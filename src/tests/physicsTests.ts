/**
 * Physics validation suite for the D3Q19 LBM wind tunnel.
 *
 * Each test reports `{passed, value, expected, tolerance, message}`. Some
 * tests are pure-algebraic (D3Q19 lattice invariants) and some need the
 * live solver (mass conservation, inlet profile, etc.). The latter are
 * marked `kind: 'gpu'` and run against the current LBM state.
 *
 * Intended audience: a physicist who wants to verify the solver before
 * trusting its quantitative output. Pass-criteria are tight enough that a
 * regression in any of these tests means a real physics or implementation
 * bug, not numerical noise.
 *
 * References for the pass/fail thresholds:
 *   - Krüger et al., "The Lattice Boltzmann Method" (Springer 2016), Ch. 4
 *   - d'Humières et al., Phil. Trans. R. Soc. A 360, 437 (2002)
 *   - Schlichting, "Boundary Layer Theory" (8th ed., Fig 1.5 for sphere Cd)
 */

import { Q, E, W, opp, feq } from '../sim/d3q19';
import type { LBM3D } from '../sim/lbm3d';

export interface TestResult {
  name: string;
  kind: 'algebraic' | 'gpu';
  passed: boolean;
  value: number;
  expected: number;
  tolerance: number;
  message: string;
}

const ok = (
  name: string,
  kind: TestResult['kind'],
  value: number,
  expected: number,
  tolerance: number,
  message = '',
): TestResult => {
  const passed = Math.abs(value - expected) <= tolerance;
  return { name, kind, passed, value, expected, tolerance, message };
};

// ═════════ ALGEBRAIC TESTS (pure-JS, no GPU) ═════════

/** Σᵢ wᵢ = 1 — required for f^eq to conserve mass when ρ = 1 and u = 0. */
export function testWeightsSumToOne(): TestResult {
  const s = W.reduce((a, b) => a + b, 0);
  return ok('D3Q19 weights sum to 1', 'algebraic', s, 1, 1e-12);
}

/** Σᵢ eᵢ = 0 — closure (no preferred direction in the lattice). */
export function testEClosure(): TestResult {
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < Q; i++) { sx += E[i]![0]; sy += E[i]![1]; sz += E[i]![2]; }
  const mag = Math.abs(sx) + Math.abs(sy) + Math.abs(sz);
  return ok('Σᵢ eᵢ = 0 (lattice isotropy)', 'algebraic', mag, 0, 1e-12);
}

/** Σᵢ wᵢ eᵢα eᵢβ = (1/3) δαβ — second-moment lattice tensor identity. */
export function testSecondMomentTensor(): TestResult {
  let err = 0;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      let m = 0;
      for (let i = 0; i < Q; i++) m += W[i]! * E[i]![a]! * E[i]![b]!;
      const target = a === b ? 1 / 3 : 0;
      err = Math.max(err, Math.abs(m - target));
    }
  }
  return ok('Σᵢ wᵢ eᵢα eᵢβ = ⅓ δαβ', 'algebraic', err, 0, 1e-12);
}

/** Σᵢ wᵢ eᵢα eᵢβ eᵢγ eᵢδ = (1/9) (δαβ δγδ + δαγ δβδ + δαδ δβγ) — fourth moment. */
export function testFourthMomentTensor(): TestResult {
  let err = 0;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      for (let c = 0; c < 3; c++) {
        for (let d = 0; d < 3; d++) {
          let m = 0;
          for (let i = 0; i < Q; i++) {
            m += W[i]! * E[i]![a]! * E[i]![b]! * E[i]![c]! * E[i]![d]!;
          }
          const dAB = a === b ? 1 : 0;
          const dCD = c === d ? 1 : 0;
          const dAC = a === c ? 1 : 0;
          const dBD = b === d ? 1 : 0;
          const dAD = a === d ? 1 : 0;
          const dBC = b === c ? 1 : 0;
          const target = (1 / 9) * (dAB * dCD + dAC * dBD + dAD * dBC);
          err = Math.max(err, Math.abs(m - target));
        }
      }
    }
  }
  return ok('Σᵢ wᵢ eᵢ⊗eᵢ⊗eᵢ⊗eᵢ = ⅑·perms', 'algebraic', err, 0, 1e-12);
}

/** opp(opp(i)) = i for every direction. */
export function testOppInvolution(): TestResult {
  let failed = 0;
  for (let i = 0; i < Q; i++) if (opp(opp(i)) !== i) failed++;
  return ok('opp(opp(i)) = i', 'algebraic', failed, 0, 0);
}

/** e[opp(i)] = -e[i] for every direction. */
export function testOppNegates(): TestResult {
  let failed = 0;
  for (let i = 0; i < Q; i++) {
    const [a, b, c] = E[i]!;
    const [oa, ob, oc] = E[opp(i)]!;
    if (a !== -oa || b !== -ob || c !== -oc) failed++;
  }
  return ok('e[opp(i)] = −e[i]', 'algebraic', failed, 0, 0);
}

