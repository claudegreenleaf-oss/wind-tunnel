/**
 * Screen-space fluid renderer adapted from matsuoka-601/Splash
 * (https://github.com/matsuoka-601/Splash, MIT). We keep the SAME
 * pipeline shape (depth → blur → thickness → blur → composite) but
 * simplified:
 *   - uses our vec4 particle buffer (xyz + age) instead of PosVel
 *   - separable gaussian instead of narrow-range filter
 *   - procedural sky instead of cube envmap
 *   - procedural "lattice floor" for refracted-ray hits
 *
 * Render order each frame:
 *   1. depth pass  : impostor spheres → r32float view-space depth + depth-test
 *   2. depth blur X→Y : gaussian smooth depth
 *   3. thickness pass : impostor spheres → r16float (additive)
 *   4. thickness blur X→Y
 *   5. composite : reconstructs normals from depth, applies fresnel, refraction
 *      via Beer-Lambert + procedural backdrop, reflection via procedural sky.
 */

import * as THREE from 'three';

const FAR_DEPTH = 1e5;

export class FluidSurfaceRenderer {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;
  private getCanvasView: () => GPUTextureView;
  private getCanvasSize: () => [number, number];
  private particleBuf: GPUBuffer;
  private N: number;

  // Render targets — recreated on resize
  private rtW = 0;
  private rtH = 0;
  private depthTex: GPUTexture | null = null;
  private depthTexAlt: GPUTexture | null = null;     // ping-pong for blur
  private depthTestTex: GPUTexture | null = null;    // real depth-stencil
  private thicknessTex: GPUTexture | null = null;
  private thicknessAlt: GPUTexture | null = null;

  // Uniform buffer
  private uniformBuf: GPUBuffer;
  private blurDirBufX: GPUBuffer;
  private blurDirBufY: GPUBuffer;
  private filterSizeBuf: GPUBuffer;

  // Pipelines
  private depthPipeline!: GPURenderPipeline;
  private depthBlurPipeline!: GPURenderPipeline;
  private thicknessPipeline!: GPURenderPipeline;
  private thicknessBlurPipeline!: GPURenderPipeline;
  private compositePipeline!: GPURenderPipeline;

  // Direct sphere render — bypasses depth/blur/composite, draws colored impostor
  // spheres straight to the canvas.
  private directSpherePipeline!: GPURenderPipeline;
  private directSphereBgl!: GPUBindGroupLayout;
  private directSphereBG: GPUBindGroup | null = null;
  private directDepthTex: GPUTexture | null = null;

  // Obstacle mesh — drawn in our pipeline so it shares the depth-stencil with
  // the particles, giving correct occlusion regardless of camera angle.
  private obstaclePipeline!: GPURenderPipeline;
  private obstacleBgl!: GPUBindGroupLayout;
  private obstacleBG: GPUBindGroup | null = null;
  private obstacleUniformBuf: GPUBuffer;
  private obstacleVtxBuf: GPUBuffer | null = null;
  private obstacleIdxBuf: GPUBuffer | null = null;
  private obstacleVertCount = 0;
  private obstacleIdxCount = 0;
  private obstacleIdxFormat: GPUIndexFormat = 'uint32';

  // Bind-group layouts
  private depthBgl!: GPUBindGroupLayout;
  private depthBlurBgl!: GPUBindGroupLayout;
  private thicknessBgl!: GPUBindGroupLayout;
  private thicknessBlurBgl!: GPUBindGroupLayout;
  private compositeBgl!: GPUBindGroupLayout;

  // Bind groups — rebuilt on resize
  private depthBG!: GPUBindGroup;
  private thicknessBG!: GPUBindGroup;
  private depthBlurXBG: GPUBindGroup | null = null;
  private depthBlurYBG: GPUBindGroup | null = null;
  private thicknessBlurXBG: GPUBindGroup | null = null;
  private thicknessBlurYBG: GPUBindGroup | null = null;
  private compositeBG: GPUBindGroup | null = null;

  private sampler: GPUSampler;

  // LBM macros 3D texture for in-fluid color (velocity, density).
  private macrosView: GPUTextureView | null = null;
  private macrosSampler: GPUSampler;

