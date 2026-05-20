import * as THREE from 'three';

/**
 * GPU particle system for wind-tunnel-style streamlines.
 *
 *  - N particles, each is (pos.xyz, age) packed as 4 f32s in a single storage buffer.
 *  - Compute pass advects each particle by the LBM macros 3D texture velocity field,
 *    and reseeds (random inlet position) once a particle either exceeds maxAge or
 *    leaves the lattice AABB.
 *  - Render pass draws each particle as a camera-facing billboard quad with a soft
 *    radial alpha; color comes from speed magnitude through an inferno ramp.
 *
 * Designed to render on top of Three.js's scene render. Composite via additive
 * blend so particles look like glowing smoke streaks.
 */
export class ParticleSystem {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;
  private trailFormat: GPUTextureFormat = 'rgba16float';
  private getCanvasTextureView: () => GPUTextureView;
  private getCanvasSize: () => [number, number];

  /** 70k particles → fewer, larger spheres make a smoother SSFR surface. */
  N = 70_000;

  // GPU resources
  private particleBuf!: GPUBuffer;
  private prevPosBuf!: GPUBuffer;
  private uniformBuf!: GPUBuffer;
  private sampler!: GPUSampler;

  // T1: persistent trail render target — particles accumulate here over many frames.
  private trailTex: GPUTexture | null = null;
  private trailView: GPUTextureView | null = null;
  private trailW = 0;
  private trailH = 0;

  // Particle compute + render (renders into trail RT)
  private advectPipeline!: GPUComputePipeline;
  private killInsidePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private advectBgl!: GPUBindGroupLayout;
  private renderBgl!: GPUBindGroupLayout;
  private advectBG: GPUBindGroup | null = null;
  private renderBG: GPUBindGroup | null = null;

  // T1: fade pass — multiplies trail RT by ~0.94 each frame.
  private fadePipeline!: GPURenderPipeline;

  // T2: composite pass — samples trail RT, bloom + tonemap, additive to canvas.
  private compositePipeline!: GPURenderPipeline;
  private compositeBgl!: GPUBindGroupLayout;
  private compositeBG: GPUBindGroup | null = null;
  private compositeSampler!: GPUSampler;

  private frame = 0;

