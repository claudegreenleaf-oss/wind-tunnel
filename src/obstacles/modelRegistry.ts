/**
 * Curated catalogue of public-CDN .glb models used as wind-tunnel obstacles.
 *
 * Every URL here was verified to return 200 + Content-Type model/gltf-binary
 * with Access-Control-Allow-Origin: * so GLTFLoader can fetch them directly
 * from any web origin.
 *
 * Hosts: threejs.org/examples/models (official three.js example set) and
 * cdn.jsdelivr.net (proxying KhronosGroup, CesiumGS, google/model-viewer).
 */

export interface RemoteModel {
  id: string;
  name: string;
  url: string;
  /** Approximate file size in KB — drives the loading-toast hint. */
  sizeKB: number;
  /**
   * Optional yaw (Y-axis rotation, radians) applied to the loaded geometry
   * so the model faces upstream by default. Models authored facing different
   * world axes get nudged here.
   */
  yawRad?: number;
  /**
   * Optional aspect bias: if true, the obstacle is "elongated along flow"
   * and the particle-cull radius uses halfLen instead of r. Used for the
   * inside-obstacle bounding-sphere heuristic.
   */
  elongated?: boolean;
}

export const REMOTE_MODELS: RemoteModel[] = [
  { id: 'duck',           name: 'Duck',           url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb',                                       sizeKB: 118 },
  { id: 'stork',          name: 'Stork',          url: 'https://threejs.org/examples/models/gltf/Stork.glb',                                                                                  sizeKB: 75, elongated: true },
  { id: 'flamingo',       name: 'Flamingo',       url: 'https://threejs.org/examples/models/gltf/Flamingo.glb',                                                                               sizeKB: 76, elongated: true },
  { id: 'parrot',         name: 'Parrot',         url: 'https://threejs.org/examples/models/gltf/Parrot.glb',                                                                                 sizeKB: 95 },
  { id: 'fox',            name: 'Fox',            url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb',                                       sizeKB: 159, elongated: true },
  { id: 'horse',          name: 'Horse',          url: 'https://threejs.org/examples/models/gltf/Horse.glb',                                                                                  sizeKB: 178, elongated: true },
  { id: 'milk-truck',     name: 'Milk Truck',     url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',               sizeKB: 361, elongated: true },
  { id: 'lee-perry',      name: 'Head',           url: 'https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb',                                                             sizeKB: 396 },
  { id: 'robot',          name: 'Robot',          url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',                                                         sizeKB: 453 },
  { id: 'cesium-drone',   name: 'Drone',          url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb',                                  sizeKB: 1142, elongated: true },
  { id: 'ferrari',        name: 'Ferrari',        url: 'https://threejs.org/examples/models/gltf/ferrari.glb',                                                                                sizeKB: 1642, elongated: true },
  { id: 'astronaut',      name: 'Astronaut',      url: 'https://cdn.jsdelivr.net/gh/google/model-viewer@master/packages/shared-assets/models/Astronaut.glb',                                   sizeKB: 2802 },
  { id: 'damaged-helmet', name: 'Damaged Helmet', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',                   sizeKB: 3686 },
  { id: 'toy-car',        name: 'Toy Car',        url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ToyCar/glTF-Binary/ToyCar.glb',                                 sizeKB: 5295, elongated: true },
  { id: 'buggy',          name: 'VW Buggy',       url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Buggy/glTF-Binary/Buggy.glb',                                    sizeKB: 7169, elongated: true },
];

export function getRemoteModel(id: string): RemoteModel | undefined {
  return REMOTE_MODELS.find((m) => m.id === id);
}
