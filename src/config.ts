// Simulation configuration. Grid resolution is adaptive based on device.

export interface SimConfig {
  width: number;       // lattice cells in x
  height: number;      // lattice cells in y
  uIn: number;         // inlet velocity (lattice units, max ~0.15 for stability)
  visc: number;        // kinematic viscosity (lattice units)
  aoaDeg: number;      // angle of attack, degrees
  dyeAmount: number;   // 0..1
  vizMode: number;     // 0=speed, 1=vorticity, 2=pressure, 3=dye-only
  shapeId: string;     // preset id or "custom"
  paused: boolean;
}

export function adaptiveGridSize(): { width: number; height: number } {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const lowMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory != null
    && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! < 4;
  if (isMobile || lowMem) return { width: 256, height: 128 };
  return { width: 384, height: 192 };
}

export const defaultConfig = (): SimConfig => {
  const { width, height } = adaptiveGridSize();
  return {
    width,
    height,
    uIn: 0.1,
    visc: 0.005,
    aoaDeg: 0,
    dyeAmount: 0.7,
    vizMode: 1, // vorticity by default — it's the showstopper
    shapeId: 'cylinder',
    paused: false,
  };
};

// Reynolds number = U * L / nu, where L = obstacle characteristic length.
// We use grid units: L = ~40 cells (typical obstacle), so Re = U * 40 / visc.
export function computeRe(uIn: number, visc: number, L: number = 40): number {
  return (uIn * L) / Math.max(visc, 1e-6);
}
