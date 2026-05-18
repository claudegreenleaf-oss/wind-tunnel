import * as THREE from 'three';
import { FullScreenPass, PASSTHROUGH_VERT, createFloatRT, pickFloatType } from '../../util/passes';
import FORCE_FRAG from './force.frag.glsl?raw';
import REDUCE_FRAG from './reduce.frag.glsl?raw';

/**
 * GPU force computation:
 *  Pass 1: per-cell momentum-exchange force, written into a full-grid texture.
 *  Pass 2..N: 4x4 sum-reductions until 1x1.
 *  Pass N+1: async readback of the 1x1 result via gl.readPixels every 4 frames.
 */
export class ForceComputer {
  private readonly type: THREE.TextureDataType;
  private readonly forceRT: THREE.WebGLRenderTarget;
  private readonly pyramid: THREE.WebGLRenderTarget[];
  private readonly forcePass: FullScreenPass;
  private readonly reducePass: FullScreenPass;
  private readonly readback = new Float32Array(4);

  // Latest readings (lattice units).
  Fx = 0;
  Fy = 0;

  width: number;
  height: number;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.type = pickFloatType(renderer, true);

    this.forceRT = createFloatRT(width, height, this.type, 1);

    // Build a 4x downsample pyramid.
    this.pyramid = [];
    let w = width, h = height;
    while (w > 1 || h > 1) {
      w = Math.max(1, Math.ceil(w / 4));
      h = Math.max(1, Math.ceil(h / 4));
      this.pyramid.push(createFloatRT(w, h, this.type, 1));
    }

    this.forcePass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: FORCE_FRAG,
      uniforms: {
        uTexA: { value: null },
        uTexB: { value: null },
        uTexC: { value: null },
        uMask: { value: null },
        uGrid: { value: new THREE.Vector2(width, height) },
      },
    }));

    this.reducePass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: REDUCE_FRAG,
      uniforms: {
        uSrc: { value: null },
        uSrcSize: { value: new THREE.Vector2(width, height) },
      },
    }));
  }

  /** Compute force, reduce to 1x1, read back. Returns the lattice-units (Fx, Fy). */
  compute(
    renderer: THREE.WebGLRenderer,
    fA: THREE.Texture,
    fB: THREE.Texture,
    fC: THREE.Texture,
    mask: THREE.Texture,
  ): { Fx: number; Fy: number } {
    // 1) Per-cell force.
    const fu = this.forcePass.material.uniforms;
    fu.uTexA.value = fA;
    fu.uTexB.value = fB;
    fu.uTexC.value = fC;
    fu.uMask.value = mask;
    this.forcePass.render(renderer, this.forceRT);

    // 2) Pyramid reduction.
    let srcTex: THREE.Texture = this.forceRT.texture;
    let srcW = this.width, srcH = this.height;
    for (const dst of this.pyramid) {
      const ru = this.reducePass.material.uniforms;
      ru.uSrc.value = srcTex;
      (ru.uSrcSize.value as THREE.Vector2).set(srcW, srcH);
      this.reducePass.render(renderer, dst);
      srcTex = dst.texture;
      srcW = dst.width;
      srcH = dst.height;
    }

    // 3) Read back the 1x1 result.
    const final = this.pyramid[this.pyramid.length - 1];
    const gl = renderer.getContext() as WebGL2RenderingContext;
    renderer.setRenderTarget(final);
    if (this.type === THREE.FloatType) {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, this.readback);
    } else {
      // HalfFloat readback requires intermediate conversion. For our purposes,
      // half-float force readings are noisy; we still do a best-effort read.
      const tmp = new Uint16Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.HALF_FLOAT, tmp);
      this.readback[0] = halfToFloat(tmp[0]);
      this.readback[1] = halfToFloat(tmp[1]);
    }
    this.Fx = this.readback[0];
    this.Fy = this.readback[1];
    return { Fx: this.Fx, Fy: this.Fy };
  }

  dispose() {
    this.forceRT.dispose();
    for (const rt of this.pyramid) rt.dispose();
    this.forcePass.dispose();
    this.reducePass.dispose();
  }
}

/** Convert IEEE 754 half-precision float bits to a regular JS number. */
function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : ((s ? -1 : 1) * Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