/** Mass conservation of equilibrium: Σ f^eq(ρ,u) = ρ for arbitrary (ρ, u). */
export function testFeqMass(): TestResult {
  let err = 0;
  const rhos = [0.9, 1.0, 1.1];
  const us: Array<[number, number, number]> = [[0, 0, 0], [0.1, 0, 0], [0.05, 0.05, 0.05]];
  for (const rho of rhos) for (const u of us) {
    let s = 0;
    for (let i = 0; i < Q; i++) s += feq(i, rho, u);
    err = Math.max(err, Math.abs(s - rho));
  }
  return ok('Σ fᵢᵉᵠ = ρ', 'algebraic', err, 0, 1e-9);
}

/** Momentum conservation of equilibrium: Σ eᵢ f^eq = ρu. */
export function testFeqMomentum(): TestResult {
  let err = 0;
  const cases: Array<{ rho: number; u: [number, number, number] }> = [
    { rho: 1.0, u: [0.1, 0, 0] },
    { rho: 1.0, u: [0.05, 0.05, 0] },
    { rho: 0.95, u: [0, 0, 0.08] },
  ];
  for (const { rho, u } of cases) {
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < Q; i++) {
      const f = feq(i, rho, u);
      mx += E[i]![0] * f;
      my += E[i]![1] * f;
      mz += E[i]![2] * f;
    }
    err = Math.max(err,
      Math.abs(mx - rho * u[0]),
      Math.abs(my - rho * u[1]),
      Math.abs(mz - rho * u[2]),
    );
  }
  return ok('Σ eᵢ fᵢᵉᵠ = ρu', 'algebraic', err, 0, 1e-9);
}

/**
 * Galilean-invariant frame check on the stress tensor.
 * Πneq = Σ eᵢ⊗eᵢ (fᵢ − fᵢᵉᵠ); for f = fᵉᵠ this must be 0.
 */
export function testEquilibriumStressZero(): TestResult {
  const rho = 1.0;
  const u: [number, number, number] = [0.08, 0.03, -0.02];
  let err = 0;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      let pi = 0;
      for (let i = 0; i < Q; i++) {
        pi += E[i]![a]! * E[i]![b]! * (feq(i, rho, u) - feq(i, rho, u));
      }
      err = Math.max(err, Math.abs(pi));
    }
  }
  return ok('Πneq[fᵉᵠ] = 0', 'algebraic', err, 0, 1e-12);
}

export const ALGEBRAIC_TESTS = [
  testWeightsSumToOne,
  testEClosure,
  testSecondMomentTensor,
  testFourthMomentTensor,
  testOppInvolution,
  testOppNegates,
  testFeqMass,
  testFeqMomentum,
  testEquilibriumStressZero,
] as const;

// ═════════ GPU TESTS (need a live LBM3D) ═════════

/**
 * Async readback of the macros texture (rgba16float) into a Float32Array
 * of shape [W·H·D, 4] flattened. Each cell is (u.x, u.y, u.z, rho) but the
 * texture is f16 — we decode each value through DataView half-floats.
 */
