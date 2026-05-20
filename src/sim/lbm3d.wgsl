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
    // ===== Zou-He velocity inlet (Zou & He 1997) =====
    // Replaces the previous equilibrium-projection that over-constrained both
    // ρ and u (Krüger §5.3.3 warning). With Zou-He, only the 5 unknown
    // distributions (e.x = +1) are reconstructed; ρ floats to whatever the
    // interior demands. Acoustic noise at the inlet drops dramatically.
    let Hf = f32(params.dims.y);
    let Df = f32(params.dims.z);
    let yLocal = (f32(gid.y) + 0.5) / Hf;
    let zLocal = (f32(gid.z) + 0.5) / Df;
    var profile : f32 = 0.0;
    for (var k = 0u; k < 4u; k = k + 1u) {
      let inlet = params.inlets[k];
      if (inlet.w < 0.5) { continue; }
      let dy = yLocal - inlet.x;
      let dz = zLocal - inlet.y;
      let dist = sqrt(dy * dy + dz * dz);
      let edgeBlend = 0.04;
      let p = 1.0 - smoothstep(inlet.z - edgeBlend, inlet.z + edgeBlend, dist);
      profile = max(profile, p);
    }
    let ux_bc = uInVec.x * profile;
    let uy_bc = uInVec.y * profile;
    let uz_bc = 0.0;
    // ρ derived from known distributions + prescribed u-component (mass cons.)
    let knowns_0   = f[0]  + f[3]  + f[4]  + f[5]  + f[6]
                   + f[15] + f[16] + f[17] + f[18];
    let knowns_neg = f[2]  + f[8]  + f[10] + f[12] + f[14];
    // Clamp denominator so Ma→1 doesn't blow ρ up.
    let rho_in = (knowns_0 + 2.0 * knowns_neg) / max(1.0 - ux_bc, 0.01);
    // Reconstruct the 5 unknown e.x = +1 distributions (Zou-He NEBB).
    f[1]  = f[2]  + (1.0 / 3.0) * rho_in * ux_bc;
    f[7]  = f[10] + (1.0 / 6.0) * rho_in * (ux_bc + uy_bc);
    f[9]  = f[8]  + (1.0 / 6.0) * rho_in * (ux_bc - uy_bc);
    f[11] = f[14] + (1.0 / 6.0) * rho_in * (ux_bc + uz_bc);
    f[13] = f[12] + (1.0 / 6.0) * rho_in * (ux_bc - uz_bc);
    rho = rho_in;
    u = vec3<f32>(ux_bc, uy_bc, uz_bc);
    // No collision on the inlet plane — distributions are now BC-consistent.
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
      // van Driest wall damping (Pope §13.5.4): scan 6 axial directions up
      // to 8 cells for the nearest solid voxel, then C_s_eff = C_s · (1 −
      // exp(−d/A⁺)) with A⁺ ≈ 5 cells (heuristic). Drops ν_t to 0 right at
      // the wall so the laminar sublayer survives. Without this Smagorinsky
      // over-dissipates the BL even at moderate Re.
      var wall_dist : f32 = 100.0;
      let dirsVD = array<vec3<i32>, 6>(
        vec3<i32>(1,0,0),  vec3<i32>(-1,0,0),
        vec3<i32>(0,1,0),  vec3<i32>(0,-1,0),
        vec3<i32>(0,0,1),  vec3<i32>(0,0,-1),
      );
      for (var d = 0u; d < 6u; d = d + 1u) {
        let dir = dirsVD[d];
        for (var k : i32 = 1; k <= 8; k = k + 1) {
          let nx = i32(gid.x) + dir.x * k;
          let ny = i32(gid.y) + dir.y * k;
          let nz = i32(gid.z) + dir.z * k;
          if (nx < 0 || ny < 0 || nz < 0
              || nx >= i32(dims.x) || ny >= i32(dims.y) || nz >= i32(dims.z)) {
            wall_dist = min(wall_dist, f32(k));
            break;
          }
          let nIdx = cellIndex(vec3<u32>(u32(nx), u32(ny), u32(nz)));
          if (mask[nIdx] == 1u) {
            wall_dist = min(wall_dist, f32(k));
            break;
          }
        }
      }
      let A_plus_cells : f32 = 5.0;
      let vd_damp = 1.0 - exp(-wall_dist / A_plus_cells);
      let Cs = 0.16 * vd_damp;
      let nu_base = (1.0 / omega_use - 0.5) / 3.0;
      let nu_t = Cs * Cs * Smag;
      let nu_total = nu_base + nu_t;
      omega_use = 1.0 / (3.0 * nu_total + 0.5);
    }

    if (params.useMRT == 1u) {
      // ===== MRT collision (d'Humières 2002, 19-moment orthogonal basis) =====
      // Each moment relaxes at its own rate: conserved quantities preserved,
      // stress modes set physical viscosity (= omega_use), ghost modes are
      // aggressively damped to kill the BGK τ→0.5 stability cliff that lets
      // local cells spike ρ and explode particle velocities.
      // Matrix coefficients and relaxation rates from d'Humières et al. 2002
      // (Phil. Trans. Roy. Soc. A 360, 437) — textbook numerics, no IP issue.

      // ---- Forward transform f → moments (sparse) ----
      let sf = f[1]+f[2]+f[3]+f[4]+f[5]+f[6];
      let se = f[7]+f[8]+f[9]+f[10]+f[11]+f[12]+f[13]+f[14]+f[15]+f[16]+f[17]+f[18];
      let sXY = f[7]+f[8]+f[9]+f[10];
      let sXZ = f[11]+f[12]+f[13]+f[14];
      let sYZ = f[15]+f[16]+f[17]+f[18];
      var m0  = f[0] + sf + se;
      var m1  = -30.0*f[0] - 11.0*sf + 8.0*se;
      var m2  = 12.0*f[0] - 4.0*sf + se;
      var m3  = f[1]-f[2] + f[7]-f[8]+f[9]-f[10] + f[11]-f[12]+f[13]-f[14];
      var m4  = -4.0*(f[1]-f[2]) + f[7]-f[8]+f[9]-f[10] + f[11]-f[12]+f[13]-f[14];
      var m5  = f[3]-f[4] + f[7]+f[8]-f[9]-f[10] + f[15]-f[16]+f[17]-f[18];
      var m6  = -4.0*(f[3]-f[4]) + f[7]+f[8]-f[9]-f[10] + f[15]-f[16]+f[17]-f[18];
      var m7  = f[5]-f[6] + f[11]+f[12]-f[13]-f[14] + f[15]+f[16]-f[17]-f[18];
      var m8  = -4.0*(f[5]-f[6]) + f[11]+f[12]-f[13]-f[14] + f[15]+f[16]-f[17]-f[18];
      var m9  = 2.0*(f[1]+f[2]) - (f[3]+f[4]) - (f[5]+f[6]) + sXY + sXZ - 2.0*sYZ;
      var m10 = -4.0*(f[1]+f[2]) + 2.0*(f[3]+f[4]) + 2.0*(f[5]+f[6]) + sXY + sXZ - 2.0*sYZ;
      var m11 = (f[3]+f[4]) - (f[5]+f[6]) + sXY - sXZ;
      var m12 = -2.0*(f[3]+f[4]) + 2.0*(f[5]+f[6]) + sXY - sXZ;
      var m13 = f[7]-f[8]-f[9]+f[10];
      var m14 = f[15]-f[16]-f[17]+f[18];
      var m15 = f[11]-f[12]-f[13]+f[14];
      var m16 = f[7]-f[8]+f[9]-f[10] - f[11]+f[12]-f[13]+f[14];
      var m17 = -f[7]-f[8]+f[9]+f[10] + f[15]-f[16]+f[17]-f[18];
      var m18 = f[11]+f[12]-f[13]-f[14] - f[15]-f[16]+f[17]+f[18];

      // ---- Equilibrium moments meq(ρ, u) ----
      let u2 = dot(u, u);
      let meq0  = rho;
      let meq1  = -11.0*rho + 19.0*rho*u2;
      let meq2  = 3.0*rho - 5.5*rho*u2;
      let meq3  = rho*u.x;
      let meq4  = -2.0/3.0 * rho*u.x;
      let meq5  = rho*u.y;
      let meq6  = -2.0/3.0 * rho*u.y;
      let meq7  = rho*u.z;
      let meq8  = -2.0/3.0 * rho*u.z;
      let meq9  = rho*(2.0*u.x*u.x - u.y*u.y - u.z*u.z);
      let meq10 = -0.5*meq9;
      let meq11 = rho*(u.y*u.y - u.z*u.z);
      let meq12 = -0.5*meq11;
      let meq13 = rho*u.x*u.y;
      let meq14 = rho*u.y*u.z;
      let meq15 = rho*u.x*u.z;
      // meq16..18 = 0 (ghost modes)

      // ---- Relaxation: m* = m − S·(m − meq). Conserved moments (0,3,5,7) have s=0. ----
      let s_nu = omega_use;
      m1  = m1  - 1.19  * (m1  - meq1);
      m2  = m2  - 1.4   * (m2  - meq2);
      m4  = m4  - 1.2   * (m4  - meq4);
      m6  = m6  - 1.2   * (m6  - meq6);
      m8  = m8  - 1.2   * (m8  - meq8);
      m9  = m9  - s_nu  * (m9  - meq9);
      m10 = m10 - 1.4   * (m10 - meq10);
      m11 = m11 - s_nu  * (m11 - meq11);
      m12 = m12 - 1.4   * (m12 - meq12);
      m13 = m13 - s_nu  * (m13 - meq13);
      m14 = m14 - s_nu  * (m14 - meq14);
      m15 = m15 - s_nu  * (m15 - meq15);
      m16 = m16 - 1.98  * m16;
      m17 = m17 - 1.98  * m17;
      m18 = m18 - 1.98  * m18;

      // ---- Pre-scale by 1/||row||² (M⁻¹ = Mᵀ / diag(M·Mᵀ)) ----
      let s0  = m0  / 19.0;
      let s1  = m1  / 2394.0;
      let s2  = m2  / 252.0;
      let s3  = m3  / 10.0;
      let s4  = m4  / 40.0;
      let s5  = m5  / 10.0;
      let s6  = m6  / 40.0;
      let s7  = m7  / 10.0;
      let s8  = m8  / 40.0;
      let s9  = m9  / 36.0;
      let s10 = m10 / 72.0;
      let s11 = m11 / 12.0;
      let s12 = m12 / 24.0;
      let s13 = m13 / 4.0;
      let s14 = m14 / 4.0;
      let s15 = m15 / 4.0;
      let s16 = m16 / 8.0;
      let s17 = m17 / 8.0;
      let s18 = m18 / 8.0;

      // ---- Inverse transform back to f ----
      f[0]  = s0 - 30.0*s1 + 12.0*s2;
      f[1]  = s0 - 11.0*s1 -  4.0*s2 + s3 - 4.0*s4 + 2.0*s9 - 4.0*s10;
      f[2]  = s0 - 11.0*s1 -  4.0*s2 - s3 + 4.0*s4 + 2.0*s9 - 4.0*s10;
      f[3]  = s0 - 11.0*s1 -  4.0*s2 + s5 - 4.0*s6 - s9 + 2.0*s10 + s11 - 2.0*s12;
      f[4]  = s0 - 11.0*s1 -  4.0*s2 - s5 + 4.0*s6 - s9 + 2.0*s10 + s11 - 2.0*s12;
      f[5]  = s0 - 11.0*s1 -  4.0*s2 + s7 - 4.0*s8 - s9 + 2.0*s10 - s11 + 2.0*s12;
      f[6]  = s0 - 11.0*s1 -  4.0*s2 - s7 + 4.0*s8 - s9 + 2.0*s10 - s11 + 2.0*s12;
      f[7]  = s0 + 8.0*s1 + s2 + s3 + s4 + s5 + s6 + s9 + s10 + s11 + s12 + s13 + s16 - s17;
      f[8]  = s0 + 8.0*s1 + s2 - s3 - s4 + s5 + s6 + s9 + s10 + s11 + s12 - s13 - s16 - s17;
      f[9]  = s0 + 8.0*s1 + s2 + s3 + s4 - s5 - s6 + s9 + s10 + s11 + s12 - s13 + s16 + s17;
      f[10] = s0 + 8.0*s1 + s2 - s3 - s4 - s5 - s6 + s9 + s10 + s11 + s12 + s13 - s16 + s17;
      f[11] = s0 + 8.0*s1 + s2 + s3 + s4 + s7 + s8 + s9 + s10 - s11 - s12 + s15 - s16 + s18;
      f[12] = s0 + 8.0*s1 + s2 - s3 - s4 + s7 + s8 + s9 + s10 - s11 - s12 - s15 + s16 + s18;
      f[13] = s0 + 8.0*s1 + s2 + s3 + s4 - s7 - s8 + s9 + s10 - s11 - s12 - s15 - s16 - s18;
      f[14] = s0 + 8.0*s1 + s2 - s3 - s4 - s7 - s8 + s9 + s10 - s11 - s12 + s15 + s16 - s18;
      f[15] = s0 + 8.0*s1 + s2 + s5 + s6 + s7 + s8 - 2.0*s9 - 2.0*s10 + s14 + s17 - s18;
      f[16] = s0 + 8.0*s1 + s2 - s5 - s6 + s7 + s8 - 2.0*s9 - 2.0*s10 - s14 - s17 - s18;
      f[17] = s0 + 8.0*s1 + s2 + s5 + s6 - s7 - s8 - 2.0*s9 - 2.0*s10 - s14 + s17 + s18;
      f[18] = s0 + 8.0*s1 + s2 - s5 - s6 - s7 - s8 - 2.0*s9 - 2.0*s10 + s14 - s17 + s18;
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
