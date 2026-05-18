// D3Q19 BGK / TRT Lattice Boltzmann - combined stream + collide pass.
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
  dims:     vec4<u32>,   // W, H, D, pad
  omega:    f32,
  uIn:      f32,
  aoaRad:   f32,
  _pad0:    f32,
  gravity:  vec4<f32>,  // gx, gy, gz, pad
  useMRT:   u32,        // 0=BGK, 1=TRT
  useLES:   u32,        // 0=off, 1=Smagorinsky
  freeSlip: u32,        // 0=no-slip, 1=free-slip
  _pad1:    u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> fIn: array<f32>;
@group(0) @binding(2) var<storage, read_write> fOut: array<f32>;
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

// Free-slip Y-reflection: reflect direction index when y-component flips.
// Lookup: 0→0,1→1,2→2,3→4,4→3,5→5,6→6,7→9,8→10,9→7,10→8,11→13,12→14,13→11,14→12,15→16,16→15,17→18,18→17
fn reflY(i: u32) -> u32 {
  switch i {
    case 3u:  { return 4u; }
    case 4u:  { return 3u; }
    case 7u:  { return 9u; }
    case 8u:  { return 10u; }
    case 9u:  { return 7u; }
    case 10u: { return 8u; }
    case 11u: { return 13u; }
    case 12u: { return 14u; }
    case 13u: { return 11u; }
    case 14u: { return 12u; }
    case 15u: { return 16u; }
    case 16u: { return 15u; }
    case 17u: { return 18u; }
    case 18u: { return 17u; }
    default:  { return i; }
  }
}

