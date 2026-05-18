import * as THREE from 'three';
import { createMaskTexture } from '../util/passes';
import { PRESETS_BY_ID } from './presets';
import { rasterizePredicate, rasterizePolygon } from './rasterizer';

export interface ObstacleState {
  kind: 'preset' | 'polygon';
  presetId?: string;
  polygon?: Array<[number, number]>;  // raw normalized [0,1] x [0,1] coordinates if free-drawn
  /** Center in grid cells. */
  cx: number;
  cy: number;
  /** Half-extent in lattice cells (the [-1,1] local frame maps to this many cells). */
  scale: number;
  /** Rotation in radians. */
  rot: number;
}

/**
 * Manages the obstacle mask texture: builds it from a preset or a free-drawn polygon,
 * applies rotation/scale, and uploads to the GPU.
 */
export class ObstacleManager {
  readonly texture: THREE.DataTexture;
  private readonly w: number;
  private readonly h: number;

  state: ObstacleState;
  /** Project area of the obstacle along x (cells) — used for force normalization. */
  charLengthCells = 40;

  constructor(gridW: number, gridH: number, initial: ObstacleState) {
    this.w = gridW;
    this.h = gridH;
    this.state = initial;
    this.texture = createMaskTexture(gridW, gridH);
    this.rebuild();
  }

  setPreset(id: string) {
    if (!PRESETS_BY_ID[id]) return;
    this.state = { ...this.state, kind: 'preset', presetId: id, polygon: undefined };
    this.rebuild();
  }

  setPolygon(polygonNorm: Array<[number, number]>) {
    // polygonNorm: normalized [0,1] coordinates; rebuild scales them to grid.
    this.state = { ...this.state, kind: 'polygon', polygon: polygonNorm, presetId: undefined };
    this.rebuild();
  }

  setRotation(radians: number) {
    this.state = { ...this.state, rot: radians };
    this.rebuild();
  }

  setScale(scaleCells: number) {
    this.state = { ...this.state, scale: scaleCells };
    this.rebuild();
  }

  setCenter(cx: number, cy: number) {
    this.state = { ...this.state, cx, cy };
    this.rebuild();
  }

  /** Re-rasterize and upload. Called whenever shape/transform changes. */
  rebuild() {
    let data: Uint8Array;
    if (this.state.kind === 'preset') {
      const preset = PRESETS_BY_ID[this.state.presetId ?? 'cylinder'] ?? PRESETS_BY_ID.cylinder;
      data = rasterizePredicate(preset.predicate, {
        gridW: this.w,
        gridH: this.h,
        cx: this.state.cx,
        cy: this.state.cy,
        scale: this.state.scale,
        rot: this.state.rot,
      });
      this.charLengthCells = computeProjectedWidth(data, this.w, this.h);
    } else {
      // Map normalized polygon coordinates to grid cells.
      const pts: Array<[number, number]> = (this.state.polygon ?? []).map(([nx, ny]) => [
        nx * this.w,
        ny * this.h,
      ]);
      data = rasterizePolygon(pts, this.w, this.h);
      this.charLengthCells = computeProjectedWidth(data, this.w, this.h);
    }

    (this.texture.image.data as Uint8Array).set(data);
    this.texture.needsUpdate = true;
  }
}

/** Count the projected width of the obstacle: max number of solid cells in any column. */
function computeProjectedWidth(mask: Uint8Array, w: number, h: number): number {
  let maxCount = 0;
  for (let i = 0; i < w; i++) {
    let count = 0;
    for (let j = 0; j < h; j++) {
      if (mask[j * w + i] > 0) count++;
    }
    if (count > maxCount) maxCount = count;
  }
  return Math.max(maxCount, 1);
}

export { PRESETS_BY_ID } from './presets';
export type { ShapePreset } from './presets';
