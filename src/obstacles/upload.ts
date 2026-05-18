import * as THREE from 'three';

// CPU voxelization of an uploaded mesh via bounding-box sampling.
export async function voxelizeMesh(
  geometry: THREE.BufferGeometry,
  W: number,
  H: number,
  D: number,
): Promise<Uint32Array> {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const center = new THREE.Vector3();
  bb.getCenter(center);

  const mask = new Uint32Array(W * H * D);
  const pos = geometry.getAttribute('position');
  if (!pos) return mask;

  // For each triangle, voxelize by sampling points inside.
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const tempA = new THREE.Vector3();
  const tempB = new THREE.Vector3();
  const tempC = new THREE.Vector3();

  const cx = W * 0.3;
  const cy = H * 0.5;
  const cz = D * 0.5;
  const scale = Math.min(W, H, D) * 0.3 / Math.max(size.x, size.y, size.z, 1e-6);

  for (let t = 0; t < triCount; t++) {
    const ia = index ? index.getX(t * 3) : t * 3;
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    tempA.fromBufferAttribute(pos, ia).sub(center).multiplyScalar(scale);
    tempB.fromBufferAttribute(pos, ib).sub(center).multiplyScalar(scale);
    tempC.fromBufferAttribute(pos, ic).sub(center).multiplyScalar(scale);

    // Sample the triangle interior at ~4 points per axis
    for (let u = 0; u <= 4; u++) {
      for (let v = 0; v <= 4 - u; v++) {
        const w = 4 - u - v;
        const uf = u / 4, vf = v / 4, wf = w / 4;
        const px = cx + tempA.x * uf + tempB.x * vf + tempC.x * wf;
        const py = cy + tempA.y * uf + tempB.y * vf + tempC.y * wf;
        const pz = cz + tempA.z * uf + tempB.z * vf + tempC.z * wf;
        const ix = Math.round(px), iy = Math.round(py), iz = Math.round(pz);
        if (ix >= 0 && ix < W && iy >= 0 && iy < H && iz >= 0 && iz < D) {
          mask[ix + iy * W + iz * W * H] = 1;
        }
      }
    }
  }

  return mask;
}
