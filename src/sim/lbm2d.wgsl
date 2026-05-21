// D2Q9 BGK lattice Boltzmann with inlet/outlet + bounce-back on solid mask.
// Distribution layout: (y*W + x) * 9 + i, where i is the velocity direction.
//   i  ex  ey  weight
//   0   0   0  4/9
//   1   1   0  1/9
//   2   0   1  1/9
//   3  -1   0  1/9
//   4   0  -1  1/9
//   5   1   1  1/36
//   6  -1   1  1/36
//   7  -1  -1  1/36
//   8   1  -1  1/36

struct Uniforms {
  dims   : vec4<u32>,    // W, H, _, _
  scalars: vec4<f32>,    // omega, uIn, inletYFrac, inletR
};

@group(0) @binding(0) var<uniform>                u       : Uniforms;
@group(0) @binding(1) var<storage, read_write>    fIn     : array<f32>;     // current step
@group(0) @binding(2) var<storage, read_write>    fOut    : array<f32>;     // next step (post-collide+stream)
@group(0) @binding(3) var<storage, read>          mask    : array<u32>;     // 1 = solid
@group(0) @binding(4) var                          macros : texture_storage_3d<rgba16float, write>;

const W3 : f32 = 4.0 / 9.0;
const W1 : f32 = 1.0 / 9.0;
const W2 : f32 = 1.0 / 36.0;

fn weight(i : u32) -> f32 {
  if i == 0u { return W3; }
  if i < 5u  { return W1; }
  return W2;
}

fn ex(i : u32) -> i32 {
  switch i {
    case 1u, 5u, 8u: { return  1; }
    case 3u, 6u, 7u: { return -1; }
    default: { return 0; }
  }
}
fn ey(i : u32) -> i32 {
  switch i {
    case 2u, 5u, 6u: { return  1; }
    case 4u, 7u, 8u: { return -1; }
    default: { return 0; }
  }
}
fn opp(i : u32) -> u32 {
  switch i {
    case 1u: { return 3u; }
    case 2u: { return 4u; }
    case 3u: { return 1u; }
    case 4u: { return 2u; }
    case 5u: { return 7u; }
    case 6u: { return 8u; }
    case 7u: { return 5u; }
    case 8u: { return 6u; }
    default: { return 0u; }
  }
}

fn cellIdx(x : u32, y : u32) -> u32 {
  return x + y * u.dims.x;
}
fn distIdx(x : u32, y : u32, i : u32) -> u32 {
  return cellIdx(x, y) * 9u + i;
}

fn feq(i : u32, rho : f32, ux : f32, uy : f32) -> f32 {
  let exi = f32(ex(i));
  let eyi = f32(ey(i));
  let cu = 3.0 * (exi * ux + eyi * uy);
  let usq = 1.5 * (ux * ux + uy * uy);
  return weight(i) * rho * (1.0 + cu + 0.5 * cu * cu - usq);
}

// Initialise f to equilibrium with rho=1, u=(uIn, 0).
@compute @workgroup_size(8, 8)
fn cs_init(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = u.dims.x;
  let H = u.dims.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let uIn = u.scalars.y;
  for (var i : u32 = 0u; i < 9u; i = i + 1u) {
    fIn[distIdx(gid.x, gid.y, i)] = feq(i, 1.0, uIn, 0.0);
    fOut[distIdx(gid.x, gid.y, i)] = feq(i, 1.0, uIn, 0.0);
  }
  textureStore(macros, vec3<i32>(i32(gid.x), i32(gid.y), 0), vec4(uIn, 0.0, 0.0, 1.0));
}

