// D3Q19 BGK Lattice Boltzmann - combined stream + collide pass.
//
// Lattice (canonical D3Q19 ordering):
//   0: ( 0, 0, 0)
//   1: ( 1, 0, 0)   2: (-1, 0, 0)
//   3: ( 0, 1, 0)   4: ( 0,-1, 0)
//   5: ( 0, 0, 1)   6: ( 0, 0,-1)
//   7: ( 1, 1, 0)   8: (-1, 1, 0)
//   9: ( 1,-1, 0)  10: (-1,-1, 0)
//  11: ( 1, 0, 1)  12: (-1, 0, 1)
//  13: ( 1, 0,-1)  14: (-1, 0,-1)
//  15: ( 0, 1, 1)  16: ( 0,-1, 1)
//  17: ( 0, 1,-1)  18: ( 0,-1,-1)
//
// Weights: w0 = 1/3; cardinal (i in 1..6) = 1/18; diagonal (i in 7..18) = 1/36.

struct Params {
  dims: vec4<u32>,        // W, H, D, padding
  omega: f32,             // 1 / tau
  uIn: f32,               // inlet velocity (lattice units)
  aoaRad: f32,            // angle of attack (rotates inlet in XY)
  _pad: f32,
  gravity: vec4<f32>,     // gx, gy, gz, _
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> fIn: array<f32>;   // 19 * N_cells
@group(0) @binding(2) var<storage, read_write> fOut: array<f32>;
@group(0) @binding(3) var<storage, read> mask: array<u32>;   // 0=fluid, 1=wall, 2=inlet, 3=outlet
@group(0) @binding(4) var macrosTex: texture_storage_3d<rgba16float, write>;

// Direction vectors (consts)
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
    default:  { return vec3<i32>( 0, -1, -1); } // 18
  }
}

fn opp(i: u32) -> u32 {
  switch i {
    case 0u:  { return 0u; }
    case 1u:  { return 2u; }
    case 2u:  { return 1u; }
    case 3u:  { return 4u; }
    case 4u:  { return 3u; }
    case 5u:  { return 6u; }
    case 6u:  { return 5u; }
    case 7u:  { return 10u; }
    case 8u:  { return 9u; }
    case 9u:  { return 8u; }
    case 10u: { return 7u; }
    case 11u: { return 14u; }
    case 12u: { return 13u; }
    case 13u: { return 12u; }
    case 14u: { return 11u; }
    case 15u: { return 18u; }
    case 16u: { return 17u; }
    case 17u: { return 16u; }
    default:  { return 15u; } // 18
  }
}

fn weight(i: u32) -> f32 {
  if (i == 0u) { return 1.0 / 3.0; }
  if (i <= 6u) { return 1.0 / 18.0; }
  return 1.0 / 36.0;
}

fn cellIndex(c: vec3<u32>) -> u32 {
  return c.x + c.y * params.dims.x + c.z * params.dims.x * params.dims.y;
}

fn fIdx(cell: u32, dir: u32) -> u32 {
  return cell * 19u + dir;
}

fn feq(i: u32, rho: f32, u: vec3<f32>) -> f32 {
  let e = vec3<f32>(eVec(i));
  let eu = dot(e, u);
  let uu = dot(u, u);
  return weight(i) * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * uu);
}

fn isWall(c: vec3<i32>) -> bool {
  let dims = vec3<i32>(params.dims.xyz);
  if (any(c < vec3<i32>(0)) || any(c >= dims)) { return false; }
  return mask[cellIndex(vec3<u32>(c))] == 1u;
}

@compute @workgroup_size(4, 4, 4)
fn cs_step(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = params.dims.xyz;
  if (any(gid >= dims)) { return; }

  let myIdx = cellIndex(gid);
  let myMask = mask[myIdx];

  // Solid: zero out and emit stationary macros.
  if (myMask == 1u) {
    for (var i = 0u; i < 19u; i = i + 1u) {
      fOut[fIdx(myIdx, i)] = 0.0;
    }
    textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(0.0, 0.0, 0.0, 1.0));
    return;
  }

  // 1) Streaming: read f_i from cell at (gid - e_i). Apply boundary rules:
  //    * Left edge (x=0): forced equilibrium inflow.
  //    * Right edge (x=W-1): zero-gradient (copy from x-1).
  //    * Top/bottom/front/back (y, z out of bounds): no-slip bounce-back.
  //    * Solid neighbor: bounce-back.
  var f: array<f32, 19>;
  let icur = vec3<i32>(gid);

  let uIn = params.uIn;
  let uInVec = vec3<f32>(uIn * cos(params.aoaRad), uIn * sin(params.aoaRad), 0.0);

  for (var i = 0u; i < 19u; i = i + 1u) {
    var src = icur - eVec(i);
    var fi: f32;

    // Inlet: x < 0 -> use equilibrium with U_in
    if (src.x < 0) {
      fi = feq(i, 1.0, uInVec);
    }
    // Outlet: x >= W -> clamp (zero-gradient)
    else if (src.x >= i32(dims.x)) {
      src.x = i32(dims.x) - 1;
      fi = fIn[fIdx(cellIndex(vec3<u32>(src)), i)];
    }
    // Top/bottom/front/back walls: bounce-back
    else if (src.y < 0 || src.y >= i32(dims.y) || src.z < 0 || src.z >= i32(dims.z)) {
      fi = fIn[fIdx(myIdx, opp(i))];
    }
    // Solid neighbor: bounce-back
    else if (isWall(src)) {
      fi = fIn[fIdx(myIdx, opp(i))];
    }
    // Normal stream
    else {
      fi = fIn[fIdx(cellIndex(vec3<u32>(src)), i)];
    }
    f[i] = fi;
  }

  // 2) Macroscopics
  var rho: f32 = 0.0;
  var mom: vec3<f32> = vec3<f32>(0.0);
  for (var i = 0u; i < 19u; i = i + 1u) {
    rho = rho + f[i];
    mom = mom + f[i] * vec3<f32>(eVec(i));
  }
  rho = max(rho, 1e-4);
  var u: vec3<f32> = mom / rho;

  // External force (gravity / buoyancy) via Guo's forcing scheme (simplified):
  // u_eq = u + F / (2 * rho)
  let force = params.gravity.xyz;
  if (length(force) > 0.0) {
    u = u + force / (2.0 * rho);
  }

  // 3) Inlet column (x == 0): force equilibrium
  if (gid.x == 0u) {
    rho = 1.0;
    u = uInVec;
    for (var i = 0u; i < 19u; i = i + 1u) {
      f[i] = feq(i, rho, u);
    }
  } else {
    // 4) BGK collision
    for (var i = 0u; i < 19u; i = i + 1u) {
      f[i] = f[i] + params.omega * (feq(i, rho, u) - f[i]);
    }
  }

  // 5) Write to output buffer
  for (var i = 0u; i < 19u; i = i + 1u) {
    fOut[fIdx(myIdx, i)] = f[i];
  }

  // 6) Write macroscopics to storage texture (channels: u.x, u.y, u.z, rho)
  textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(u, rho));
}
