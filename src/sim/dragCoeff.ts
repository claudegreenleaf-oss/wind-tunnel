/**
 * Drag coefficient via on-the-fly Cauchy stress integration over the
 * wetted obstacle surface.
 *
 * For every fluid cell adjacent to a solid cell, the shared face is a
 * piece of the obstacle's wetted boundary. The traction on the body from
 * the fluid at that face is
 *
 *     dF_α  =  + p · d_α                  (pressure)
 *              − 2μ · S_αβ · d_β          (viscous)
 *
 * where
 *   d        = unit vector from fluid → solid (= inward normal of the body),
 *   p        = (ρ − 1) / 3      (LBM equation of state, c_s² = 1/3),
 *   S_αβ     = ½(∂u_α/∂x_β + ∂u_β/∂x_α)   (strain-rate tensor),
 *   μ        = ρν ≈ ν           (dynamic viscosity at ρ ≈ 1, lattice units).
 *
 * Summing dF_x over all such faces yields the streamwise drag F_x; the
 * drag coefficient follows from
 *
 *     Cd = F_x / (½ · ρ_∞ · U² · A)       with ρ_∞ = 1, U = inlet speed,
 *
 * and A = frontal silhouette area in lattice cells² (computed on JS side).
 *
 * Improvements over the pressure-only first cut:
 *   - Includes the viscous (skin-friction) stress; brings sphere Cd from
 *     ~0.3 up toward the textbook ~0.45 at moderate Re.
 *   - Integrates over all six axis directions, not just ±X — picks up the
 *     ∂u_x/∂y and ∂u_x/∂z gradient contributions to drag.
 *   - JS-side exponential moving average smooths the per-frame jitter so
 *     the HUD doesn't flicker.
 *
 * References:
 *   Mei, Yu, Shyy, Luo, Phys. Rev. E 65, 041203 (2002) — stress integration
 *   Krüger et al., "The Lattice Boltzmann Method" (Springer 2016), Ch. 6 & 11
 *   OpenFOAM forceCoeffs functionObject (per-face F_p / F_v formulae)
 *
 * Float atomics aren't generally available in WebGPU, so we accumulate
 * into i32 in fixed-point (× FIXED_SCALE) and rescale on readback.
 */

const FIXED_SCALE = 1e6;

