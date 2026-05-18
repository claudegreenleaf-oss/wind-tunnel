/**
 * CPU-side voxelizers for the initial preset shapes (Phase 1/4).
 * Produces a Uint32Array mask with values: 0 = fluid, 1 = wall, 2 = inlet, 3 = outlet.
 * Larger shape library + GLB upload + GPU conservative voxelizer is deferred to follow-up.
 */

export type ShapeId = 'sphere' | 'cylinder';

export interface VoxelizeParams {
  W: number;
  H: number;
  D: number;
  shape: ShapeId;
  /** Center of the obstacle in lattice coordinates. */
  cx: number;
  cy: number;
  cz: number;
  /** Radius (sphere) / radius along x (cylinder) in lattice cells. */
  radius: number;
  /** For cylinder: half-length along its axis. */
  halfLen: number;
  /** Rotation (radians) — yaw around Y for now. */
  yaw: number;
}

export function voxelize(p: VoxelizeParams): Uint32Array {
  const out = new Uint32Array(p.W * p.H * p.D);
  const cosY = Math.cos(-p.yaw);
  const sinY = Math.sin(-p.yaw);

  for (let z = 0; z < p.D; z++) {
    for (let y = 0; y < p.H; y++) {
      for (let x = 0; x < p.W; x++) {
        const dx = x - p.cx;
        const dy = y - p.cy;
        const dz = z - p.cz;
        // Inverse yaw rotation into shape-local frame.
        const lx = dx * cosY - dz * sinY;
        const lz = dx * sinY + dz * cosY;
        const ly = dy;

        let inside = false;
        if (p.shape === 'sphere') {
          inside = lx * lx + ly * ly + lz * lz <= p.radius * p.radius;
        } else {
          // Cylinder: axis along Y, radius in XZ plane, half-length along Y.
          const r2 = lx * lx + lz * lz;
          inside = r2 <= p.radius * p.radius && Math.abs(ly) <= p.halfLen;
        }
        if (inside) {
          out[x + y * p.W + z * p.W * p.H] = 1;
        }
      }
    }
  }
  return out;
}

/** Projected width of the obstacle along x (max # solid cells in any column) — for force normalization. */
export function projectedWidth(mask: Uint32Array, W: number, H: number, D: number): number {
  let maxColumn = 0;
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      let count = 0;
      for (let x = 0; x < W; x++) {
        if (mask[x + y * W + z * W * H] !== 0) count++;
      }
      if (count > maxColumn) maxColumn = count;
    }
  }
  return Math.max(maxColumn, 1);
}
