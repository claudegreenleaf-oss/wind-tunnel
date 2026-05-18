// Semi-Lagrangian dye advection: back-trace one step using LBM velocity field.
struct Params {
  dims     : vec4<u32>,   // W, H, D, _pad
  decay    : f32,
  _pad0    : f32,
  _pad1    : f32,
  _pad2    : f32,
}

@group(0) @binding(0) var<uniform>          params     : Params;
@group(0) @binding(1) var                   macrosTex  : texture_3d<f32>;
@group(0) @binding(2) var                   prevDye    : texture_3d<f32>;
@group(0) @binding(3) var                   linearSamp : sampler;
@group(0) @binding(4) var                   nextDye    : texture_storage_3d<rgba16float, write>;

@compute @workgroup_size(4, 4, 4)
fn cs_advect(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = params.dims.x;
  let H = params.dims.y;
  let D = params.dims.z;
  if gid.x >= W || gid.y >= H || gid.z >= D { return; }

  // Normalized center of this voxel
  let uvw = (vec3<f32>(gid) + 0.5) / vec3<f32>(f32(W), f32(H), f32(D));

  // Sample velocity at this cell (macros.xyz = u.x, u.y, u.z)
  let macros = textureSampleLevel(macrosTex, linearSamp, uvw, 0.0);
  let vel = macros.xyz; // lattice units per step

  // Back-trace: src = current - vel / dims
  let srcUvw = uvw - vel / vec3<f32>(f32(W), f32(H), f32(D));
  let srcClamped = clamp(srcUvw, vec3(0.0), vec3(1.0));

  var dye = textureSampleLevel(prevDye, linearSamp, srcClamped, 0.0);
  dye *= params.decay;

  textureStore(nextDye, vec3<i32>(gid), dye);
}