  // Obstacle bound (sphere): particles entering this volume get reseeded.
  private obstacleCenter: [number, number, number] = [0, 0, 0];
  private obstacleRadius = 0;
  /** Inlet jet disc radius (fraction of cross-section), matches LBM inletR. */
  jetRadius = 0.12;
  /** Mirror of LBM3D.inlets so particle reseed picks the same inlet discs. */
  inlets: { enabled: boolean; yFrac: number; zFrac: number; radius: number }[] = [
    { enabled: true, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
    { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
    { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
    { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
  ];

  setObstacle(center: { x: number; y: number; z: number }, radius: number) {
    this.obstacleCenter = [center.x, center.y, center.z];
    this.obstacleRadius = radius;
  }

  /**
   * Kill (= mark for reseed) any particle currently inside the obstacle
   * bounding sphere. Call this exactly when the obstacle shape/position
   * changes or the user explicitly requests a flow reset — NOT every frame.
   */
  /**
   * Mark ALL particles for reseed. Used when the user clicks "Reset flow"
   * or switches obstacle shape — every particle disappears (parked off-screen
   * in a dormant state) and the inflow restarts from the inlet over the
   * next ~RESET_STAGGER_FRAMES frames.
   *
   * Encoding: ages in (maxAge, maxAge + RESET_STAGGER_FRAMES] tell the shader
   * "dormant, tick down by 1 each frame". When age crosses back to maxAge,
   * the existing reseed branch fires (non-initial, so it uses the inlet face,
   * not the tube-fill path).
   */
  resetAllParticles() {
    const MAX_AGE = 600;
    const STAGGER = 60;                                 // ~1s at 60fps
    const init = new Float32Array(this.N * 4);
    for (let i = 0; i < this.N; i++) {
      init[i * 4 + 0] = 0;
      init[i * 4 + 1] = 0;
      init[i * 4 + 2] = 0;
      // Random stagger so particles emerge from the inlet over ~1s, not all at once.
      init[i * 4 + 3] = MAX_AGE + 1 + Math.random() * STAGGER;
    }
    this.device.queue.writeBuffer(this.particleBuf, 0, init.buffer);
    // Also clear prev-pos so the next-frame motion blur quad doesn't streak
    // from a stale position.
    this.device.queue.writeBuffer(this.prevPosBuf, 0, new Float32Array(this.N * 4).buffer);
  }

  killParticlesInsideObstacle() {
    if (!this.advectBG) return;
    // Only patch the obstacle slot (bytes 208..224) — leave matrices, aabb,
    // dims and other in-flight values from the most recent advect intact.
    const obstacleData = new Float32Array([
      this.obstacleCenter[0],
      this.obstacleCenter[1],
      this.obstacleCenter[2],
      this.obstacleRadius,
    ]);
    this.device.queue.writeBuffer(this.uniformBuf, 52 * 4, obstacleData.buffer);

    const enc = this.device.createCommandEncoder({ label: 'particles-kill-inside' });
    const cp = enc.beginComputePass();
    cp.setPipeline(this.killInsidePipeline);
    cp.setBindGroup(0, this.advectBG);
    cp.dispatchWorkgroups(Math.ceil(this.N / 64));
    cp.end();
    this.device.queue.submit([enc.finish()]);
  }

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    getCanvasTextureView: () => GPUTextureView,
    getCanvasSize: () => [number, number],
  ) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.getCanvasTextureView = getCanvasTextureView;
    this.getCanvasSize = getCanvasSize;
    this.allocate();
    this.buildPipelines();
  }

  private allocate() {
    // 4 floats per particle (pos.xyz, age)
    this.particleBuf = this.device.createBuffer({
      size: this.N * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Initialize all ages > maxAge so the first compute pass reseeds them.
    const init = new Float32Array(this.N * 4);
    for (let i = 0; i < this.N; i++) {
      init[i * 4 + 0] = 0;
      init[i * 4 + 1] = 0;
      init[i * 4 + 2] = 0;
      init[i * 4 + 3] = 9999;
    }
    this.device.queue.writeBuffer(this.particleBuf, 0, init.buffer);

    // Prev-position buffer (T3 motion-blur quads). w=0 = uninitialized.
    this.prevPosBuf = this.device.createBuffer({
      size: this.N * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.prevPosBuf, 0, new Float32Array(this.N * 4).buffer);

    // Uniform layout (256 bytes):
    //   viewMat mat4x4 (64)
    //   projMat mat4x4 (64)
    //   cameraPos vec4 (16)
    //   aabbMin vec4 (16)
    //   aabbMax vec4 (16)
    //   dims vec4 (16)
    //   dt, maxAge, frameSeed, pointSize (16)
    //   pad (48)
    this.uniformBuf = this.device.createBuffer({
      size: 320,  // 256 B base + 4 × vec4 inlet entries
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge',
    });

    this.compositeSampler = this.device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
    });
  }

  /** Allocates / resizes the trail render target to match the canvas. */
  private ensureTrailTex(w: number, h: number) {
    if (this.trailTex && this.trailW === w && this.trailH === h) return;
    this.trailTex?.destroy();
    this.trailTex = this.device.createTexture({
      label: 'particles-trail',
      size: [w, h],
      format: this.trailFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.trailView = this.trailTex.createView();
    this.trailW = w;
    this.trailH = h;
    this.compositeBG = null;   // rebuild composite bind group with new view
  }

  private buildPipelines() {
    const advectModule = this.device.createShaderModule({ code: ADVECT_WGSL, label: 'particles-advect' });
    const renderModule = this.device.createShaderModule({ code: RENDER_WGSL, label: 'particles-render' });

    this.advectBgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        // Solid mask (binding 5) — read-only — so the substep advect can
        // detect when a sub-step would enter the obstacle and reseed instead
        // of tunneling through.
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.renderBgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.advectPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.advectBgl] }),
      compute: { module: advectModule, entryPoint: 'cs_advect' },
    });

    this.killInsidePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.advectBgl] }),
      compute: { module: advectModule, entryPoint: 'cs_kill_inside' },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.renderBgl] }),
      vertex: { module: renderModule, entryPoint: 'vs_main' },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_main',
        targets: [{
          // T1: render into the trail RT (HDR, rgba16float) instead of the canvas.
          format: this.trailFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // T1 fade pipeline: fullscreen quad, blend = (zero, constant) → multiplies trail by fadeFactor.
    const fadeModule = this.device.createShaderModule({ code: FADE_WGSL, label: 'particles-fade' });
    this.fadePipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: fadeModule, entryPoint: 'vs_full' },
      fragment: {
        module: fadeModule,
        entryPoint: 'fs_fade',
        targets: [{
          format: this.trailFormat,
          blend: {
            color: { srcFactor: 'zero', dstFactor: 'constant', operation: 'add' },
            alpha: { srcFactor: 'zero', dstFactor: 'constant', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // T2 composite pipeline: samples trail, bloom + Reinhard tonemap, additive onto canvas.
    const compositeModule = this.device.createShaderModule({ code: COMPOSITE_WGSL, label: 'particles-composite' });
    this.compositeBgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    this.compositePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.compositeBgl] }),
      vertex: { module: compositeModule, entryPoint: 'vs_full' },
      fragment: {
        module: compositeModule,
        entryPoint: 'fs_composite',
        targets: [{
          format: this.canvasFormat,
          // Alpha-over blend: semi-transparent fluid surface overlays the scene.
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /** Expose the particle position buffer so external renderers (e.g. SSFR) can read it. */
  getParticleBuffer(): GPUBuffer { return this.particleBuf; }

  /** Run the advect compute pass only — no canvas/trail rendering. */
  advectOnly(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    camPos: THREE.Vector3,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    dims: { W: number; H: number; D: number },
    options: { dt?: number; maxAge?: number; pointSize?: number } = {},
  ) {
    if (!this.advectBG) return;
    const { dt = 6.0, maxAge = 600, pointSize = 0.014 } = options;
    this.writeUniforms(view, proj, camPos, aabbMin, aabbMax, dims, dt, maxAge, pointSize);
    const enc = this.device.createCommandEncoder({ label: 'particles-advect-only' });
    const cp = enc.beginComputePass();
    cp.setPipeline(this.advectPipeline);
    cp.setBindGroup(0, this.advectBG);
    cp.dispatchWorkgroups(Math.ceil(this.N / 64));
    cp.end();
    this.device.queue.submit([enc.finish()]);
  }

  /**
   * (Re)bind the macros texture + the LBM solid mask buffer. The mask is
   * consulted inside `cs_advect` so particles can't tunnel through the
   * voxelised obstacle: any substep that would land in a solid cell flips
   * needsReseed instead of moving the particle.
   */
  setMacrosTexture(macrosView: GPUTextureView, maskBuf?: GPUBuffer) {
    // Fall back to a 1-cell dummy mask if no mask buffer is supplied — keeps
    // the bind group valid before the LBM is fully set up.
    let mb = maskBuf;
    if (!mb) {
      if (!this._dummyMaskBuf) {
        this._dummyMaskBuf = this.device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this._dummyMaskBuf, 0, new Uint32Array([0, 0, 0, 0]).buffer);
      }
      mb = this._dummyMaskBuf;
    }
    this.advectBG = this.device.createBindGroup({
      layout: this.advectBgl,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.particleBuf } },
        { binding: 2, resource: macrosView },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: { buffer: this.prevPosBuf } },
        { binding: 5, resource: { buffer: mb } },
      ],
    });
    this.renderBG = this.device.createBindGroup({
      layout: this.renderBgl,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.particleBuf } },
        { binding: 2, resource: macrosView },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: { buffer: this.prevPosBuf } },
      ],
    });
  }
  private _dummyMaskBuf: GPUBuffer | null = null;

  private writeUniforms(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    camPos: THREE.Vector3,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    dims: { W: number; H: number; D: number },
    dt: number,
    maxAge: number,
    pointSize: number,
  ) {
    const buf = new Float32Array(80);
    buf.set(view.elements, 0);
    buf.set(proj.elements, 16);
    buf[32] = camPos.x; buf[33] = camPos.y; buf[34] = camPos.z; buf[35] = 1;
    buf[36] = aabbMin.x; buf[37] = aabbMin.y; buf[38] = aabbMin.z; buf[39] = 0;
    buf[40] = aabbMax.x; buf[41] = aabbMax.y; buf[42] = aabbMax.z; buf[43] = 0;
    buf[44] = dims.W; buf[45] = dims.H; buf[46] = dims.D; buf[47] = 0;
    buf[48] = dt; buf[49] = maxAge; buf[50] = this.frame; buf[51] = pointSize;
    // Obstacle bound: center.xyz, radius.
    buf[52] = this.obstacleCenter[0];
    buf[53] = this.obstacleCenter[1];
    buf[54] = this.obstacleCenter[2];
    buf[55] = this.obstacleRadius;
    // Extras: jetRadius then 3 pads.
    buf[56] = this.jetRadius;
    buf[57] = 0; buf[58] = 0; buf[59] = 0;
    // Inlets [4] × vec4(yFrac, zFrac, radius, enabled)
    for (let k = 0; k < 4; k++) {
      const i = this.inlets[k] ?? { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0 };
      const base = 60 + k * 4;
      buf[base + 0] = i.yFrac;
      buf[base + 1] = i.zFrac;
      buf[base + 2] = i.radius;
      buf[base + 3] = i.enabled ? 1.0 : 0.0;
    }
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf.buffer);
    this.frame++;
  }

  /**
   * Three-pass pipeline:
   *   1. fade trail RT by 0.94 (multiplicative blend)
   *   2. advect compute + draw particles into trail RT (additive)
   *   3. composite trail → canvas (bloom + Reinhard tonemap, additive)
   */
  step(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    camPos: THREE.Vector3,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    dims: { W: number; H: number; D: number },
    options: { dt?: number; maxAge?: number; pointSize?: number; fade?: number } = {},
  ) {
    if (!this.advectBG || !this.renderBG) return;
    const { dt = 6.0, maxAge = 600, pointSize = 0.014, fade = 0.70 } = options;
    this.writeUniforms(view, proj, camPos, aabbMin, aabbMax, dims, dt, maxAge, pointSize);

    // Ensure trail RT sized to canvas.
    const [cw, ch] = this.getCanvasSize();
    if (cw <= 0 || ch <= 0) return;
    this.ensureTrailTex(cw, ch);
    if (!this.trailView) return;

    // Build composite bind group once per trail RT lifetime.
    if (!this.compositeBG) {
      this.compositeBG = this.device.createBindGroup({
        layout: this.compositeBgl,
        entries: [
          { binding: 0, resource: this.trailView },
          { binding: 1, resource: this.compositeSampler },
        ],
      });
    }

    const enc = this.device.createCommandEncoder({ label: 'particles' });

    // (1) Fade the trail RT by the multiplicative blend constant.
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: this.trailView, loadOp: 'load', storeOp: 'store' }],
      });
      rp.setPipeline(this.fadePipeline);
      rp.setBlendConstant({ r: fade, g: fade, b: fade, a: fade });
      rp.draw(3);
      rp.end();
    }

    // (2) Compute advect.
    {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.advectPipeline);
      cp.setBindGroup(0, this.advectBG);
      cp.dispatchWorkgroups(Math.ceil(this.N / 64));
      cp.end();
    }

    // (2b) Draw particles into the trail RT additively.
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: this.trailView, loadOp: 'load', storeOp: 'store' }],
      });
      rp.setPipeline(this.renderPipeline);
      rp.setBindGroup(0, this.renderBG);
      rp.draw(6 * this.N, 1, 0, 0);
      rp.end();
    }

    // (3) Composite trail → canvas with bloom + tonemap.
    {
      const canvasView = this.getCanvasTextureView();
      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
      });
      rp.setPipeline(this.compositePipeline);
      rp.setBindGroup(0, this.compositeBG);
      rp.draw(3);
      rp.end();
    }

    this.device.queue.submit([enc.finish()]);
  }

  dispose() {
    this.particleBuf?.destroy();
    this.prevPosBuf?.destroy();
    this.uniformBuf?.destroy();
    this.trailTex?.destroy();
  }
}

