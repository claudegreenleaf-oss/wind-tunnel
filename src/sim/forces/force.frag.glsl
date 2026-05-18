// Momentum-exchange force on the obstacle surface.
// For each fluid cell adjacent to a solid wall in direction e_i, the wall feels
// a force contribution of (f_i^pre + f_i^post) * e_i (in lattice units).
// Here we approximate using the current post-collision distributions: sum over
// neighbors that are solid, of (f_i + f_{opp(i)}) * e_i, where f_i is at this
// fluid cell in direction i pointing into the wall, and f_{opp(i)} is at the
// fluid cell in the opposite direction.
// We write (Fx, Fy) into the .rg channels; .ba unused.
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uTexC;
uniform sampler2D uMask;
uniform vec2 uGrid;

float fAt(int i, ivec2 c) {
  vec4 a = texelFetch(uTexA, c, 0);
  vec4 b = texelFetch(uTexB, c, 0);
  vec4 t = texelFetch(uTexC, c, 0);
  if (i == 0) return a.x;
  if (i == 1) return a.y;
  if (i == 2) return a.z;
  if (i == 3) return a.w;
  if (i == 4) return b.x;
  if (i == 5) return b.y;
  if (i == 6) return b.z;
  if (i == 7) return b.w;
  return t.x;
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
  return ivec2( 1, -1);
}

int opp(int i) {
  if (i == 0) return 0;
  if (i == 1) return 3;
  if (i == 2) return 4;
  if (i == 3) return 1;
  if (i == 4) return 2;
  if (i == 5) return 7;
  if (i == 6) return 8;
  if (i == 7) return 5;
  return 6;
}

bool isWall(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= int(uGrid.x) || c.y >= int(uGrid.y)) return false;
  float m = texelFetch(uMask, c, 0).r * 255.0;
  return m > 0.5 && m < 1.5;
}

void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);

  // Only fluid cells contribute.
  if (isWall(ic)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 F = vec2(0.0);
  // Check each direction; if neighbor is solid, accumulate momentum exchange.
  for (int i = 1; i < 9; i++) {
    ivec2 nb = ic + eVec(i);
    if (isWall(nb)) {
      float fi = fAt(i, ic);
      float fo = fAt(opp(i), nb); // wall has 0, but kept for completeness
      vec2 e = vec2(eVec(i));
      F += (fi + fo) * e;
    }
  }

  outColor = vec4(F, 0.0, 0.0);
}
