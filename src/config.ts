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
  useMRT: boolean;    // true = TRT collision, false = BGK
  useLES: boolean;    // true = Smagorinsky LES turbulence model
  freeSlip: boolean;  // true = free-slip walls, false = no-slip (bounce-back)
  // Shape
  shapeId: string;
  // Obstacle orientation (Euler angles, deg) + uniform scale multiplier.
  // Applied on top of each model's authored orientation; user-driven via sliders.
  yawDeg: number;     // rotation around vertical (Y) axis
  pitchDeg: number;   // rotation around side (Z) axis
  rollDeg: number;    // rotation around flow (X) axis
  scaleMul: number;   // 1 = registry default size
  obstacleXFrac: number;  // 0 = at inlet, 1 = at outlet; default 0.3
  inletRadius: number;    // jet disc radius as a fraction of cross-section; default 0.12
  ballSize: number;       // multiplier on the rendered particle sphere size; default 1.0
  // Visualization
  dyeAmount: number;
  // Time
  paused: boolean;
  simSpeed: number;   // 0.1x – 4x
}

export function defaultConfig(): SimConfig {
  return {
    N: 80,
    uIn: 0.12,        // moderate — clean streamlines without violent vortex shedding
    visc: 0.020,      // higher visc → laminar-ish flow, cleaner wake structure
    aoaDeg: 0,
    gravity: [0, 0, 0],
    useMRT: false,
    useLES: false,
    freeSlip: false,
    shapeId: 'sphere',
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    scaleMul: 1,
    obstacleXFrac: 0.3,
    inletRadius: 0.12,
    ballSize: 1.0,
    dyeAmount: 1.0,
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