const COMMON_WGSL = /* wgsl */`
struct Uniforms {
  viewMat   : mat4x4<f32>,
  projMat   : mat4x4<f32>,
  cameraPos : vec4<f32>,
  aabbMin   : vec4<f32>,
  aabbMax   : vec4<f32>,
  dims      : vec4<f32>,        // W, H, D, _
  params    : vec4<f32>,        // dt, maxAge, frameSeed, pointSize
  obstacle  : vec4<f32>,        // centerX, centerY, centerZ, radius
  extras    : vec4<f32>,        // jetRadius (legacy single-inlet), pad, pad, pad
  inlets    : array<vec4<f32>, 4>,  // (yFrac, zFrac, radius, enabledMask) per inlet
};

fn hash11(n : f32) -> f32 {
  return fract(sin(n * 12.9898) * 43758.5453);
}
fn hash31(seed : f32, i : u32) -> vec3<f32> {
  return vec3(
    hash11(f32(i) * 0.103 + seed * 1.31),
    hash11(f32(i) * 0.217 + seed * 0.71),
    hash11(f32(i) * 0.319 + seed * 1.93),
  );
}

// ---- value noise + curl noise (Bridson 2007 style turbulence injection) ----
// Cheap hashed value noise: 3D trilinear interpolation of per-corner hashes.
fn hash13(p : vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}

fn vnoise(p : vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  let n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  let n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  let n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  let n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  let n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  let n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  let nx00 = mix(n000, n100, u.x);
  let nx10 = mix(n010, n110, u.x);
  let nx01 = mix(n001, n101, u.x);
  let nx11 = mix(n011, n111, u.x);
  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;   // remap to [-1, 1]
}

// Vector potential: three decorrelated noise fields. Curl of this is
// divergence-free, so adding it to a flow doesn't pump mass anywhere.
fn potential(p : vec3<f32>) -> vec3<f32> {
  return vec3(
    vnoise(p),
    vnoise(p + vec3(31.41, 91.72, 17.83)),
    vnoise(p + vec3(67.19, 23.55, 81.13)),
  );
}

// Divergence-free curl noise at point p. Output is the velocity perturbation.
fn curlNoise(p : vec3<f32>) -> vec3<f32> {
  let eps = 0.6;
  let dx = vec3(eps, 0.0, 0.0);
  let dy = vec3(0.0, eps, 0.0);
  let dz = vec3(0.0, 0.0, eps);
  let p_xp = potential(p + dx);
  let p_xn = potential(p - dx);
  let p_yp = potential(p + dy);
  let p_yn = potential(p - dy);
  let p_zp = potential(p + dz);
  let p_zn = potential(p - dz);
  let curlX = (p_yp.z - p_yn.z) - (p_zp.y - p_zn.y);
  let curlY = (p_zp.x - p_zn.x) - (p_xp.z - p_xn.z);
  let curlZ = (p_xp.y - p_xn.y) - (p_yp.x - p_yn.x);
  return vec3(curlX, curlY, curlZ) / (2.0 * eps);
}

// Two-octave curl noise: large + small structures stacked for fractal detail.
fn curlNoiseFbm(p : vec3<f32>, t : f32) -> vec3<f32> {
  let pAnim = p + vec3(t * 0.07, t * 0.03, -t * 0.05);
  let big   = curlNoise(pAnim * 0.7);
  let small = curlNoise(pAnim * 2.3 + vec3(11.0, 7.0, 3.0)) * 0.45;
  return big + small;
}

// Cold "frost" palette: deep navy → royal blue → ice cyan → frost white → pale lavender.
// Stays in cyan-blue-white range, no warm tones — feels like cryogenic wind tunnel.
fn turbo(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3(0.02, 0.05, 0.18);   // abyssal navy
  let c1 = vec3(0.08, 0.22, 0.65);   // deep ocean blue
  let c2 = vec3(0.15, 0.55, 1.00);   // electric blue
  let c3 = vec3(0.35, 0.92, 1.10);   // ice cyan
  let c4 = vec3(0.85, 0.98, 1.10);   // frost white
  let c5 = vec3(0.85, 0.80, 1.15);   // pale lavender pop
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

// Cheap vorticity proxy: how much the velocity field bends across a small
// stencil. High when streamlines curl (wake / shear layer), low in laminar flow.
fn vorticityMag(macrosTex : texture_3d<f32>, samp : sampler, uvw : vec3<f32>, dims : vec3<f32>) -> f32 {
  let h = 1.5 / dims;
  let vxp = textureSampleLevel(macrosTex, samp, uvw + vec3(h.x, 0.0, 0.0), 0.0).xyz;
  let vxn = textureSampleLevel(macrosTex, samp, uvw - vec3(h.x, 0.0, 0.0), 0.0).xyz;
  let vyp = textureSampleLevel(macrosTex, samp, uvw + vec3(0.0, h.y, 0.0), 0.0).xyz;
  let vyn = textureSampleLevel(macrosTex, samp, uvw - vec3(0.0, h.y, 0.0), 0.0).xyz;
  let vzp = textureSampleLevel(macrosTex, samp, uvw + vec3(0.0, 0.0, h.z), 0.0).xyz;
  let vzn = textureSampleLevel(macrosTex, samp, uvw - vec3(0.0, 0.0, h.z), 0.0).xyz;
  let curlX = (vyp.z - vyn.z) - (vzp.y - vzn.y);
  let curlY = (vzp.x - vzn.x) - (vxp.z - vxn.z);
  let curlZ = (vxp.y - vxn.y) - (vyp.x - vyn.x);
  return length(vec3(curlX, curlY, curlZ));
}
`;

