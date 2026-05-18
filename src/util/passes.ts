import * as THREE from 'three';

// Cell-classification tags used in the mask R8 texture (values *255 in shader).
// Matches the Xinhuan-Imperial PhD LBM convention adapted for 2D.
export const CELL = {
  FLUID: 0,    // ordinary fluid cell (default = 0 so blank textures are fluid)
  WALL: 1,     // solid obstacle / external wall
  INLET: 2,    // left edge — forced equilibrium
  OUTLET: 3,   // right edge — zero-gradient
} as const;

// Vertex shader shared by every fullscreen pass.
// NOTE: Three.js (RawShaderMaterial + glslVersion=GLSL3) prepends '#version 300 es' automatically;
// adding it here would duplicate the directive and silently fail compilation.
export const PASSTHROUGH_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** A single fullscreen quad pass: render a shader to a render target. */
export class FullScreenPass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mesh: THREE.Mesh;
  material: THREE.RawShaderMaterial;

  constructor(material: THREE.RawShaderMaterial) {
    this.material = material;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(this.mesh);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export interface FloatRTOptions {
  count?: number;       // # of color attachments (MRT)
  preferFloat32?: boolean;
}

/** Pick the best floating-point texture type the GPU can render to. */
export function pickFloatType(renderer: THREE.WebGLRenderer, preferFloat32 = true): THREE.TextureDataType {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const hasF32 = !!gl.getExtension('EXT_color_buffer_float');
  if (preferFloat32 && hasF32) return THREE.FloatType;
  // HalfFloat is universally available on WebGL2 for color attachments.
  return THREE.HalfFloatType;
}

/** Create a (possibly multi-target) render target with float textures, nearest filter.
 *  Only passes `count` when > 1 so single-target RTs use the simpler non-MRT code path. */
export function createFloatRT(
  width: number,
  height: number,
  type: THREE.TextureDataType,
  count = 1,
): THREE.WebGLRenderTarget {
  const opts: THREE.RenderTargetOptions = {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  };
  if (count > 1) opts.count = count;
  return new THREE.WebGLRenderTarget(width, height, opts);
}

/** Create a single-channel R8 texture from a Uint8Array (for the obstacle/cell mask). */
export function createMaskTexture(width: number, height: number, data?: Uint8Array): THREE.DataTexture {
  const arr = data ?? new Uint8Array(width * height);
  const tex = new THREE.DataTexture(arr, width, height, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
