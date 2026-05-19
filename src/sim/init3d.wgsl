// Initialize the LBM state to equilibrium with uniform inflow.

struct Params {
  dims: vec4<u32>,
  omega: f32,
  uIn: f32,
  aoaRad: f32,
  inletR: f32,
  gravity: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> fA: array<f32>;
@group(0) @binding(2) var<storage, read_write> fB: array<f32>;
@group(0) @binding(3) var<storage, read> mask: array<u32>;
@group(0) @binding(4) var macrosTex: texture_storage_3d<rgba16float, write>;

fn eVec(i: u32) -> vec3<i32> {
  switch i {
    case 0u:  { return vec3<i32>( 0,  0,  0); }
    case 1u:  { return vec3<i32>( 1,  0,  0); }
    case 2u:  { return vec3<i32>(-1,  0,  0); }
    case 3u:  { return vec3<i32>( 0,  1,  0); }
    case 4u:  { return vec3<i32>( 0, -1,  0); }
    case 5u:  { return vec3<i32>( 0,  0,  1); }
    case 6u:  { return vec3<i32>( 0,  0, -1); }
    case 7u:  { return vec3<i32>( 1,  1,  0); }
    case 8u:  { return vec3<i32>(-1,  1,  0); }
    case 9u:  { return vec3<i32>( 1, -1,  0); }
    case 10u: { return vec3<i32>(-1, -1,  0); }
    case 11u: { return vec3<i32>( 1,  0,  1); }
    case 12u: { return vec3<i32>(-1,  0,  1); }
    case 13u: { return vec3<i32>( 1,  0, -1); }
    case 14u: { return vec3<i32>(-1,  0, -1); }
    case 15u: { return vec3<i32>( 0,  1,  1); }
    case 16u: { return vec3<i32>( 0, -1,  1); }
    case 17u: { return vec3<i32>( 0,  1, -1); }
    default:  { return vec3<i32>( 0, -1, -1); }
  }
}

fn weight(i: u32) -> f32 {
  if (i == 0u) { return 1.0 / 3.0; }
  if (i <= 6u) { return 1.0 / 18.0; }
  return 1.0 / 36.0;
}

fn feq(i: u32, rho: f32, u: vec3<f32>) -> f32 {
  let e = vec3<f32>(eVec(i));
  let eu = dot(e, u);
  let uu = dot(u, u);
  return weight(i) * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * uu);
}

fn cellIndex(c: vec3<u32>) -> u32 {
  return c.x + c.y * params.dims.x + c.z * params.dims.x * params.dims.y;
}

@compute @workgroup_size(4, 4, 4)
fn cs_init(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (any(gid >= params.dims.xyz)) { return; }

  let myIdx = cellIndex(gid);
  let isSolid = mask[myIdx] == 1u;

  let uIn = params.uIn;
  let u = vec3<f32>(uIn * cos(params.aoaRad), uIn * sin(params.aoaRad), 0.0);
  let rho = 1.0;

  if (isSolid) {
    for (var i = 0u; i < 19u; i = i + 1u) {
      fA[myIdx * 19u + i] = 0.0;
      fB[myIdx * 19u + i] = 0.0;
    }
    textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(0.0, 0.0, 0.0, 1.0));
    return;
  }

  for (var i = 0u; i < 19u; i = i + 1u) {
    let eqv = feq(i, rho, u);
    fA[myIdx * 19u + i] = eqv;
    fB[myIdx * 19u + i] = eqv;
  }
  textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(u, rho));
}
