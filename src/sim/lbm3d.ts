import LBM_WGSL from './lbm3d.wgsl?raw';
import INIT_WGSL from './init3d.wgsl?raw';
import { voxelize, type ShapeId } from './voxelize';

/**
 * D3Q19 BGK Lattice Boltzmann solver, raw WebGPU.
 *
 * Storage:
 *  - fA, fB: storage buffers, length 19 * W * H * D, f32 each. Ping-pong.
 *  - mask: storage buffer, length W * H * D, u32 (0 fluid, 1 wall, 2 inlet, 3 outlet).
 *  - macros: texture_storage_3d<rgba16float, write>. Writes (u.xyz, rho) each step.
 *
 * The macros texture is the public surface for downstream passes (dye advection,
 * volumetric raymarcher). It can also be sampled by Three.js NodeMaterials.
 */
export class LBM3D {
  readonly device: GPUDevice;
  W: number;
  H: number;
  D: number;

  uIn = 0.08;
  visc = 0.005;
  aoaRad = 0;
  gravity: [number, number, number] = [0, 0, 0];
  useMRT = 0;   // 0 = BGK, 1 = TRT
  useLES = 0;   // 0 = off, 1 = Smagorinsky LES
  freeSlip = 0; // 0 = no-slip, 1 = free-slip

  // Resources (rebuilt on resize)
  private fA!: GPUBuffer;
  private fB!: GPUBuffer;
  private maskBuf!: GPUBuffer;
  private paramsBuf!: GPUBuffer;
  private macrosTex!: GPUTexture;
  private macrosView!: GPUTextureView;
  private stepPipeline!: GPUComputePipeline;
  private initPipeline!: GPUComputePipeline;
  private bindGroupAB!: GPUBindGroup;   // fA in, fB out
  private bindGroupBA!: GPUBindGroup;   // fB in, fA out
  private initBindGroup!: GPUBindGroup;
  private stepLayout!: GPUBindGroupLayout;
  private initLayout!: GPUBindGroupLayout;

  // Current obstacle params
  shape: ShapeId = 'sphere';
  obstacleRadius = 0;
  obstacleHalfLen = 0;
  charLengthCells = 1;

  private currentIsA = true; // tracks which buffer holds the *latest* state

  constructor(device: GPUDevice, W: number, H: number, D: number) {
    this.device = device;
    this.W = W;
    this.H = H;
    this.D = D;
    this.allocate();
    this.voxelizeAndUpload();
    this.runInit();
  }

