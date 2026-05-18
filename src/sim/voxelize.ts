/**
 * CPU-side voxelizers for the initial preset shapes (Phase 1/4).
 * Produces a Uint32Array mask with values: 0 = fluid, 1 = wall, 2 = inlet, 3 = outlet.
 * Larger shape library + GLB upload + GPU conservative voxelizer is deferred to follow-up.
 */

export type ShapeId = 'sphere' | 'cylinder' | 'cone' | 'wing' | 'teapot' | 'f1car' | 'helmet';

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
        const r = p.radius;
        const halfLen = p.halfLen;
        if (p.shape === 'sphere') {
          inside = lx * lx + ly * ly + lz * lz <= r * r;
        } else if (p.shape === 'cylinder') {
          // Cylinder: axis along Y, radius in XZ plane, half-length along Y.
          inside = lx * lx + lz * lz <= r * r && Math.abs(ly) <= halfLen;
        } else if (p.shape === 'cone') {
          // Cone: axis along +X, apex at -halfLen, base at +halfLen.
          const t = (lx + halfLen) / (2 * halfLen);
          if (t > 0 && t < 1) {
            const rt = t * r;
            inside = ly * ly + lz * lz <= rt * rt;
          }
        } else if (p.shape === 'wing') {
          // NACA 0012 airfoil extruded along Z.
          const xc = (lx + halfLen) / (2 * halfLen);
          if (xc >= 0 && xc <= 1) {
            const sq = Math.sqrt(Math.max(0, xc));
            const yt = 5 * 0.12 * (0.2969 * sq - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1015 * xc * xc * xc * xc);
            inside = Math.abs(ly) < yt * halfLen * 0.5 && Math.abs(lz) <= halfLen * 1.5;
          }
        } else if (p.shape === 'teapot') {
          // Simplified teapot: body (flattened sphere) + spout (angled cylinder) + handle + lid
          const bodyInside = (lx * lx) / (r * r) + (ly * ly) / (r * 0.7 * r * 0.7) + (lz * lz) / (r * r) <= 1;
          // Spout: small cylinder angled out +X, +Y side
          const spx = lx - r * 0.6;
          const spy = ly - r * 0.4;
          const spz = lz;
          const spAxis = spx * 0.7 + spy * 0.7;
          const spPerp2 = (spx - spAxis * 0.7) * (spx - spAxis * 0.7) + spz * spz;
          const spoutInside = spPerp2 <= (r * 0.2) * (r * 0.2) && spAxis >= 0 && spAxis <= r * 0.8;
          // Handle: small cylinder on -X side
          const hx = lx + r * 0.7;
          const hy = ly;
          const handleInside = hx * hx + hy * hy <= (r * 0.5) * (r * 0.5) &&
                               hx * hx + hy * hy >= (r * 0.25) * (r * 0.25) &&
                               Math.abs(lz) <= r * 0.15;
          // Lid: small cone on top
          const lidY = ly - r * 0.65;
          const lidT = 1 - lidY / (r * 0.35);
          const lidInside = lidY >= 0 && lidY <= r * 0.35 && lx * lx + lz * lz <= (lidT * r * 0.4) * (lidT * r * 0.4);
          inside = bodyInside || spoutInside || handleInside || lidInside;
        } else if (p.shape === 'f1car') {
          // Main hull: flattened ellipsoid
          const hullInside = (lx * lx) / (halfLen * halfLen) +
                             (ly * ly) / (halfLen * 0.4 * halfLen * 0.4) +
                             (lz * lz) / (halfLen * 0.7 * halfLen * 0.7) <= 1;
          // 4 wheels at corners: small cylinders along Y axis
          const wr = halfLen * 0.2;
          const wx = halfLen * 0.6;
          const wz = halfLen * 0.6;
          const wh = halfLen * 0.15;
          const wheel = (offX: number, offZ: number) => {
            const wx2 = lx - offX;
            const wz2 = lz - offZ;
            return wx2 * wx2 + wz2 * wz2 <= wr * wr && Math.abs(ly) <= wh;
          };
          const wheelsInside = wheel(wx, wz) || wheel(wx, -wz) || wheel(-wx, wz) || wheel(-wx, -wz);
          inside = hullInside || wheelsInside;
        } else if (p.shape === 'helmet') {
          // Sphere with visor cutout on the front (+X facing) side
          const inSphere = lx * lx + ly * ly + lz * lz <= r * r;
          const inVisor = lx > 0 && Math.abs(ly) < r * 0.6 && Math.abs(lz) < r * 0.7;
          inside = inSphere && !inVisor;
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
