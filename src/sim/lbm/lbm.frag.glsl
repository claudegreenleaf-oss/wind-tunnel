// D2Q9 BGK Lattice Boltzmann — combined stream + collide pass.
// Lattice layout (matching the Xinhuan-Imperial PhD convention, adapted for 2D):
//   6   2   5
//     \ | /
//   3 — 0 — 1
//     / | \
//   7   4   8
// Cell mask (R8 texture, value * 255):
//   0 = fluid, 1 = wall (bounce-back), 2 = inlet, 3 = outlet.
// Texture layout (3 RGBA float textures):
//   texA = (f0, f1, f2, f3)
//   texB = (f4, f5, f6, f7)
//   texC = (f8, rho, ux, uy)   <- last 3 channels are derived macroscopics for downstream passes

precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
layout(location = 2) out vec4 outC;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uTexC;
uniform sampler2D uMask;
uniform vec2 uGrid;      // (W, H) of the lattice
uniform float uOmega;    // BGK relaxation = 1 / tau
uniform float uUin;      // inlet velocity (lattice units)
uniform float uAoa;      // angle of attack — tilts the inlet flow direction (radians)

// Weights
const float W0 = 4.0 / 9.0;
const float WS = 1.0 / 9.0;   // side
const float WD = 1.0 / 36.0;  // diagonal

// Read distribution i (0..8) from a cell, returning a scalar.
float readF(int i, ivec2 ic) {
  vec4 a = texelFetch(uTexA, ic, 0);
  vec4 b = texelFetch(uTexB, ic, 0);
  vec4 c = texelFetch(uTexC, ic, 0);
  if (i == 0) return a.x;
  if (i == 1) return a.y;
  if (i == 2) return a.z;
  if (i == 3) return a.w;
  if (i == 4) return b.x;
  if (i == 5) return b.y;
  if (i == 6) return b.z;
  if (i == 7) return b.w;
  return c.x; // i == 8
}

int opp(int i) {
  // direction inverses for D2Q9
  if (i == 0) return 0;
  if (i == 1) return 3;
  if (i == 2) return 4;
  if (i == 3) return 1;
  if (i == 4) return 2;
  if (i == 5) return 7;
  if (i == 6) return 8;
  if (i == 7) return 5;
  return 6; // i == 8
}

ivec2 eVec(int i) {
  if (i == 0) return ivec2( 0,  0);
  if (i == 1) return ivec2( 1,  0);
  if (i == 2) return ivec2( 0,  1);
  if (i == 3) return ivec2(-1,  0);
  if (i == 4) return ivec2( 0, -1);
  if (i == 5) return ivec2( 1,  1);
  if (i == 6) return ivec2(-1,  1);
  if (i == 7) return ivec2(-1, -1);
  return ivec2( 1, -1); // i == 8
}

float weight(int i) {
  if (i == 0) return W0;
  if (i <= 4) return WS;
  return WD;
}

float feq(int i, float rho, vec2 u) {
  vec2 e = vec2(eVec(i));
  float eu = e.x * u.x + e.y * u.y;
  float uu = u.x * u.x + u.y * u.y;
  return weight(i) * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * uu);
}

// Read the post-streaming f_i at cell `ic` (the current target cell).
// Handles: bounce-back from solid walls, inlet equilibrium, outlet zero-gradient,
// top/bottom no-slip walls.
float streamRead(int i, ivec2 ic, int W, int H) {
  ivec2 src = ic - eVec(i);

  // Top / bottom: bounce-back (no-slip wall).
  if (src.y < 0 || src.y >= H) {
    return readF(opp(i), ic);
  }
  // Left: inlet forced equilibrium.
  if (src.x < 0) {
    vec2 uIn = vec2(uUin * cos(uAoa), uUin * sin(uAoa));
    return feq(i, 1.0, uIn);
  }
  // Right: outlet zero-gradient (clamp).
  if (src.x >= W) {
    src.x = W - 1;
  }
  // Solid obstacle: bounce-back.
  float m = texelFetch(uMask, src, 0).r * 255.0;
  if (m > 0.5 && m < 1.5) { // wall tag
    return readF(opp(i), ic);
  }
  return readF(i, src);
}

void main() {
  int W = int(uGrid.x);
  int H = int(uGrid.y);
  ivec2 ic = ivec2(gl_FragCoord.xy);

  float myMask = texelFetch(uMask, ic, 0).r * 255.0;

  // Solid cell: write zeros (the data is unused; mask tells downstream passes to skip).
  if (myMask > 0.5 && myMask < 1.5) {
    outA = vec4(0.0);
    outB = vec4(0.0);
    outC = vec4(0.0, 1.0, 0.0, 0.0); // rho=1 so dye advection sees stationary fluid
    return;
  }

  // 1) Streaming: pull f_i from the cell at -e_i (or bounce-back).
  float f0 = streamRead(0, ic, W, H);
  float f1 = streamRead(1, ic, W, H);
  float f2 = streamRead(2, ic, W, H);
  float f3 = streamRead(3, ic, W, H);
  float f4 = streamRead(4, ic, W, H);
  float f5 = streamRead(5, ic, W, H);
  float f6 = streamRead(6, ic, W, H);
  float f7 = streamRead(7, ic, W, H);
  float f8 = streamRead(8, ic, W, H);

  // 2) Compute macroscopics.
  float rho = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
  rho = max(rho, 1e-4);
  vec2 u = vec2(
    (f1 + f5 + f8) - (f3 + f6 + f7),
    (f2 + f5 + f6) - (f4 + f7 + f8)
  ) / rho;

  // 3) Inlet boundary: force equilibrium at the left edge for cleanest inflow.
  if (ic.x == 0) {
    vec2 uIn = vec2(uUin * cos(uAoa), uUin * sin(uAoa));
    rho = 1.0;
    u = uIn;
    f0 = feq(0, rho, u);
    f1 = feq(1, rho, u);
    f2 = feq(2, rho, u);
    f3 = feq(3, rho, u);
    f4 = feq(4, rho, u);
    f5 = feq(5, rho, u);
    f6 = feq(6, rho, u);
    f7 = feq(7, rho, u);
    f8 = feq(8, rho, u);
  } else {
    // 4) BGK collision: f += omega * (feq - f).
    f0 += uOmega * (feq(0, rho, u) - f0);
    f1 += uOmega * (feq(1, rho, u) - f1);
    f2 += uOmega * (feq(2, rho, u) - f2);
    f3 += uOmega * (feq(3, rho, u) - f3);
    f4 += uOmega * (feq(4, rho, u) - f4);
    f5 += uOmega * (feq(5, rho, u) - f5);
    f6 += uOmega * (feq(6, rho, u) - f6);
    f7 += uOmega * (feq(7, rho, u) - f7);
    f8 += uOmega * (feq(8, rho, u) - f8);
  }

  outA = vec4(f0, f1, f2, f3);
  outB = vec4(f4, f5, f6, f7);
  outC = vec4(f8, rho, u.x, u.y);
}