  // LBM voxel mask: exact obstacle shape, used to clip particles inside obstacle.
  private maskBuffer: GPUBuffer | null = null;
  private maskDims: [number, number, number] = [0, 0, 0];

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    getCanvasView: () => GPUTextureView,
    getCanvasSize: () => [number, number],
    particleBuf: GPUBuffer,
    N: number,
  ) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.getCanvasView = getCanvasView;
    this.getCanvasSize = getCanvasSize;
    this.particleBuf = particleBuf;
    this.N = N;

    // Uniforms layout (matches RenderUniforms in WGSL below):
    //   texelSize         vec4  (16)
    //   sphereTime        vec4  (16) [sphereSize, time, pad, pad]
    //   invProjectionMat  mat4  (64)
    //   projectionMat     mat4  (64)
    //   viewMat           mat4  (64)
    //   invViewMat        mat4  (64)
    //   aabbMin           vec4  (16)
    //   aabbMax           vec4  (16)
    //   sliceMask         vec4  (16) [axis, pos, active, thickness]
    //   obstacle          vec4  (16) [centerX, centerY, centerZ, radius]
    //   latticeDims       vec4  (16) [W, H, D, _]
    //   total: 368 bytes
    this.uniformBuf = device.createBuffer({
      size: 368,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Obstacle uniforms: viewMat(64) + projMat(64) + modelMat(64) + upstream(16)
    // + aabbMin(16) + aabbMax(16) + scalars(16) = 256 bytes.
    this.obstacleUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Blur direction uniforms (vec4 padded → 16 bytes each)
    this.blurDirBufX = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.blurDirBufY = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.blurDirBufX, 0, new Float32Array([1, 0, 0, 0]).buffer);
    device.queue.writeBuffer(this.blurDirBufY, 0, new Float32Array([0, 1, 0, 0]).buffer);

    // Filter size (i32 padded to 16). Bigger = smoother surface but slower.
    this.filterSizeBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.filterSizeBuf, 0, new Int32Array([18, 0, 0, 0]).buffer);

    this.sampler = device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
    });
    this.macrosSampler = device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge',
    });

    this.buildPipelines();
  }

  setMacrosTexture(view: GPUTextureView) {
    this.macrosView = view;
    // Force composite + obstacle bind group rebuild on next render.
    this.compositeBG = null;
    this.obstacleBG  = null;
  }

  /** Build the obstacle bind group on demand — needs the current macros view. */
  private ensureObstacleBG() {
    if (this.obstacleBG || !this.macrosView) return;
    this.obstacleBG = this.device.createBindGroup({
      layout: this.obstacleBgl,
      entries: [
        { binding: 0, resource: { buffer: this.obstacleUniformBuf } },
        { binding: 1, resource: this.macrosView },
        { binding: 2, resource: this.macrosSampler },
      ],
    });
  }

  private buildPipelines() {
    const dev = this.device;

    // ---- bind group layouts ----
    this.depthBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    this.thicknessBgl = this.depthBgl;   // identical layout

    this.depthBlurBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    this.thicknessBlurBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.compositeBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    // Direct sphere render: vertex needs particles + uniforms + voxel mask;
    // fragment needs macros + sampler.
    this.directSphereBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    // ---- modules ----
    const sphereMod = dev.createShaderModule({ code: SPHERE_WGSL, label: 'fluid-sphere' });
    const blurMod   = dev.createShaderModule({ code: BLUR_WGSL,   label: 'fluid-blur' });
    const fluidMod  = dev.createShaderModule({ code: FLUID_WGSL,  label: 'fluid-composite' });

    // ---- pipelines ----
    this.depthPipeline = dev.createRenderPipeline({
      label: 'fluid-depth',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.depthBgl] }),
      vertex: { module: sphereMod, entryPoint: 'vs_sphere' },
      fragment: {
        module: sphereMod, entryPoint: 'fs_depth',
        targets: [{ format: 'r32float' }],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less',
      },
    });

    this.thicknessPipeline = dev.createRenderPipeline({
      label: 'fluid-thickness',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.thicknessBgl] }),
      vertex: { module: sphereMod, entryPoint: 'vs_sphere' },
      fragment: {
        module: sphereMod, entryPoint: 'fs_thickness',
        targets: [{
          format: 'r16float',
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.depthBlurPipeline = dev.createRenderPipeline({
      label: 'fluid-depth-blur',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.depthBlurBgl] }),
      vertex: { module: blurMod, entryPoint: 'vs_full' },
      fragment: {
        module: blurMod, entryPoint: 'fs_blur',
        targets: [{ format: 'r32float' }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.thicknessBlurPipeline = dev.createRenderPipeline({
      label: 'fluid-thickness-blur',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.thicknessBlurBgl] }),
      vertex: { module: blurMod, entryPoint: 'vs_full' },
      fragment: {
        module: blurMod, entryPoint: 'fs_blur',
        targets: [{ format: 'r16float' }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.compositePipeline = dev.createRenderPipeline({
      label: 'fluid-composite',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.compositeBgl] }),
      vertex: { module: fluidMod, entryPoint: 'vs_full' },
      fragment: {
        module: fluidMod, entryPoint: 'fs_composite',
        targets: [{
          format: this.canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // Obstacle pipeline — draws the actual mesh into the same color + depth
    // attachments as particles, so depth occlusion is correct.
    this.obstacleBgl = dev.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });
    const obstacleMod = dev.createShaderModule({ code: OBSTACLE_WGSL, label: 'fluid-obstacle' });
    this.obstaclePipeline = dev.createRenderPipeline({
      label: 'fluid-obstacle',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.obstacleBgl] }),
      vertex: {
        module: obstacleMod, entryPoint: 'vs_obstacle',
        buffers: [
          {
            // Interleaved: position(3) + normal(3) = 6 floats = 24 bytes
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0,  format: 'float32x3' },   // position
              { shaderLocation: 1, offset: 12, format: 'float32x3' },   // normal
            ],
          },
        ],
      },
      fragment: {
        module: obstacleMod, entryPoint: 'fs_obstacle',
        targets: [{ format: this.canvasFormat }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less',
      },
    });
    // obstacleBG is rebuilt in setMacrosTexture so we always have the latest
    // macros view bound (the LBM may swap textures on resize / re-init).
    this.obstacleBG = null;

    // Direct sphere pipeline — opaque colored impostor spheres, depth-tested,
    // straight onto the canvas. No SSFR filter.
    const directMod = dev.createShaderModule({ code: DIRECT_SPHERE_WGSL, label: 'fluid-direct-sphere' });
    this.directSpherePipeline = dev.createRenderPipeline({
      label: 'fluid-direct-sphere',
      layout: dev.createPipelineLayout({ bindGroupLayouts: [this.directSphereBgl] }),
      vertex: { module: directMod, entryPoint: 'vs_sphere' },
      fragment: {
        module: directMod, entryPoint: 'fs_direct',
        targets: [{ format: this.canvasFormat }],   // opaque, no blend
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less',
      },
    });

    // ---- particle bind group (built once — references the shared particle buf) ----
    this.depthBG = dev.createBindGroup({
      layout: this.depthBgl,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuf } },
        { binding: 1, resource: { buffer: this.uniformBuf } },
      ],
    });
    this.thicknessBG = dev.createBindGroup({
      layout: this.thicknessBgl,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuf } },
        { binding: 1, resource: { buffer: this.uniformBuf } },
      ],
    });
  }

  private ensureRTs(w: number, h: number) {
    if (this.depthTex && this.rtW === w && this.rtH === h) return;
    this.depthTex?.destroy();
    this.depthTexAlt?.destroy();
    this.depthTestTex?.destroy();
    this.thicknessTex?.destroy();
    this.thicknessAlt?.destroy();

    this.depthTex = this.device.createTexture({
      label: 'fluid-depth-rt',
      size: [w, h], format: 'r32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.depthTexAlt = this.device.createTexture({
      label: 'fluid-depth-rt-alt',
      size: [w, h], format: 'r32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.depthTestTex = this.device.createTexture({
      label: 'fluid-depth-test',
      size: [w, h], format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.thicknessTex = this.device.createTexture({
      label: 'fluid-thickness-rt',
      size: [w, h], format: 'r16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.thicknessAlt = this.device.createTexture({
      label: 'fluid-thickness-rt-alt',
      size: [w, h], format: 'r16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.rtW = w; this.rtH = h;

    // Rebuild blur + composite bind groups (textures changed)
    this.depthBlurXBG = this.device.createBindGroup({
      layout: this.depthBlurBgl,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.depthTex.createView() },
        { binding: 2, resource: { buffer: this.blurDirBufX } },
        { binding: 3, resource: { buffer: this.filterSizeBuf } },
      ],
    });
    this.depthBlurYBG = this.device.createBindGroup({
      layout: this.depthBlurBgl,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.depthTexAlt.createView() },
        { binding: 2, resource: { buffer: this.blurDirBufY } },
        { binding: 3, resource: { buffer: this.filterSizeBuf } },
      ],
    });
    this.thicknessBlurXBG = this.device.createBindGroup({
      layout: this.thicknessBlurBgl,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.thicknessTex.createView() },
        { binding: 2, resource: { buffer: this.blurDirBufX } },
        { binding: 3, resource: { buffer: this.filterSizeBuf } },
      ],
    });
    this.thicknessBlurYBG = this.device.createBindGroup({
      layout: this.thicknessBlurBgl,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.thicknessAlt.createView() },
        { binding: 2, resource: { buffer: this.blurDirBufY } },
        { binding: 3, resource: { buffer: this.filterSizeBuf } },
      ],
    });
    // compositeBG is (re)built lazily in render() — depends on macros texture too.
    this.compositeBG = null;
  }

  /**
   * Render the fluid surface from the current particles.
   * sphereSize is the diameter of each particle impostor in world units.
   */
  render(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    sphereSize: number,
    time: number,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
  ) {
    const [w, h] = this.getCanvasSize();
    if (w <= 0 || h <= 0) return;
    this.ensureRTs(w, h);
    if (!this.depthTex || !this.depthTexAlt || !this.depthTestTex || !this.thicknessTex || !this.thicknessAlt) return;
    if (!this.macrosView) return;       // composite needs the LBM macros texture

    // Rebuild composite bind group lazily (depends on macros + thickness/depth views).
    if (!this.compositeBG) {
      this.compositeBG = this.device.createBindGroup({
        layout: this.compositeBgl,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: this.depthTex.createView() },
          { binding: 2, resource: { buffer: this.uniformBuf } },
          { binding: 3, resource: this.thicknessTex.createView() },
          { binding: 4, resource: this.macrosView },
          { binding: 5, resource: this.macrosSampler },
        ],
      });
    }

    // Pack uniforms (RenderUniforms struct in WGSL).
    const invProj = proj.clone().invert();
    const invView = view.clone().invert();
    const buf = new Float32Array(92);
    buf[0] = 1 / w; buf[1] = 1 / h; buf[2] = 0; buf[3] = 0;
    buf[4] = sphereSize; buf[5] = time; buf[6] = 0; buf[7] = 0;
    buf.set(invProj.elements, 8);
    buf.set(proj.elements,   24);
    buf.set(view.elements,   40);
    buf.set(invView.elements, 56);
    buf[72] = aabbMin.x; buf[73] = aabbMin.y; buf[74] = aabbMin.z; buf[75] = 0;
    buf[76] = aabbMax.x; buf[77] = aabbMax.y; buf[78] = aabbMax.z; buf[79] = 0;
    // sliceMask zeroed in this path.
    buf[80] = 0; buf[81] = 0; buf[82] = 0; buf[83] = 0;
    // obstacle
    buf[84] = this.obstacleCenter[0];
    buf[85] = this.obstacleCenter[1];
    buf[86] = this.obstacleCenter[2];
    buf[87] = this.obstacleRadius;
    // latticeDims
    buf[88] = this.maskDims[0]; buf[89] = this.maskDims[1]; buf[90] = this.maskDims[2]; buf[91] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf.buffer);

    const enc = this.device.createCommandEncoder({ label: 'fluid-surface' });

    // 1) Depth pass — clear depth-test, clear depth color RT to FAR.
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.depthTex.createView(),
          clearValue: { r: FAR_DEPTH, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
        depthStencilAttachment: {
          view: this.depthTestTex.createView(),
          depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store',
        },
      });
      rp.setPipeline(this.depthPipeline);
      rp.setBindGroup(0, this.depthBG);
      rp.draw(6, this.N);
      rp.end();
    }

    // 2) Separable gaussian blur on depth: X then Y, ping-pong.
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.depthTexAlt.createView(),
          clearValue: { r: FAR_DEPTH, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.depthBlurPipeline);
      rp.setBindGroup(0, this.depthBlurXBG!);
      rp.draw(6);
      rp.end();
    }
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.depthTex.createView(),
          clearValue: { r: FAR_DEPTH, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.depthBlurPipeline);
      rp.setBindGroup(0, this.depthBlurYBG!);
      rp.draw(6);
      rp.end();
    }

    // 3) Thickness pass — additive, no depth test.
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.thicknessTex.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.thicknessPipeline);
      rp.setBindGroup(0, this.thicknessBG);
      rp.draw(6, this.N);
      rp.end();
    }

    // 4) Blur thickness X→Y
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.thicknessAlt.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.thicknessBlurPipeline);
      rp.setBindGroup(0, this.thicknessBlurXBG!);
      rp.draw(6);
      rp.end();
    }
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.thicknessTex.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.thicknessBlurPipeline);
      rp.setBindGroup(0, this.thicknessBlurYBG!);
      rp.draw(6);
      rp.end();
    }

    // 5) Composite → canvas (alpha-over).
    {
      const rp = enc.beginRenderPass({
        colorAttachments: [{
          view: this.getCanvasView(),
          loadOp: 'load', storeOp: 'store',
        }],
      });
      rp.setPipeline(this.compositePipeline);
      rp.setBindGroup(0, this.compositeBG!);
      rp.draw(6);
      rp.end();
    }

    this.device.queue.submit([enc.finish()]);
  }

  /** Slice mask config — when active, particles outside the slice band are hidden. */
  sliceMaskAxis = 0;        // 0=x, 1=y, 2=z
  sliceMaskPos = 0.5;       // 0..1
  sliceMaskActive = false;
  sliceMaskThickness = 0.04;

  setSliceMask(axis: 0 | 1 | 2, pos: number, active: boolean, thickness = 0.04) {
    this.sliceMaskAxis = axis;
    this.sliceMaskPos = pos;
    this.sliceMaskActive = active;
    this.sliceMaskThickness = thickness;
  }

  /** Obstacle bound — particles inside this sphere are clipped at vertex stage so
   *  the obstacle mesh shows through. The particles aren't deleted (that happens
   *  only on shape change / reset), just visually hidden. */
  obstacleCenter: [number, number, number] = [0, 0, 0];
  obstacleRadius = 0;

  setObstacle(center: { x: number; y: number; z: number }, radius: number) {
    this.obstacleCenter = [center.x, center.y, center.z];
    this.obstacleRadius = radius;
  }

  /** Bind the LBM voxel mask for exact-shape obstacle culling. */
  setMaskBuffer(buf: GPUBuffer, dims: { W: number; H: number; D: number }) {
    this.maskBuffer = buf;
    this.maskDims = [dims.W, dims.H, dims.D];
    this.directSphereBG = null;   // force rebuild with new binding
  }

  /**
   * Upload obstacle mesh geometry to GPU. The mesh is then drawn in our
   * render pass before the particles, so depth-occlusion works for ALL shapes.
   * Pass interleaved position+normal floats (6 floats per vertex) and indices.
   */
  setObstacleGeometry(interleaved: Float32Array, indices: Uint16Array | Uint32Array | null) {
    this.obstacleVtxBuf?.destroy();
    this.obstacleIdxBuf?.destroy();
    this.obstacleVtxBuf = this.device.createBuffer({
      size: interleaved.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.obstacleVtxBuf, 0, interleaved.buffer, interleaved.byteOffset, interleaved.byteLength);
    this.obstacleVertCount = interleaved.length / 6;

    if (indices) {
      this.obstacleIdxFormat = indices.BYTES_PER_ELEMENT === 2 ? 'uint16' : 'uint32';
      this.obstacleIdxBuf = this.device.createBuffer({
        size: Math.max(indices.byteLength, 4),
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(this.obstacleIdxBuf, 0, indices.buffer, indices.byteOffset, indices.byteLength);
      this.obstacleIdxCount = indices.length;
    } else {
      this.obstacleIdxBuf = null;
      this.obstacleIdxCount = 0;
    }
  }

  /**
   * Render particles as colored opaque impostor spheres straight to canvas.
   * No SSFR filter — each particle is an individual lit sphere.
   */
  /** Draw ONLY the obstacle into the canvas — used by the Drag visualization tab
   *  where we want the surface heatmap visible without any particle overlay.
   *  Color is cleared first so the obstacle reads on a clean background. */
  renderObstacleOnly() {
    const [w, h] = this.getCanvasSize();
    if (w <= 0 || h <= 0) return;
    if (!this.obstacleVtxBuf || this.obstacleVertCount <= 0) return;
    this.ensureObstacleBG();
    if (!this.obstacleBG) return;

    // Lazy depth target sized to canvas.
    if (!this.directDepthTex || this.rtW !== w || this.rtH !== h) {
      this.directDepthTex?.destroy();
      this.directDepthTex = this.device.createTexture({
        label: 'direct-sphere-depth',
        size: [w, h], format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.rtW = w; this.rtH = h;
      this.directSphereBG = null;
    }

    const enc = this.device.createCommandEncoder({ label: 'obstacle-only' });
    const rpO = enc.beginRenderPass({
      colorAttachments: [{ view: this.getCanvasView(), loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: {
        view: this.directDepthTex!.createView(),
        depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store',
      },
    });
    rpO.setPipeline(this.obstaclePipeline);
    rpO.setBindGroup(0, this.obstacleBG!);
    rpO.setVertexBuffer(0, this.obstacleVtxBuf);
    if (this.obstacleIdxBuf && this.obstacleIdxCount > 0) {
      rpO.setIndexBuffer(this.obstacleIdxBuf, this.obstacleIdxFormat);
      rpO.drawIndexed(this.obstacleIdxCount);
    } else {
      rpO.draw(this.obstacleVertCount);
    }
    rpO.end();
    this.device.queue.submit([enc.finish()]);
  }

  renderRawSpheres(
    view: THREE.Matrix4,
    proj: THREE.Matrix4,
    sphereSize: number,
    time: number,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
  ) {
    const [w, h] = this.getCanvasSize();
    if (w <= 0 || h <= 0) return;
    if (!this.macrosView) return;

    // Lazy depth target for the direct sphere pass (size = canvas).
    if (!this.directDepthTex || this.rtW !== w || this.rtH !== h) {
      this.directDepthTex?.destroy();
      this.directDepthTex = this.device.createTexture({
        label: 'direct-sphere-depth',
        size: [w, h], format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.rtW = w; this.rtH = h;
      this.directSphereBG = null;
    }
    if (!this.directSphereBG) {
      if (!this.maskBuffer) return;
      this.directSphereBG = this.device.createBindGroup({
        layout: this.directSphereBgl,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuf } },
          { binding: 1, resource: { buffer: this.uniformBuf } },
          { binding: 2, resource: this.macrosView },
          { binding: 3, resource: this.macrosSampler },
          { binding: 4, resource: { buffer: this.maskBuffer } },
        ],
      });
    }

    // Pack uniforms.
    const invProj = proj.clone().invert();
    const invView = view.clone().invert();
    const buf = new Float32Array(92);
    buf[0] = 1 / w; buf[1] = 1 / h; buf[2] = 0; buf[3] = 0;
    buf[4] = sphereSize; buf[5] = time; buf[6] = 0; buf[7] = 0;
    buf.set(invProj.elements, 8);
    buf.set(proj.elements,   24);
    buf.set(view.elements,   40);
    buf.set(invView.elements, 56);
    buf[72] = aabbMin.x; buf[73] = aabbMin.y; buf[74] = aabbMin.z; buf[75] = 0;
    buf[76] = aabbMax.x; buf[77] = aabbMax.y; buf[78] = aabbMax.z; buf[79] = 0;
    // sliceMask
    buf[80] = this.sliceMaskAxis;
    buf[81] = this.sliceMaskPos;
    buf[82] = this.sliceMaskActive ? 1 : 0;
    buf[83] = this.sliceMaskThickness;
    // obstacle (kept but unused now that we use mask)
    buf[84] = this.obstacleCenter[0];
    buf[85] = this.obstacleCenter[1];
    buf[86] = this.obstacleCenter[2];
    buf[87] = this.obstacleRadius;
    // latticeDims
    buf[88] = this.maskDims[0]; buf[89] = this.maskDims[1]; buf[90] = this.maskDims[2]; buf[91] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf.buffer);

    const enc = this.device.createCommandEncoder({ label: 'direct-spheres' });
    const canvasView = this.getCanvasView();
    const depthView = this.directDepthTex!.createView();

    // 1) Draw the obstacle (if uploaded), establishing color + depth.
    this.ensureObstacleBG();
    if (this.obstacleVtxBuf && this.obstacleVertCount > 0 && this.obstacleBG) {
      const rpO = enc.beginRenderPass({
        colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store',
        },
      });
      rpO.setPipeline(this.obstaclePipeline);
      rpO.setBindGroup(0, this.obstacleBG!);
      rpO.setVertexBuffer(0, this.obstacleVtxBuf);
      if (this.obstacleIdxBuf && this.obstacleIdxCount > 0) {
        rpO.setIndexBuffer(this.obstacleIdxBuf, this.obstacleIdxFormat);
        rpO.drawIndexed(this.obstacleIdxCount);
      } else {
        rpO.draw(this.obstacleVertCount);
      }
      rpO.end();
    }

    // 2) Draw particles, LOADING the obstacle depth so particles behind the
    //    obstacle get depth-culled.
    const rp = enc.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: {
        view: depthView,
        depthLoadOp: this.obstacleVtxBuf ? 'load' : 'clear',
        depthClearValue: 1.0,
        depthStoreOp: 'store',
      },
    });
    rp.setPipeline(this.directSpherePipeline);
    rp.setBindGroup(0, this.directSphereBG);
    rp.draw(6, this.N);
    rp.end();
    this.device.queue.submit([enc.finish()]);
  }

  /** Push view/proj/model matrices + upstream dir into the obstacle uniform. */
  setObstacleTransform(view: THREE.Matrix4, proj: THREE.Matrix4, model: THREE.Matrix4) {
    const buf = new Float32Array(52);
    buf.set(view.elements, 0);
    buf.set(proj.elements, 16);
    buf.set(model.elements, 32);
    buf[48] = -1; buf[49] = 0; buf[50] = 0; buf[51] = 0;   // upstream direction
    this.device.queue.writeBuffer(this.obstacleUniformBuf, 0, buf.buffer);
  }

  /** AABB + inlet velocity needed for real-LBM Cp sampling on the obstacle. */
  setObstacleFlowParams(aabbMin: THREE.Vector3, aabbMax: THREE.Vector3, uIn: number) {
    const buf = new Float32Array(12);
    buf[0] = aabbMin.x; buf[1] = aabbMin.y; buf[2] = aabbMin.z; buf[3] = 0;
    buf[4] = aabbMax.x; buf[5] = aabbMax.y; buf[6] = aabbMax.z; buf[7] = 0;
    buf[8] = uIn;       buf[9] = 0;         buf[10] = 0;        buf[11] = 0;
    // Write at byte offset 208 (after the three matrices + upstream vec4).
    this.device.queue.writeBuffer(this.obstacleUniformBuf, 208, buf.buffer);
  }

  dispose() {
    this.depthTex?.destroy();
    this.depthTexAlt?.destroy();
    this.depthTestTex?.destroy();
    this.thicknessTex?.destroy();
    this.thicknessAlt?.destroy();
    this.uniformBuf.destroy();
    this.blurDirBufX.destroy();
    this.blurDirBufY.destroy();
    this.filterSizeBuf.destroy();
  }
}

// ============================================================================
// WGSL shaders — adapted from matsuoka-601/Splash (MIT)
// ============================================================================

/** Common uniform layout used by sphere passes + composite. */
const UNIFORMS_WGSL = /* wgsl */`
struct RenderUniforms {
    texelSize     : vec4f,    // texelSize.xy, pad, pad
    sphereTime    : vec4f,    // sphereSize, time, pad, pad
    invProjMat    : mat4x4f,
    projMat       : mat4x4f,
    viewMat       : mat4x4f,
    invViewMat    : mat4x4f,
    aabbMin       : vec4f,    // x, y, z, pad
    aabbMax       : vec4f,    // x, y, z, pad
    sliceMask     : vec4f,    // axis (0=x,1=y,2=z), pos[0..1], active (0/1), thickness[0..1]
    obstacle      : vec4f,    // centerX, centerY, centerZ, radius (kept for back-compat)
    latticeDims   : vec4f,    // W, H, D, _
};
`;

/** Particle = vec4(pos.xyz, age) in our buffer. */
const SPHERE_WGSL = UNIFORMS_WGSL + /* wgsl */`
@group(0) @binding(0) var<storage, read> particles : array<vec4f>;
@group(0) @binding(1) var<uniform> u : RenderUniforms;

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv      : vec2f,
  @location(1) viewPos : vec3f,
};

const CORNERS = array<vec2f, 6>(
  vec2( 0.5,  0.5), vec2( 0.5, -0.5), vec2(-0.5, -0.5),
  vec2( 0.5,  0.5), vec2(-0.5, -0.5), vec2(-0.5,  0.5),
);

@vertex
fn vs_sphere(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VertOut {
  let size = u.sphereTime.x;
  let corner2 = CORNERS[vi] * size;
  let uv = CORNERS[vi] + 0.5;

  let worldPos = particles[ii].xyz;
  let viewPos = (u.viewMat * vec4f(worldPos, 1.0)).xyz;
  let outClip = u.projMat * vec4f(viewPos + vec3f(corner2, 0.0), 1.0);

  var out : VertOut;
  out.position = outClip;
  out.uv = uv;
  out.viewPos = viewPos;
  return out;
}

struct DepthOut {
  @location(0) depth : f32,
  @builtin(frag_depth) fragDepth : f32,
};

@fragment
fn fs_depth(@location(0) uv : vec2f, @location(1) viewPos : vec3f) -> DepthOut {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let nz = sqrt(1.0 - r2);
  let radius = u.sphereTime.x * 0.5;
  let realView = vec4f(viewPos + vec3f(nxy, nz) * radius, 1.0);
  let clipPos = u.projMat * realView;

  var out : DepthOut;
  out.fragDepth = clipPos.z / clipPos.w;
  // Output negative view-space z so the value is positive (camera looks down -Z).
  out.depth = -realView.z;
  return out;
}

@fragment
fn fs_thickness(@location(0) uv : vec2f) -> @location(0) vec4f {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let thickness = sqrt(1.0 - r2);
  let particleAlpha = 0.05;
  return vec4f(particleAlpha * thickness, 0.0, 0.0, 1.0);
}
`;

/** Separable Gaussian blur (used for both depth and thickness). */
const BLUR_WGSL = /* wgsl */`
@group(0) @binding(0) var samp     : sampler;
@group(0) @binding(1) var srcTex   : texture_2d<f32>;
@group(0) @binding(2) var<uniform> blurDir : vec4f;   // x,y = blur direction
@group(0) @binding(3) var<uniform> filterCfg : vec4i; // x = filterSize

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> VertOut {
  let pos = array<vec2f, 6>(
    vec2( 1.0,  1.0), vec2( 1.0, -1.0), vec2(-1.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0, -1.0), vec2(-1.0,  1.0),
  );
  let uv = array<vec2f, 6>(
    vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0),
    vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, 0.0),
  );
  var out : VertOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}

@fragment
fn fs_blur(@location(0) uv : vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(srcTex, 0));
  let iuv = uv * dims;
  let center = textureLoad(srcTex, vec2u(iuv), 0).r;

  let filterSize = filterCfg.x;
  let sigma = f32(filterSize) / 3.0;
  let sigmaInv = 1.0 / (2.0 * sigma * sigma);

  var sum = center;
  var wsum = 1.0;
  for (var x : i32 = 1; x <= filterSize; x = x + 1) {
    let off = blurDir.xy * f32(x);
    let l = textureLoad(srcTex, vec2u(iuv - off), 0).r;
    let r = textureLoad(srcTex, vec2u(iuv + off), 0).r;
    let w = exp(-f32(x * x) * sigmaInv);
    sum  = sum + (l + r) * w;
    wsum = wsum + 2.0 * w;
  }
  return vec4f(sum / wsum, 0.0, 0.0, 1.0);
}
`;

/** Composite — reads filtered depth + thickness, produces fluid surface color. */
const FLUID_WGSL = UNIFORMS_WGSL + /* wgsl */`
@group(0) @binding(0) var samp        : sampler;
@group(0) @binding(1) var depthTex    : texture_2d<f32>;
@group(0) @binding(2) var<uniform> u  : RenderUniforms;
@group(0) @binding(3) var thicknessTex: texture_2d<f32>;
@group(0) @binding(4) var macrosTex   : texture_3d<f32>;
@group(0) @binding(5) var macrosSamp  : sampler;

// Turbo colormap — vivid blue→cyan→green→yellow→red velocity ramp.
fn turbo(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.19, 0.07, 0.23);
  let c1 = vec3f(0.10, 0.40, 0.95);
  let c2 = vec3f(0.10, 0.85, 0.85);
  let c3 = vec3f(0.30, 0.95, 0.30);
  let c4 = vec3f(0.98, 0.85, 0.10);
  let c5 = vec3f(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> VertOut {
  let pos = array<vec2f, 6>(
    vec2( 1.0,  1.0), vec2( 1.0, -1.0), vec2(-1.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0, -1.0), vec2(-1.0,  1.0),
  );
  let uv = array<vec2f, 6>(
    vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0),
    vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, 0.0),
  );
  var out : VertOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}

fn viewPosFromDepth(uv : vec2f, depthVal : f32) -> vec3f {
  // depthVal is positive view-space distance (we stored -viewPos.z).
  // Reconstruct via inv-proj of NDC.
  var ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - 2.0 * uv.y, 0.0, 1.0);
  ndc.z = -u.projMat[2].z + u.projMat[3].z / depthVal;
  let eye = u.invProjMat * ndc;
  return eye.xyz / eye.w;
}

fn loadDepth(iuv : vec2i) -> f32 {
  return abs(textureLoad(depthTex, vec2u(iuv), 0).r);
}

// Procedural cool gradient sky for reflection/refraction backdrop.
fn skyDir(d : vec3f) -> vec3f {
  let t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  let horizon = vec3f(0.05, 0.10, 0.18);    // dark blue-grey near horizon
  let zenith  = vec3f(0.55, 0.78, 1.05);    // ice cyan above
  let nadir   = vec3f(0.02, 0.03, 0.05);    // black below
  if d.y > 0.0 {
    return mix(horizon, zenith, pow(t, 0.6));
  }
  return mix(horizon, nadir, pow(1.0 - t, 0.7));
}

// Animated caustic-style lattice floor for refracted rays that head downward.
fn floorCol(world : vec3f, time : f32) -> vec3f {
  // Soft grid
  let gs = 0.3;
  let gx = abs(fract(world.x / gs) - 0.5);
  let gz = abs(fract(world.z / gs) - 0.5);
  let line = smoothstep(0.46, 0.50, max(gx, gz));
  let baseGrid = mix(vec3f(0.02, 0.04, 0.10), vec3f(0.10, 0.30, 0.55), line);

  // Animated multi-octave caustic — bright moving bands of focused light.
  let cs = world.xz * 1.5;
  let a = sin(cs.x * 3.0 + time * 0.7) + sin(cs.y * 2.7 + time * 0.5);
  let b = sin(cs.x * 1.8 - cs.y * 2.3 + time * 0.9);
  let c = sin((cs.x + cs.y) * 4.1 - time * 1.3);
  let cAccum = a * 0.5 + b * 0.5 + c * 0.4;
  let causticIntensity = pow(max(0.0, cAccum), 6.0) * 1.8;
  // Iridescent caustics: hue shifts based on caustic phase
  let phase = sin(cs.x * 1.2 + time * 0.3) * 0.5 + 0.5;
  let causticColor = mix(vec3f(0.40, 0.95, 1.30), vec3f(1.20, 0.70, 1.30), phase);

  return baseGrid + causticColor * causticIntensity;
}

@fragment
fn fs_composite(@location(0) uv : vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(depthTex, 0));
  let iuv = vec2i(uv * dims);

  let depthVal = loadDepth(iuv);
  let thickness = textureSample(thicknessTex, samp, uv).r;

  if depthVal >= 1e4 {
    // No fluid here — let the background show through.
    discard;
  }

  let surfaceView = viewPosFromDepth(uv, depthVal);
  let texel = u.texelSize.xy;

  // View-pos derivatives for normal. Use whichever side has smaller deltaZ
  // (avoids picking up huge silhouette discontinuities).
  let ddx1 = viewPosFromDepth(uv + vec2f( texel.x, 0.0), loadDepth(iuv + vec2i( 1, 0))) - surfaceView;
  let ddy1 = viewPosFromDepth(uv + vec2f(0.0,  texel.y), loadDepth(iuv + vec2i(0,  1))) - surfaceView;
  let ddx2 = surfaceView - viewPosFromDepth(uv + vec2f(-texel.x, 0.0), loadDepth(iuv + vec2i(-1, 0)));
  let ddy2 = surfaceView - viewPosFromDepth(uv + vec2f(0.0, -texel.y), loadDepth(iuv + vec2i(0, -1)));
  let ddx = select(ddx1, ddx2, abs(ddx1.z) > abs(ddx2.z));
  let ddy = select(ddy1, ddy2, abs(ddy1.z) > abs(ddy2.z));

  let normalView = -normalize(cross(ddx, ddy));
  let rayDirView = normalize(surfaceView);

  // ---- Refraction ----
  let refractDirView = refract(rayDirView, normalView, 1.0 / 1.333);
  let refractDirWorld = normalize((u.invViewMat * vec4f(refractDirView, 0.0)).xyz);

  let surfaceWorld = (u.invViewMat * vec4f(surfaceView, 1.0)).xyz;

  // Where does the refracted ray hit the "floor" (y = -1.0)?
  var refractedCol = skyDir(refractDirWorld);
  if refractDirWorld.y < -0.01 {
    let t = (-1.0 - surfaceWorld.y) / refractDirWorld.y;
    if t > 0.0 {
      let hit = surfaceWorld + refractDirWorld * t;
      refractedCol = floorCol(hit, u.sphereTime.y);
    }
  }

  // Sample LBM velocity along the refracted ray inside the fluid — averages
  // over the volume the fluid occupies, giving rich color from interior flow.
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let probeStep = refractDirWorld * (length(aabbSize) * 0.02);
  let probe0 = surfaceWorld + probeStep * 0.5;
  let probe1 = surfaceWorld + probeStep * 1.5;
  let probe2 = surfaceWorld + probeStep * 3.0;
  let uvw0 = clamp((probe0 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let uvw1 = clamp((probe1 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let uvw2 = clamp((probe2 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let m0 = textureSampleLevel(macrosTex, macrosSamp, uvw0, 0.0).xyz;
  let m1 = textureSampleLevel(macrosTex, macrosSamp, uvw1, 0.0).xyz;
  let m2 = textureSampleLevel(macrosTex, macrosSamp, uvw2, 0.0).xyz;
  let avgVel = (m0 + m1 + m2) * (1.0 / 3.0);
  let speed = length(avgVel);
  let speedN = clamp(speed / 0.06, 0.0, 1.0);     // more sensitive
  let velocityColor = turbo(speedN);

  // Approximate vorticity by 6-tap finite difference on velocity field.
  let h = 1.5 / vec3f(160.0, 80.0, 80.0);
  let vxp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vxn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vyp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vyn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vzp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let vzn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let curlX = (vyp.z - vyn.z) - (vzp.y - vzn.y);
  let curlY = (vzp.x - vzn.x) - (vxp.z - vxn.z);
  let curlZ = (vxp.y - vxn.y) - (vyp.x - vyn.x);
  let vort = length(vec3f(curlX, curlY, curlZ));
  let vortN = clamp(vort * 60.0, 0.0, 1.0);

  // Add a positional hue shift — depth along the tunnel adds variety.
  let posPhase = uvw0.x * 6.283 + u.sphereTime.y * 0.4;
  let positionalTint = vec3f(
    0.5 + 0.5 * sin(posPhase),
    0.5 + 0.5 * sin(posPhase + 2.094),
    0.5 + 0.5 * sin(posPhase + 4.188)
  );

  // Beer-Lambert tint with thickness — absorb less when fast (more vivid).
  let absorbColor = mix(vec3f(0.95, 0.55, 0.25), vec3f(0.20, 0.30, 0.45), speedN);
  let transmittance = exp(-absorbColor * thickness * 1.6);
  refractedCol = refractedCol * transmittance;

  // ---- Vivid multi-channel color encoding ----
  // Speed lives in distinct, sharp BANDS — no smooth gradient → no mud.
  var bandColor = vec3f(0.06, 0.18, 0.55);            // deep electric blue (baseline)
  if speedN > 0.18 { bandColor = vec3f(0.10, 0.45, 1.00); }    // electric blue
  if speedN > 0.35 { bandColor = vec3f(0.05, 0.90, 0.90); }    // cyan
  if speedN > 0.55 { bandColor = vec3f(0.20, 0.95, 0.25); }    // green
  if speedN > 0.75 { bandColor = vec3f(1.00, 0.85, 0.10); }    // yellow
  if speedN > 0.92 { bandColor = vec3f(1.00, 0.30, 0.10); }    // red (highest)

  // Vorticity flash — sharp threshold for clear hotspots.
  let vortFlash = step(0.35, vortN) * vortN;
  bandColor = mix(bandColor, vec3f(1.35, 0.30, 0.95), vortFlash * 0.65);

  // Animated rainbow stripes scrolling downstream — adds time-varying info layer.
  let stripePhase = uvw0.x * 14.0 - u.sphereTime.y * 4.0;
  let stripeMask  = pow(0.5 + 0.5 * sin(stripePhase), 8.0) * 0.55;
  let stripeColor = vec3f(
    0.5 + 0.5 * sin(stripePhase),
    0.5 + 0.5 * sin(stripePhase + 2.094),
    0.5 + 0.5 * sin(stripePhase + 4.188),
  );
  bandColor = bandColor + stripeColor * stripeMask;

  // Density (rho) channel — bumps near obstacle, encoded as warm white halo.
  let rho = textureSampleLevel(macrosTex, macrosSamp, uvw0, 0.0).w;
  let rhoN = clamp((rho - 1.0) * 12.0 + 0.5, 0.0, 1.0);
  bandColor = bandColor + vec3f(1.15, 0.95, 0.55) * rhoN * 0.30;

  // Use the banded color as the dominant body tint.
  refractedCol = mix(refractedCol, bandColor * 1.3, 0.90);

  // ---- Reflection ----
  let reflectDirView = reflect(rayDirView, normalView);
  let reflectDirWorld = normalize((u.invViewMat * vec4f(reflectDirView, 0.0)).xyz);
  let reflectedCol = skyDir(reflectDirWorld);

  // ---- Fresnel ----
  let F0 = 0.02;
  let cosI = clamp(dot(normalView, -rayDirView), 0.0, 1.0);
  let fresnel = clamp(F0 + (1.0 - F0) * pow(1.0 - cosI, 5.0), 0.0, 1.0);

  // ---- Specular ----
  let lightDirView = normalize((u.viewMat * vec4f(0.5, 1.0, 0.6, 0.0)).xyz);
  let H = normalize(lightDirView - rayDirView);
  let spec = pow(max(0.0, dot(H, normalView)), 220.0) * 1.2;

  // Composite
  var finalCol = mix(refractedCol, reflectedCol, fresnel) + vec3f(spec);

  // Iridescence — thin-film rainbow at fresnel edges, animated like a soap film.
  let iriPhase = fresnel * 12.566 + u.sphereTime.y * 0.7;
  let iri = vec3f(
    0.5 + 0.5 * sin(iriPhase),
    0.5 + 0.5 * sin(iriPhase + 2.094),
    0.5 + 0.5 * sin(iriPhase + 4.188),
  );
  finalCol = finalCol + iri * fresnel * fresnel * 0.55;

  // Gamma
  finalCol = pow(max(finalCol, vec3f(0.0)), vec3f(1.0 / 2.2));

  // Alpha — thin everywhere, fresnel rim crisper. Body translucent so the
  // refracted floor caustics shine through.
  let alpha = clamp(0.25 + fresnel * 0.45 + thickness * 0.3, 0.05, 0.78);

  return vec4f(finalCol, alpha);
}
`;

// Direct sphere — opaque colored impostor spheres with velocity-driven turbo
// color + simple diffuse lighting. No SSFR filter; each particle stands alone.
const DIRECT_SPHERE_WGSL = UNIFORMS_WGSL + /* wgsl */`
@group(0) @binding(0) var<storage, read> particles : array<vec4f>;
@group(0) @binding(1) var<uniform> u : RenderUniforms;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var macrosSamp : sampler;
@group(0) @binding(4) var<storage, read> voxelMask : array<u32>;   // 0=fluid, 1=wall

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv      : vec2f,
  @location(1) viewPos : vec3f,
  @location(2) world   : vec3f,
};

const CORNERS = array<vec2f, 6>(
  vec2( 0.5,  0.5), vec2( 0.5, -0.5), vec2(-0.5, -0.5),
  vec2( 0.5,  0.5), vec2(-0.5, -0.5), vec2(-0.5,  0.5),
);

fn turbo(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.19, 0.07, 0.23);
  let c1 = vec3f(0.10, 0.40, 0.95);
  let c2 = vec3f(0.10, 0.85, 0.85);
  let c3 = vec3f(0.30, 0.95, 0.30);
  let c4 = vec3f(0.98, 0.85, 0.10);
  let c5 = vec3f(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

@vertex
fn vs_sphere(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VertOut {
  let size = u.sphereTime.x;
  let corner2 = CORNERS[vi] * size;
  let uv = CORNERS[vi] + 0.5;

  let worldPos = particles[ii].xyz;

  // Slice mask: when active, hide particles whose normalized position along
  // the slice axis falls outside [pos - thickness, pos + thickness].
  var clipped = false;
  if u.sliceMask.z > 0.5 {
    let axis = i32(u.sliceMask.x + 0.5);
    let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
    let lUvw = (worldPos - u.aabbMin.xyz) / aabbSize;
    var coord = 0.0;
    if axis == 0      { coord = lUvw.x; }
    else if axis == 1 { coord = lUvw.y; }
    else              { coord = lUvw.z; }
    if abs(coord - u.sliceMask.y) > u.sliceMask.w {
      clipped = true;
    }
  }

  // Exact obstacle cull via LBM voxel mask: clip particles whose lattice
  // cell is flagged as solid (mask == 1). Uses the EXACT voxelized shape,
  // so the cull region matches the mesh — no bounding-sphere overshoot.
  let W = i32(u.latticeDims.x);
  let H = i32(u.latticeDims.y);
  let D = i32(u.latticeDims.z);
  if W > 0 && H > 0 && D > 0 {
    let aabbSizeC = u.aabbMax.xyz - u.aabbMin.xyz;
    let lUvw2 = (worldPos - u.aabbMin.xyz) / aabbSizeC;
    let xi = i32(clamp(lUvw2.x * f32(W), 0.0, f32(W - 1)));
    let yi = i32(clamp(lUvw2.y * f32(H), 0.0, f32(H - 1)));
    let zi = i32(clamp(lUvw2.z * f32(D), 0.0, f32(D - 1)));
    let idx = u32(zi * W * H + yi * W + xi);
    let flag = voxelMask[idx];
    if flag == 1u { clipped = true; }
  }

  let viewPos = (u.viewMat * vec4f(worldPos, 1.0)).xyz;
  var outClip = u.projMat * vec4f(viewPos + vec3f(corner2, 0.0), 1.0);
  // Send clipped vertices to NDC-infinity so they're guaranteed culled.
  if clipped { outClip = vec4f(2.0, 2.0, 2.0, 1.0); }

  var out : VertOut;
  out.position = outClip;
  out.uv = uv;
  out.viewPos = viewPos;
  out.world = worldPos;
  return out;
}

struct FragOut {
  @location(0) color : vec4f,
  @builtin(frag_depth) fragDepth : f32,
};

@fragment
fn fs_direct(@location(0) uv : vec2f, @location(1) viewPos : vec3f, @location(2) world : vec3f) -> FragOut {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let nz = sqrt(1.0 - r2);
  let normal = vec3f(nxy, nz);
  let radius = u.sphereTime.x * 0.5;

  // True view-space position of the sphere surface point under this pixel.
  let realView = vec4f(viewPos + normal * radius, 1.0);
  let clipPos = u.projMat * realView;
  let fragDepth = clipPos.z / clipPos.w;

  // Sample LBM velocity at the SPHERE CENTER world position.
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let lUvw = clamp((world - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let macros = textureSampleLevel(macrosTex, macrosSamp, lUvw, 0.0);
  let speed = length(macros.xyz);
  let speedN = clamp(speed / 0.10, 0.0, 1.0);
  let col = turbo(speedN);

  // Simple Lambert + soft rim. Light from upper-left.
  let lightDir = normalize(vec3f(-0.4, 0.8, 0.7));
  let ndotl = clamp(dot(normal, lightDir), 0.0, 1.0);
  let rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.0);
  let shaded = col * (0.45 + 0.65 * ndotl) + vec3f(rim * 0.25);

  var out : FragOut;
  out.color = vec4f(shaded, 1.0);
  out.fragDepth = fragDepth;
  return out;
}
`;

// Obstacle pipeline: draws the actual mesh into the same color + depth
// attachments as the particles, so depth occlusion is correct for ALL shapes.
// Fragment shader colors each surface fragment by friction proxy
// (dot(normal, upstream)) through a turbo ramp.
const OBSTACLE_WGSL = /* wgsl */`
struct ObstacleUniforms {
  viewMat   : mat4x4f,
  projMat   : mat4x4f,
  modelMat  : mat4x4f,
  upstream  : vec4f,    // -X by default
  aabbMin   : vec4f,
  aabbMax   : vec4f,
  scalars   : vec4f,    // x = uIn (inlet velocity, lattice units)
};
@group(0) @binding(0) var<uniform>                u    : ObstacleUniforms;
@group(0) @binding(1) var                         macrosTex : texture_3d<f32>;
@group(0) @binding(2) var                         samp : sampler;

struct VOut {
  @builtin(position) clip        : vec4f,
  @location(0) normalWorld       : vec3f,
  @location(1) worldPos          : vec3f,
};

@vertex
fn vs_obstacle(@location(0) pos : vec3f, @location(1) norm : vec3f) -> VOut {
  let worldPos = (u.modelMat * vec4f(pos, 1.0)).xyz;
  let viewPos  = (u.viewMat  * vec4f(worldPos, 1.0)).xyz;
  let nWorld   = normalize((u.modelMat * vec4f(norm, 0.0)).xyz);
  var out : VOut;
  out.clip = u.projMat * vec4f(viewPos, 1.0);
  out.normalWorld = nWorld;
  out.worldPos    = worldPos;
  return out;
}

// Turbo colormap for Cp: blue (low pressure / suction) → red (high pressure / stagnation).
fn turbo5(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.30, 0.45, 0.95);   // bright blue (Cp < 0, suction)
  let c1 = vec3f(0.20, 0.85, 0.95);   // cyan
  let c2 = vec3f(0.30, 0.95, 0.30);   // green (Cp ≈ 0)
  let c3 = vec3f(1.00, 0.85, 0.10);   // yellow
  let c4 = vec3f(1.00, 0.30, 0.10);   // red (Cp ≈ 1, stagnation)
  if tt < 0.25 { return mix(c0, c1, tt * 4.0); }
  if tt < 0.55 { return mix(c1, c2, (tt - 0.25) * 3.333); }
  if tt < 0.80 { return mix(c2, c3, (tt - 0.55) * 4.0); }
  return mix(c3, c4, (tt - 0.80) * 5.0);
}

@fragment
fn fs_obstacle(in : VOut) -> @location(0) vec4f {
  let nw = normalize(in.normalWorld);
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let uIn = u.scalars.x;
  let denom = max(0.5 * uIn * uIn, 1e-5);

  // Freestream baseline ρ — averaged from the four AABB-edge corners where
  // flow is least disturbed. LBM has a small bulk-density offset that would
  // otherwise tint the whole obstacle a constant colour.
  let baseRho = 0.25 * (
      textureSampleLevel(macrosTex, samp, vec3f(0.5, 0.95, 0.05), 0.0).w
    + textureSampleLevel(macrosTex, samp, vec3f(0.5, 0.05, 0.95), 0.0).w
    + textureSampleLevel(macrosTex, samp, vec3f(0.5, 0.95, 0.95), 0.0).w
    + textureSampleLevel(macrosTex, samp, vec3f(0.5, 0.05, 0.05), 0.0).w
  );

  // Average ρ over six probe depths along the outward normal — single-probe
  // sampling was picking up per-step LBM compressibility noise + per-vertex
  // facet variation, producing visible per-frame flicker ("super jittery"
  // user report). Spatial averaging across ~1–4 % of the tunnel length out
  // from the surface collapses that into a smooth, slowly-varying Cp.
  // The fixed denominator (160 = default lattice W = 2 N at N=80) means
  // probes stay at the same world distance independent of resolution; the
  // smoothing is for visual stability, not physically calibrated depth.
  let cellWorld = aabbSize.x / 160.0;
  var rhoSum : f32 = 0.0;
  for (var i : i32 = 0; i < 6; i = i + 1) {
    let d = cellWorld * (1.5 + f32(i));     // 1.5, 2.5, 3.5, 4.5, 5.5, 6.5 cells out
    let probe = in.worldPos + nw * d;
    let uvw = clamp((probe - u.aabbMin.xyz) / aabbSize, vec3f(0.005), vec3f(0.995));
    rhoSum = rhoSum + textureSampleLevel(macrosTex, samp, uvw, 0.0).w;
  }
  let rhoSurf = rhoSum / 6.0;

  let pLattice = (rhoSurf - baseRho) * (1.0 / 3.0);
  // Smaller LBM gain (was 4×) plus larger probe ensemble keeps the signal
  // alive without amplifying noise across the colour ramp every frame.
  let cpLBM = pLattice / denom * 1.5;

  // Direction-based proxy: smooth function of surface normal, no temporal
  // noise. Heavier weight now compensates for the reduced LBM gain so the
  // overall Cp range is similar.
  let frontness = clamp(dot(nw, u.upstream.xyz), -1.0, 1.0);
  let cp = clamp(cpLBM + frontness * 0.85, -1.5, 1.5);

  // Tighter mapping range: most data falls in ±0.6, so use that as the
  // colour span (rather than ±1.5) for dramatic gradients.
  let cpN = clamp((cp + 0.7) / 1.4, 0.0, 1.0);
  var col = turbo5(cpN);

  // Stronger ambient + softer Lambert so the colour ramp dominates the visual
  // (matching AirShaper's flat-shaded pressure plots where pressure is the
  // only signal carried by the surface colour).
  let lightDir = normalize(vec3f(-0.3, 0.85, 0.4));
  let ndotl = clamp(dot(nw, lightDir), 0.0, 1.0);
  col = col * (0.88 + 0.20 * ndotl);
  return vec4f(col, 1.0);
}
`;
