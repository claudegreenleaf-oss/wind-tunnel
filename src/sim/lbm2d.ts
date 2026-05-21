/**
 * D2Q9 lattice Boltzmann fluid for the 2D mode of the wind tunnel.
 *
 * The macros texture is a thin 3D texture (W×H×1) so the existing 3D-facing
 * renderers (particles, streamlines, slice viewer) can sample it without
 * needing a new code path. We write velocity into rgb (with uz=0) and
 * density into the alpha channel so .xyz still means "velocity vector"
 * and .w still means "ρ" — matching the convention every consumer expects.
 */
import LBM2D_WGSL from './lbm2d.wgsl?raw';

export type Scene2D = 'circle' | 'cavity';

export class LBM2D {
  readonly device: GPUDevice;
  W: number;
  H: number;
  readonly D = 1;

  uIn = 0.08;
  visc = 0.005;
  inletR = 0.18;
  shape: Scene2D = 'circle';
  obstacleXFrac = 0.3;
  obstacleScale = 1;
  charLengthCells = 1;

  // No-op shims so callers expecting the LBM3D API don't have to branch.
  aoaRad = 0;
  gravity: [number, number, number] = [0, 0, 0];
  useMRT = 0;
  useLES = 0;
  freeSlip = 0;
  useRegularized = 0;

  private fA!: GPUBuffer;
  private fB!: GPUBuffer;
  private maskBuf!: GPUBuffer;
  private paramsBuf!: GPUBuffer;
  private macrosTex!: GPUTexture;
  private macrosView!: GPUTextureView;
  private stepPipeline!: GPUComputePipeline;
  private initPipeline!: GPUComputePipeline;
  private bgAB!: GPUBindGroup;
  private bgBA!: GPUBindGroup;
  private bgInit!: GPUBindGroup;
  private currentIsA = true;

  constructor(device: GPUDevice, W: number, H: number) {
    this.device = device;
    this.W = W;
    this.H = H;
    this.allocate();
    this.voxelize();
    this.runInit();
  }

  get macrosTextureView(): GPUTextureView { return this.macrosView; }
  get maskBuffer(): GPUBuffer { return this.maskBuf; }

  setUIn(u: number) { this.uIn = u; this.writeParams(); }
  setVisc(v: number) { this.visc = v; this.writeParams(); }

  setShape(shape: Scene2D, xFrac: number, scale: number) {
    this.shape = shape;
    this.obstacleXFrac = xFrac;
    this.obstacleScale = Math.max(0.1, scale);
    this.voxelize();
    this.runInit();
  }

  /** Compute ω from kinematic viscosity (lattice units): ω = 1 / (3ν + 0.5). */
  private omegaFromVisc(): number {
    return 1.0 / (3.0 * this.visc + 0.5);
  }

  private writeParams() {
    const buf = new ArrayBuffer(32);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    u32[0] = this.W; u32[1] = this.H; u32[2] = 0; u32[3] = 0;
    f32[4] = this.omegaFromVisc();
    f32[5] = this.uIn;
    f32[6] = 0;
    f32[7] = this.inletR;
    this.device.queue.writeBuffer(this.paramsBuf, 0, buf);
  }

