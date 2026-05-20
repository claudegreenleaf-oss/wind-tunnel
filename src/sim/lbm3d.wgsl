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
  inletR:   f32,        // legacy single-inlet radius (unused by the multi-inlet loop)
  gravity:  vec4<f32>,  // gx, gy, gz, pad
  useMRT:   u32,        // 0=BGK, 1=TRT (ignored when useRegularized=1)
  useLES:   u32,        // 0=off, 1=Smagorinsky
  freeSlip: u32,        // 0=no-slip, 1=free-slip
  useRegularized: u32,  // 0=off, 1=regularized BGK (overrides useMRT)
  // 4 inlets: each vec4 = (yFrac, zFrac, radius, enabledMask 0/1).
  inlets:   array<vec4<f32>, 4>,
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

  // ===== Zou-He pressure outlet at +X face =====
  // Ported from MarcosAsh/Lattice_Fluid_Dynamics (MIT) `lbm_collide.comp:377-409`.
  // Replaces the zero-gradient (clamp-to-self) outlet with anti-bounce-back
  // so vortex / acoustic waves leave the domain instead of reflecting back.
  // Assumes fully developed flow: uy ≈ uz ≈ 0 at the boundary; rho = 1.
  if (gid.x == dims.x - 1u) {
    let knowns_0   = f[0]  + f[3]  + f[4]  + f[5]  + f[6]
                   + f[15] + f[16] + f[17] + f[18];
    let knowns_pos = f[1]  + f[7]  + f[9]  + f[11] + f[13];
    let rho_out = 1.0;
    let ux_out  = -1.0 + (knowns_0 + 2.0 * knowns_pos) / rho_out;
    // Reconstruct the 5 unknown distributions (those with e.x = -1).
    f[2]  = f[1]  - (1.0 / 3.0) * rho_out * ux_out;
    f[10] = f[7]  - (1.0 / 6.0) * rho_out * ux_out;
    f[8]  = f[9]  - (1.0 / 6.0) * rho_out * ux_out;
    f[14] = f[11] - (1.0 / 6.0) * rho_out * ux_out;
    f[12] = f[13] - (1.0 / 6.0) * rho_out * ux_out;
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

  // Inlet column: force equilibrium ONLY inside a small centered disc (jet).
  // Outside the disc is held at zero velocity = closed wall. Smooth profile
  // inside avoids the sharp shear layer that triggers vortex shedding.
  if (gid.x == 0u) {
    // Multi-inlet: any cell on the -X plane inside one of up to 4 enabled
    // discs gets pushed back to equilibrium with the inlet velocity. The
    // soft profile (max over the discs) prevents sharp shear at the inlet.
    let Hf = f32(params.dims.y);
    let Df = f32(params.dims.z);
    let yLocal = (f32(gid.y) + 0.5) / Hf;
    let zLocal = (f32(gid.z) + 0.5) / Df;
    var profile : f32 = 0.0;
    for (var k = 0u; k < 4u; k = k + 1u) {
      let inlet = params.inlets[k];
      if (inlet.w < 0.5) { continue; }  // disabled slot
      let dy = yLocal - inlet.x;
      let dz = zLocal - inlet.y;
      let dist = sqrt(dy * dy + dz * dz);
      let edgeBlend = 0.04;
      let p = 1.0 - smoothstep(inlet.z - edgeBlend, inlet.z + edgeBlend, dist);
      profile = max(profile, p);
    }
    rho = 1.0;
    u = uInVec * profile;
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
    } else if (params.useRegularized == 1u) {
      // ===== Regularized BGK (Latt & Chopard 2006) =====
      // Ported from MarcosAsh/Lattice_Fluid_Dynamics (MIT) `lbm_collide.comp:488-545`.
      // Reconstruct each f_i from f_eq + the projection of the non-equilibrium
      // stress tensor onto the 2nd-order Hermite basis. Filters out unstable
      // higher-order moments — gives MRT-like stability for ~30 LOC and one
      // collision-rate uniform. Identical to BGK at the macroscopic level.

      // Step 1: non-equilibrium stress Π_neq_ab = Σ_i e_ia e_ib (f_i - f_eq_i)
      var Pxx : f32 = 0.0; var Pyy : f32 = 0.0; var Pzz : f32 = 0.0;
      var Pxy : f32 = 0.0; var Pxz : f32 = 0.0; var Pyz : f32 = 0.0;
      for (var i = 0u; i < 19u; i = i + 1u) {
        let f_neq = f[i] - feq(i, rho, u);
        let e = vec3<f32>(eVec(i));
        Pxx = Pxx + e.x * e.x * f_neq;
        Pyy = Pyy + e.y * e.y * f_neq;
        Pzz = Pzz + e.z * e.z * f_neq;
        Pxy = Pxy + e.x * e.y * f_neq;
        Pxz = Pxz + e.x * e.z * f_neq;
        Pyz = Pyz + e.y * e.z * f_neq;
      }
      // Step 2: regularized f = f_eq + (1 - omega) * f_neq_reg
      // f_neq_reg_i = (w_i / 2 c_s^4) * Q_iab Π_ab,  c_s^2 = 1/3 ⇒ 1/(2 c_s^4) = 4.5
      let cs2 : f32 = 1.0 / 3.0;
      let inv_2cs4 : f32 = 4.5;
      for (var i = 0u; i < 19u; i = i + 1u) {
        let feq_i = feq(i, rho, u);
        let e = vec3<f32>(eVec(i));
        let QP = (e.x * e.x - cs2) * Pxx
               + (e.y * e.y - cs2) * Pyy
               + (e.z * e.z - cs2) * Pzz
               + 2.0 * e.x * e.y * Pxy
               + 2.0 * e.x * e.z * Pxz
               + 2.0 * e.y * e.z * Pyz;
        let f_neq_reg = weight(i) * inv_2cs4 * QP;
        f[i] = feq_i + (1.0 - omega_use) * f_neq_reg;
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
