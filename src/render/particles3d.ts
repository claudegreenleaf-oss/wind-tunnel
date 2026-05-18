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
  private getCanvasTextureView: () => GPUTextureView;

  /** Total particles. ~200k is plenty for an obvious wind-tunnel feel and runs at 60fps. */
  N = 200_000;

  // GPU resources
  private particleBuf!: GPUBuffer;
  private uniformBuf!: GPUBuffer;
  private sampler!: GPUSampler;

  private advectPipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private advectBgl!: GPUBindGroupLayout;
  private renderBgl!: GPUBindGroupLayout;
  private advectBG: GPUBindGroup | null = null;
  private renderBG: GPUBindGroup | null = null;

  private frame = 0;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    getCanvasTextureView: () => GPUTextureView,
  ) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.getCanvasTextureView = getCanvasTextureView;
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
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge',
    });
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
      ],
    });

    this.renderBgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, sampler: { type: 'filtering' } },
      ],
    });

    this.advectPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.advectBgl] }),
      compute: { module: advectModule, entryPoint: 'cs_advect' },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.renderBgl] }),
      vertex: { module: renderModule, entryPoint: 'vs_main' },
      fragment: {
        module: renderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.canvasFormat,
          // Additive blend → particles glow on top of the existing canvas
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  setMacrosTexture(macrosView: GPUTextureView) {
    this.advectBG = this.device.createBindGroup({
      layout: this.advectBgl,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.particleBuf } },
        { binding: 2, resource: macrosView },
        { binding: 3, resource: this.sampler },
      ],
    });
    this.renderBG = this.device.createBindGroup({
      layout: this.renderBgl,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.particleBuf } },
        { binding: 2, resource: macrosView },
        { binding: 3, resource: this.sampler },
      ],
    });
  }

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
    const buf = new Float32Array(64);
    buf.set(view.elements, 0);
    buf.set(proj.elements, 16);
    buf[32] = camPos.x; buf[33] = camPos.y; buf[34] = camPos.z; buf[35] = 1;
    buf[36] = aabbMin.x; buf[37] = aabbMin.y; buf[38] = aabbMin.z; buf[39] = 0;
    buf[40] = aabbMax.x; buf[41] = aabbMax.y; buf[42] = aabbMax.z; buf[43] = 0;
    buf[44] = dims.W; buf[45] = dims.H; buf[46] = dims.D; buf[47] = 0;
    buf[48] = dt; buf[49] = maxAge; buf[50] = this.frame; buf[51] = pointSize;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf.buffer);
    this.frame++;
  }

  /** Advect particles + render in one combined command buffer. */
  step(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    camPos: THREE.Vector3,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    dims: { W: number; H: number; D: number },
    options: { dt?: number; maxAge?: number; pointSize?: number } = {},
  ) {
    if (!this.advectBG || !this.renderBG) return;
    const { dt = 6.0, maxAge = 600, pointSize = 0.012 } = options;
    this.writeUniforms(view, proj, camPos, aabbMin, aabbMax, dims, dt, maxAge, pointSize);

    const enc = this.device.createCommandEncoder({ label: 'particles' });

    // Compute pass: advect
    const cp = enc.beginComputePass();
    cp.setPipeline(this.advectPipeline);
    cp.setBindGroup(0, this.advectBG);
    cp.dispatchWorkgroups(Math.ceil(this.N / 64));
    cp.end();

    // Render pass: draw billboards. Load existing canvas contents.
    const canvasView = this.getCanvasTextureView();
    const rp = enc.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });
    rp.setPipeline(this.renderPipeline);
    rp.setBindGroup(0, this.renderBG);
    // 6 vertices per particle (two triangles forming a quad)
    rp.draw(6 * this.N, 1, 0, 0);
    rp.end();

    this.device.queue.submit([enc.finish()]);
  }

  dispose() {
    this.particleBuf?.destroy();
    this.uniformBuf?.destroy();
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

fn inferno(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3(0.04, 0.05, 0.20);
  let c1 = vec3(0.55, 0.06, 0.55);
  let c2 = vec3(1.00, 0.40, 0.30);
  let c3 = vec3(1.00, 0.92, 0.55);
  if tt < 0.33 { return mix(c0, c1, tt * 3.0); }
  if tt < 0.66 { return mix(c1, c2, (tt - 0.33) * 3.0); }
  return mix(c2, c3, (tt - 0.66) * 3.0);
}
`;

const ADVECT_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read_write> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;

const INVALID : f32 = 9999.0;

@compute @workgroup_size(64)
fn cs_advect(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= arrayLength(&particles) { return; }

  var p = particles[idx];
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let dt = u.params.x;
  let maxAge = u.params.y;
  let seed = u.params.z;

  var needsReseed : bool = p.w >= maxAge;
  if !needsReseed {
    let uvw = (p.xyz - aabbMin) / aabbSize;
    if any(uvw < vec3(0.0)) || any(uvw > vec3(1.0)) {
      needsReseed = true;
    } else {
      // Advect by velocity field. macros.xyz is in lattice units; scale to world.
      let macros = textureSampleLevel(macrosTex, samp, uvw, 0.0);
      let vel_world = macros.xyz * (aabbSize / u.dims.xyz);
      p = vec4(p.xyz + vel_world * dt, p.w + dt / 60.0);
    }
  }

  if needsReseed {
    let r = hash31(seed, idx);
    // Seed in a small slab right inside the inlet
    let inletX = aabbMin.x + 0.02 * aabbSize.x;
    p = vec4(
      inletX + r.x * 0.005 * aabbSize.x,
      aabbMin.y + r.y * aabbSize.y,
      aabbMin.z + r.z * aabbSize.z,
      hash11(f32(idx) * 0.41 + seed) * maxAge * 0.6,  // staggered age so particles don't all reseed in sync
    );
  }

  particles[idx] = p;
}
`;

const RENDER_WGSL = COMMON_WGSL + /* wgsl */`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;

struct VertOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) localUv   : vec2<f32>,
  @location(1) speed     : f32,
  @location(2) ageFrac   : f32,
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

  // Sample velocity at particle position for speed-coloring.
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let uvw = clamp((p.xyz - aabbMin) / aabbSize, vec3(0.0), vec3(1.0));
  let macros = textureSampleLevel(macrosTex, samp, uvw, 0.0);
  let speed = length(macros.xyz);

  // Camera-facing billboard
  let camRight = vec3(u.viewMat[0][0], u.viewMat[1][0], u.viewMat[2][0]);
  let camUp    = vec3(u.viewMat[0][1], u.viewMat[1][1], u.viewMat[2][1]);
  let off = QUAD_OFF[vIdx] * u.params.w;
  let worldPos = p.xyz + camRight * off.x + camUp * off.y;

  var out : VertOut;
  out.pos = u.projMat * u.viewMat * vec4(worldPos, 1.0);
  out.localUv = QUAD_OFF[vIdx];
  out.speed = speed;
  out.ageFrac = clamp(p.w / max(u.params.y, 1.0), 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in : VertOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.localUv, in.localUv);
  if r2 > 1.0 { discard; }

  // Soft radial alpha falloff
  let falloff = exp(-r2 * 3.5);
  let speedN = clamp(in.speed / 0.18, 0.0, 1.0);
  let col = inferno(0.15 + speedN * 0.85);

  // Particles fade out as they age so trails fade in
  let lifeFade = 1.0 - in.ageFrac * 0.4;
  let alpha = falloff * (0.18 + 0.7 * speedN) * lifeFade;

  return vec4(col * (0.6 + 1.4 * speedN), alpha);
}
`;
