import * as THREE from 'three';
import { FullScreenPass, PASSTHROUGH_VERT, createFloatRT, pickFloatType } from '../../util/passes';
import LBM_FRAG from './lbm.frag.glsl?raw';
import INIT_FRAG from './init.frag.glsl?raw';

/**
 * GPU D2Q9 BGK Lattice Boltzmann solver.
 * Stores 9 distributions per cell across 3 RGBA float render targets, ping-pong.
 * Macroscopics (rho, u_x, u_y) are co-located in texture C for downstream passes.
 */
export class LBMSolver {
  readonly width: number;
  readonly height: number;
  readonly floatType: THREE.TextureDataType;

  private rtA: THREE.WebGLRenderTarget; // "current" state
  private rtB: THREE.WebGLRenderTarget; // "next" state
  private stepPass: FullScreenPass;
  private initPass: FullScreenPass;

  // Tunable params
  uIn = 0.1;
  visc = 0.005;
  aoaRad = 0;

  maskTexture: THREE.Texture;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number, maskTexture: THREE.Texture) {
    this.width = width;
    this.height = height;
    this.maskTexture = maskTexture;
    this.floatType = pickFloatType(renderer, true);

    this.rtA = createFloatRT(width, height, this.floatType, 3);
    this.rtB = createFloatRT(width, height, this.floatType, 3);

    this.stepPass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: LBM_FRAG,
      uniforms: {
        uTexA: { value: null },
        uTexB: { value: null },
        uTexC: { value: null },
        uMask: { value: maskTexture },
        uGrid: { value: new THREE.Vector2(width, height) },
        uOmega: { value: this.computeOmega() },
        uUin: { value: this.uIn },
        uAoa: { value: this.aoaRad },
      },
    }));

    this.initPass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: INIT_FRAG,
      uniforms: {
        uMask: { value: maskTexture },
        uGrid: { value: new THREE.Vector2(width, height) },
        uUin: { value: this.uIn },
        uAoa: { value: this.aoaRad },
      },
    }));

    this.reset(renderer);
  }

  /** Re-initialize both ping-pong buffers to equilibrium inflow. */
  reset(renderer: THREE.WebGLRenderer) {
    const initMat = this.initPass.material;
    initMat.uniforms.uUin.value = this.uIn;
    initMat.uniforms.uAoa.value = this.aoaRad;
    initMat.uniformsNeedUpdate = true;

    this.initPass.render(renderer, this.rtA);
    this.initPass.render(renderer, this.rtB);
  }

  /** Advance by one LBM timestep. */
  step(renderer: THREE.WebGLRenderer) {
    const u = this.stepPass.material.uniforms;
    u.uTexA.value = this.rtA.textures[0];
    u.uTexB.value = this.rtA.textures[1];
    u.uTexC.value = this.rtA.textures[2];
    u.uMask.value = this.maskTexture;
    u.uOmega.value = this.computeOmega();
    u.uUin.value = this.uIn;
    u.uAoa.value = this.aoaRad;
    this.stepPass.material.uniformsNeedUpdate = true;

    this.stepPass.render(renderer, this.rtB);

    // ping-pong
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;
  }

  setMask(maskTexture: THREE.Texture) {
    this.maskTexture = maskTexture;
    this.stepPass.material.uniforms.uMask.value = maskTexture;
    this.initPass.material.uniforms.uMask.value = maskTexture;
  }

  /** Texture C: (f8, rho, ux, uy). Downstream passes read this. */
  get macroTexture(): THREE.Texture {
    return this.rtA.textures[2];
  }
  /** Texture A: (f0, f1, f2, f3). Force pass needs raw distributions. */
  get fTextureA(): THREE.Texture { return this.rtA.textures[0]; }
  get fTextureB(): THREE.Texture { return this.rtA.textures[1]; }
  get fTextureC(): THREE.Texture { return this.rtA.textures[2]; }

  private computeOmega(): number {
    // tau = 3*nu + 0.5, omega = 1/tau. Stability requires tau > 0.5.
    const tau = 3 * this.visc + 0.5;
    return 1 / Math.max(tau, 0.5001);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.stepPass.dispose();
    this.initPass.dispose();
  }
}
