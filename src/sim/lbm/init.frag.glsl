// Initialize the LBM state to equilibrium with uniform inflow (u = U_in*x_hat).
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
layout(location = 2) out vec4 outC;

uniform float uUin;
uniform float uAoa;
uniform sampler2D uMask;
uniform vec2 uGrid;

const float W0 = 4.0 / 9.0;
const float WS = 1.0 / 9.0;
const float WD = 1.0 / 36.0;

float feq(vec2 e, float w, float rho, vec2 u) {
  float eu = e.x * u.x + e.y * u.y;
  float uu = u.x * u.x + u.y * u.y;
  return w * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * uu);
}

void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  float m = texelFetch(uMask, ic, 0).r * 255.0;
  if (m > 0.5 && m < 1.5) {
    outA = vec4(0.0);
    outB = vec4(0.0);
    outC = vec4(0.0, 1.0, 0.0, 0.0);
    return;
  }

  vec2 u = vec2(uUin * cos(uAoa), uUin * sin(uAoa));
  float rho = 1.0;

  float f0 = feq(vec2( 0,  0), W0, rho, u);
  float f1 = feq(vec2( 1,  0), WS, rho, u);
  float f2 = feq(vec2( 0,  1), WS, rho, u);
  float f3 = feq(vec2(-1,  0), WS, rho, u);
  float f4 = feq(vec2( 0, -1), WS, rho, u);
  float f5 = feq(vec2( 1,  1), WD, rho, u);
  float f6 = feq(vec2(-1,  1), WD, rho, u);
  float f7 = feq(vec2(-1, -1), WD, rho, u);
  float f8 = feq(vec2( 1, -1), WD, rho, u);

  outA = vec4(f0, f1, f2, f3);
  outB = vec4(f4, f5, f6, f7);
  outC = vec4(f8, rho, u.x, u.y);
}
