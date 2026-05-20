/**
 * Pure-TS D3Q19 lattice constants, mirroring `lbm3d.wgsl`. Used by the
 * physics test suite to validate solver invariants without invoking WGSL.
 *
 * Source of truth: the WGSL `eVec`, `weight`, and `feq` functions. If you
 * change those, update here too — the algebraic tests will catch drift.
 *
 * Index convention (canonical D3Q19):
 *   0: (0,0,0)
 *   1: (+1,0,0)  2: (-1,0,0)
 *   3: (0,+1,0)  4: (0,-1,0)
 *   5: (0,0,+1)  6: (0,0,-1)
 *   7: (+1,+1,0)  8: (-1,+1,0)
 *   9: (+1,-1,0) 10: (-1,-1,0)
 *  11: (+1,0,+1) 12: (-1,0,+1)
 *  13: (+1,0,-1) 14: (-1,0,-1)
 *  15: (0,+1,+1) 16: (0,-1,+1)
 *  17: (0,+1,-1) 18: (0,-1,-1)
 */

export const Q = 19;

export const E: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
  [1, 1, 0], [-1, 1, 0],
  [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1],
  [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1],
  [0, 1, -1], [0, -1, -1],
] as const;

const W0 = 1 / 3;
const WC = 1 / 18;   // cardinal (1..6)
const WD = 1 / 36;   // diagonal (7..18)

export const W: ReadonlyArray<number> = [
  W0,
  WC, WC, WC, WC, WC, WC,
  WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD, WD,
] as const;

export function opp(i: number): number {
  // Canonical D3Q19 opposite-direction pairs: cardinals (1↔2, 3↔4, 5↔6),
  // diagonals (7↔10, 8↔9, 11↔14, 12↔13, 15↔18, 16↔17).
  if (i === 0) return 0;
  if (i <= 6) return ((i - 1) ^ 1) + 1;       // 1↔2, 3↔4, 5↔6
  // Diagonals: opp negates both nonzero components.
  const [ex, ey, ez] = E[i]!;
  for (let j = 7; j < Q; j++) {
    const [fx, fy, fz] = E[j]!;
    if (fx === -ex && fy === -ey && fz === -ez) return j;
  }
  throw new Error(`opp(${i}) undefined`);
}

/** Equilibrium distribution f_i^eq for given (ρ, u). */
export function feq(i: number, rho: number, u: readonly [number, number, number]): number {
  const [ex, ey, ez] = E[i]!;
  const eu = ex * u[0] + ey * u[1] + ez * u[2];
  const usq = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
  return W[i]! * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * usq);
}
