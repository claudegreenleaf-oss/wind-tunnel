import ADVECT_WGSL from './dye-advect.wgsl?raw';
import INJECT_WGSL from './dye-inject.wgsl?raw';

export class DyeField3D {
  readonly device: GPUDevice;
  readonly W: number;
  readonly H: number;
  readonly D: number;

  private texA!: GPUTexture;
  private texB!: GPUTexture;
  private viewA!: GPUTextureView;
  private viewB!: GPUTextureView;

  private sampler!: GPUSampler;
  private advectParamsBuf!: GPUBuffer;
  private injectParamsBuf!: GPUBuffer;

  private advectPipeline!: GPUComputePipeline;
  private injectPipeline!: GPUComputePipeline;

  private injectBGA!: GPUBindGroup; // target=A
  private injectBGB!: GPUBindGroup; // target=B

  private currentIsA = true;
  private getMacrosView: () => GPUTextureView;

  decay = 0.992;       // moderate persistence so streaks fade gracefully downstream
  injectAmount = 0.7;  // softer injection so we don't saturate at the inlet

  constructor(device: GPUDevice, W: number, H: number, D: number, getMacrosView: () => GPUTextureView) {
    this.device = device;
    this.W = W;
    this.H = H;
    this.D = D;
    this.getMacrosView = getMacrosView;
    this.allocate();
  }

  private allocate() {
    const fmt: GPUTextureFormat = 'rgba16float';
    const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;

    this.texA = this.device.createTexture({ size: [this.W, this.H, this.D], dimension: '3d', format: fmt, usage });
    this.texB = this.device.createTexture({ size: [this.W, this.H, this.D], dimension: '3d', format: fmt, usage });
    this.viewA = this.texA.createView({ dimension: '3d' });
    this.viewB = this.texB.createView({ dimension: '3d' });

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });

    // Params buffers (16 bytes each)
    this.advectParamsBuf = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.injectParamsBuf = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Pipelines
    const advectModule = this.device.createShaderModule({ code: ADVECT_WGSL, label: 'dye-advect' });
    const injectModule = this.device.createShaderModule({ code: INJECT_WGSL, label: 'dye-inject' });

    const advectBGL = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      ],
    });

    const injectBGL = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-write', format: 'rgba16float', viewDimension: '3d' } },
      ],
    });

    this.advectPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [advectBGL] }),
      compute: { module: advectModule, entryPoint: 'cs_advect' },
    });
    this.injectPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [injectBGL] }),
      compute: { module: injectModule, entryPoint: 'cs_inject' },
    });

    this.injectBGA = this.device.createBindGroup({
      layout: injectBGL,
      entries: [
        { binding: 0, resource: { buffer: this.injectParamsBuf } },
        { binding: 1, resource: this.viewA },
      ],
    });
    this.injectBGB = this.device.createBindGroup({
      layout: injectBGL,
      entries: [
        { binding: 0, resource: { buffer: this.injectParamsBuf } },
        { binding: 1, resource: this.viewB },
      ],
    });

    this.advectBGLayout = advectBGL;
    this.currentIsA = true;
  }

  private advectBGLayout!: GPUBindGroupLayout;

  private makeAdvectBG(layout: GPUBindGroupLayout, prevView: GPUTextureView, nextView: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.advectParamsBuf } },
        { binding: 1, resource: this.getMacrosView() },
        { binding: 2, resource: prevView },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: nextView },
      ],
    });
  }

  /** Advance one dye step: advect then inject at inlet. */
  step() {
    this.writeParams();

    // Rebuild advect bind groups each step (macros view may be stable, but this is safe)
    const advectBG = this.currentIsA
      ? this.makeAdvectBG(this.advectBGLayout, this.viewA, this.viewB)
      : this.makeAdvectBG(this.advectBGLayout, this.viewB, this.viewA);

    // After advect, next buffer becomes current
    const injectBG = this.currentIsA ? this.injectBGB : this.injectBGA;

    const enc = this.device.createCommandEncoder({ label: 'dye-step' });

    // Advect pass
    const ap = enc.beginComputePass();
    ap.setPipeline(this.advectPipeline);
    ap.setBindGroup(0, advectBG);
    ap.dispatchWorkgroups(Math.ceil(this.W / 4), Math.ceil(this.H / 4), Math.ceil(this.D / 4));
    ap.end();

    // Inject pass — workgroup is (4,4,4), shader self-limits to first 14 cells along X
    const ip = enc.beginComputePass();
    ip.setPipeline(this.injectPipeline);
    ip.setBindGroup(0, injectBG);
    ip.dispatchWorkgroups(Math.ceil(16 / 4), Math.ceil(this.H / 4), Math.ceil(this.D / 4));
    ip.end();

    this.device.queue.submit([enc.finish()]);
    this.currentIsA = !this.currentIsA;
  }

  private writeParams() {
    const advBuf = new ArrayBuffer(32);
    const advU32 = new Uint32Array(advBuf);
    const advF32 = new Float32Array(advBuf);
    advU32[0] = this.W; advU32[1] = this.H; advU32[2] = this.D; advU32[3] = 0;
    advF32[4] = this.decay;
    advF32[5] = 0; advF32[6] = 0; advF32[7] = 0;
    this.device.queue.writeBuffer(this.advectParamsBuf, 0, advBuf);

    const injBuf = new ArrayBuffer(32);
    const injU32 = new Uint32Array(injBuf);
    const injF32 = new Float32Array(injBuf);
    injU32[0] = this.W; injU32[1] = this.H; injU32[2] = this.D; injU32[3] = 0;
    injF32[4] = this.injectAmount;
    injF32[5] = 0; injF32[6] = 0; injF32[7] = 0;
    this.device.queue.writeBuffer(this.injectParamsBuf, 0, injBuf);
  }

  /** The current dye texture view (for the volumetric renderer). */
  get currentView(): GPUTextureView {
    // After step(), currentIsA has been flipped, so current output is the OTHER one
    return this.currentIsA ? this.viewA : this.viewB;
  }

  dispose() {
    this.texA?.destroy();
    this.texB?.destroy();
    this.advectParamsBuf?.destroy();
    this.injectParamsBuf?.destroy();
  }
}
