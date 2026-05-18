/**
 * Free-draw mode: capture mouse strokes over the canvas, return a closed polygon
 * in *normalized* [0, 1] x [0, 1] coordinates (origin top-left, matching DOM).
 *
 * The polygon is automatically simplified (Ramer-Douglas-Peucker) and closed.
 */

export interface FreeDrawCallbacks {
  onPoint: (nx: number, ny: number) => void;   // streaming preview while drawing
  onCommit: (polygon: Array<[number, number]>) => void;   // final closed polygon
  onCancel: () => void;
}

export class FreeDrawController {
  private active = false;
  private points: Array<[number, number]> = [];
  private readonly overlay: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: FreeDrawCallbacks;

  constructor(overlay: HTMLElement, canvas: HTMLCanvasElement, callbacks: FreeDrawCallbacks) {
    this.overlay = overlay;
    this.canvas = canvas;
    this.callbacks = callbacks;
    overlay.addEventListener('pointerdown', this.onDown);
    overlay.addEventListener('pointermove', this.onMove);
    overlay.addEventListener('pointerup', this.onUp);
    overlay.addEventListener('pointercancel', this.onCancel);
  }

  enable() {
    this.overlay.hidden = false;
  }

  disable() {
    this.overlay.hidden = true;
    this.points = [];
    this.active = false;
  }

  private toNormalized = (clientX: number, clientY: number): [number, number] => {
    const rect = this.canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
  };

  private onDown = (e: PointerEvent) => {
    if (this.overlay.hidden) return;
    e.preventDefault();
    this.active = true;
    this.points = [this.toNormalized(e.clientX, e.clientY)];
    (this.overlay as Element & { setPointerCapture: (id: number) => void }).setPointerCapture?.(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.active) return;
    const p = this.toNormalized(e.clientX, e.clientY);
    // Skip duplicate / very close points.
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.005) return;
    this.points.push(p);
    this.callbacks.onPoint(p[0], p[1]);
  };

  private onUp = (e: PointerEvent) => {
    if (!this.active) return;
    e.preventDefault();
    this.active = false;
    if (this.points.length >= 3) {
      const simplified = rdp(this.points, 0.005);
      // Convert flow-friendly: in DOM, y grows downward; in LBM grid, y grows upward.
      // We'll keep DOM-style normalized here and the consumer flips y when uploading.
      this.callbacks.onCommit(simplified);
    } else {
      this.callbacks.onCancel();
    }
    this.points = [];
    this.disable();
  };

  private onCancel = () => {
    this.points = [];
    this.active = false;
    this.callbacks.onCancel();
    this.disable();
  };
}

/** Ramer-Douglas-Peucker polyline simplification. */
function rdp(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((dx * (a[1] - p[1]) - (a[0] - p[0]) * dy)) / len;
}