const ADVECT_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read_write> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;
@group(0) @binding(4) var<storage, read_write> prevPos : array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> solidMask : array<u32>;

const INVALID : f32 = 9999.0;

@compute @workgroup_size(64)
fn cs_advect(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= arrayLength(&particles) { return; }

  var p = particles[idx];
  let oldPos = p.xyz;
  let prevValid = prevPos[idx].w;
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let dt = u.params.x;
  let maxAge = u.params.y;
  let seed = u.params.z;

  var needsReseed : bool = p.w >= maxAge;
  if !needsReseed {
    // Multi-step advection (T4): 8 sub-steps of dt/8 per frame. This resolves
    // curved flow paths around the obstacle cleanly instead of smearing.
    // The obstacle-inside check runs in a separate one-shot compute pass
    // (killInsideObstacle) only when the shape changes or the user resets,
    // not every frame.
    let SUBSTEPS = 8;
    let subDt = dt / f32(SUBSTEPS);
    var pos = p.xyz;
    var exited = false;
    let W = u32(u.dims.x);
    let H = u32(u.dims.y);
    let D = u32(u.dims.z);
    for (var k = 0; k < SUBSTEPS; k = k + 1) {
      let uvwSub = (pos - aabbMin) / aabbSize;
      if any(uvwSub < vec3(0.0)) || any(uvwSub > vec3(1.0)) {
        exited = true;
        break;
      }
      // ANTI-TUNNELING: read the LBM solid mask at this cell. If we would
      // step into a solid voxel, abort the substep loop and reseed — the
      // particle has hit the obstacle wall.
      let xi = u32(clamp(uvwSub.x * f32(W), 0.0, f32(W - 1u)));
      let yi = u32(clamp(uvwSub.y * f32(H), 0.0, f32(H - 1u)));
      let zi = u32(clamp(uvwSub.z * f32(D), 0.0, f32(D - 1u)));
      let cellIdx = xi + yi * W + zi * W * H;
      if (solidMask[cellIdx] == 1u) {
        exited = true;
        break;
      }
      let macros = textureSampleLevel(macrosTex, samp, uvwSub, 0.0);
      let cellSize = aabbSize / u.dims.xyz;
      let vel_world = macros.xyz * cellSize;
      // Lagrangian-stochastic diffusive kick (Pope, "Turbulent Flows" §12.3).
      // Real flows break tracer "strings" through molecular + turbulent
      // diffusion; without it every particle follows its streamline forever
      // and the inlet emission renders as a comb of beaded paths. A small
      // isotropic random walk (~0.08 cells per substep ⇒ ~0.6 cells/frame
      // RMS over 8 substeps) restores the natural smoke-plume look.
      let noiseSeed = seed + f32(idx) * 0.137 + f32(k) * 1.713;
      let nx = hash11(noiseSeed * 1.93) - 0.5;
      let ny = hash11(noiseSeed * 1.13 + 0.7) - 0.5;
      let nz = hash11(noiseSeed * 0.71 + 1.3) - 0.5;
      let noise = vec3<f32>(nx, ny, nz) * cellSize * 0.16;
      pos = pos + vel_world * subDt + noise;
    }
    if exited {
      needsReseed = true;
    } else {
      // Age tick: dt/6 means a stuck particle in an eddy still ages out within
      // ~maxAge/(dt/6) frames — about 10 s at simSpeed=1 — so the inlet pool
      // keeps cycling even when downstream flow stalls behind the obstacle.
      p = vec4(pos, p.w + dt / 6.0);
    }
  }

  if needsReseed {
    // Reset-dormant state: ages in (maxAge, maxAge + 200] mean "user just hit
    // Reset flow / switched shape — disappear and wait, then re-emit from the
    // inlet over the next ~stagger frames." We tick the age DOWN by 1.0 each
    // frame; once it crosses maxAge the normal (non-initial) reseed branch
    // below fires on the next pass.
    let isInitialSeed : bool = p.w > 9000.0;
    if !isInitialSeed && p.w > maxAge + 0.5 && p.w < 9000.0 {
      let newAge = p.w - 1.0;
      // Park the particle off-screen (well outside the AABB on the -X side)
      // so the sphere renderer's clip kills it. Spheres are world-space points
      // transformed by view/proj — anything off-screen is just gone.
      let off = vec3(aabbMin.x - aabbSize.x * 2.0, 0.0, 0.0);
      particles[idx] = vec4(off, newAge);
      prevPos[idx] = vec4(off, 0.0);
      return;
    }

    let r = hash31(seed, idx);
    // Multi-inlet selection: pick an enabled inlet weighted by area (radius²),
    // then sample uniformly inside its disc. Fallback to the legacy single-jet
    // (centered, u.extras.x radius) when no inlet is enabled (should never
    // happen in practice but keeps the shader well-defined).
    var totalArea : f32 = 0.0;
    for (var k = 0u; k < 4u; k = k + 1u) {
      if (u.inlets[k].w >= 0.5) {
        totalArea = totalArea + u.inlets[k].z * u.inlets[k].z;
      }
    }
    // No inlets enabled at all? Park the particle off-screen and don't reseed
    // — the alternative (puffing from the centre) makes the inlet plate look
    // active when the LBM is correctly emitting nothing.
    if (totalArea <= 0.0) {
      let off = vec3(aabbMin.x - aabbSize.x * 2.0, 0.0, 0.0);
      particles[idx] = vec4(off, maxAge - 1.0);  // stay below maxAge so we don't keep retrying
      prevPos[idx] = vec4(off, 0.0);
      return;
    }
    var pickYFrac : f32 = 0.5;
    var pickZFrac : f32 = 0.5;
    var pickR     : f32 = u.extras.x;
    {
      let r_pick = r.x * totalArea;
      var cum : f32 = 0.0;
      for (var k = 0u; k < 4u; k = k + 1u) {
        if (u.inlets[k].w < 0.5) { continue; }
        cum = cum + u.inlets[k].z * u.inlets[k].z;
        if (cum >= r_pick) {
          pickYFrac = u.inlets[k].x;
          pickZFrac = u.inlets[k].y;
          pickR     = u.inlets[k].z;
          break;
        }
      }
    }
    // r.x was consumed picking the inlet; use r.y/r.z (still uniform) for
    // the disc sample, plus a freshly-hashed angle.
    let theta = hash11(seed * 13.0 + f32(idx) * 0.7) * 6.2831853;
    let radius = sqrt(r.y) * pickR;
    let dy = radius * cos(theta);
    let dz = radius * sin(theta);
    let jetY = aabbMin.y + pickYFrac * aabbSize.y + dy * aabbSize.y;
    let jetZ = aabbMin.z + pickZFrac * aabbSize.z + dz * aabbSize.z;

    // First-time seed (age set to 9999 on JS init) — distribute along the jet
    // tube length so the volume looks populated immediately. Subsequent reseeds
    // come back to the inlet face.
    // Decohere reseed cohorts: mix the per-frame seed with idx and an extra
    // hash to break the "every particle's k-th reseed lands at the same age"
    // pattern that creates pulsing emission rings.
    let ageHash = hash11(f32(idx) * 0.41 + seed * 1.71 + hash11(f32(idx) * 0.137) * 31.4);
    if isInitialSeed {
      p = vec4(
        aabbMin.x + r.z * aabbSize.x,
        jetY,
        jetZ,
        ageHash * maxAge * 0.95,
      );
    } else {
      // Reseed in a FAT slab (10 % of tube length), not a sheet. The previous
      // 1 % slab made every emerging cohort look like a "ball at the inlet
      // centre" — all particles at almost the same x, with only the
      // jet-disc y/z variation. Spreading the x jitter over ~10 % means the
      // emerging fluid looks like a stream, not a frame-by-frame puff.
      // Combined with the decohered ageHash this gives a steady plume.
      let inletX = aabbMin.x + 0.02 * aabbSize.x;
      let xJitter = r.z * 0.10 * aabbSize.x;
      // Use a fresh hash for the in-slab age so newly-emerging particles
      // inherit a uniform age distribution and don't all "catch up" at once.
      let inSlabAge = ageHash * (maxAge - 1.0);
      p = vec4(
        inletX + xJitter,
        jetY,
        jetZ,
        inSlabAge,
      );
    }
  }

  particles[idx] = p;

  // T3: save prev_pos for next-frame motion-blur quad.
  // On reseed (or uninitialized), set prev = current so the quad collapses to a dot
  // rather than streaking from origin.
  let didReseed = needsReseed;
  let usePrev = select(p.xyz, oldPos, prevValid > 0.5 && !didReseed);
  prevPos[idx] = vec4(usePrev, 1.0);
}

