import { CELL } from '../util/passes';
import type { ShapePredicate } from './presets';

export interface RasterParams {
  gridW: number;
  gridH: number;
  /** Center of the shape in lattice coordinates (cells). */
  cx: number;
  cy: number;
  /** Size in lattice cells (half-width along x of the [-1,1] local frame). */
  scale: number;
  /** Rotation (radians, positive = counterclockwise). */
  rot: number;
}

/**
 * Rasterize a predicate-defined shape into a Uint8Array mask
 * suitable for upload as the R8 cell-classification texture.
 */
export function rasterizePredicate(predicate: ShapePredicate, p: RasterParams): Uint8Array {
  const out = new Uint8Array(p.gridW * p.gridH);
  const cos = Math.cos(-p.rot);
  const sin = Math.sin(-p.rot);
  const inv = 1 / Math.max(p.scale, 1);

  for (let j = 0; j < p.gridH; j++) {
    for (let i = 0; i < p.gridW; i++) {
      // Translate to shape-local frame.
      const dx = (i - p.cx) * inv;
      const dy = (j - p.cy) * inv;
      // Rotate (inverse rotation since we're going world -> local).
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (predicate(lx, ly)) {
        out[j * p.gridW + i] = CELL.WALL;
      }
    }
  }
  return out;
}

/**
 * Rasterize a closed polygon (array of [x, y] in lattice coordinates).
 * Uses even-odd scanline fill.
 */
export function rasterizePolygon(points: Array<[number, number]>, gridW: number, gridH: number): Uint8Array {
  const out = new Uint8Array(gridW * gridH);
  if (points.length < 3) return out;

  // Bounding box clip.
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(gridH - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let k = 0; k < points.length; k++) {
      const [ax, ay] = points[k];
      const [bx, by] = points[(k + 1) % points.length];
      // Standard scanline rule: edge crosses y if (ay > y) != (by > y).
      if ((ay > y) !== (by > y)) {
        const t = (y - ay) / (by - ay);
        xs.push(ax + t * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.floor(xs[k]));
      const xb = Math.min(gridW - 1, Math.ceil(xs[k + 1]));
      for (let x = xa; x <= xb; x++) {
        out[y * gridW + x] = CELL.WALL;
      }
    }
  }
  return out;
}
