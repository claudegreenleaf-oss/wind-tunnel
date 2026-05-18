// Final composite pass — renders the LBM state + dye to the canvas.
// Modes: 0 = speed magnitude, 1 = vorticity (signed curl), 2 = pressure, 3 = dye only.
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uMacro;   // (f8, rho, ux, uy)
uniform sampler2D uDye;
uniform sampler2D uMask;
uniform vec2 uGrid;
uniform int uMode;
uniform float uSpeedScale;  // normalization for speed (1/uIn typically)
uniform float uDyeStrength;

// Viridis approximation by Inigo Quilez-style polynomial fit. Cheap and pretty close.
vec3 viridis(float t) {
  t = clamp(t, 0.0, 1.0);
  const vec3 c0 = vec3(0.2777, 0.0054, 0.3340);
  const vec3 c1 = vec3(0.1059, 1.4046, 1.3845);
  const vec3 c2 = vec3(-0.3308, 0.2148, 0.0952);
  const vec3 c3 = vec3(-4.6342, -5.7991, -19.3324);
  const vec3 c4 = vec3(6.2287, 14.1799, 56.6905);
  const vec3 c5 = vec3(4.7763, -13.7451, -65.3530);
  const vec3 c6 = vec3(-5.4357, 4.6453, 26.3124);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}

// Bipolar magma-ish: blue/black/red. For vorticity / pressure deviation.
vec3 bipolar(float t) {
  // t in [-1, 1]
  float s = abs(t);
  vec3 cold = mix(vec3(0.05, 0.07, 0.12), vec3(0.27, 0.65, 1.0), s);
  vec3 hot  = mix(vec3(0.07, 0.05, 0.10), vec3(1.0, 0.43, 0.7), s);
  return t < 0.0 ? cold : hot;
}

void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  float m = texelFetch(uMask, ic, 0).r * 255.0;
  bool isWall = (m > 0.5 && m < 1.5);

  vec3 bg = vec3(0.02, 0.02, 0.04);

  if (isWall) {
    // Obstacle silhouette + subtle inner edge.
    outColor = vec4(0.92, 0.92, 0.96, 1.0);
    return;
  }

  vec4 macro = texelFetch(uMacro, ic, 0);
  vec2 u = macro.zw;
  float rho = macro.y;

  vec3 fieldColor = bg;

  if (uMode == 0) {
    // Speed magnitude
    float s = length(u) * uSpeedScale;
    fieldColor = viridis(clamp(s, 0.0, 1.0));
  } else if (uMode == 1) {
    // Vorticity (curl_z = du_y/dx - du_x/dy), central difference.
    int W = int(uGrid.x);
    int H = int(uGrid.y);
    ivec2 ixp = ivec2(min(ic.x + 1, W - 1), ic.y);
    ivec2 ixm = ivec2(max(ic.x - 1, 0), ic.y);
    ivec2 iyp = ivec2(ic.x, min(ic.y + 1, H - 1));
    ivec2 iym = ivec2(ic.x, max(ic.y - 1, 0));
    float duy_dx = (texelFetch(uMacro, ixp, 0).w - texelFetch(uMacro, ixm, 0).w) * 0.5;
    float dux_dy = (texelFetch(uMacro, iyp, 0).z - texelFetch(uMacro, iym, 0).z) * 0.5;
    float curl = duy_dx - dux_dy;
    // Scale: vorticity in lattice units is typically tiny; multiply for visibility.
    float t = clamp(curl * 30.0, -1.0, 1.0);
    fieldColor = bipolar(t);
  } else if (uMode == 2) {
    // Pressure (rho - 1)
    float p = (rho - 1.0) * 3.0; // amplify
    fieldColor = bipolar(clamp(p, -1.0, 1.0));
  } else {
    // Dye only — pure black background, dye on top.
    fieldColor = vec3(0.0);
  }

  // Composite dye on top (additive with soft saturation).
  vec4 dye = texelFetch(uDye, ic, 0);
  vec3 dyeRgb = dye.rgb * uDyeStrength;
  // Tone-map: 1 - exp(-x) keeps highlights from blowing out.
  dyeRgb = vec3(1.0) - exp(-dyeRgb);

  // Blend: field underneath, dye glowing on top.
  vec3 finalRgb = fieldColor * (1.0 - 0.4 * length(dyeRgb)) + dyeRgb;
  outColor = vec4(finalRgb, 1.0);
}