// One-shot pass — invoked when the obstacle shape changes or the user clicks
// "Reset flow". Marks any particle inside the obstacle bounding sphere for
// reseed; the next normal advect step does the actual reseed via existing
// "age >= maxAge" logic.
@compute @workgroup_size(64)
fn cs_kill_inside(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= arrayLength(&particles) { return; }
  let r2 = u.obstacle.w * u.obstacle.w;
  if r2 <= 0.0 { return; }
  let p = particles[idx];
  let d = p.xyz - u.obstacle.xyz;
  if dot(d, d) < r2 {
    particles[idx] = vec4(p.xyz, 9999.0);
    prevPos[idx]   = vec4(p.xyz, 0.0);
  }
}
`;

const RENDER_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;
@group(0) @binding(4) var<storage, read> prevPos : array<vec4<f32>>;

struct VertOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) localUv   : vec2<f32>,
  @location(1) speed     : f32,
  @location(2) ageFrac   : f32,
  @location(3) vort      : f32,
  @location(4) sizeScale : f32,
};

// Quad-vertex offsets (two triangles forming a centered quad)
const QUAD_OFF = array<vec2<f32>, 6>(
  vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0),
  vec2(-1.0, -1.0), vec2( 1.0,  1.0), vec2(-1.0,  1.0),
);

@vertex
fn vs_main(@builtin(vertex_index) vi : u32) -> VertOut {
  let particleIdx = vi / 6u;
  let vIdx = vi % 6u;
  let p = particles[particleIdx];
  let prev = prevPos[particleIdx].xyz;
  let curr = p.xyz;
  let mid  = (prev + curr) * 0.5;
  let dPos = curr - prev;
  let dLen = length(dPos);

  // Sample velocity at the midpoint for color/intensity.
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let uvw = clamp((mid - aabbMin) / aabbSize, vec3(0.0), vec3(1.0));
  let macros = textureSampleLevel(macrosTex, samp, uvw, 0.0);
  let speed = length(macros.xyz);

  // Per-particle hash drives stable hue variation between neighbors.
  let vort = hash11(f32(particleIdx) * 0.137);
  let speedN = clamp(speed / 0.18, 0.0, 1.0);
  let vortN  = vort;

  // Build streak basis aligned with the prev→curr motion vector. When the
  // particle is nearly stationary, blend to a camera-facing dot.
  let camRight = vec3(u.viewMat[0][0], u.viewMat[1][0], u.viewMat[2][0]);
  let camUp    = vec3(u.viewMat[0][1], u.viewMat[1][1], u.viewMat[2][1]);
  let viewDir  = normalize(mid - u.cameraPos.xyz);

  let motionDir = select(camRight, dPos / max(dLen, 1e-6), dLen > 1e-6);
  let perpRaw = cross(motionDir, viewDir);
  let perpLen = length(perpRaw);
  let perpAxis = select(camUp, perpRaw / max(perpLen, 1e-6), perpLen > 1e-4);
  let streakAxis = normalize(cross(viewDir, perpAxis));

  // Fluid surface mode: render each particle as a round metaball-style blob.
  // No streak elongation — particles fuse into a cohesive fluid mass.
  let rad = u.params.w * 0.7 * (0.85 + 0.4 * speedN);

  let off = QUAD_OFF[vIdx];
  let worldPos = mid
    + streakAxis * (off.x * rad)
    + perpAxis   * (off.y * rad);

  var out : VertOut;
  out.pos = u.projMat * u.viewMat * vec4(worldPos, 1.0);
  out.localUv = QUAD_OFF[vIdx];
  out.speed = speed;
  out.ageFrac = clamp(p.w / max(u.params.y, 1.0), 0.0, 1.0);
  out.vort = vort;
  out.sizeScale = rad;
  return out;
}

@fragment
fn fs_main(in : VertOut) -> @location(0) vec4<f32> {
  // Smooth gaussian disc → particles fuse into a cohesive fluid mass.
  let r2 = dot(in.localUv, in.localUv);
  if r2 > 1.0 { discard; }

  // Metaball falloff: bright dense center, smooth zero at edge.
  let density = exp(-r2 * 2.5);

  let speedN = clamp(in.speed / 0.16, 0.0, 1.0);

  // Output RGB = a velocity-tinted color, A = thickness contribution.
  // Per-particle thickness is small — fluid mass builds via overlap density.
  let col = turbo(0.25 + speedN * 0.7);
  let lifeFade = 1.0 - in.ageFrac * 0.45;
  let thickness = density * 0.04 * lifeFade;

  return vec4(col * thickness, thickness);
}
`;

