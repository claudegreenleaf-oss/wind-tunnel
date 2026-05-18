import * as THREE from 'three';
import { FullScreenPass, PASSTHROUGH_VERT } from '../util/passes';
import COMPOSITE_FRAG from './composite.frag.glsl?raw';

/** Final pass that draws the simulation state to the screen. */
export class CompositeRenderer {
  private readonly pass: FullScreenPass;

  /** Visualization mode: 0=speed, 1=vorticity, 2=pressure, 3=dye-only. */
  mode = 1;
  speedScale = 10; // 1 / uIn, recomputed externally
  dyeStrength = 1.2;

  constructor(width: number, height: number) {
    this.pass = new FullScreenPass(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PASSTHROUGH_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        uMacro: { value: null },
        uDye: { value: null },
        uMask: { value: null },
        uGrid: { value: new THREE.Vector2(width, height) },
        uMode: { value: this.mode },
        uSpeedScale: { value: this.speedScale },
        uDyeStrength: { value: this.dyeStrength },
      },
    }));
  }

  render(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget | null,
    macro: THREE.Texture,
    dye: THREE.Texture,
    mask: THREE.Texture,
  ) {
    const u = this.pass.material.uniforms;
    u.uMacro.value = macro;
    u.uDye.value = dye;
    u.uMask.value = mask;
    u.uMode.value = this.mode;
    u.uSpeedScale.value = this.speedScale;
    u.uDyeStrength.value = this.dyeStrength;
    this.pass.render(renderer, target);
  }

  dispose() { this.pass.dispose(); }
}