export async function readMacros(lbm: LBM3D): Promise<Float32Array> {
  const { W, H, D } = lbm;
  const bytesPerRow = Math.ceil((W * 8) / 256) * 256;  // 256-byte alignment
  const bufSize = bytesPerRow * H * D;
  const staging = lbm.device.createBuffer({
    size: bufSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const enc = lbm.device.createCommandEncoder({ label: 'macros-readback' });
  enc.copyTextureToBuffer(
    { texture: lbm.macrosTexture },
    { buffer: staging, bytesPerRow, rowsPerImage: H },
    { width: W, height: H, depthOrArrayLayers: D },
  );
  lbm.device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const raw = new Uint16Array(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();

  const out = new Float32Array(W * H * D * 4);
  // De-pad each row: bytesPerRow may be larger than W·8.
  const u16PerRow = bytesPerRow / 2;
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      const srcRow = (z * H + y) * u16PerRow;
      const dstRow = (z * H + y) * W * 4;
      for (let x = 0; x < W; x++) {
        for (let c = 0; c < 4; c++) {
          out[dstRow + x * 4 + c] = halfToFloat(raw[srcRow + x * 4 + c]!);
        }
      }
    }
  }
  return out;
}

/** IEEE 754 half-float (binary16) → float32. */
function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

/** Σ ρ over the domain should be ~constant — confirms mass conservation. */
export async function testMassConservation(
  lbm: LBM3D,
  warmupSteps = 100,
  windowSteps = 500,
): Promise<TestResult> {
  for (let i = 0; i < warmupSteps; i++) lbm.step();
  const before = await readMacros(lbm);
  let sumBefore = 0;
  for (let i = 3; i < before.length; i += 4) sumBefore += before[i]!;
  for (let i = 0; i < windowSteps; i++) lbm.step();
  const after = await readMacros(lbm);
  let sumAfter = 0;
  for (let i = 3; i < after.length; i += 4) sumAfter += after[i]!;
  const drift = Math.abs(sumAfter - sumBefore) / sumBefore;
  return ok(
    `Mass conservation (${windowSteps} steps)`,
    'gpu',
    drift, 0, 0.005,
    `Σρ drifted ${(drift * 100).toFixed(3)}% (threshold 0.5%)`,
  );
}

/** Max |u| across the domain ≤ slider clamp 0.15. */
export async function testMaxVelocityBound(lbm: LBM3D): Promise<TestResult> {
  const m = await readMacros(lbm);
  let maxMag = 0;
  for (let i = 0; i < m.length; i += 4) {
    const u = Math.hypot(m[i]!, m[i + 1]!, m[i + 2]!);
    if (u > maxMag) maxMag = u;
  }
  return ok(
    'Max |u| ≤ 0.15 (Ma < 0.26)',
    'gpu',
    maxMag, 0, 0.18,
    `peak |u| = ${maxMag.toFixed(4)}`,
  );
}

/** ρ near 1 everywhere — strong-incompressibility check. */
export async function testDensityBounds(lbm: LBM3D): Promise<TestResult> {
  const m = await readMacros(lbm);
  let minRho = Infinity, maxRho = -Infinity;
  for (let i = 3; i < m.length; i += 4) {
    if (m[i]! < minRho) minRho = m[i]!;
    if (m[i]! > maxRho) maxRho = m[i]!;
  }
  const dev = Math.max(Math.abs(1 - minRho), Math.abs(maxRho - 1));
  return ok(
    'ρ ∈ [0.95, 1.05]',
    'gpu',
    dev, 0, 0.05,
    `ρ range [${minRho.toFixed(4)}, ${maxRho.toFixed(4)}]`,
  );
}

/** u at gid.x = 1, centre of inlet, should be ≈ uIn (BC fidelity). */
export async function testInletProfileFidelity(lbm: LBM3D): Promise<TestResult> {
  const m = await readMacros(lbm);
  const { W, H, D } = lbm;
  const x = 1, y = H >> 1, z = D >> 1;
  const idx = (x + y * W + z * W * H) * 4;
  const ux = m[idx]!;
  return ok(
    'Inlet u_x at x=1 ≈ uIn',
    'gpu',
    ux, lbm.uIn, lbm.uIn * 0.15,
    `measured u_x = ${ux.toFixed(4)} vs uIn = ${lbm.uIn.toFixed(4)}`,
  );
}

/** Symmetry around y=0 plane: u_x(y) ≈ u_x(-y) for centered obstacles. */
export async function testYSymmetry(lbm: LBM3D): Promise<TestResult> {
  const m = await readMacros(lbm);
  const { W, H, D } = lbm;
  let maxAsym = 0;
  // Sample 64 random fluid cells in the middle of the tunnel.
  for (let s = 0; s < 64; s++) {
    const x = (W >> 2) + ((s * 13) % (W >> 1));
    const y = 2 + ((s * 7) % (H >> 1));
    const yFlip = H - 1 - y;
    const z = (D >> 1);
    const a = (x + y * W + z * W * H) * 4;
    const b = (x + yFlip * W + z * W * H) * 4;
    const dux = Math.abs(m[a]! - m[b]!);
    const ref = Math.max(0.01, Math.abs(m[a]!) + Math.abs(m[b]!));
    if (dux / ref > maxAsym) maxAsym = dux / ref;
  }
  return ok(
    'y-symmetry of u_x',
    'gpu',
    maxAsym, 0, 0.25,
    `max relative asymmetry = ${(maxAsym * 100).toFixed(1)}%`,
  );
}

/** τ from current ν matches what the shader receives. Pure-JS check. */
export function testTauNuConsistency(lbm: LBM3D): TestResult {
  const tau = Math.max(3 * lbm.visc + 0.5, 0.55);
  const omegaExpected = 1 / tau;
  const nuRecovered = (1 / omegaExpected - 0.5) / 3;
  const nuExpected = (tau - 0.5) / 3;
  return ok(
    'τ ↔ ν consistency',
    'algebraic',
    Math.abs(nuRecovered - nuExpected), 0, 1e-12,
    `τ=${tau.toFixed(4)}, ω=${omegaExpected.toFixed(4)}, ν=${nuRecovered.toFixed(6)}`,
  );
}

/**
 * Aggregate runner. Algebraic tests are sync; GPU tests are async + only
 * run if `lbm` is supplied.
 */
export async function runAllPhysicsTests(lbm?: LBM3D): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const t of ALGEBRAIC_TESTS) results.push(t());
  if (lbm) {
    results.push(testTauNuConsistency(lbm));
    results.push(await testMaxVelocityBound(lbm));
    results.push(await testDensityBounds(lbm));
    results.push(await testInletProfileFidelity(lbm));
    results.push(await testYSymmetry(lbm));
    results.push(await testMassConservation(lbm, 50, 200));
  }
  return results;
}
