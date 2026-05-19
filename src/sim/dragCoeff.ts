/**
 * Estimate the drag coefficient Cd of the current obstacle by integrating
 * the pressure over its surface.
 *
 * Method:
 *   For every fluid cell that has at least one solid neighbour, the shared
 *   face is a piece of the obstacle's wetted surface. The pressure force on
 *   the obstacle at that face is `(p - p_inf) * d` (lattice units, where
 *   d is the unit vector from the fluid cell to the solid neighbour). The
 *   x-component, summed over every such face, is the drag force F.
 *
 *   Cd = F / (0.5 * rho_inf * U^2 * A)
 *
 *   with rho_inf = 1, U = inlet velocity, A = frontal cross-sectional area
 *   (in lattice units squared; the caller supplies it from the mask buffer).
 *
 * Float atomics aren't widely available in WebGPU, so we accumulate into an
 * i32 in fixed-point (multiplied by FIXED_SCALE) and rescale on readback.
 */

const FIXED_SCALE = 1e6;

const SHADER = /* wgsl */ `
struct Uniforms {
  dims : vec4<u32>,           // W, H, D, padding
  uIn  : vec4<f32>,           // inlet velocity (x), pad
};
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var macros : texture_3d<f32>;
@group(0) @binding(2) var samp   : sampler;
@group(0) @binding(3) var<storage, read> mask : array<u32>;
@group(0) @binding(4) var<storage, read_write> outI32 : array<atomic<i32>>;

fn idxOf(x : u32, y : u32, z : u32) -> u32 {
  return x + y * u.dims.x + z * u.dims.x * u.dims.y;
}

@compute @workgroup_size(4, 4, 4)
fn cs_drag(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= u.dims.x || gid.y >= u.dims.y || gid.z >= u.dims.z) { return; }
  let i = idxOf(gid.x, gid.y, gid.z);

  // Need fluid cells only — skip solid.
  if (mask[i] != 0u) { return; }

  // Sample macros at the cell centre. Channel .w = rho.
  let dims_f = vec3<f32>(u.dims.xyz);
  let uvw = (vec3<f32>(gid) + 0.5) / dims_f;
  let macros_local = textureSampleLevel(macros, samp, uvw, 0.0);
  let rho = macros_local.w;
  // Δp = (ρ - 1) / 3   (LBM equation of state, p = ρ * cs² with cs² = 1/3)
  let dp = (rho - 1.0) * (1.0 / 3.0);

  // Check 6 neighbours; for each solid one accumulate p * d.x into Fx.
  var fx : f32 = 0.0;
  // +X
  if (gid.x + 1u < u.dims.x && mask[idxOf(gid.x + 1u, gid.y, gid.z)] == 1u) { fx = fx + dp; }
  // -X
  if (gid.x >= 1u            && mask[idxOf(gid.x - 1u, gid.y, gid.z)] == 1u) { fx = fx - dp; }
  // ±Y / ±Z don't contribute to Fx (d.x = 0), but we still need them for
  // future use (lift = Fy). Skipped to keep the shader minimal.

  if (fx != 0.0) {
    atomicAdd(&outI32[0], i32(fx * ${FIXED_SCALE.toExponential()}));
  }
}

@compute @workgroup_size(1)
fn cs_clear() {
  atomicStore(&outI32[0], 0);
}
`;

export class DragCoeffCalc {
  private device: GPUDevice;
  private uniformBuf: GPUBuffer;
  private outBuf: GPUBuffer;
  private readBuf: GPUBuffer;
  private pipelineDrag: GPUComputePipeline;
  private pipelineClear: GPUComputePipeline;
  private layout: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null = null;
  private W = 1; private H = 1; private D = 1;
  private uIn = 0.1;
  private readPending = false;
  private lastFx = 0;

  /** Frontal area in lattice units (cells²). Set by `setFrontalArea`. */
  private frontalArea = 1;
  /** Approximate cell side-length in world units (so Cd is unit-consistent). */
  private cellWorld = 1;

  constructor(device: GPUDevice) {
    this.device = device;
    this.uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.outBuf = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.readBuf = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const mod = device.createShaderModule({ code: SHADER, label: 'dragCoeff.wgsl' });
    this.layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pl = device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
    this.pipelineDrag = device.createComputePipeline({ layout: pl, compute: { module: mod, entryPoint: 'cs_drag' } });
    this.pipelineClear = device.createComputePipeline({ layout: pl, compute: { module: mod, entryPoint: 'cs_clear' } });
  }

  /** Rebind macros + mask + lattice dims. Call after any LBM resize/voxelization. */
  setInputs(macros: GPUTextureView, mask: GPUBuffer, dims: { W: number; H: number; D: number }) {
    this.W = dims.W; this.H = dims.H; this.D = dims.D;
    const sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.bindGroup = this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: macros },
        { binding: 2, resource: sampler },
        { binding: 3, resource: { buffer: mask } },
        { binding: 4, resource: { buffer: this.outBuf } },
      ],
    });
  }

  setUIn(u: number) { this.uIn = u; }
  setFrontalArea(cells: number, cellWorld: number) {
    this.frontalArea = Math.max(1, cells);
    this.cellWorld = cellWorld;
  }

  /**
   * Dispatch the drag-integration compute pass. Result is fetched
   * asynchronously; `getLastCd()` returns the most-recent finished result.
   */
  compute() {
    if (!this.bindGroup) return;
    if (this.readPending) return;     // skip if a previous readback is still pending

    // Write uniforms
    const buf = new ArrayBuffer(32);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    u32[0] = this.W; u32[1] = this.H; u32[2] = this.D; u32[3] = 0;
    f32[4] = this.uIn; f32[5] = 0; f32[6] = 0; f32[7] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf);

    const enc = this.device.createCommandEncoder({ label: 'drag-coeff' });

    // Clear accumulator
    {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.pipelineClear);
      cp.setBindGroup(0, this.bindGroup);
      cp.dispatchWorkgroups(1);
      cp.end();
    }
    // Integrate over the lattice
    {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.pipelineDrag);
      cp.setBindGroup(0, this.bindGroup);
      cp.dispatchWorkgroups(
        Math.ceil(this.W / 4),
        Math.ceil(this.H / 4),
        Math.ceil(this.D / 4),
      );
      cp.end();
    }
    enc.copyBufferToBuffer(this.outBuf, 0, this.readBuf, 0, 4);
    this.device.queue.submit([enc.finish()]);

    this.readPending = true;
    this.readBuf.mapAsync(GPUMapMode.READ).then(() => {
      const arr = new Int32Array(this.readBuf.getMappedRange().slice(0));
      this.readBuf.unmap();
      this.lastFx = arr[0] / FIXED_SCALE;
      this.readPending = false;
    }).catch(() => { this.readPending = false; });
  }

  /** Most recent finished drag force estimate (lattice units). */
  getLastFx(): number { return this.lastFx; }

  /** Cd = F / (0.5 * ρ_inf * U² * A). All in consistent lattice units. */
  getLastCd(): number {
    const denom = 0.5 * 1.0 * this.uIn * this.uIn * this.frontalArea;
    if (denom < 1e-9) return 0;
    return this.lastFx / denom;
  }

  dispose() {
    this.uniformBuf.destroy();
    this.outBuf.destroy();
    this.readBuf.destroy();
  }
}