// T1 fade pass: fullscreen quad that, combined with blend = (zero, constant),
// multiplies the trail RT in place by the blend constant.
const FADE_WGSL = /* wgsl */`
@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4<f32> {
  // Single fullscreen triangle (saves one vertex over a quad).
  let pos = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0), vec2( 3.0, -1.0), vec2(-1.0,  3.0),
  );
  return vec4(pos[vi], 0.0, 1.0);
}
@fragment
fn fs_fade() -> @location(0) vec4<f32> {
  // Output value is irrelevant — blend = (zero, constant) ignores src color
  // and multiplies dst by the per-pass blend constant set on the encoder.
  return vec4(1.0);
}
`;

// T2 composite pass: reads trail RT, applies a cheap bloom + Reinhard tonemap,
// outputs additively to the canvas (so Three.js scene shows through).
const COMPOSITE_WGSL = /* wgsl */`
@group(0) @binding(0) var trail : texture_2d<f32>;
@group(0) @binding(1) var trailSamp : sampler;

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4<f32> {
  let pos = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0), vec2( 3.0, -1.0), vec2(-1.0,  3.0),
  );
  return vec4(pos[vi], 0.0, 1.0);
}

// Sample thickness (alpha channel of accumulated trail RT).
fn thickness(uv : vec2<f32>) -> f32 {
  return textureSampleLevel(trail, trailSamp, uv, 0.0).a;
}

// Multi-tap box-blurred thickness — smooths individual particle bumps into a
// cohesive fluid surface. Cheaper than a separable gaussian for this use.
fn thicknessBlur(uv : vec2<f32>, texel : vec2<f32>) -> f32 {
  var sum = 0.0;
  let R = 4.0;
  // 13-tap symmetric kernel — gives a smooth circular blur footprint.
  sum += thickness(uv) * 0.20;
  sum += thickness(uv + vec2( R,  0.0) * texel) * 0.10;
  sum += thickness(uv + vec2(-R,  0.0) * texel) * 0.10;
  sum += thickness(uv + vec2( 0.0,  R) * texel) * 0.10;
  sum += thickness(uv + vec2( 0.0, -R) * texel) * 0.10;
  sum += thickness(uv + vec2( R,  R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2( R, -R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2(-R,  R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2(-R, -R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2( 2.0*R,  0.0) * texel) * 0.03;
  sum += thickness(uv + vec2(-2.0*R,  0.0) * texel) * 0.03;
  sum += thickness(uv + vec2( 0.0,  2.0*R) * texel) * 0.03;
  sum += thickness(uv + vec2( 0.0, -2.0*R) * texel) * 0.03;
  return sum;
}

@fragment
fn fs_composite(@builtin(position) fragPos : vec4<f32>) -> @location(0) vec4<f32> {
  let dims = vec2<f32>(textureDimensions(trail, 0));
  let uv = fragPos.xy / dims;
  let texel = 1.0 / dims;

  let s = textureSampleLevel(trail, trailSamp, uv, 0.0);
  let centerRGB = s.rgb;

  // Use the BLURRED thickness so the fluid reads as a smooth surface, not bumps.
  let centerThick = thicknessBlur(uv, texel);

  if centerThick < 0.04 {
    // No fluid here — let the scene show through unchanged.
    discard;
  }

  // Reconstruct a screen-space normal from blurred thickness gradient.
  // Wider sample radius → softer, sheet-like surface.
  let h = 6.0;
  let tL = thicknessBlur(uv + vec2(-h, 0.0) * texel, texel);
  let tR = thicknessBlur(uv + vec2( h, 0.0) * texel, texel);
  let tD = thicknessBlur(uv + vec2(0.0,-h) * texel, texel);
  let tU = thicknessBlur(uv + vec2(0.0, h) * texel, texel);
  let dx = (tR - tL);
  let dy = (tU - tD);
  // Surface "pokes out" toward camera where thickness is high. Normal slopes
  // away from regions where neighbors are thicker.
  let normal = normalize(vec3(-dx * 14.0, -dy * 14.0, 0.7));

  // View vector — assume orthographic looking down -Z. (Good enough for screen-space.)
  let V = vec3(0.0, 0.0, 1.0);
  // Key light from upper-left, like an icy interior overhead.
  let L = normalize(vec3(-0.4, 0.6, 0.8));
  let H = normalize(L + V);

  // Fresnel: edges of the fluid surface get more reflective/lighter than the body.
  let NdotV = clamp(dot(normal, V), 0.0, 1.0);
  let fresnel = pow(1.0 - NdotV, 4.0);

  // Specular highlight — sharp icy glint.
  let NdotH = clamp(dot(normal, H), 0.0, 1.0);
  let spec  = pow(NdotH, 90.0) * 1.4;

  // Diffuse — softens the look so the fluid isn't pure highlights.
  let NdotL = clamp(dot(normal, L) * 0.5 + 0.5, 0.0, 1.0);

  // Body color: cool blue tint deepening with thickness (Beer-Lambert style).
  let deepCol = vec3(0.06, 0.30, 0.60);
  let shallowCol = vec3(0.55, 0.85, 1.10);
  let absorption = exp(-centerThick * 2.5);
  let bodyCol = mix(deepCol, shallowCol, absorption);

  // Refraction wobble: sample trail at a normal-offset for inner detail.
  let refractOff = normal.xy * centerThick * 0.04;
  let inner = textureSampleLevel(trail, trailSamp, uv + refractOff, 0.0).rgb;

  // Compose: refracted inner color × diffuse + fresnel-mixed highlight + specular.
  let surfaceCol = mix(bodyCol * NdotL, vec3(0.9, 0.97, 1.10), fresnel * 0.85)
                   + vec3(spec)
                   + inner * 0.35;

  // Output alpha — translucency grows with thickness; thin edges are barely visible.
  let alpha = clamp(centerThick * 4.5 + fresnel * 0.4, 0.0, 0.95);

  return vec4(surfaceCol, alpha);
}
`;