  /** Allocate / reallocate buffers + textures + pipelines for current W/H/D. */
  private allocate() {
    const cells = this.W * this.H * this.D;
    const fSize = cells * 19 * 4;     // f32

    // Buffers
    this.fA = this.device.createBuffer({
      size: fSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.fB = this.device.createBuffer({
      size: fSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.maskBuf = this.device.createBuffer({
      size: cells * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.paramsBuf = this.device.createBuffer({
      size: 64,   // vec4u dims(16) + f32x4 omega/uIn/aoa/pad(16) + vec4f gravity(16) + u32x4 flags(16)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Macros 3D texture (rgba16float, channels = u.x, u.y, u.z, rho).
    this.macrosTex = this.device.createTexture({
      size: [this.W, this.H, this.D],
      dimension: '3d',
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    this.macrosView = this.macrosTex.createView({ dimension: '3d' });

    // Pipelines
    const stepModule = this.device.createShaderModule({ code: LBM_WGSL, label: 'lbm3d.wgsl' });
    const initModule = this.device.createShaderModule({ code: INIT_WGSL, label: 'init3d.wgsl' });

    this.stepLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      ],
    });

    this.initLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      ],
    });

    this.stepPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.stepLayout] }),
      compute: { module: stepModule, entryPoint: 'cs_step' },
    });
    this.initPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.initLayout] }),
      compute: { module: initModule, entryPoint: 'cs_init' },
    });

    this.bindGroupAB = this.device.createBindGroup({
      layout: this.stepLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuf } },
        { binding: 1, resource: { buffer: this.fA } },
        { binding: 2, resource: { buffer: this.fB } },
        { binding: 3, resource: { buffer: this.maskBuf } },
        { binding: 4, resource: this.macrosView },
      ],
    });
    this.bindGroupBA = this.device.createBindGroup({
      layout: this.stepLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuf } },
        { binding: 1, resource: { buffer: this.fB } },
        { binding: 2, resource: { buffer: this.fA } },
        { binding: 3, resource: { buffer: this.maskBuf } },
        { binding: 4, resource: this.macrosView },
      ],
    });
    this.initBindGroup = this.device.createBindGroup({
      layout: this.initLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuf } },
        { binding: 1, resource: { buffer: this.fA } },
        { binding: 2, resource: { buffer: this.fB } },
        { binding: 3, resource: { buffer: this.maskBuf } },
        { binding: 4, resource: this.macrosView },
      ],
    });
  }

  setShape(shape: ShapeId) {
    this.shape = shape;
    this.voxelizeAndUpload();
    this.runInit();
  }

  /** Upload a pre-computed mask directly (e.g. from a voxelized uploaded mesh). */
  setMaskBuffer(mask: Uint32Array) {
    this.device.queue.writeBuffer(this.maskBuf, 0, mask.buffer, 0, mask.byteLength);
    this.runInit();
  }

  /** Reallocate everything for a new lattice size. */
  resize(W: number, H: number, D: number) {
    this.dispose();
    this.W = W; this.H = H; this.D = D;
    this.allocate();
    this.voxelizeAndUpload();
    this.runInit();
  }

  private voxelizeAndUpload() {
    // Place obstacle 30% of the way along x.
    const cx = Math.round(this.W * 0.3);
    const cy = Math.round(this.H * 0.5);
    const cz = Math.round(this.D * 0.5);
    const r = Math.max(2, Math.round(Math.min(this.H, this.D) * 0.18));
    const halfLen = Math.max(2, Math.round(this.H * 0.42));

    this.obstacleRadius = r;
    this.obstacleHalfLen = halfLen;

    const mask = voxelize({
      W: this.W, H: this.H, D: this.D,
      shape: this.shape, cx, cy, cz, radius: r, halfLen, yaw: 0,
    });
    this.device.queue.writeBuffer(this.maskBuf, 0, mask.buffer, 0, mask.byteLength);
    this.charLengthCells = Math.max(2 * r, 1);
  }

  private writeParams() {
    const tau = 3 * this.visc + 0.5;
    const omega = 1 / Math.max(tau, 0.5001);
    // Layout (64 bytes):
    //   [0..3]  u32: W, H, D, pad       (16 bytes)
    //   [4..7]  f32: omega, uIn, aoa, pad (16 bytes)
    //   [8..11] f32: gx, gy, gz, pad    (16 bytes)
    //   [12..15] u32: useMRT, useLES, freeSlip, pad (16 bytes)
    const buf = new ArrayBuffer(64);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    u32[0] = this.W; u32[1] = this.H; u32[2] = this.D; u32[3] = 0;
    f32[4] = omega;
    f32[5] = this.uIn;
    f32[6] = this.aoaRad;
    f32[7] = 0;
    f32[8] = this.gravity[0];
    f32[9] = this.gravity[1];
    f32[10] = this.gravity[2];
    f32[11] = 0;
    u32[12] = this.useMRT;
    u32[13] = this.useLES;
    u32[14] = this.freeSlip;
    u32[15] = 0;
    this.device.queue.writeBuffer(this.paramsBuf, 0, buf);
  }

  /** Run init pipeline once. */
  private runInit() {
    this.writeParams();
    const enc = this.device.createCommandEncoder({ label: 'lbm-init' });
    const pass = enc.beginComputePass();
    pass.setPipeline(this.initPipeline);
    pass.setBindGroup(0, this.initBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.W / 4), Math.ceil(this.H / 4), Math.ceil(this.D / 4));
    pass.end();
    this.device.queue.submit([enc.finish()]);
    this.currentIsA = true;
  }

  resetFlow() {
    this.runInit();
  }

  /** Advance by one LBM timestep. */
  step() {
    this.writeParams();
    const enc = this.device.createCommandEncoder({ label: 'lbm-step' });
    const pass = enc.beginComputePass();
    pass.setPipeline(this.stepPipeline);
    pass.setBindGroup(0, this.currentIsA ? this.bindGroupAB : this.bindGroupBA);
    pass.dispatchWorkgroups(Math.ceil(this.W / 4), Math.ceil(this.H / 4), Math.ceil(this.D / 4));
    pass.end();
    this.device.queue.submit([enc.finish()]);
    this.currentIsA = !this.currentIsA;
  }

  /** The macros texture: rgba16float, channels (u.x, u.y, u.z, rho). */
  get macrosTexture(): GPUTexture { return this.macrosTex; }
  get macrosTextureView(): GPUTextureView { return this.macrosView; }

  /** Current f-buffer (the one holding the latest state). Used by inject shader. */
  get currentFBuffer(): GPUBuffer { return this.currentIsA ? this.fA : this.fB; }

  dispose() {
    this.fA?.destroy();
    this.fB?.destroy();
    this.maskBuf?.destroy();
    this.paramsBuf?.destroy();
    this.macrosTex?.destroy();
  }
}