// Free-slip Z-reflection: reflect direction index when z-component flips.
fn reflZ(i: u32) -> u32 {
  switch i {
    case 5u:  { return 6u; }
    case 6u:  { return 5u; }
    case 11u: { return 12u; }
    case 12u: { return 11u; }
    case 13u: { return 14u; }
    case 14u: { return 13u; }
    case 15u: { return 17u; }
    case 16u: { return 18u; }
    case 17u: { return 15u; }
    case 18u: { return 16u; }
    default:  { return i; }
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

  if (myMask == 1u) {
    for (var i = 0u; i < 19u; i = i + 1u) {
      fOut[fIdx(myIdx, i)] = 0.0;
    }
    textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(0.0, 0.0, 0.0, 1.0));
    return;
  }

  let icur = vec3<i32>(gid);
  let uIn = params.uIn;
  let uInVec = vec3<f32>(uIn * cos(params.aoaRad), uIn * sin(params.aoaRad), 0.0);
  let freeSlip = params.freeSlip;

  var f: array<f32, 19>;

  for (var i = 0u; i < 19u; i = i + 1u) {
    var src = icur - eVec(i);
    var fi: f32;

    if (src.x < 0) {
      fi = feq(i, 1.0, uInVec);
    } else if (src.x >= i32(dims.x)) {
      src.x = i32(dims.x) - 1;
      fi = fIn[fIdx(cellIndex(vec3<u32>(src)), i)];
    } else if (src.y < 0 || src.y >= i32(dims.y)) {
      if (freeSlip == 1u) {
        // Specular reflection: read from same cell, reflected direction
        fi = fIn[fIdx(myIdx, reflY(i))];
      } else {
        fi = fIn[fIdx(myIdx, opp(i))];
      }
    } else if (src.z < 0 || src.z >= i32(dims.z)) {
      if (freeSlip == 1u) {
        fi = fIn[fIdx(myIdx, reflZ(i))];
      } else {
        fi = fIn[fIdx(myIdx, opp(i))];
      }
    } else if (isWall(src)) {
      fi = fIn[fIdx(myIdx, opp(i))];
    } else {
      fi = fIn[fIdx(cellIndex(vec3<u32>(src)), i)];
    }
    f[i] = fi;
  }

  // Macroscopics
  var rho: f32 = 0.0;
  var mom: vec3<f32> = vec3<f32>(0.0);
  for (var i = 0u; i < 19u; i = i + 1u) {
    rho = rho + f[i];
    mom = mom + f[i] * vec3<f32>(eVec(i));
  }
  rho = max(rho, 1e-4);
  var u: vec3<f32> = mom / rho;

  // Guo forcing: shift velocity by F/(2*rho) for macroscopics
  let force = params.gravity.xyz;
  if (length(force) > 0.0) {
    u = u + force / (2.0 * rho);
  }

  // Inlet column: force equilibrium
  if (gid.x == 0u) {
    rho = 1.0;
    u = uInVec;
    for (var i = 0u; i < 19u; i = i + 1u) {
      f[i] = feq(i, rho, u);
    }
  } else {
    // Determine collision omega (possibly modified by LES)
    var omega_use = params.omega;

    if (params.useLES == 1u) {
      // Smagorinsky LES: compute local strain rate from non-equilibrium stress
      var S_xx = 0.0; var S_yy = 0.0; var S_zz = 0.0;
      var S_xy = 0.0; var S_xz = 0.0; var S_yz = 0.0;
      for (var i = 0u; i < 19u; i = i + 1u) {
        let neq = f[i] - feq(i, rho, u);
        let e = vec3<f32>(eVec(i));
        S_xx = S_xx + e.x * e.x * neq;
        S_yy = S_yy + e.y * e.y * neq;
        S_zz = S_zz + e.z * e.z * neq;
        S_xy = S_xy + e.x * e.y * neq;
        S_xz = S_xz + e.x * e.z * neq;
        S_yz = S_yz + e.y * e.z * neq;
      }
      let scale = -1.5 * omega_use / rho;
      S_xx = S_xx * scale; S_yy = S_yy * scale; S_zz = S_zz * scale;
      S_xy = S_xy * scale; S_xz = S_xz * scale; S_yz = S_yz * scale;
      let Smag = sqrt(2.0 * (S_xx*S_xx + S_yy*S_yy + S_zz*S_zz +
                              2.0*(S_xy*S_xy + S_xz*S_xz + S_yz*S_yz)));
      let Cs = 0.16;
      let nu_base = (1.0 / omega_use - 0.5) / 3.0;
      let nu_t = Cs * Cs * Smag;
      let nu_total = nu_base + nu_t;
      omega_use = 1.0 / (3.0 * nu_total + 0.5);
    }

    if (params.useMRT == 1u) {
      // TRT collision (two-relaxation-time)
      // Magic parameter Lambda = 1/4 gives correct boundary location
      // omega_minus derived from magic relation: (1/w+ - 1/2)(1/w- - 1/2) = Lambda
      let Lambda = 0.25;
      let inv_wplus = 1.0 / omega_use;
      // (inv_wplus - 0.5)(inv_wminus - 0.5) = Lambda => inv_wminus = Lambda/(inv_wplus-0.5) + 0.5
      let inv_wminus = Lambda / (inv_wplus - 0.5) + 0.5;
      let omega_minus = 1.0 / inv_wminus;

      for (var i = 0u; i < 19u; i = i + 1u) {
        let j = opp(i);
        let fi = f[i];
        let fj = f[j];
        let fi_sym  = (fi + fj) * 0.5;
        let fi_asym = (fi - fj) * 0.5;
        let feqi     = feq(i, rho, u);
        let feqj     = feq(j, rho, u);
        let feq_sym  = (feqi + feqj) * 0.5;
        let feq_asym = (feqi - feqj) * 0.5;
        f[i] = fi - omega_use * (fi_sym - feq_sym) - omega_minus * (fi_asym - feq_asym);
      }
    } else {
      // BGK collision
      for (var i = 0u; i < 19u; i = i + 1u) {
        f[i] = f[i] + omega_use * (feq(i, rho, u) - f[i]);
      }
    }

    // Guo forcing source term (add to post-collision f)
    if (length(force) > 0.0) {
      for (var i = 0u; i < 19u; i = i + 1u) {
        let e = vec3<f32>(eVec(i));
        let eu = dot(e, u);
        // Fi = wi * (1 - omega/2) * [3*(e-u) + 9*eu*e] . F / rho
        let coeff = weight(i) * (1.0 - omega_use * 0.5);
        f[i] = f[i] + coeff * (3.0 * dot(e - u, force) + 9.0 * eu * dot(e, force));
      }
    }
  }

  for (var i = 0u; i < 19u; i = i + 1u) {
    fOut[fIdx(myIdx, i)] = f[i];
  }

  textureStore(macrosTex, vec3<i32>(gid), vec4<f32>(u, rho));
}