const SHADER = /* wgsl */ `
struct Uniforms {
  dims  : vec4<u32>,            // W, H, D, 0
  scalars : vec4<f32>,          // visc (≈ μ at ρ=1), uIn, 0, 0
};
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var macros : texture_3d<f32>;
@group(0) @binding(2) var samp   : sampler;
@group(0) @binding(3) var<storage, read> mask : array<u32>;
@group(0) @binding(4) var<storage, read_write> outI32 : array<atomic<i32>>;

const ONE_THIRD : f32 = 0.33333333333;

fn idxOf(x : u32, y : u32, z : u32) -> u32 {
  return x + y * u.dims.x + z * u.dims.x * u.dims.y;
}

/// Sample (u_x, u_y, u_z) at integer cell coordinates. Coordinates outside
/// the lattice are clamped to the boundary (one-sided diff fallback).
fn sampleU(x : i32, y : i32, z : i32) -> vec3<f32> {
  let xc = clamp(x, 0, i32(u.dims.x) - 1);
  let yc = clamp(y, 0, i32(u.dims.y) - 1);
  let zc = clamp(z, 0, i32(u.dims.z) - 1);
  let dims_f = vec3<f32>(u.dims.xyz);
  let uvw = (vec3<f32>(f32(xc), f32(yc), f32(zc)) + 0.5) / dims_f;
  let m = textureSampleLevel(macros, samp, uvw, 0.0);
  return m.xyz;
}

@compute @workgroup_size(4, 4, 4)
fn cs_drag(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = u.dims.x;
  let H = u.dims.y;
  let D = u.dims.z;
  if (gid.x >= W || gid.y >= H || gid.z >= D) { return; }
  let i = idxOf(gid.x, gid.y, gid.z);

  // Need fluid cells only.
  if (mask[i] != 0u) { return; }

  // Identify which axis neighbours are solid (we contribute one face per).
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);

  let solidPx = (gid.x + 1u  <  W) && mask[idxOf(gid.x + 1u, gid.y, gid.z)] == 1u;
  let solidMx = (gid.x       >= 1u) && mask[idxOf(gid.x - 1u, gid.y, gid.z)] == 1u;
  let solidPy = (gid.y + 1u  <  H) && mask[idxOf(gid.x, gid.y + 1u, gid.z)] == 1u;
  let solidMy = (gid.y       >= 1u) && mask[idxOf(gid.x, gid.y - 1u, gid.z)] == 1u;
  let solidPz = (gid.z + 1u  <  D) && mask[idxOf(gid.x, gid.y, gid.z + 1u)] == 1u;
  let solidMz = (gid.z       >= 1u) && mask[idxOf(gid.x, gid.y, gid.z - 1u)] == 1u;

  if (!(solidPx || solidMx || solidPy || solidMy || solidPz || solidMz)) {
    return;
  }

  // Centre-cell ρ and pressure.
  let dims_f = vec3<f32>(u.dims.xyz);
  let uvw0 = (vec3<f32>(gid) + 0.5) / dims_f;
  let m0 = textureSampleLevel(macros, samp, uvw0, 0.0);
  let rho = m0.w;
  let p = (rho - 1.0) * ONE_THIRD;

  // Velocity gradients via central differences (clamped at boundaries).
  // Cells inside the solid have u ≈ 0 (no-slip BC), which gives a steep
  // wall gradient and a meaningful viscous traction. Staircase error is
  // partially absorbed by summing all 6 face contributions.
  let u_px = sampleU(ix + 1, iy,     iz);
  let u_mx = sampleU(ix - 1, iy,     iz);
  let u_py = sampleU(ix,     iy + 1, iz);
  let u_my = sampleU(ix,     iy - 1, iz);
  let u_pz = sampleU(ix,     iy,     iz + 1);
  let u_mz = sampleU(ix,     iy,     iz - 1);

  let dux_dx = (u_px.x - u_mx.x) * 0.5;
  let dux_dy = (u_py.x - u_my.x) * 0.5;
  let dux_dz = (u_pz.x - u_mz.x) * 0.5;
  let duy_dx = (u_px.y - u_mx.y) * 0.5;
  let duz_dx = (u_px.z - u_mx.z) * 0.5;

  // Strain-rate components touching F_x.
  let Sxx = dux_dx;
  let Sxy = 0.5 * (dux_dy + duy_dx);
  let Sxz = 0.5 * (dux_dz + duz_dx);

  let mu = u.scalars.x;
  let two_mu_Sxx = 2.0 * mu * Sxx;
  let two_mu_Sxy = 2.0 * mu * Sxy;
  let two_mu_Sxz = 2.0 * mu * Sxz;

  // F_x contribution per face. Convention: F_x = +p·d_x − 2μ·(S_xβ·d_β).
  // Verified: a stagnation-point face (d=+X, p>0, S≈0) gives F_x ≈ +p > 0,
  // i.e. the front of the obstacle drags downstream — same sign as flow.
  var fx : f32 = 0.0;
  if (solidPx) { fx = fx +  p - two_mu_Sxx; }
  if (solidMx) { fx = fx + -p + two_mu_Sxx; }
  if (solidPy) { fx = fx + -two_mu_Sxy; }
  if (solidMy) { fx = fx +  two_mu_Sxy; }
  if (solidPz) { fx = fx + -two_mu_Sxz; }
  if (solidMz) { fx = fx +  two_mu_Sxz; }

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
  private visc = 0.02;
  private readPending = false;
  private lastFx = 0;

  /** Frontal area in lattice units (cells²). Set by `setFrontalArea`. */
  private frontalArea = 1;

  /** Exponential-moving-average Cd; smooths transient noise for the HUD. */
  private cdEMA = 0;
  private emaAlpha = 0.15;
  /** Samples since the last shape/scale/orientation change. Used to skip the
   *  big transient spike that always follows a re-voxelization. */
  private samplesSinceReset = 0;

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
    // Reset the EMA so we don't drag the old shape's value into the new one.
    this.cdEMA = 0;
    this.samplesSinceReset = 0;
  }

  setUIn(u: number) { this.uIn = u; }
  setVisc(v: number) { this.visc = v; }
  setFrontalArea(cells: number) {
    this.frontalArea = Math.max(1, cells);
  }

  /**
   * Dispatch the drag-integration compute pass. The result is fetched
   * asynchronously; `getLastCd()` returns the most-recent finished value.
   */
  compute() {
    if (!this.bindGroup) return;
    if (this.readPending) return;     // a previous readback is still in flight

    // Uniforms: dims (4 × u32) + (visc, uIn, 0, 0)
    const buf = new ArrayBuffer(32);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    u32[0] = this.W; u32[1] = this.H; u32[2] = this.D; u32[3] = 0;
    f32[4] = this.visc; f32[5] = this.uIn; f32[6] = 0; f32[7] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf);

    const enc = this.device.createCommandEncoder({ label: 'drag-coeff' });
    {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.pipelineClear);
      cp.setBindGroup(0, this.bindGroup);
      cp.dispatchWorkgroups(1);
      cp.end();
    }
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
      // EMA on Cd. Skip the first 3 samples after a reset — those carry the
      // big spike from re-voxelization transients.
      const cdInst = this.computeInstCd();
      this.samplesSinceReset++;
      if (this.samplesSinceReset <= 3) {
        this.cdEMA = cdInst;
      } else {
        this.cdEMA = (1 - this.emaAlpha) * this.cdEMA + this.emaAlpha * cdInst;
      }
      this.readPending = false;
    }).catch(() => { this.readPending = false; });
  }

  private computeInstCd(): number {
    const denom = 0.5 * 1.0 * this.uIn * this.uIn * this.frontalArea;
    if (denom < 1e-9) return 0;
    return this.lastFx / denom;
  }

  /** Smoothed (EMA) drag coefficient — what the HUD should display. */
  getLastCd(): number { return this.cdEMA; }

  /** Most recent finished drag force estimate (lattice units). */
  getLastFx(): number { return this.lastFx; }

  dispose() {
    this.uniformBuf.destroy();
    this.outBuf.destroy();
    this.readBuf.destroy();
  }
}