  private allocate() {
    const cells = this.W * this.H;
    const fSize = cells * 9 * 4;

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
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.macrosTex = this.device.createTexture({
      label: 'lbm2d-macros',
      size: [this.W, this.H, 1],
      format: 'rgba16float',
      dimension: '3d',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.macrosView = this.macrosTex.createView({ dimension: '3d' });

    const layout = this.device.createBindGroupLayout({
      label: 'lbm2d-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      ],
    });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const mod = this.device.createShaderModule({ code: LBM2D_WGSL, label: 'lbm2d.wgsl' });
    this.initPipeline = this.device.createComputePipeline({
      layout: pipelineLayout, compute: { module: mod, entryPoint: 'cs_init' },
    });
    this.stepPipeline = this.device.createComputePipeline({
      layout: pipelineLayout, compute: { module: mod, entryPoint: 'cs_step' },
    });

    const mkBG = (fIn: GPUBuffer, fOut: GPUBuffer): GPUBindGroup =>
      this.device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuf } },
          { binding: 1, resource: { buffer: fIn } },
          { binding: 2, resource: { buffer: fOut } },
          { binding: 3, resource: { buffer: this.maskBuf } },
          { binding: 4, resource: this.macrosView },
        ],
      });
    this.bgAB = mkBG(this.fA, this.fB);
    this.bgBA = mkBG(this.fB, this.fA);
    this.bgInit = mkBG(this.fA, this.fB);
    this.writeParams();
  }

  /** Rebuild the solid mask for the current scene. */
  private voxelize() {
    const m = new Uint32Array(this.W * this.H);
    const cx = this.obstacleXFrac * this.W;
    const cy = this.H * 0.5;

    if (this.shape === 'circle') {
      // Cylinder cross-flow: a filled disc of radius ~ 12% of H × scale.
      const r = Math.max(2, this.H * 0.12 * this.obstacleScale);
      const r2 = r * r;
      let frontalCount = 0;
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy < r2) m[y * this.W + x] = 1;
        }
      }
      // Frontal cells: column of cells at xCenter that are solid.
      const xc = Math.round(cx);
      for (let y = 0; y < this.H; y++) {
        if (m[y * this.W + xc] === 1) frontalCount++;
      }
      this.charLengthCells = Math.max(1, frontalCount);
    } else {
      // Floor cavity: a rectangular notch cut INTO the floor (y = 0 .. cavityDepth)
      // The cavity spans cavityW cells in X, centred on obstacleXFrac.
      const cavityH = Math.max(3, Math.round(this.H * 0.25 * this.obstacleScale));
      const cavityW = Math.max(6, Math.round(this.W * 0.18 * this.obstacleScale));
      const xLo = Math.max(0, Math.round(cx - cavityW / 2));
      const xHi = Math.min(this.W, xLo + cavityW);
      // Floor: bottom row of solid cells (y=0). Cavity removes a section.
      // Outside the cavity X range, y=0 is solid (floor). Inside cavity X
      // range, the floor is removed and instead there's a U-shaped trench.
      for (let x = 0; x < this.W; x++) {
        if (x < xLo || x >= xHi) {
          // Solid floor
          m[0 * this.W + x] = 1;
        } else {
          // Trench bottom (cavityH cells below baseline)
          // Since y=0 is the bottom of the domain, model the cavity by placing
          // floor at y=cavityH AND walls at x=xLo and x=xHi from y=0 to y=cavityH-1
          for (let y = 0; y <= cavityH; y++) {
            if (y === cavityH) m[y * this.W + x] = 1;
          }
        }
      }
      // Cavity side walls
      for (let y = 0; y < Math.max(3, Math.round(this.H * 0.25 * this.obstacleScale)); y++) {
        if (xLo >= 0 && xLo < this.W) m[y * this.W + xLo] = 1;
        if (xHi - 1 >= 0 && xHi - 1 < this.W) m[y * this.W + xHi - 1] = 1;
      }
      // Frontal length proxy = cavity depth
      this.charLengthCells = cavityH;
    }

    // Top wall (y=H-1) as solid for the cavity case so flow channels above.
    if (this.shape === 'cavity') {
      for (let x = 0; x < this.W; x++) m[(this.H - 1) * this.W + x] = 1;
    }

    this.device.queue.writeBuffer(this.maskBuf, 0, m.buffer);
  }

  private runInit() {
    const enc = this.device.createCommandEncoder({ label: 'lbm2d-init' });
    const pass = enc.beginComputePass();
    pass.setPipeline(this.initPipeline);
    pass.setBindGroup(0, this.bgInit);
    pass.dispatchWorkgroups(Math.ceil(this.W / 8), Math.ceil(this.H / 8));
    pass.end();
    this.device.queue.submit([enc.finish()]);
    this.currentIsA = true;
  }

  /** Advance one LBM step (collide + stream + boundary). */
  step() {
    const enc = this.device.createCommandEncoder({ label: 'lbm2d-step' });
    const pass = enc.beginComputePass();
    pass.setPipeline(this.stepPipeline);
    pass.setBindGroup(0, this.currentIsA ? this.bgAB : this.bgBA);
    pass.dispatchWorkgroups(Math.ceil(this.W / 8), Math.ceil(this.H / 8));
    pass.end();
    this.device.queue.submit([enc.finish()]);
    this.currentIsA = !this.currentIsA;
  }

  reset() { this.runInit(); }

  /** Rebuild buffers for a new domain size. */
  resize(W: number, H: number, _D?: number) {
    this.dispose();
    this.W = W;
    this.H = H;
    this.allocate();
    this.voxelize();
    this.runInit();
  }

  dispose() {
    this.fA.destroy();
    this.fB.destroy();
    this.maskBuf.destroy();
    this.paramsBuf.destroy();
    this.macrosTex.destroy();
  }
}
