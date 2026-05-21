/**
 * 3D wind tunnel configuration. Lattice is anisotropic:
 *   W (length along flow) = 2 * N
 *   H (height)            = N
 *   D (depth)             = N
 * where N is the user-controlled resolution slider value.
 */

/** Up to this many independent inlet discs can be active at once. */
export const MAX_INLETS = 4;

/** Per-inlet config. All four slots are always present; `enabled` switches them on/off. */
export interface InletConfig {
  enabled: boolean;
  yFrac: number;    // 0 = bottom edge of inlet plane, 1 = top edge
  zFrac: number;    // 0 = -z edge, 1 = +z edge
  radius: number;   // disc radius as a fraction of the cross-section
}

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
  useRegularized: boolean; // true = regularized BGK (overrides useMRT)
  // Shape
  shapeId: string;
  // Obstacle orientation (Euler angles, deg) + uniform scale multiplier.
  // Applied on top of each model's authored orientation; user-driven via sliders.
  yawDeg: number;     // rotation around vertical (Y) axis
  pitchDeg: number;   // rotation around side (Z) axis
  rollDeg: number;    // rotation around flow (X) axis
  scaleMul: number;   // 1 = registry default size
  obstacleXFrac: number;  // 0 = at inlet, 1 = at outlet; default 0.3
  inletRadius: number;    // legacy single-inlet radius — shadows inlets[0].radius
  inlets: InletConfig[];  // always length MAX_INLETS
  ballSize: number;       // multiplier on the rendered particle sphere size; default 1.0
  floorEnabled: boolean;  // when true a solid horizontal floor is added at floorYFrac
  floorYFrac: number;     // floor height as a fraction of sy from the bottom (0 = bottom, 1 = top)
  // Visualization
  dyeAmount: number;
  // Time
  paused: boolean;
  simSpeed: number;   // 0.1x – 4x
  /** 2D mode: swap the 3D LBM for a D2Q9 lattice with top-down camera. */
  mode2D: boolean;
  /** When mode2D, which scene: 'circle' (cylinder cross-flow) or 'cavity' (floor trench). */
  scene2D: 'circle' | 'cavity';
}

export function defaultConfig(): SimConfig {
  return {
    // N=80 fits comfortably under WebGPU's default 128 MiB
    // maxStorageBufferBindingSize (each f-buffer = 2N·N·N·19·4 bytes;
    // at N=96 that's exactly 128 MiB and triggers allocation failure on
    // browsers without raised limits). Boundary-layer resolution at
    // r ≈ 14 cells is marginal; user can crank to 96 manually on a
    // machine with raised limits.
    N: 80,
    uIn: 0.12,        // moderate — clean streamlines without violent vortex shedding
    visc: 0.020,      // higher visc → laminar-ish flow, cleaner wake structure
    aoaDeg: 0,
    gravity: [0, 0, 0],
    useMRT: false,
    useLES: false,
    useRegularized: false,
    freeSlip: false,
    shapeId: 'sphere',
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    scaleMul: 1,
    obstacleXFrac: 0.3,
    inletRadius: 0.12,
    inlets: [
      { enabled: true,  yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
      { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
      { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
      { enabled: false, yFrac: 0.5, zFrac: 0.5, radius: 0.12 },
    ],
    ballSize: 1.0,
    floorEnabled: false,
    floorYFrac: 0.0,
    dyeAmount: 1.0,
    paused: false,
    simSpeed: 1.0,
    mode2D: false,
    scene2D: 'circle',
  };
}

export function latticeDims(N: number, mode2D = false): { W: number; H: number; D: number } {
  // 2D mode collapses the Z direction to a single lattice cell so the LBM2D
  // macros texture (W×H×1) matches every renderer's expectations and the
  // particle solid-mask reads stay in bounds.
  return { W: 2 * N, H: N, D: mode2D ? 1 : N };
}

/**
 * Reynolds number: U·L/ν where L is the actual obstacle characteristic
 * length in lattice units (≈ obstacle diameter). Fallback uses N/4 only when
 * we don't have a real char-length yet (e.g. boot, before voxelization).
 */
export function computeRe(uIn: number, visc: number, N: number, charLengthCells?: number): number {
  const L = (charLengthCells && charLengthCells > 0)
    ? charLengthCells
    : Math.max(1, Math.round(N / 4));
  return (uIn * L) / Math.max(visc, 1e-6);
}
