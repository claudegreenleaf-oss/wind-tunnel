// Sum-reduction: 4x4 → 1, repeated until 1x1. Writes (sumFx, sumFy, 0, 0).
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSrc;
uniform ivec2 uSrcSize;

void main() {
  ivec2 oc = ivec2(gl_FragCoord.xy);
  ivec2 base = oc * 4;

  vec2 sum = vec2(0.0);
  for (int dy = 0; dy < 4; dy++) {
    for (int dx = 0; dx < 4; dx++) {
      ivec2 s = base + ivec2(dx, dy);
      if (s.x < uSrcSize.x && s.y < uSrcSize.y) {
        sum += texelFetch(uSrc, s, 0).rg;
      }
    }
  }
  outColor = vec4(sum, 0.0, 0.0);
}
