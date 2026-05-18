// Inject dye at the inlet (-X face, ic.x < 4) with stripe pattern.
struct Params {
  dims     : vec4<u32>,   // W, H, D, _pad
  amount   : f32,
  _pad0    : f32,
  _pad1    : f32,
  _pad2    : f32,
}

@group(0) @binding(0) var<uniform> params  : Params;
@group(0) @binding(1) var          dyeTex  : texture_storage_3d<rgba16float, read_write>;

@compute @workgroup_size(1, 8, 8)
fn cs_inject(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = params.dims.x;
  let H = params.dims.y;
  let D = params.dims.z;
  if gid.x >= 4u || gid.y >= H || gid.z >= D { return; }

  // Stripe pattern: parity of 6-cell bands in Y and Z
  let bandY = gid.y / 6u;
  let bandZ = gid.z / 6u;
  let parity = (bandY + bandZ) % 3u;

  var injectColor : vec4<f32>;
  if parity == 0u {
    injectColor = vec4(0.0, 1.0, 1.0, 1.0); // cyan
  } else if parity == 1u {
    injectColor = vec4(1.0, 0.2, 0.8, 1.0); // pink
  } else {
    injectColor = vec4(1.0, 1.0, 0.0, 1.0); // yellow
  }

  let coord = vec3<i32>(gid);
  let existing = textureLoad(dyeTex, coord);
  let result = clamp(existing + injectColor * params.amount, vec4(0.0), vec4(1.5));
  textureStore(dyeTex, coord, result);
}
