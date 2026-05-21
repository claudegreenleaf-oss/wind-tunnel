/**
 * Fetch a remote .glb, flatten its scene graph to a single merged
 * BufferGeometry, and normalise it so its longest side equals `targetSize`.
 *
 * Results are cached by URL so re-selecting a previously-loaded model is
 * instant.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map<string, Promise<THREE.BufferGeometry>>();

// Shared GLTFLoader with Draco + Meshopt decoders enabled — some of the
// remote models (Ferrari, LittlestTokyo, ToyCar, etc.) are Draco-compressed
// and won't parse without the decoder. The decoder JS + WASM are served from
// Google's CDN; ~200 KB but cached after first use.
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
const sharedLoader = new GLTFLoader();
sharedLoader.setDRACOLoader(draco);
sharedLoader.setMeshoptDecoder(MeshoptDecoder);

export async function loadRemoteModel(url: string): Promise<THREE.BufferGeometry> {
  let entry = cache.get(url);
  if (!entry) {
    entry = fetchAndMerge(url).catch((err) => {
      // Don't cache failures — let the user retry.
      cache.delete(url);
      throw err;
    });
    cache.set(url, entry);
  }
  // Always hand back a clone so callers can scale/rotate without poisoning
  // the cached source.
  const src = await entry;
  return src.clone();
}

async function fetchAndMerge(url: string): Promise<THREE.BufferGeometry> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();

  // STL branch: a single geometry with positions only — no scene graph.
  if (/\.stl$/i.test(new URL(url, location.href).pathname)) {
    const stl = new STLLoader();
    const geom = stl.parse(buf);
    geom.computeBoundingBox();
    const bbox = geom.boundingBox!;
    const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
    const center = new THREE.Vector3().addVectors(bbox.min, bbox.max).multiplyScalar(0.5);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest > 0) {
      geom.applyMatrix4(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
      geom.applyMatrix4(new THREE.Matrix4().makeScale(1 / longest, 1 / longest, 1 / longest));
    }
    geom.computeVertexNormals();
    return geom;
  }

  const gltf = await new Promise<any>((resolve, reject) => {
    sharedLoader.parse(buf, '', resolve, reject);
  });

  // Walk the scene, baking each mesh's world-space transform into a clone.
  const geoms: THREE.BufferGeometry[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj: THREE.Object3D) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry.clone();
    // Strip everything we don't need so mergeGeometries doesn't complain
    // about mismatched attribute sets between meshes.
    const keep = new THREE.BufferGeometry();
    keep.setAttribute('position', g.getAttribute('position'));
    if (g.getIndex()) keep.setIndex(g.getIndex());
    keep.applyMatrix4(m.matrixWorld);
    keep.computeVertexNormals();
    geoms.push(keep);
  });

  if (geoms.length === 0) throw new Error('No mesh in glTF');

  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
  if (!merged) throw new Error('mergeGeometries failed (incompatible attributes)');

  // Center on origin + normalise so longest side = 1.
  merged.computeBoundingBox();
  const bbox = merged.boundingBox!;
  const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
  const center = new THREE.Vector3().addVectors(bbox.min, bbox.max).multiplyScalar(0.5);
  const longest = Math.max(size.x, size.y, size.z);
  if (longest > 0) {
    const m = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    merged.applyMatrix4(m);
    merged.applyMatrix4(new THREE.Matrix4().makeScale(1 / longest, 1 / longest, 1 / longest));
  }
  merged.computeVertexNormals();
  return merged;
}
