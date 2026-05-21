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

/** Free-text category used to group items into <optgroup>s in the dropdown. */
export type ModelCategory =
  | 'vehicles' | 'aircraft' | 'characters' | 'animals' | 'objects' | 'misc';

export interface RemoteModelExt extends RemoteModel {
  category: ModelCategory;
}

export const REMOTE_MODELS: RemoteModelExt[] = [
  // ── Aircraft ──
  { id: 'cesium-air',     name: 'Cessna',         category: 'aircraft',  url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',                  sizeKB: 165, elongated: true },
  { id: 'cesium-drone',   name: 'Drone',          category: 'aircraft',  url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb',               sizeKB: 1142, elongated: true },
  { id: 'cesium-balloon', name: 'Hot-Air Balloon',category: 'aircraft',  url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumBalloon/CesiumBalloon.glb',           sizeKB: 175 },

  // ── Vehicles ──
  { id: 'milk-truck',     name: 'Milk Truck',     category: 'vehicles',  url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb', sizeKB: 361, elongated: true },
  { id: 'ground-vehicle', name: 'Ground Vehicle', category: 'vehicles',  url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb',           sizeKB: 350, elongated: true },
  { id: 'ferrari',        name: 'Ferrari',        category: 'vehicles',  url: 'https://threejs.org/examples/models/gltf/ferrari.glb',                                                              sizeKB: 1642, elongated: true },
  { id: 'toy-car',        name: 'Toy Car',        category: 'vehicles',  url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ToyCar/glTF-Binary/ToyCar.glb',             sizeKB: 5295, elongated: true },
  { id: 'buggy',          name: 'VW Buggy',       category: 'vehicles',  url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Buggy/glTF-Binary/Buggy.glb',                sizeKB: 7169, elongated: true },

  // ── Characters ──
  { id: 'lee-perry',      name: 'Head (Lee Perry)', category: 'characters', url: 'https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb',                                       sizeKB: 396 },
  { id: 'michelle',       name: 'Michelle',       category: 'characters', url: 'https://threejs.org/examples/models/gltf/Michelle.glb',                                                            sizeKB: 410, elongated: true },
  { id: 'nefertiti',      name: 'Nefertiti',      category: 'characters', url: 'https://threejs.org/examples/models/gltf/Nefertiti/Nefertiti.glb',                                                 sizeKB: 760 },
  { id: 'robot',          name: 'Robot',          category: 'characters', url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',                                     sizeKB: 453 },
  { id: 'astronaut',      name: 'Astronaut',      category: 'characters', url: 'https://cdn.jsdelivr.net/gh/google/model-viewer@master/packages/shared-assets/models/Astronaut.glb',               sizeKB: 2802 },
  { id: 'damaged-helmet', name: 'Damaged Helmet', category: 'characters', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb', sizeKB: 3686 },

  // ── Animals ──
  { id: 'duck',           name: 'Duck',           category: 'animals',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb',                  sizeKB: 118 },
  { id: 'stork',          name: 'Stork',          category: 'animals',   url: 'https://threejs.org/examples/models/gltf/Stork.glb',                                                                sizeKB: 75, elongated: true },
  { id: 'flamingo',       name: 'Flamingo',       category: 'animals',   url: 'https://threejs.org/examples/models/gltf/Flamingo.glb',                                                             sizeKB: 76, elongated: true },
  { id: 'parrot',         name: 'Parrot',         category: 'animals',   url: 'https://threejs.org/examples/models/gltf/Parrot.glb',                                                               sizeKB: 95 },
  { id: 'fox',            name: 'Fox',            category: 'animals',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb',                    sizeKB: 159, elongated: true },
  { id: 'horse',          name: 'Horse',          category: 'animals',   url: 'https://threejs.org/examples/models/gltf/Horse.glb',                                                                sizeKB: 178, elongated: true },
  { id: 'brain-stem',     name: 'Brain Stem',     category: 'animals',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BrainStem/glTF-Binary/BrainStem.glb',        sizeKB: 1900, elongated: true },

  // ── Custom (user-supplied) ──
  { id: 'clipped',        name: 'Clipped (custom STL)', category: 'misc',  url: '/models/clipped.stl', sizeKB: 4000, elongated: true },

  // ── Objects ──
  { id: 'avocado',        name: 'Avocado',        category: 'objects',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Avocado/glTF-Binary/Avocado.glb',           sizeKB: 1900 },
  { id: 'boom-box',       name: 'Boom Box',       category: 'objects',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',            sizeKB: 1900 },
  { id: 'antique-camera', name: 'Antique Camera', category: 'objects',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb', sizeKB: 17000 },
  { id: 'water-bottle',   name: 'Water Bottle',   category: 'objects',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/WaterBottle/glTF-Binary/WaterBottle.glb',    sizeKB: 1700, elongated: true },
  { id: 'lantern',        name: 'Lantern',        category: 'objects',   url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Lantern/glTF-Binary/Lantern.glb',            sizeKB: 5500, elongated: true },
  { id: 'coffeemat',      name: 'Coffeemat',      category: 'objects',   url: 'https://threejs.org/examples/models/gltf/coffeemat.glb',                                                             sizeKB: 950 },
  { id: 'iridescence',    name: 'Iridescence Lamp', category: 'objects', url: 'https://threejs.org/examples/models/gltf/IridescenceLamp.glb',                                                       sizeKB: 1500, elongated: true },
];

export function getRemoteModel(id: string): RemoteModel | undefined {
  return REMOTE_MODELS.find((m) => m.id === id);
}
