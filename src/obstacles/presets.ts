/**
 * Parametric shape predicates. Each returns (x, y) -> inside?
 * Coordinates are normalized to the obstacle's local frame, [-1, 1] in both axes,
 * with the shape centered at (0, 0). The rasterizer applies position/rotation/scale.
 */

export type ShapePredicate = (x: number, y: number) => boolean;

export interface ShapePreset {
  id: string;
  label: string;
  /** Characteristic length in normalized coords (used for Re calc; the rasterizer
   * scales the shape so this maps to ~40 cells by default). */
  charLen: number;
  predicate: ShapePredicate;
}

const cylinder: ShapePreset = {
  id: 'cylinder',
  label: 'Cylinder',
  charLen: 1.0,
  predicate: (x, y) => x * x + y * y <= 1.0,
};

const square: ShapePreset = {
  id: 'square',
  label: 'Square',
  charLen: 1.0,
  predicate: (x, y) => Math.abs(x) <= 1.0 && Math.abs(y) <= 1.0,
};

// NACA 4-digit airfoil. Chord runs from x = -1 to +1 (chord length = 2).
// Standard NACA: y_t = 5*t * (0.2969*sqrt(xc) - 0.1260*xc - 0.3516*xc^2 + 0.2843*xc^3 - 0.1015*xc^4)
// For symmetric NACA00xx, camber = 0.
function nacaThickness(xc: number, t: number): number {
  if (xc < 0 || xc > 1) return 0;
  return 5 * t * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
}

function nacaCamber(xc: number, m: number, p: number): { yc: number; dyc: number } {
  if (m === 0 || p === 0) return { yc: 0, dyc: 0 };
  if (xc < p) {
    const yc = (m / (p * p)) * (2 * p * xc - xc * xc);
    const dyc = (2 * m / (p * p)) * (p - xc);
    return { yc, dyc };
  } else {
    const yc = (m / ((1 - p) ** 2)) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
    const dyc = (2 * m / ((1 - p) ** 2)) * (p - xc);
    return { yc, dyc };
  }
}

function makeNacaPredicate(m: number, p: number, t: number): ShapePredicate {
  // x in [-1, 1] maps to xc in [0, 1].
  return (x, y) => {
    const xc = (x + 1) * 0.5;
    if (xc < 0 || xc > 1) return false;
    // Scale y so the airfoil is reasonably thick relative to chord.
    // chord_length = 2 in normalized coords; multiply y by a factor to give it visual height.
    const yScaled = y * 0.5;
    const yt = nacaThickness(xc, t);
    const { yc, dyc } = nacaCamber(xc, m, p);
    const theta = Math.atan(dyc);
    const xu = xc - yt * Math.sin(theta);
    const yu = yc + yt * Math.cos(theta);
    const yl = yc - yt * Math.cos(theta);
    // Approximate inside test: y between lower and upper at this xc (fine for thin airfoils).
    return yScaled <= yu && yScaled >= yl && Math.abs(xu - xc) < 0.5;
  };
}

const naca0012: ShapePreset = {
  id: 'naca0012',
  label: 'NACA 0012 airfoil',
  charLen: 2.0,
  predicate: makeNacaPredicate(0, 0, 0.12),
};

const naca2412: ShapePreset = {
  id: 'naca2412',
  label: 'NACA 2412 airfoil (cambered)',
  charLen: 2.0,
  predicate: makeNacaPredicate(0.02, 0.4, 0.12),
};

const teardrop: ShapePreset = {
  id: 'teardrop',
  label: 'Teardrop',
  charLen: 2.0,
  predicate: (x, y) => {
    // Egg-like: round on the left, tapered on the right.
    // x in [-1, 1]; treat as parameter for half-width.
    if (x < -1 || x > 1) return false;
    const u = (x + 1) * 0.5; // 0..1 from nose to tail
    // half-height profile: max ~0.4 at u=0.3, taper to 0 at u=1
    const h = 0.45 * Math.pow(Math.sin(Math.PI * u), 0.85) * (1 - 0.3 * u);
    return Math.abs(y) <= h;
  },
};

const flatPlate: ShapePreset = {
  id: 'plate',
  label: 'Flat plate',
  charLen: 2.0,
  predicate: (x, y) => Math.abs(x) <= 1.0 && Math.abs(y) <= 0.05,
};

export const PRESETS: ShapePreset[] = [cylinder, square, naca0012, naca2412, teardrop, flatPlate];
export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map(p => [p.id, p])) as Record<string, ShapePreset>;
