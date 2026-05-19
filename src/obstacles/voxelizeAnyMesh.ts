/**
 * Unified mesh voxelizer. Takes any Three.js BufferGeometry (already in
 * world coordinates) and the LBM lattice's world AABB, and produces a
 * filled (interior + surface) solid mask.
 *
 * Algorithm:
 *   1. Dense barycentric surface voxelization — every triangle stamps
 *      ~256 sample points → no holes even on thin shells.
 *   2. 3D flood-fill from the volume corners marks "outside" cells;
 *      anything not reached is interior → solid.
 *
 * The mask layout matches the LBM3D convention:
 *   index = x + y*W + z*W*H, values 0=fluid, 1=solid.
 *
 * This is the SOURCE OF TRUTH for collisions — the Three.js mesh and
 * the LBM physics both use the same voxelization, so they never disagree.
 */

import * as THREE from 'three';

const SAMPLES_PER_AXIS = 16;      // 16×16 = 256 samples per triangle

export function voxelizeAnyMesh(
  geometry: THREE.BufferGeometry,
  dims: { W: number; H: number; D: number },
  worldAabbMin: THREE.Vector3,
  worldAabbSize: THREE.Vector3,
): Uint32Array {
  const { W, H, D } = dims;
  const mask = new Uint32Array(W * H * D);

  const pos = geometry.getAttribute('position');
  if (!pos) return mask;
  const idx = geometry.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  // World point → lattice (continuous, not yet rounded)
  const toLattice = (v: THREE.Vector3) => {
    v.x = (v.x - worldAabbMin.x) / worldAabbSize.x * W;
    v.y = (v.y - worldAabbMin.y) / worldAabbSize.y * H;
    v.z = (v.z - worldAabbMin.z) / worldAabbSize.z * D;
  };

  // ---- Pass 1: surface voxelize via dense barycentric sampling ----
  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx.getX(t * 3) : t * 3;
    const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, ia); toLattice(a);
    b.fromBufferAttribute(pos, ib); toLattice(b);
    c.fromBufferAttribute(pos, ic); toLattice(c);

    for (let u = 0; u <= SAMPLES_PER_AXIS; u++) {
      for (let v = 0; v <= SAMPLES_PER_AXIS - u; v++) {
        const w = SAMPLES_PER_AXIS - u - v;
        const uf = u / SAMPLES_PER_AXIS;
        const vf = v / SAMPLES_PER_AXIS;
        const wf = w / SAMPLES_PER_AXIS;
        const px = a.x * uf + b.x * vf + c.x * wf;
        const py = a.y * uf + b.y * vf + c.y * wf;
        const pz = a.z * uf + b.z * vf + c.z * wf;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const iz = Math.floor(pz);
        if (ix >= 0 && ix < W && iy >= 0 && iy < H && iz >= 0 && iz < D) {
          mask[ix + iy * W + iz * W * H] = 1;
        }
      }
    }
  }

  // ---- Pass 2: flood-fill from outside to mark interior solid ----
  // Mark every cell reachable from the volume border that isn't already a
  // surface voxel. Whatever's left is interior → solid.
  const visited = new Uint8Array(W * H * D);
  const stack: number[] = [];

  // Seed with the entire 6-face boundary that isn't already surface.
  const seed = (x: number, y: number, z: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return;
    const i = x + y * W + z * W * H;
    if (mask[i] === 1 || visited[i] === 1) return;
    visited[i] = 1;
    stack.push(i);
  };
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) { seed(0, y, z); seed(W - 1, y, z); }
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { seed(x, 0, z); seed(x, H - 1, z); }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { seed(x, y, 0); seed(x, y, D - 1); }

  // 6-neighbour BFS through fluid cells, skipping surface voxels.
  while (stack.length > 0) {
    const i = stack.pop()!;
    const z = (i / (W * H)) | 0;
    const y = ((i - z * W * H) / W) | 0;
    const x = i - z * W * H - y * W;
    const tryStep = (nx: number, ny: number, nz: number) => {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D) return;
      const ni = nx + ny * W + nz * W * H;
      if (mask[ni] === 1 || visited[ni] === 1) return;
      visited[ni] = 1;
      stack.push(ni);
    };
    tryStep(x + 1, y, z); tryStep(x - 1, y, z);
    tryStep(x, y + 1, z); tryStep(x, y - 1, z);
    tryStep(x, y, z + 1); tryStep(x, y, z - 1);
  }

  // Any unvisited, non-surface cell is interior → mark solid.
  for (let i = 0; i < mask.length; i++) {
    if (visited[i] === 0 && mask[i] === 0) {
      mask[i] = 1;
    }
  }

  return mask;
}
