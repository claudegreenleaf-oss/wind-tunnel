// Inject horizontal colored stripes at the inlet column. Additive composite onto existing dye.
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uDye;
uniform vec2 uGrid;
uniform float uAmount;   // 0..1
uniform int uInletWidth; // injection band width in cells

void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(uDye, ic, 0);

  if (ic.x < uInletWidth) {
    // Stripe pattern: 8-cell band of dye, 8-cell band of nothing → distinct streamlines.
    // Color hue rotates every band for visual variety.
    float bandIdx = floor(float(ic.y) / 8.0);
    bool inBand = mod(bandIdx, 2.0) < 0.5;
    if (inBand) {
      float hueIdx = mod(floor(bandIdx / 2.0), 3.0);
      vec3 c;
      if (hueIdx < 1.0) c = vec3(0.42, 0.94, 0.84);       // accent cyan
      else if (hueIdx < 2.0) c = vec3(1.0, 0.48, 0.85);   // accent pink
      else c = vec3(0.96, 0.86, 0.31);                    // warm yellow
      outColor = prev + vec4(c, 1.0) * uAmount * 0.25;    // gentle additive injection
      outColor = min(outColor, vec4(1.5));
    } else {
      outColor = prev; // gaps stay clean
    }
  } else {
    outColor = prev;
  }
}
