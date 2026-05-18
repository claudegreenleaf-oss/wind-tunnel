/**
 * 3D wind tunnel configuration. Lattice is anisotropic:
 *   W (length along flow) = 2 * N
 *   H (height)            = N
 *   D (depth)             = N
 * where N is the user-controlled resolution slider value.
 */

export interface SimConfig {
  // Resolution
  N: number;          // base resolution; W=2N, H=N, D=N
  // Flow
  uIn: number;        // inlet velocity (lattice units)
  visc: number;       // kinematic viscosity (lattice units)
  aoaDeg: number;     // angle of attack
  // Physics
  gravity: [number, number, number];   // body force per cell (lattice units / step^2)
  // Shape
  shapeId: string;
  // Visualization
  dyeAmount: number;
  // Time
  paused: boolean;
  simSpeed: number;   // 0.1x – 4x
}

export function defaultConfig(): SimConfig {
  return {
    N: 80,            // ~80*40*40 ~= 130k cells: safe default for first render
    uIn: 0.08,
    visc: 0.005,
    aoaDeg: 0,
    gravity: [0, 0, 0],
    shapeId: 'sphere',
    dyeAmount: 0.7,
    paused: false,
    simSpeed: 1.0,
  };
}

export function latticeDims(N: number): { W: number; H: number; D: number } {
  return { W: 2 * N, H: N, D: N };
}

/** Reynolds number: U * L / nu. L = N / 4 (typical obstacle size). */
export function computeRe(uIn: number, visc: number, N: number): number {
  const L = Math.max(1, Math.round(N / 4));
  return (uIn * L) / Math.max(visc, 1e-6);
}
