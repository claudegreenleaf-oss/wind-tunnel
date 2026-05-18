// Inject dye at the inlet (-X face) with a vivid full-face color gradient.
// Wider band + dense color = obvious flow lines streaming through the tunnel.
struct Params {
  dims     : vec4<u32>,   // W, H, D, _pad
  amount   : f32,
  _pad0    : f32,
  _pad1    : f32,
  _pad2    : f32,
}

@group(0) @binding(0) var<uniform> params  : Params;
@group(0) @binding(1) var          dyeTex  : texture_storage_3d<rgba16float, read_write>;

@compute @workgroup_size(4, 4, 4)
fn cs_inject(@builtin(global_invocation_id) gid : vec3<u32>) {
  let H = params.dims.y;
  let D = params.dims.z;
  if gid.x >= 14u || gid.y >= H || gid.z >= D { return; }

  // Coordinates in cross-section, centered at origin
  let fy = f32(gid.y) / f32(H) - 0.5;  // -0.5 .. 0.5
  let fz = f32(gid.z) / f32(D) - 0.5;
  let radial = sqrt(fy*fy + fz*fz);
  let ang = atan2(fz, fy);

  // Hot core fading to cool edge, with angular hue rotation -> swirling rainbow donut
  let hue = ang / 6.28318 + 0.5; // 0..1
  // Three-color hue ramp: cyan (#6bf0d6) -> pink (#ff7ad9) -> yellow (#ffd44a)
  let c0 = vec3(0.42, 0.94, 0.84);
  let c1 = vec3(1.00, 0.48, 0.85);
  let c2 = vec3(1.00, 0.83, 0.29);
  var col : vec3<f32>;
  if hue < 0.5 {
    col = mix(c0, c1, hue * 2.0);
  } else {
    col = mix(c1, c2, (hue - 0.5) * 2.0);
  }

  // Strong center, soft edge falloff
  let centerBoost = exp(-radial * radial * 4.0);
  let colBoosted = col * (0.55 + 1.4 * centerBoost);

  // Fade with depth into inlet so x=0 cell is the strongest
  let fade = 1.0 - f32(gid.x) / 14.0;
  let strength = params.amount * (0.45 + 0.55 * fade);

  let coord = vec3<i32>(gid);
  let existing = textureLoad(dyeTex, coord);
  // mix-toward-targetCol rather than additive: prevents the inlet face from piling up
  // into an opaque wall that occludes the rest of the volume.
  let targetCol = vec4(colBoosted, 1.0) * 0.85;
  let result = mix(existing, targetCol, strength);
  textureStore(dyeTex, coord, result);
}