// One time step: BGK collide + streaming (pull pattern). Reads fIn, writes fOut.
@compute @workgroup_size(8, 8)
fn cs_step(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = u.dims.x;
  let H = u.dims.y;
  if (gid.x >= W || gid.y >= H) { return; }

  let x = gid.x;
  let y = gid.y;
  let c = cellIdx(x, y);
  let omega = u.scalars.x;
  let uIn   = u.scalars.y;

  // Pull each distribution from its upstream neighbour, applying bounce-back
  // where the upstream cell is solid (or outside the domain).
  var f : array<f32, 9>;
  let solidHere = (mask[c] == 1u);

  for (var i : u32 = 0u; i < 9u; i = i + 1u) {
    let nx = i32(x) - ex(i);
    let ny = i32(y) - ey(i);
    let inBounds = (nx >= 0 && nx < i32(W) && ny >= 0 && ny < i32(H));
    if (!inBounds) {
      // Treat as "open" boundary — use this cell's pre-collide value via bounce
      // (effectively zero-gradient). The dedicated inlet/outlet branches
      // below override for x=0 and x=W-1.
      f[i] = fIn[distIdx(x, y, opp(i))];
    } else {
      let nMask = mask[cellIdx(u32(nx), u32(ny))];
      if (nMask == 1u) {
        // Upstream is solid: bounce-back from THIS cell's opposite slot.
        f[i] = fIn[distIdx(x, y, opp(i))];
      } else {
        f[i] = fIn[distIdx(u32(nx), u32(ny), i)];
      }
    }
  }

  if solidHere {
    // Freeze solid cells: equilibrium with u=0 so they don't poison neighbors.
    for (var i : u32 = 0u; i < 9u; i = i + 1u) {
      fOut[distIdx(x, y, i)] = feq(i, 1.0, 0.0, 0.0);
    }
    textureStore(macros, vec3<i32>(i32(x), i32(y), 0), vec4(0.0, 0.0, 0.0, 1.0));
    return;
  }

  // Macroscopic moments from post-stream f.
  var rho : f32 = 0.0;
  var ux  : f32 = 0.0;
  var uy  : f32 = 0.0;
  for (var i : u32 = 0u; i < 9u; i = i + 1u) {
    rho += f[i];
    ux  += f[i] * f32(ex(i));
    uy  += f[i] * f32(ey(i));
  }
  // NaN / negative-ρ guard. BGK can drive ρ to 0 in regions with large
  // velocity-gradient × dt; once that happens every downstream calculation
  // (u, feq, alpha) becomes NaN and the cell stays poisoned forever.
  if (!(rho > 0.001)) {
    rho = 1.0; ux = 0.0; uy = 0.0;
  } else {
    ux = ux / rho;
    uy = uy / rho;
    // Subsonic cap: keep |u| < 0.18 lattice units so BGK stays stable. The
    // model is incompressible-ish, anything past this is a numerical wave.
    let usq = ux * ux + uy * uy;
    let uMax = 0.18;
    if (usq > uMax * uMax) {
      let s = uMax / sqrt(usq);
      ux = ux * s;
      uy = uy * s;
    }
  }

  // Inlet BC (x=0): driven velocity (uIn, 0) within the inlet radius around
  // a configurable Y centre. The cavity scene puts its floor low in the
  // domain and needs the inlet shifted up into the freestream band.
  if (x == 0u) {
    let cyf  = u.scalars.z * f32(H);
    let inletR = u.scalars.w * f32(H);
    let dy = f32(y) - cyf;
    if (abs(dy) <= inletR) {
      ux = uIn;
      uy = 0.0;
      rho = 1.0;
    } else {
      ux = 0.0;
      uy = 0.0;
    }
  }
  // Outlet BC (x=W-1): zero-gradient — copy from x=W-2.
  if (x == W - 1u) {
    rho = 0.0; ux = 0.0; uy = 0.0;
    for (var i : u32 = 0u; i < 9u; i = i + 1u) {
      let fv = fIn[distIdx(W - 2u, y, i)];
      rho += fv;
      ux  += fv * f32(ex(i));
      uy  += fv * f32(ey(i));
    }
    ux = ux / max(rho, 1e-5);
    uy = uy / max(rho, 1e-5);
  }

  // BGK relaxation toward equilibrium.
  for (var i : u32 = 0u; i < 9u; i = i + 1u) {
    let fe = feq(i, rho, ux, uy);
    fOut[distIdx(x, y, i)] = f[i] - omega * (f[i] - fe);
  }
  // Macros texture is a thin (W×H×1) 3D texture — z=0 is the only slab. We
  // write ux/uy into rg, density into a so the existing renderers (which all
  // sample .xyz for velocity and .w for density) work unchanged.
  textureStore(macros, vec3<i32>(i32(x), i32(y), 0), vec4(ux, uy, 0.0, rho));
}
