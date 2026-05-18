// Semi-Lagrangian advection of an RGBA dye field by the LBM velocity.
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uDye;       // previous dye field
uniform sampler2D uMacro;     // LBM texC: (f8, rho, ux, uy)
uniform sampler2D uMask;
uniform vec2 uGrid;
uniform float uDt;            // timestep in lattice units (typically 1)
uniform float uDecay;         // multiplicative decay per step (e.g. 0.998)

void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  float m = texelFetch(uMask, ic, 0).r * 255.0;
  if (m > 0.5 && m < 1.5) {
    // Solid: clear dye inside obstacle.
    outColor = vec4(0.0);
    return;
  }

  vec4 macro = texelFetch(uMacro, ic, 0);
  vec2 u = macro.zw;

  // Back-trace one timestep.
  vec2 srcUv = vUv - u * uDt / uGrid;
  srcUv = clamp(srcUv, vec2(0.0), vec2(1.0));

  vec4 sampled = texture(uDye, srcUv);
  outColor = sampled * uDecay;
}
