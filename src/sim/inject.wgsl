// Inject compute shader: paint dye or add velocity impulse into the lattice.
//
// type == 0: dye inject (stub — DyeField3D owned by Track A)
// type == 1: impulse inject — adds momentum into f-buffers directly

struct InjectParams {
  center:   vec3<f32>,
  radius:   f32,
  impulse:  vec3<f32>,  // velocity direction * strength for type==1
  type_:    u32,        // 0=dye, 1=impulse
  dims:     vec3<u32>,
  _pad:     u32,
};

@group(0) @binding(0) var<uniform> iparams: InjectParams;
@group(0) @binding(1) var<storage, read_write> fBuf: array<f32>;

fn eVec(i: u32) -> vec3<f32> {
  switch i {
    case 0u:  { return vec3<f32>( 0,  0,  0); }
    case 1u:  { return vec3<f32>( 1,  0,  0); }
    case 2u:  { return vec3<f32>(-1,  0,  0); }
    case 3u:  { return vec3<f32>( 0,  1,  0); }
    case 4u:  { return vec3<f32>( 0, -1,  0); }
    case 5u:  { return vec3<f32>( 0,  0,  1); }
    case 6u:  { return vec3<f32>( 0,  0, -1); }
    case 7u:  { return vec3<f32>( 1,  1,  0); }
    case 8u:  { return vec3<f32>(-1,  1,  0); }
    case 9u:  { return vec3<f32>( 1, -1,  0); }
    case 10u: { return vec3<f32>(-1, -1,  0); }
    case 11u: { return vec3<f32>( 1,  0,  1); }
    case 12u: { return vec3<f32>(-1,  0,  1); }
    case 13u: { return vec3<f32>( 1,  0, -1); }
    case 14u: { return vec3<f32>(-1,  0, -1); }
    case 15u: { return vec3<f32>( 0,  1,  1); }
    case 16u: { return vec3<f32>( 0, -1,  1); }
    case 17u: { return vec3<f32>( 0,  1, -1); }
    default:  { return vec3<f32>( 0, -1, -1); } // 18
  }
}

fn weight(i: u32) -> f32 {
  if (i == 0u) { return 1.0 / 3.0; }
  if (i <= 6u) { return 1.0 / 18.0; }
  return 1.0 / 36.0;
}

@compute @workgroup_size(4, 4, 4)
fn cs_inject(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (any(gid >= iparams.dims)) { return; }

  let pos = vec3<f32>(gid);
  let dist = length(pos - iparams.center);
  if (dist >= iparams.radius) { return; }

  let cellIdx = gid.x + gid.y * iparams.dims.x + gid.z * iparams.dims.x * iparams.dims.y;

  if (iparams.type_ == 1u) {
    // Impulse: add equilibrium increment for extra velocity
    let dv = iparams.impulse * (1.0 - dist / iparams.radius);
    for (var i = 0u; i < 19u; i = i + 1u) {
      let e = eVec(i);
      let contrib = weight(i) * 3.0 * dot(e, dv);
      fBuf[cellIdx * 19u + i] = fBuf[cellIdx * 19u + i] + contrib;
    }
  }
  // type==0 (dye) is a stub — DyeField3D (Track A) owns dye buffers
}
