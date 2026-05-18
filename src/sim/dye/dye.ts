import * as THREE from 'three';
import { FullScreenPass, PASSTHROUGH_VERT, pickFloatType } from '../../util/passes';
import ADVECT_FRAG from './advect.frag.glsl?raw';
import INJECT_FRAG from './inject.frag.glsl?raw';

// Dye field uses LINEAR filtering so semi-Lagrangian back-trace can sample
// between cells. Without this, the tiny sub-cell offset gets clamped by NEAREST
// and dye never advects.
function createDyeRT(width: number, height: number, type: THREE.TextureDataType): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

/** GPU dye field — semi-Lagrangian advection + inlet injection. */
export class DyeField {
  readonly width: number;
  readonly height: number;
  private readonly type: THREE.TextureDataType;
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private advectPass: FullScreenPass;
  private injectPass: FullScreenPass;

  amount = 0.7;
  decay = 0.992;   // a touch more aggressive so streamlines don't smear to white downstream
  inletWidth = 4;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number, maskTexture: THREE.Texture) {
    this.width = width;
    this.height = height;
    this.type = pickFloatType(renderer, false); // half-float is plenty for dye color

    this.rtA = createDyeRT(width, height, this.type);
    this.rtB = createDyeRT(width, height, this.type);

    this.advectPass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: ADVECT_FRAG,
      uniforms: {
        uDye: { value: null },
        uMacro: { value: null },
        uMask: { value: maskTexture },
        uGrid: { value: new THREE.Vector2(width, height) },
        uDt: { value: 5.0 },
        uDecay: { value: this.decay },
      },
    }));

    this.injectPass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: INJECT_FRAG,
      uniforms: {
        uDye: { value: null },
        uGrid: { value: new THREE.Vector2(width, height) },
        uAmount: { value: this.amount },
        uInletWidth: { value: this.inletWidth },
      },
    }));

    this.reset(renderer);
  }

  reset(renderer: THREE.WebGLRenderer) {
    const old = renderer.getClearColor(new THREE.Color());
    const oldA = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.rtA);
    renderer.clear();
    renderer.setRenderTarget(this.rtB);
    renderer.clear();
    renderer.setClearColor(old, oldA);
  }

  step(renderer: THREE.WebGLRenderer, macroTexture: THREE.Texture, maskTexture: THREE.Texture) {
    // Advect rtA -> rtB
    const au = this.advectPass.material.uniforms;
    au.uDye.value = this.rtA.texture;
    au.uMacro.value = macroTexture;
    au.uMask.value = maskTexture;
    au.uDecay.value = this.decay;
    this.advectPass.render(renderer, this.rtB);

    // Inject into rtB -> rtA (swap roles)
    const iu = this.injectPass.material.uniforms;
    iu.uDye.value = this.rtB.texture;
    iu.uAmount.value = this.amount;
    iu.uInletWidth.value = this.inletWidth;
    this.injectPass.render(renderer, this.rtA);
  }

  get texture(): THREE.Texture { return this.rtA.texture; }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.advectPass.dispose();
    this.injectPass.dispose();
  }
}
