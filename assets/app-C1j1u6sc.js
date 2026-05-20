import{A as e,B as t,C as n,D as r,E as i,F as a,I as o,L as s,M as c,N as l,O as u,P as d,R as f,S as p,T as m,V as h,_ as g,a as _,b as v,c as y,d as b,f as x,g as S,h as C,i as w,j as T,k as E,l as D,m as O,n as ee,o as k,p as A,r as te,s as ne,t as j,u as M,v as N,w as P,x as F,y as re,z as I}from"./three-Bcou0C_B.js";var L=16;function R(e,t,n,r){let{W:i,H:a,D:o}=t,s=new Uint32Array(i*a*o),c=e.getAttribute(`position`);if(!c)return s;let l=e.getIndex(),u=l?l.count/3:c.count/3,d=new h,f=new h,p=new h,m=e=>{e.x=(e.x-n.x)/r.x*i,e.y=(e.y-n.y)/r.y*a,e.z=(e.z-n.z)/r.z*o};for(let e=0;e<u;e++){let t=l?l.getX(e*3):e*3,n=l?l.getX(e*3+1):e*3+1,r=l?l.getX(e*3+2):e*3+2;d.fromBufferAttribute(c,t),m(d),f.fromBufferAttribute(c,n),m(f),p.fromBufferAttribute(c,r),m(p);for(let e=0;e<=L;e++)for(let t=0;t<=L-e;t++){let n=L-e-t,r=e/L,c=t/L,l=n/L,u=d.x*r+f.x*c+p.x*l,m=d.y*r+f.y*c+p.y*l,h=d.z*r+f.z*c+p.z*l,g=Math.floor(u),_=Math.floor(m),v=Math.floor(h);g>=0&&g<i&&_>=0&&_<a&&v>=0&&v<o&&(s[g+_*i+v*i*a]=1)}}let g=new Uint8Array(i*a*o),_=[],v=(e,t,n)=>{if(e<0||e>=i||t<0||t>=a||n<0||n>=o)return;let r=e+t*i+n*i*a;s[r]===1||g[r]===1||(g[r]=1,_.push(r))};for(let e=0;e<a;e++)for(let t=0;t<o;t++)v(0,e,t),v(i-1,e,t);for(let e=0;e<i;e++)for(let t=0;t<o;t++)v(e,0,t),v(e,a-1,t);for(let e=0;e<i;e++)for(let t=0;t<a;t++)v(e,t,0),v(e,t,o-1);for(;_.length>0;){let e=_.pop(),t=e/(i*a)|0,n=(e-t*i*a)/i|0,r=e-t*i*a-n*i,c=(e,t,n)=>{if(e<0||e>=i||t<0||t>=a||n<0||n>=o)return;let r=e+t*i+n*i*a;s[r]===1||g[r]===1||(g[r]=1,_.push(r))};c(r+1,n,t),c(r-1,n,t),c(r,n+1,t),c(r,n-1,t),c(r,n,t+1),c(r,n,t-1)}for(let e=0;e<s.length;e++)g[e]===0&&s[e]===0&&(s[e]=1);return s}var ie=[{id:`duck`,name:`Duck`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb`,sizeKB:118},{id:`stork`,name:`Stork`,url:`https://threejs.org/examples/models/gltf/Stork.glb`,sizeKB:75,elongated:!0},{id:`flamingo`,name:`Flamingo`,url:`https://threejs.org/examples/models/gltf/Flamingo.glb`,sizeKB:76,elongated:!0},{id:`parrot`,name:`Parrot`,url:`https://threejs.org/examples/models/gltf/Parrot.glb`,sizeKB:95},{id:`fox`,name:`Fox`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb`,sizeKB:159,elongated:!0},{id:`horse`,name:`Horse`,url:`https://threejs.org/examples/models/gltf/Horse.glb`,sizeKB:178,elongated:!0},{id:`milk-truck`,name:`Milk Truck`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb`,sizeKB:361,elongated:!0},{id:`lee-perry`,name:`Head`,url:`https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb`,sizeKB:396},{id:`robot`,name:`Robot`,url:`https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb`,sizeKB:453},{id:`cesium-drone`,name:`Drone`,url:`https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb`,sizeKB:1142,elongated:!0},{id:`ferrari`,name:`Ferrari`,url:`https://threejs.org/examples/models/gltf/ferrari.glb`,sizeKB:1642,elongated:!0},{id:`astronaut`,name:`Astronaut`,url:`https://cdn.jsdelivr.net/gh/google/model-viewer@master/packages/shared-assets/models/Astronaut.glb`,sizeKB:2802},{id:`damaged-helmet`,name:`Damaged Helmet`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`,sizeKB:3686},{id:`toy-car`,name:`Toy Car`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ToyCar/glTF-Binary/ToyCar.glb`,sizeKB:5295,elongated:!0},{id:`buggy`,name:`VW Buggy`,url:`https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Buggy/glTF-Binary/Buggy.glb`,sizeKB:7169,elongated:!0}];function z(e){return ie.find(t=>t.id===e)}var B=new Map,V=new ee;V.setDecoderPath(`https://www.gstatic.com/draco/v1/decoders/`);var H=new w;H.setDRACOLoader(V),H.setMeshoptDecoder(j);async function U(e){let t=B.get(e);return t||(t=W(e).catch(t=>{throw B.delete(e),t}),B.set(e,t)),(await t).clone()}async function W(e){let t=await fetch(e);if(!t.ok)throw Error(`Failed to fetch ${e}: ${t.status}`);let n=await t.arrayBuffer(),r=await new Promise((e,t)=>{H.parse(n,``,e,t)}),i=[];if(r.scene.updateMatrixWorld(!0),r.scene.traverse(e=>{let t=e;if(!t.isMesh||!t.geometry)return;let n=t.geometry.clone(),r=new F;r.setAttribute(`position`,n.getAttribute(`position`)),n.getIndex()&&r.setIndex(n.getIndex()),r.applyMatrix4(t.matrixWorld),r.computeVertexNormals(),i.push(r)}),i.length===0)throw Error(`No mesh in glTF`);let a=i.length===1?i[0]:_(i,!1);if(!a)throw Error(`mergeGeometries failed (incompatible attributes)`);a.computeBoundingBox();let o=a.boundingBox,s=new h().subVectors(o.max,o.min),l=new h().addVectors(o.min,o.max).multiplyScalar(.5),u=Math.max(s.x,s.y,s.z);if(u>0){let e=new c().makeTranslation(-l.x,-l.y,-l.z);a.applyMatrix4(e),a.applyMatrix4(new c().makeScale(1/u,1/u,1/u))}return a.computeVertexNormals(),a}function G(){return{N:80,uIn:.12,visc:.02,aoaDeg:0,gravity:[0,0,0],useMRT:!1,useLES:!1,freeSlip:!1,shapeId:`sphere`,yawDeg:0,pitchDeg:0,rollDeg:0,scaleMul:1,obstacleXFrac:.3,inletRadius:.12,ballSize:1,dyeAmount:1,paused:!1,simSpeed:1}}function K(e){return{W:2*e,H:e,D:e}}function q(e,t,n){return e*Math.max(1,Math.round(n/4))/Math.max(t,1e-6)}var J=`// D3Q19 BGK / TRT Lattice Boltzmann - combined stream + collide pass.
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
  inletR:   f32,        // jet disc radius as fraction of cross-section
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

  // Inlet column: force equilibrium ONLY inside a small centered disc (jet).
  // Outside the disc is held at zero velocity = closed wall. Smooth profile
  // inside avoids the sharp shear layer that triggers vortex shedding.
  if (gid.x == 0u) {
    let H = f32(params.dims.y);
    let D = f32(params.dims.z);
    let cy = (f32(gid.y) + 0.5) / H - 0.5;
    let cz = (f32(gid.z) + 0.5) / D - 0.5;
    let r = sqrt(cy * cy + cz * cz);
    let jetR = params.inletR;                         // configurable inlet disc radius
    let edgeBlend = 0.04;                            // smooth boundary
    let profile = 1.0 - smoothstep(jetR - edgeBlend, jetR + edgeBlend, r);
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
`,ae=`// Initialize the LBM state to equilibrium with uniform inflow.

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
`;function Y(e){let t=new Uint32Array(e.W*e.H*e.D),n=Math.cos(-e.yaw),r=Math.sin(-e.yaw);for(let i=0;i<e.D;i++)for(let a=0;a<e.H;a++)for(let o=0;o<e.W;o++){let s=o-e.cx,c=a-e.cy,l=i-e.cz,u=s*n-l*r,d=s*r+l*n,f=c,p=!1,m=e.radius,h=e.halfLen;if(e.shape===`sphere`)p=u*u+f*f+d*d<=m*m;else if(e.shape===`cylinder`)p=u*u+d*d<=m*m&&Math.abs(f)<=h;else if(e.shape===`cone`){let e=(u+h)/(2*h);if(e>0&&e<1){let t=e*m;p=f*f+d*d<=t*t}}else if(e.shape===`wing`){let e=(u+h)/(2*h);if(e>=0&&e<=1){let t=5*.12*(.2969*Math.sqrt(Math.max(0,e))-.126*e-.3516*e*e+.2843*e*e*e-.1015*e*e*e*e);p=Math.abs(f)<t*h*.5&&Math.abs(d)<=h*1.5}}else if(e.shape===`teapot`){let e=u*u/(m*m)+f*f/(m*.7*m*.7)+d*d/(m*m)<=1,t=u-m*.6,n=f-m*.4,r=d,i=t*.7+n*.7,a=(t-i*.7)*(t-i*.7)+r*r<=m*.2*(m*.2)&&i>=0&&i<=m*.8,o=u+m*.7,s=f,c=o*o+s*s<=m*.5*(m*.5)&&o*o+s*s>=m*.25*(m*.25)&&Math.abs(d)<=m*.15,l=f-m*.65,h=1-l/(m*.35),g=l>=0&&l<=m*.35&&u*u+d*d<=h*m*.4*(h*m*.4);p=e||a||c||g}else if(e.shape===`f1car`){let e=u*u/(h*h)+f*f/(h*.4*h*.4)+d*d/(h*.7*h*.7)<=1,t=h*.2,n=h*.6,r=h*.6,i=h*.15,a=(e,n)=>{let r=u-e,a=d-n;return r*r+a*a<=t*t&&Math.abs(f)<=i},o=a(n,r)||a(n,-r)||a(-n,r)||a(-n,-r);p=e||o}else if(e.shape===`helmet`){let e=u*u+f*f+d*d<=m*m,t=u>0&&Math.abs(f)<m*.6&&Math.abs(d)<m*.7;p=e&&!t}p&&(t[o+a*e.W+i*e.W*e.H]=1)}return t}function X(e){"@babel/helpers - typeof";return X=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},X(e)}function oe(e,t){if(X(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(X(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function se(e){var t=oe(e,`string`);return X(t)==`symbol`?t:t+``}function Z(e,t,n){return(t=se(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var ce=class{get maskBuffer(){return this.maskBuf}constructor(e,t,n,r){Z(this,`device`,void 0),Z(this,`W`,void 0),Z(this,`H`,void 0),Z(this,`D`,void 0),Z(this,`uIn`,.08),Z(this,`visc`,.005),Z(this,`aoaRad`,0),Z(this,`inletR`,.12),Z(this,`gravity`,[0,0,0]),Z(this,`useMRT`,0),Z(this,`useLES`,0),Z(this,`freeSlip`,0),Z(this,`fA`,void 0),Z(this,`fB`,void 0),Z(this,`maskBuf`,void 0),Z(this,`paramsBuf`,void 0),Z(this,`macrosTex`,void 0),Z(this,`macrosView`,void 0),Z(this,`stepPipeline`,void 0),Z(this,`initPipeline`,void 0),Z(this,`bindGroupAB`,void 0),Z(this,`bindGroupBA`,void 0),Z(this,`initBindGroup`,void 0),Z(this,`stepLayout`,void 0),Z(this,`initLayout`,void 0),Z(this,`shape`,`sphere`),Z(this,`obstacleRadius`,0),Z(this,`obstacleHalfLen`,0),Z(this,`charLengthCells`,1),Z(this,`currentIsA`,!0),this.device=e,this.W=t,this.H=n,this.D=r,this.allocate(),this.voxelizeAndUpload(),this.runInit()}allocate(){let e=this.W*this.H*this.D,t=e*19*4;this.fA=this.device.createBuffer({size:t,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.fB=this.device.createBuffer({size:t,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.maskBuf=this.device.createBuffer({size:e*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.paramsBuf=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.macrosTex=this.device.createTexture({size:[this.W,this.H,this.D],dimension:`3d`,format:`rgba16float`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.macrosView=this.macrosTex.createView({dimension:`3d`});let n=this.device.createShaderModule({code:J,label:`lbm3d.wgsl`}),r=this.device.createShaderModule({code:ae,label:`init3d.wgsl`});this.stepLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`write-only`,format:`rgba16float`,viewDimension:`3d`}}]}),this.initLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`write-only`,format:`rgba16float`,viewDimension:`3d`}}]}),this.stepPipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.stepLayout]}),compute:{module:n,entryPoint:`cs_step`}}),this.initPipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.initLayout]}),compute:{module:r,entryPoint:`cs_init`}}),this.bindGroupAB=this.device.createBindGroup({layout:this.stepLayout,entries:[{binding:0,resource:{buffer:this.paramsBuf}},{binding:1,resource:{buffer:this.fA}},{binding:2,resource:{buffer:this.fB}},{binding:3,resource:{buffer:this.maskBuf}},{binding:4,resource:this.macrosView}]}),this.bindGroupBA=this.device.createBindGroup({layout:this.stepLayout,entries:[{binding:0,resource:{buffer:this.paramsBuf}},{binding:1,resource:{buffer:this.fB}},{binding:2,resource:{buffer:this.fA}},{binding:3,resource:{buffer:this.maskBuf}},{binding:4,resource:this.macrosView}]}),this.initBindGroup=this.device.createBindGroup({layout:this.initLayout,entries:[{binding:0,resource:{buffer:this.paramsBuf}},{binding:1,resource:{buffer:this.fA}},{binding:2,resource:{buffer:this.fB}},{binding:3,resource:{buffer:this.maskBuf}},{binding:4,resource:this.macrosView}]})}setShape(e){this.shape=e,this.voxelizeAndUpload(),this.runInit()}setMaskBuffer(e){this.device.queue.writeBuffer(this.maskBuf,0,e.buffer,0,e.byteLength),this.runInit()}resize(e,t,n){this.dispose(),this.W=e,this.H=t,this.D=n,this.allocate(),this.voxelizeAndUpload(),this.runInit()}voxelizeAndUpload(){let e=Math.round(this.W*.3),t=Math.round(this.H*.5),n=Math.round(this.D*.5),r=Math.max(2,Math.round(Math.min(this.H,this.D)*.18)),i=Math.max(2,Math.round(this.H*.42));this.obstacleRadius=r,this.obstacleHalfLen=i;let a=Y({W:this.W,H:this.H,D:this.D,shape:this.shape,cx:e,cy:t,cz:n,radius:r,halfLen:i,yaw:0});this.device.queue.writeBuffer(this.maskBuf,0,a.buffer,0,a.byteLength),this.charLengthCells=Math.max(2*r,1)}writeParams(){let e=3*this.visc+.5,t=1/Math.max(e,.5001),n=new ArrayBuffer(64),r=new Uint32Array(n),i=new Float32Array(n);r[0]=this.W,r[1]=this.H,r[2]=this.D,r[3]=0,i[4]=t,i[5]=this.uIn,i[6]=this.aoaRad,i[7]=this.inletR,i[8]=this.gravity[0],i[9]=this.gravity[1],i[10]=this.gravity[2],i[11]=0,r[12]=this.useMRT,r[13]=this.useLES,r[14]=this.freeSlip,r[15]=0,this.device.queue.writeBuffer(this.paramsBuf,0,n)}runInit(){this.writeParams();let e=this.device.createCommandEncoder({label:`lbm-init`}),t=e.beginComputePass();t.setPipeline(this.initPipeline),t.setBindGroup(0,this.initBindGroup),t.dispatchWorkgroups(Math.ceil(this.W/4),Math.ceil(this.H/4),Math.ceil(this.D/4)),t.end(),this.device.queue.submit([e.finish()]),this.currentIsA=!0}resetFlow(){this.runInit()}step(){this.writeParams();let e=this.device.createCommandEncoder({label:`lbm-step`}),t=e.beginComputePass();t.setPipeline(this.stepPipeline),t.setBindGroup(0,this.currentIsA?this.bindGroupAB:this.bindGroupBA),t.dispatchWorkgroups(Math.ceil(this.W/4),Math.ceil(this.H/4),Math.ceil(this.D/4)),t.end(),this.device.queue.submit([e.finish()]),this.currentIsA=!this.currentIsA}get macrosTexture(){return this.macrosTex}get macrosTextureView(){return this.macrosView}get currentFBuffer(){return this.currentIsA?this.fA:this.fB}dispose(){this.fA?.destroy(),this.fB?.destroy(),this.maskBuf?.destroy(),this.paramsBuf?.destroy(),this.macrosTex?.destroy()}},Q=`// Semi-Lagrangian dye advection: back-trace one step using LBM velocity field.
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
`,le=`// Inject dye at the inlet (-X face) with a vivid full-face color gradient.
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
`,ue=class{constructor(e,t,n,r,i){Z(this,`device`,void 0),Z(this,`W`,void 0),Z(this,`H`,void 0),Z(this,`D`,void 0),Z(this,`texA`,void 0),Z(this,`texB`,void 0),Z(this,`viewA`,void 0),Z(this,`viewB`,void 0),Z(this,`sampler`,void 0),Z(this,`advectParamsBuf`,void 0),Z(this,`injectParamsBuf`,void 0),Z(this,`advectPipeline`,void 0),Z(this,`injectPipeline`,void 0),Z(this,`injectBGA`,void 0),Z(this,`injectBGB`,void 0),Z(this,`currentIsA`,!0),Z(this,`getMacrosView`,void 0),Z(this,`decay`,.992),Z(this,`injectAmount`,.7),Z(this,`advectBGLayout`,void 0),this.device=e,this.W=t,this.H=n,this.D=r,this.getMacrosView=i,this.allocate()}allocate(){let e=`rgba16float`,t=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST;this.texA=this.device.createTexture({size:[this.W,this.H,this.D],dimension:`3d`,format:e,usage:t}),this.texB=this.device.createTexture({size:[this.W,this.H,this.D],dimension:`3d`,format:e,usage:t}),this.viewA=this.texA.createView({dimension:`3d`}),this.viewB=this.texB.createView({dimension:`3d`}),this.sampler=this.device.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`}),this.advectParamsBuf=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.injectParamsBuf=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let n=this.device.createShaderModule({code:Q,label:`dye-advect`}),r=this.device.createShaderModule({code:le,label:`dye-inject`}),i=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:2,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:3,visibility:GPUShaderStage.COMPUTE,sampler:{type:`filtering`}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`write-only`,format:`rgba16float`,viewDimension:`3d`}}]}),a=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`read-write`,format:`rgba16float`,viewDimension:`3d`}}]});this.advectPipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[i]}),compute:{module:n,entryPoint:`cs_advect`}}),this.injectPipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[a]}),compute:{module:r,entryPoint:`cs_inject`}}),this.injectBGA=this.device.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:this.injectParamsBuf}},{binding:1,resource:this.viewA}]}),this.injectBGB=this.device.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:this.injectParamsBuf}},{binding:1,resource:this.viewB}]}),this.advectBGLayout=i,this.currentIsA=!0}makeAdvectBG(e,t,n){return this.device.createBindGroup({layout:e,entries:[{binding:0,resource:{buffer:this.advectParamsBuf}},{binding:1,resource:this.getMacrosView()},{binding:2,resource:t},{binding:3,resource:this.sampler},{binding:4,resource:n}]})}step(){this.writeParams();let e=this.currentIsA?this.makeAdvectBG(this.advectBGLayout,this.viewA,this.viewB):this.makeAdvectBG(this.advectBGLayout,this.viewB,this.viewA),t=this.currentIsA?this.injectBGB:this.injectBGA,n=this.device.createCommandEncoder({label:`dye-step`}),r=n.beginComputePass();r.setPipeline(this.advectPipeline),r.setBindGroup(0,e),r.dispatchWorkgroups(Math.ceil(this.W/4),Math.ceil(this.H/4),Math.ceil(this.D/4)),r.end();let i=n.beginComputePass();i.setPipeline(this.injectPipeline),i.setBindGroup(0,t),i.dispatchWorkgroups(4,Math.ceil(this.H/4),Math.ceil(this.D/4)),i.end(),this.device.queue.submit([n.finish()]),this.currentIsA=!this.currentIsA}writeParams(){let e=new ArrayBuffer(32),t=new Uint32Array(e),n=new Float32Array(e);t[0]=this.W,t[1]=this.H,t[2]=this.D,t[3]=0,n[4]=this.decay,n[5]=0,n[6]=0,n[7]=0,this.device.queue.writeBuffer(this.advectParamsBuf,0,e);let r=new ArrayBuffer(32),i=new Uint32Array(r),a=new Float32Array(r);i[0]=this.W,i[1]=this.H,i[2]=this.D,i[3]=0,a[4]=this.injectAmount,a[5]=0,a[6]=0,a[7]=0,this.device.queue.writeBuffer(this.injectParamsBuf,0,r)}get currentView(){return this.currentIsA?this.viewA:this.viewB}dispose(){this.texA?.destroy(),this.texB?.destroy(),this.advectParamsBuf?.destroy(),this.injectParamsBuf?.destroy()}},de=`
struct Uniforms {
  viewMatrix     : mat4x4<f32>,
  projMatrix     : mat4x4<f32>,
  cameraPos      : vec4<f32>,
  aabbMin        : vec4<f32>,
  aabbMax        : vec4<f32>,
  stepCount      : f32,
  _pad0          : f32,
  _pad1          : f32,
  _pad2          : f32,
}
@group(0) @binding(2) var<uniform> u : Uniforms;

// 36-vertex unit cube (NDC-positioned via transform)
const CUBE_POSITIONS = array<vec3<f32>, 36>(
  // -X face
  vec3(-0.5,-0.5,-0.5), vec3(-0.5,-0.5, 0.5), vec3(-0.5, 0.5, 0.5),
  vec3(-0.5,-0.5,-0.5), vec3(-0.5, 0.5, 0.5), vec3(-0.5, 0.5,-0.5),
  // +X face
  vec3( 0.5,-0.5, 0.5), vec3( 0.5,-0.5,-0.5), vec3( 0.5, 0.5,-0.5),
  vec3( 0.5,-0.5, 0.5), vec3( 0.5, 0.5,-0.5), vec3( 0.5, 0.5, 0.5),
  // -Y face
  vec3(-0.5,-0.5,-0.5), vec3( 0.5,-0.5,-0.5), vec3( 0.5,-0.5, 0.5),
  vec3(-0.5,-0.5,-0.5), vec3( 0.5,-0.5, 0.5), vec3(-0.5,-0.5, 0.5),
  // +Y face
  vec3(-0.5, 0.5, 0.5), vec3( 0.5, 0.5, 0.5), vec3( 0.5, 0.5,-0.5),
  vec3(-0.5, 0.5, 0.5), vec3( 0.5, 0.5,-0.5), vec3(-0.5, 0.5,-0.5),
  // -Z face
  vec3( 0.5,-0.5,-0.5), vec3(-0.5,-0.5,-0.5), vec3(-0.5, 0.5,-0.5),
  vec3( 0.5,-0.5,-0.5), vec3(-0.5, 0.5,-0.5), vec3( 0.5, 0.5,-0.5),
  // +Z face
  vec3(-0.5,-0.5, 0.5), vec3( 0.5,-0.5, 0.5), vec3( 0.5, 0.5, 0.5),
  vec3(-0.5,-0.5, 0.5), vec3( 0.5, 0.5, 0.5), vec3(-0.5, 0.5, 0.5),
);

struct VertOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) worldPos  : vec3<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vi : u32) -> VertOut {
  let localPos = CUBE_POSITIONS[vi];
  let size = u.aabbMax.xyz - u.aabbMin.xyz;
  let center = (u.aabbMin.xyz + u.aabbMax.xyz) * 0.5;
  let worldPos = localPos * size + center;
  let clipPos = u.projMatrix * u.viewMatrix * vec4(worldPos, 1.0);
  var out : VertOut;
  out.pos = clipPos;
  out.worldPos = worldPos;
  return out;
}
`,fe=`
struct Uniforms {
  viewMatrix     : mat4x4<f32>,
  projMatrix     : mat4x4<f32>,
  cameraPos      : vec4<f32>,
  aabbMin        : vec4<f32>,
  aabbMax        : vec4<f32>,
  stepCount      : f32,
  timeSeed       : f32,
  _pad1          : f32,
  _pad2          : f32,
}
@group(0) @binding(0) var macrosTex   : texture_3d<f32>;
@group(0) @binding(1) var dyeTex      : texture_3d<f32>;
@group(0) @binding(2) var<uniform> u  : Uniforms;
@group(0) @binding(3) var linearSamp  : sampler;

struct FragIn {
  @builtin(position) pos : vec4<f32>,
  @location(0) worldPos  : vec3<f32>,
}

// Turbo ramp: blue → cyan → green → yellow → red. Reads as slow → fast.
fn turbo(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3(0.19, 0.07, 0.23);
  let c1 = vec3(0.10, 0.40, 0.95);
  let c2 = vec3(0.10, 0.85, 0.85);
  let c3 = vec3(0.30, 0.95, 0.30);
  let c4 = vec3(0.98, 0.85, 0.10);
  let c5 = vec3(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

// Cheap hashed value noise — perturbs ray-march sample coords so the volume
// looks like granular smoke instead of soft fog.
fn hash13(p : vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
fn vnoise(p : vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u3 = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  let n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  let n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  let n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  let n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  let n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  let n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  let nx00 = mix(n000, n100, u3.x);
  let nx10 = mix(n010, n110, u3.x);
  let nx01 = mix(n001, n101, u3.x);
  let nx11 = mix(n011, n111, u3.x);
  let nxy0 = mix(nx00, nx10, u3.y);
  let nxy1 = mix(nx01, nx11, u3.y);
  return mix(nxy0, nxy1, u3.z);
}
// 3-octave fbm — adds the fine-grained smoke texture.
fn fbm3(p : vec3<f32>) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 3; i++) {
    s += a * vnoise(q);
    q = q * 2.07 + vec3(11.3, 7.7, 19.1);
    a = a * 0.55;
  }
  return s;
}

// Ray-AABB intersection. Returns vec2(t_near, t_far); t_far < t_near means miss.
fn rayAabb(ro : vec3<f32>, rdInv : vec3<f32>, aMin : vec3<f32>, aMax : vec3<f32>) -> vec2<f32> {
  let t0 = (aMin - ro) * rdInv;
  let t1 = (aMax - ro) * rdInv;
  let tMin = min(t0, t1);
  let tMax = max(t0, t1);
  return vec2(max(max(tMin.x, tMin.y), tMin.z),
              min(min(tMax.x, tMax.y), tMax.z));
}

@fragment
fn fs_main(in : FragIn) -> @location(0) vec4<f32> {
  let ro = u.cameraPos.xyz;
  let rd = normalize(in.worldPos - ro);
  let rdInv = 1.0 / rd;

  let aMin = u.aabbMin.xyz;
  let aMax = u.aabbMax.xyz;
  let t = rayAabb(ro, rdInv, aMin, aMax);
  if t.y < t.x { discard; }

  let tNear = max(t.x, 0.0);
  let tFar  = t.y;
  if tFar <= tNear { discard; }

  let aabbSize = aMax - aMin;
  let nSteps = i32(u.stepCount);
  let stepSize = (tFar - tNear) / f32(nSteps);

  // Jitter ray start by a hash to break banding (essential for low-step counts).
  let jitter = hash13(in.worldPos * 53.17 + vec3(u.timeSeed * 0.001));
  let timeT = u.timeSeed * 0.02;

  var accumColor = vec3(0.0);
  var transmit   = 1.0;

  for (var i = 0; i < nSteps; i++) {
    let tSample = tNear + (f32(i) + jitter) * stepSize;
    let worldP  = ro + rd * tSample;
    var uvw     = (worldP - aMin) / aabbSize;
    if any(uvw < vec3(0.0)) || any(uvw > vec3(1.0)) { continue; }

    // Granular smoke detail: warp sample coords by 2-octave noise + slow time animation.
    // This breaks the "soft blob" look into wispy filaments.
    let nFreq = 7.5;
    let warp = vec3(
      fbm3(worldP * nFreq + vec3(0.0, 0.0, timeT)),
      fbm3(worldP * nFreq + vec3(13.1, 7.3, timeT + 19.0)),
      fbm3(worldP * nFreq + vec3(29.7, 41.2, timeT + 53.0)),
    ) - 0.5;
    let warpStrength = 0.012;
    let uvwWarped = clamp(uvw + warp * warpStrength, vec3(0.0), vec3(1.0));

    let macros = textureSampleLevel(macrosTex, linearSamp, uvwWarped, 0.0);
    let speed  = length(macros.xyz);
    let speedN = clamp(speed / 0.18, 0.0, 1.0);

    // Density proxy: combine dye field + a velocity-magnitude-driven "smoke trail".
    // Modulate by an fbm field so it looks granular instead of uniform.
    let dye = textureSampleLevel(dyeTex, linearSamp, uvwWarped, 0.0);
    let dyeIntensity = clamp(length(dye.rgb), 0.0, 1.5);
    let smokeMask = clamp(fbm3(worldP * 4.0 + vec3(0.0, 0.0, timeT)) * 1.4, 0.0, 1.2);
    let density = dyeIntensity * 0.95 + speedN * 0.35 * smokeMask;

    // Henyey-Greenstein-ish forward scatter so smoke catches light from behind.
    let cosA = dot(rd, normalize(macros.xyz + vec3(1e-4)));
    let g = 0.45;
    let phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosA, 1.5);

    // Per-step alpha kept small so dense regions still let light through —
    // gives that wispy translucent quality instead of an opaque wall.
    let alpha = clamp(density * 0.045, 0.0, 0.18);

    // Color: dye dominates where present; speed-driven turbo elsewhere.
    let speedColor = turbo(0.15 + speedN * 0.85);
    let glow = mix(speedColor * (0.4 + 0.7 * speedN), dye.rgb * 1.6, clamp(dyeIntensity, 0.0, 1.0));
    let scattered = glow * (0.7 + 0.6 * phase);

    accumColor += transmit * alpha * scattered;
    transmit   *= 1.0 - alpha;
    if transmit < 0.02 { break; }
  }

  // Reduced overall opacity so volume sits BEHIND particles as ambient smoke.
  let outA = (1.0 - transmit) * 0.65;
  return vec4(accumColor, outA);
}
`,pe=class{constructor(e,t,n){Z(this,`device`,void 0),Z(this,`pipeline`,void 0),Z(this,`bindGroup`,void 0),Z(this,`uniformBuf`,void 0),Z(this,`sampler`,void 0),Z(this,`canvasFormat`,void 0),Z(this,`getCanvasTextureView`,void 0),Z(this,`macrosView`,null),Z(this,`dyeView`,null),Z(this,`bgl`,null),Z(this,`frame`,0),this.device=e,this.canvasFormat=t,this.getCanvasTextureView=n,this.createSampler(),this.createUniformBuffer()}createSampler(){this.sampler=this.device.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`})}createUniformBuffer(){this.uniformBuf=this.device.createBuffer({size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}setTextures(e,t){this.macrosView=e,this.dyeView=t,this.pipeline?this.rebuildBindGroup():this.buildPipeline()}rebuildBindGroup(){!this.macrosView||!this.dyeView||!this.bgl||(this.bindGroup=this.device.createBindGroup({layout:this.bgl,entries:[{binding:0,resource:this.macrosView},{binding:1,resource:this.dyeView},{binding:2,resource:{buffer:this.uniformBuf}},{binding:3,resource:this.sampler}]}))}buildPipeline(){if(!this.macrosView||!this.dyeView)return;this.bgl=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:2,visibility:GPUShaderStage.FRAGMENT|GPUShaderStage.VERTEX,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}}]}),this.rebuildBindGroup();let e=this.device.createShaderModule({code:de,label:`volume-vert`}),t=this.device.createShaderModule({code:fe,label:`volume-frag`});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl]}),vertex:{module:e,entryPoint:`vs_main`},fragment:{module:t,entryPoint:`fs_main`,targets:[{format:this.canvasFormat,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`front`}})}render(e,t,n,r,i,a=48){if(!this.pipeline||!this.bindGroup)return;let o=new Float32Array(48);o.set(e.elements,0),o.set(t.elements,16),o[32]=n.x,o[33]=n.y,o[34]=n.z,o[35]=1,o[36]=r.x,o[37]=r.y,o[38]=r.z,o[39]=0,o[40]=i.x,o[41]=i.y,o[42]=i.z,o[43]=0,o[44]=a,o[45]=this.frame++,o[46]=0,o[47]=0,this.device.queue.writeBuffer(this.uniformBuf,0,o.buffer);let s=this.getCanvasTextureView(),c=this.device.createCommandEncoder({label:`volume-render`}),l=c.beginRenderPass({colorAttachments:[{view:s,loadOp:`load`,storeOp:`store`}]});l.setPipeline(this.pipeline),l.setBindGroup(0,this.bindGroup),l.draw(36),l.end(),this.device.queue.submit([c.finish()])}dispose(){this.uniformBuf?.destroy()}},me=class{setObstacle(e,t){this.obstacleCenter=[e.x,e.y,e.z],this.obstacleRadius=t}resetAllParticles(){let e=new Float32Array(this.N*4);for(let t=0;t<this.N;t++)e[t*4+0]=0,e[t*4+1]=0,e[t*4+2]=0,e[t*4+3]=601+Math.random()*60;this.device.queue.writeBuffer(this.particleBuf,0,e.buffer),this.device.queue.writeBuffer(this.prevPosBuf,0,new Float32Array(this.N*4).buffer)}killParticlesInsideObstacle(){if(!this.advectBG)return;let e=new Float32Array([this.obstacleCenter[0],this.obstacleCenter[1],this.obstacleCenter[2],this.obstacleRadius]);this.device.queue.writeBuffer(this.uniformBuf,208,e.buffer);let t=this.device.createCommandEncoder({label:`particles-kill-inside`}),n=t.beginComputePass();n.setPipeline(this.killInsidePipeline),n.setBindGroup(0,this.advectBG),n.dispatchWorkgroups(Math.ceil(this.N/64)),n.end(),this.device.queue.submit([t.finish()])}constructor(e,t,n,r){Z(this,`device`,void 0),Z(this,`canvasFormat`,void 0),Z(this,`trailFormat`,`rgba16float`),Z(this,`getCanvasTextureView`,void 0),Z(this,`getCanvasSize`,void 0),Z(this,`N`,7e4),Z(this,`particleBuf`,void 0),Z(this,`prevPosBuf`,void 0),Z(this,`uniformBuf`,void 0),Z(this,`sampler`,void 0),Z(this,`trailTex`,null),Z(this,`trailView`,null),Z(this,`trailW`,0),Z(this,`trailH`,0),Z(this,`advectPipeline`,void 0),Z(this,`killInsidePipeline`,void 0),Z(this,`renderPipeline`,void 0),Z(this,`advectBgl`,void 0),Z(this,`renderBgl`,void 0),Z(this,`advectBG`,null),Z(this,`renderBG`,null),Z(this,`fadePipeline`,void 0),Z(this,`compositePipeline`,void 0),Z(this,`compositeBgl`,void 0),Z(this,`compositeBG`,null),Z(this,`compositeSampler`,void 0),Z(this,`frame`,0),Z(this,`obstacleCenter`,[0,0,0]),Z(this,`obstacleRadius`,0),Z(this,`jetRadius`,.12),this.device=e,this.canvasFormat=t,this.getCanvasTextureView=n,this.getCanvasSize=r,this.allocate(),this.buildPipelines()}allocate(){this.particleBuf=this.device.createBuffer({size:this.N*4*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});let e=new Float32Array(this.N*4);for(let t=0;t<this.N;t++)e[t*4+0]=0,e[t*4+1]=0,e[t*4+2]=0,e[t*4+3]=9999;this.device.queue.writeBuffer(this.particleBuf,0,e.buffer),this.prevPosBuf=this.device.createBuffer({size:this.N*4*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.prevPosBuf,0,new Float32Array(this.N*4).buffer),this.uniformBuf=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.sampler=this.device.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`}),this.compositeSampler=this.device.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`})}ensureTrailTex(e,t){this.trailTex&&this.trailW===e&&this.trailH===t||(this.trailTex?.destroy(),this.trailTex=this.device.createTexture({label:`particles-trail`,size:[e,t],format:this.trailFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.trailView=this.trailTex.createView(),this.trailW=e,this.trailH=t,this.compositeBG=null)}buildPipelines(){let e=this.device.createShaderModule({code:ge,label:`particles-advect`}),t=this.device.createShaderModule({code:_e,label:`particles-render`});this.advectBgl=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:3,visibility:GPUShaderStage.COMPUTE,sampler:{type:`filtering`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),this.renderBgl=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:3,visibility:GPUShaderStage.VERTEX,sampler:{type:`filtering`}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),this.advectPipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.advectBgl]}),compute:{module:e,entryPoint:`cs_advect`}}),this.killInsidePipeline=this.device.createComputePipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.advectBgl]}),compute:{module:e,entryPoint:`cs_kill_inside`}}),this.renderPipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.renderBgl]}),vertex:{module:t,entryPoint:`vs_main`},fragment:{module:t,entryPoint:`fs_main`,targets:[{format:this.trailFormat,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`}});let n=this.device.createShaderModule({code:ve,label:`particles-fade`});this.fadePipeline=this.device.createRenderPipeline({layout:`auto`,vertex:{module:n,entryPoint:`vs_full`},fragment:{module:n,entryPoint:`fs_fade`,targets:[{format:this.trailFormat,blend:{color:{srcFactor:`zero`,dstFactor:`constant`,operation:`add`},alpha:{srcFactor:`zero`,dstFactor:`constant`,operation:`add`}}}]},primitive:{topology:`triangle-list`}});let r=this.device.createShaderModule({code:ye,label:`particles-composite`});this.compositeBgl=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`2d`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}}]}),this.compositePipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.compositeBgl]}),vertex:{module:r,entryPoint:`vs_full`},fragment:{module:r,entryPoint:`fs_composite`,targets:[{format:this.canvasFormat,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`}})}getParticleBuffer(){return this.particleBuf}advectOnly(e,t,n,r,i,a,o={}){if(!this.advectBG)return;let{dt:s=6,maxAge:c=600,pointSize:l=.014}=o;this.writeUniforms(e,t,n,r,i,a,s,c,l);let u=this.device.createCommandEncoder({label:`particles-advect-only`}),d=u.beginComputePass();d.setPipeline(this.advectPipeline),d.setBindGroup(0,this.advectBG),d.dispatchWorkgroups(Math.ceil(this.N/64)),d.end(),this.device.queue.submit([u.finish()])}setMacrosTexture(e){this.advectBG=this.device.createBindGroup({layout:this.advectBgl,entries:[{binding:0,resource:{buffer:this.uniformBuf}},{binding:1,resource:{buffer:this.particleBuf}},{binding:2,resource:e},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.prevPosBuf}}]}),this.renderBG=this.device.createBindGroup({layout:this.renderBgl,entries:[{binding:0,resource:{buffer:this.uniformBuf}},{binding:1,resource:{buffer:this.particleBuf}},{binding:2,resource:e},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.prevPosBuf}}]})}writeUniforms(e,t,n,r,i,a,o,s,c){let l=new Float32Array(64);l.set(e.elements,0),l.set(t.elements,16),l[32]=n.x,l[33]=n.y,l[34]=n.z,l[35]=1,l[36]=r.x,l[37]=r.y,l[38]=r.z,l[39]=0,l[40]=i.x,l[41]=i.y,l[42]=i.z,l[43]=0,l[44]=a.W,l[45]=a.H,l[46]=a.D,l[47]=0,l[48]=o,l[49]=s,l[50]=this.frame,l[51]=c,l[52]=this.obstacleCenter[0],l[53]=this.obstacleCenter[1],l[54]=this.obstacleCenter[2],l[55]=this.obstacleRadius,l[56]=this.jetRadius,l[57]=0,l[58]=0,l[59]=0,this.device.queue.writeBuffer(this.uniformBuf,0,l.buffer),this.frame++}step(e,t,n,r,i,a,o={}){if(!this.advectBG||!this.renderBG)return;let{dt:s=6,maxAge:c=600,pointSize:l=.014,fade:u=.7}=o;this.writeUniforms(e,t,n,r,i,a,s,c,l);let[d,f]=this.getCanvasSize();if(d<=0||f<=0||(this.ensureTrailTex(d,f),!this.trailView))return;this.compositeBG||(this.compositeBG=this.device.createBindGroup({layout:this.compositeBgl,entries:[{binding:0,resource:this.trailView},{binding:1,resource:this.compositeSampler}]}));let p=this.device.createCommandEncoder({label:`particles`});{let e=p.beginRenderPass({colorAttachments:[{view:this.trailView,loadOp:`load`,storeOp:`store`}]});e.setPipeline(this.fadePipeline),e.setBlendConstant({r:u,g:u,b:u,a:u}),e.draw(3),e.end()}{let e=p.beginComputePass();e.setPipeline(this.advectPipeline),e.setBindGroup(0,this.advectBG),e.dispatchWorkgroups(Math.ceil(this.N/64)),e.end()}{let e=p.beginRenderPass({colorAttachments:[{view:this.trailView,loadOp:`load`,storeOp:`store`}]});e.setPipeline(this.renderPipeline),e.setBindGroup(0,this.renderBG),e.draw(6*this.N,1,0,0),e.end()}{let e=this.getCanvasTextureView(),t=p.beginRenderPass({colorAttachments:[{view:e,loadOp:`load`,storeOp:`store`}]});t.setPipeline(this.compositePipeline),t.setBindGroup(0,this.compositeBG),t.draw(3),t.end()}this.device.queue.submit([p.finish()])}dispose(){this.particleBuf?.destroy(),this.prevPosBuf?.destroy(),this.uniformBuf?.destroy(),this.trailTex?.destroy()}},he=`
struct Uniforms {
  viewMat   : mat4x4<f32>,
  projMat   : mat4x4<f32>,
  cameraPos : vec4<f32>,
  aabbMin   : vec4<f32>,
  aabbMax   : vec4<f32>,
  dims      : vec4<f32>,        // W, H, D, _
  params    : vec4<f32>,        // dt, maxAge, frameSeed, pointSize
  obstacle  : vec4<f32>,        // centerX, centerY, centerZ, radius
  extras    : vec4<f32>,        // jetRadius (matches LBM inletR), pad, pad, pad
};

fn hash11(n : f32) -> f32 {
  return fract(sin(n * 12.9898) * 43758.5453);
}
fn hash31(seed : f32, i : u32) -> vec3<f32> {
  return vec3(
    hash11(f32(i) * 0.103 + seed * 1.31),
    hash11(f32(i) * 0.217 + seed * 0.71),
    hash11(f32(i) * 0.319 + seed * 1.93),
  );
}

// ---- value noise + curl noise (Bridson 2007 style turbulence injection) ----
// Cheap hashed value noise: 3D trilinear interpolation of per-corner hashes.
fn hash13(p : vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}

fn vnoise(p : vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  let n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  let n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  let n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  let n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  let n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  let n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  let nx00 = mix(n000, n100, u.x);
  let nx10 = mix(n010, n110, u.x);
  let nx01 = mix(n001, n101, u.x);
  let nx11 = mix(n011, n111, u.x);
  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;   // remap to [-1, 1]
}

// Vector potential: three decorrelated noise fields. Curl of this is
// divergence-free, so adding it to a flow doesn't pump mass anywhere.
fn potential(p : vec3<f32>) -> vec3<f32> {
  return vec3(
    vnoise(p),
    vnoise(p + vec3(31.41, 91.72, 17.83)),
    vnoise(p + vec3(67.19, 23.55, 81.13)),
  );
}

// Divergence-free curl noise at point p. Output is the velocity perturbation.
fn curlNoise(p : vec3<f32>) -> vec3<f32> {
  let eps = 0.6;
  let dx = vec3(eps, 0.0, 0.0);
  let dy = vec3(0.0, eps, 0.0);
  let dz = vec3(0.0, 0.0, eps);
  let p_xp = potential(p + dx);
  let p_xn = potential(p - dx);
  let p_yp = potential(p + dy);
  let p_yn = potential(p - dy);
  let p_zp = potential(p + dz);
  let p_zn = potential(p - dz);
  let curlX = (p_yp.z - p_yn.z) - (p_zp.y - p_zn.y);
  let curlY = (p_zp.x - p_zn.x) - (p_xp.z - p_xn.z);
  let curlZ = (p_xp.y - p_xn.y) - (p_yp.x - p_yn.x);
  return vec3(curlX, curlY, curlZ) / (2.0 * eps);
}

// Two-octave curl noise: large + small structures stacked for fractal detail.
fn curlNoiseFbm(p : vec3<f32>, t : f32) -> vec3<f32> {
  let pAnim = p + vec3(t * 0.07, t * 0.03, -t * 0.05);
  let big   = curlNoise(pAnim * 0.7);
  let small = curlNoise(pAnim * 2.3 + vec3(11.0, 7.0, 3.0)) * 0.45;
  return big + small;
}

// Cold "frost" palette: deep navy → royal blue → ice cyan → frost white → pale lavender.
// Stays in cyan-blue-white range, no warm tones — feels like cryogenic wind tunnel.
fn turbo(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3(0.02, 0.05, 0.18);   // abyssal navy
  let c1 = vec3(0.08, 0.22, 0.65);   // deep ocean blue
  let c2 = vec3(0.15, 0.55, 1.00);   // electric blue
  let c3 = vec3(0.35, 0.92, 1.10);   // ice cyan
  let c4 = vec3(0.85, 0.98, 1.10);   // frost white
  let c5 = vec3(0.85, 0.80, 1.15);   // pale lavender pop
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

// Cheap vorticity proxy: how much the velocity field bends across a small
// stencil. High when streamlines curl (wake / shear layer), low in laminar flow.
fn vorticityMag(macrosTex : texture_3d<f32>, samp : sampler, uvw : vec3<f32>, dims : vec3<f32>) -> f32 {
  let h = 1.5 / dims;
  let vxp = textureSampleLevel(macrosTex, samp, uvw + vec3(h.x, 0.0, 0.0), 0.0).xyz;
  let vxn = textureSampleLevel(macrosTex, samp, uvw - vec3(h.x, 0.0, 0.0), 0.0).xyz;
  let vyp = textureSampleLevel(macrosTex, samp, uvw + vec3(0.0, h.y, 0.0), 0.0).xyz;
  let vyn = textureSampleLevel(macrosTex, samp, uvw - vec3(0.0, h.y, 0.0), 0.0).xyz;
  let vzp = textureSampleLevel(macrosTex, samp, uvw + vec3(0.0, 0.0, h.z), 0.0).xyz;
  let vzn = textureSampleLevel(macrosTex, samp, uvw - vec3(0.0, 0.0, h.z), 0.0).xyz;
  let curlX = (vyp.z - vyn.z) - (vzp.y - vzn.y);
  let curlY = (vzp.x - vzn.x) - (vxp.z - vxn.z);
  let curlZ = (vxp.y - vxn.y) - (vyp.x - vyn.x);
  return length(vec3(curlX, curlY, curlZ));
}
`,ge=he+`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read_write> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;
@group(0) @binding(4) var<storage, read_write> prevPos : array<vec4<f32>>;

const INVALID : f32 = 9999.0;

@compute @workgroup_size(64)
fn cs_advect(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= arrayLength(&particles) { return; }

  var p = particles[idx];
  let oldPos = p.xyz;
  let prevValid = prevPos[idx].w;
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let dt = u.params.x;
  let maxAge = u.params.y;
  let seed = u.params.z;

  var needsReseed : bool = p.w >= maxAge;
  if !needsReseed {
    // Multi-step advection (T4): 8 sub-steps of dt/8 per frame. This resolves
    // curved flow paths around the obstacle cleanly instead of smearing.
    // The obstacle-inside check runs in a separate one-shot compute pass
    // (killInsideObstacle) only when the shape changes or the user resets,
    // not every frame.
    let SUBSTEPS = 8;
    let subDt = dt / f32(SUBSTEPS);
    var pos = p.xyz;
    var exited = false;
    for (var k = 0; k < SUBSTEPS; k = k + 1) {
      let uvwSub = (pos - aabbMin) / aabbSize;
      if any(uvwSub < vec3(0.0)) || any(uvwSub > vec3(1.0)) {
        exited = true;
        break;
      }
      let macros = textureSampleLevel(macrosTex, samp, uvwSub, 0.0);
      let vel_world = macros.xyz * (aabbSize / u.dims.xyz);
      pos = pos + vel_world * subDt;
    }
    if exited {
      needsReseed = true;
    } else {
      // Age tick: dt/6 means a stuck particle in an eddy still ages out within
      // ~maxAge/(dt/6) frames — about 10 s at simSpeed=1 — so the inlet pool
      // keeps cycling even when downstream flow stalls behind the obstacle.
      p = vec4(pos, p.w + dt / 6.0);
    }
  }

  if needsReseed {
    // Reset-dormant state: ages in (maxAge, maxAge + 200] mean "user just hit
    // Reset flow / switched shape — disappear and wait, then re-emit from the
    // inlet over the next ~stagger frames." We tick the age DOWN by 1.0 each
    // frame; once it crosses maxAge the normal (non-initial) reseed branch
    // below fires on the next pass.
    let isInitialSeed : bool = p.w > 9000.0;
    if !isInitialSeed && p.w > maxAge + 0.5 && p.w < 9000.0 {
      let newAge = p.w - 1.0;
      // Park the particle off-screen (well outside the AABB on the -X side)
      // so the sphere renderer's clip kills it. Spheres are world-space points
      // transformed by view/proj — anything off-screen is just gone.
      let off = vec3(aabbMin.x - aabbSize.x * 2.0, 0.0, 0.0);
      particles[idx] = vec4(off, newAge);
      prevPos[idx] = vec4(off, 0.0);
      return;
    }

    let r = hash31(seed, idx);
    // Sample a point inside the inlet jet disc (matches LBM jet radius).
    let theta = r.x * 6.2831853;
    let radius = sqrt(r.y) * u.extras.x;
    let dy = radius * cos(theta);
    let dz = radius * sin(theta);
    let centerY = aabbMin.y + 0.5 * aabbSize.y;
    let centerZ = aabbMin.z + 0.5 * aabbSize.z;
    let jetY = centerY + dy * aabbSize.y;
    let jetZ = centerZ + dz * aabbSize.z;

    // First-time seed (age set to 9999 on JS init) — distribute along the jet
    // tube length so the volume looks populated immediately. Subsequent reseeds
    // come back to the inlet face.
    if isInitialSeed {
      p = vec4(
        aabbMin.x + r.z * aabbSize.x,
        jetY,
        jetZ,
        hash11(f32(idx) * 0.41 + seed) * maxAge * 0.9,
      );
    } else {
      let inletX = aabbMin.x + 0.02 * aabbSize.x;
      p = vec4(
        inletX + r.z * 0.01 * aabbSize.x,
        jetY,
        jetZ,
        hash11(f32(idx) * 0.41 + seed) * maxAge * 0.6,
      );
    }
  }

  particles[idx] = p;

  // T3: save prev_pos for next-frame motion-blur quad.
  // On reseed (or uninitialized), set prev = current so the quad collapses to a dot
  // rather than streaking from origin.
  let didReseed = needsReseed;
  let usePrev = select(p.xyz, oldPos, prevValid > 0.5 && !didReseed);
  prevPos[idx] = vec4(usePrev, 1.0);
}

// One-shot pass — invoked when the obstacle shape changes or the user clicks
// "Reset flow". Marks any particle inside the obstacle bounding sphere for
// reseed; the next normal advect step does the actual reseed via existing
// "age >= maxAge" logic.
@compute @workgroup_size(64)
fn cs_kill_inside(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= arrayLength(&particles) { return; }
  let r2 = u.obstacle.w * u.obstacle.w;
  if r2 <= 0.0 { return; }
  let p = particles[idx];
  let d = p.xyz - u.obstacle.xyz;
  if dot(d, d) < r2 {
    particles[idx] = vec4(p.xyz, 9999.0);
    prevPos[idx]   = vec4(p.xyz, 0.0);
  }
}
`,_e=he+`
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> particles : array<vec4<f32>>;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var samp      : sampler;
@group(0) @binding(4) var<storage, read> prevPos : array<vec4<f32>>;

struct VertOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) localUv   : vec2<f32>,
  @location(1) speed     : f32,
  @location(2) ageFrac   : f32,
  @location(3) vort      : f32,
  @location(4) sizeScale : f32,
};

// Quad-vertex offsets (two triangles forming a centered quad)
const QUAD_OFF = array<vec2<f32>, 6>(
  vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0),
  vec2(-1.0, -1.0), vec2( 1.0,  1.0), vec2(-1.0,  1.0),
);

@vertex
fn vs_main(@builtin(vertex_index) vi : u32) -> VertOut {
  let particleIdx = vi / 6u;
  let vIdx = vi % 6u;
  let p = particles[particleIdx];
  let prev = prevPos[particleIdx].xyz;
  let curr = p.xyz;
  let mid  = (prev + curr) * 0.5;
  let dPos = curr - prev;
  let dLen = length(dPos);

  // Sample velocity at the midpoint for color/intensity.
  let aabbMin = u.aabbMin.xyz;
  let aabbMax = u.aabbMax.xyz;
  let aabbSize = aabbMax - aabbMin;
  let uvw = clamp((mid - aabbMin) / aabbSize, vec3(0.0), vec3(1.0));
  let macros = textureSampleLevel(macrosTex, samp, uvw, 0.0);
  let speed = length(macros.xyz);

  // Per-particle hash drives stable hue variation between neighbors.
  let vort = hash11(f32(particleIdx) * 0.137);
  let speedN = clamp(speed / 0.18, 0.0, 1.0);
  let vortN  = vort;

  // Build streak basis aligned with the prev→curr motion vector. When the
  // particle is nearly stationary, blend to a camera-facing dot.
  let camRight = vec3(u.viewMat[0][0], u.viewMat[1][0], u.viewMat[2][0]);
  let camUp    = vec3(u.viewMat[0][1], u.viewMat[1][1], u.viewMat[2][1]);
  let viewDir  = normalize(mid - u.cameraPos.xyz);

  let motionDir = select(camRight, dPos / max(dLen, 1e-6), dLen > 1e-6);
  let perpRaw = cross(motionDir, viewDir);
  let perpLen = length(perpRaw);
  let perpAxis = select(camUp, perpRaw / max(perpLen, 1e-6), perpLen > 1e-4);
  let streakAxis = normalize(cross(viewDir, perpAxis));

  // Fluid surface mode: render each particle as a round metaball-style blob.
  // No streak elongation — particles fuse into a cohesive fluid mass.
  let rad = u.params.w * 0.7 * (0.85 + 0.4 * speedN);

  let off = QUAD_OFF[vIdx];
  let worldPos = mid
    + streakAxis * (off.x * rad)
    + perpAxis   * (off.y * rad);

  var out : VertOut;
  out.pos = u.projMat * u.viewMat * vec4(worldPos, 1.0);
  out.localUv = QUAD_OFF[vIdx];
  out.speed = speed;
  out.ageFrac = clamp(p.w / max(u.params.y, 1.0), 0.0, 1.0);
  out.vort = vort;
  out.sizeScale = rad;
  return out;
}

@fragment
fn fs_main(in : VertOut) -> @location(0) vec4<f32> {
  // Smooth gaussian disc → particles fuse into a cohesive fluid mass.
  let r2 = dot(in.localUv, in.localUv);
  if r2 > 1.0 { discard; }

  // Metaball falloff: bright dense center, smooth zero at edge.
  let density = exp(-r2 * 2.5);

  let speedN = clamp(in.speed / 0.16, 0.0, 1.0);

  // Output RGB = a velocity-tinted color, A = thickness contribution.
  // Per-particle thickness is small — fluid mass builds via overlap density.
  let col = turbo(0.25 + speedN * 0.7);
  let lifeFade = 1.0 - in.ageFrac * 0.45;
  let thickness = density * 0.04 * lifeFade;

  return vec4(col * thickness, thickness);
}
`,ve=`
@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4<f32> {
  // Single fullscreen triangle (saves one vertex over a quad).
  let pos = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0), vec2( 3.0, -1.0), vec2(-1.0,  3.0),
  );
  return vec4(pos[vi], 0.0, 1.0);
}
@fragment
fn fs_fade() -> @location(0) vec4<f32> {
  // Output value is irrelevant — blend = (zero, constant) ignores src color
  // and multiplies dst by the per-pass blend constant set on the encoder.
  return vec4(1.0);
}
`,ye=`
@group(0) @binding(0) var trail : texture_2d<f32>;
@group(0) @binding(1) var trailSamp : sampler;

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4<f32> {
  let pos = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0), vec2( 3.0, -1.0), vec2(-1.0,  3.0),
  );
  return vec4(pos[vi], 0.0, 1.0);
}

// Sample thickness (alpha channel of accumulated trail RT).
fn thickness(uv : vec2<f32>) -> f32 {
  return textureSampleLevel(trail, trailSamp, uv, 0.0).a;
}

// Multi-tap box-blurred thickness — smooths individual particle bumps into a
// cohesive fluid surface. Cheaper than a separable gaussian for this use.
fn thicknessBlur(uv : vec2<f32>, texel : vec2<f32>) -> f32 {
  var sum = 0.0;
  let R = 4.0;
  // 13-tap symmetric kernel — gives a smooth circular blur footprint.
  sum += thickness(uv) * 0.20;
  sum += thickness(uv + vec2( R,  0.0) * texel) * 0.10;
  sum += thickness(uv + vec2(-R,  0.0) * texel) * 0.10;
  sum += thickness(uv + vec2( 0.0,  R) * texel) * 0.10;
  sum += thickness(uv + vec2( 0.0, -R) * texel) * 0.10;
  sum += thickness(uv + vec2( R,  R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2( R, -R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2(-R,  R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2(-R, -R) * texel * 0.7) * 0.07;
  sum += thickness(uv + vec2( 2.0*R,  0.0) * texel) * 0.03;
  sum += thickness(uv + vec2(-2.0*R,  0.0) * texel) * 0.03;
  sum += thickness(uv + vec2( 0.0,  2.0*R) * texel) * 0.03;
  sum += thickness(uv + vec2( 0.0, -2.0*R) * texel) * 0.03;
  return sum;
}

@fragment
fn fs_composite(@builtin(position) fragPos : vec4<f32>) -> @location(0) vec4<f32> {
  let dims = vec2<f32>(textureDimensions(trail, 0));
  let uv = fragPos.xy / dims;
  let texel = 1.0 / dims;

  let s = textureSampleLevel(trail, trailSamp, uv, 0.0);
  let centerRGB = s.rgb;

  // Use the BLURRED thickness so the fluid reads as a smooth surface, not bumps.
  let centerThick = thicknessBlur(uv, texel);

  if centerThick < 0.04 {
    // No fluid here — let the scene show through unchanged.
    discard;
  }

  // Reconstruct a screen-space normal from blurred thickness gradient.
  // Wider sample radius → softer, sheet-like surface.
  let h = 6.0;
  let tL = thicknessBlur(uv + vec2(-h, 0.0) * texel, texel);
  let tR = thicknessBlur(uv + vec2( h, 0.0) * texel, texel);
  let tD = thicknessBlur(uv + vec2(0.0,-h) * texel, texel);
  let tU = thicknessBlur(uv + vec2(0.0, h) * texel, texel);
  let dx = (tR - tL);
  let dy = (tU - tD);
  // Surface "pokes out" toward camera where thickness is high. Normal slopes
  // away from regions where neighbors are thicker.
  let normal = normalize(vec3(-dx * 14.0, -dy * 14.0, 0.7));

  // View vector — assume orthographic looking down -Z. (Good enough for screen-space.)
  let V = vec3(0.0, 0.0, 1.0);
  // Key light from upper-left, like an icy interior overhead.
  let L = normalize(vec3(-0.4, 0.6, 0.8));
  let H = normalize(L + V);

  // Fresnel: edges of the fluid surface get more reflective/lighter than the body.
  let NdotV = clamp(dot(normal, V), 0.0, 1.0);
  let fresnel = pow(1.0 - NdotV, 4.0);

  // Specular highlight — sharp icy glint.
  let NdotH = clamp(dot(normal, H), 0.0, 1.0);
  let spec  = pow(NdotH, 90.0) * 1.4;

  // Diffuse — softens the look so the fluid isn't pure highlights.
  let NdotL = clamp(dot(normal, L) * 0.5 + 0.5, 0.0, 1.0);

  // Body color: cool blue tint deepening with thickness (Beer-Lambert style).
  let deepCol = vec3(0.06, 0.30, 0.60);
  let shallowCol = vec3(0.55, 0.85, 1.10);
  let absorption = exp(-centerThick * 2.5);
  let bodyCol = mix(deepCol, shallowCol, absorption);

  // Refraction wobble: sample trail at a normal-offset for inner detail.
  let refractOff = normal.xy * centerThick * 0.04;
  let inner = textureSampleLevel(trail, trailSamp, uv + refractOff, 0.0).rgb;

  // Compose: refracted inner color × diffuse + fresnel-mixed highlight + specular.
  let surfaceCol = mix(bodyCol * NdotL, vec3(0.9, 0.97, 1.10), fresnel * 0.85)
                   + vec3(spec)
                   + inner * 0.35;

  // Output alpha — translucency grows with thickness; thin edges are barely visible.
  let alpha = clamp(centerThick * 4.5 + fresnel * 0.4, 0.0, 0.95);

  return vec4(surfaceCol, alpha);
}
`,be=1e5,xe=class{constructor(e,t,n,r,i,a){Z(this,`device`,void 0),Z(this,`canvasFormat`,void 0),Z(this,`getCanvasView`,void 0),Z(this,`getCanvasSize`,void 0),Z(this,`particleBuf`,void 0),Z(this,`N`,void 0),Z(this,`rtW`,0),Z(this,`rtH`,0),Z(this,`depthTex`,null),Z(this,`depthTexAlt`,null),Z(this,`depthTestTex`,null),Z(this,`thicknessTex`,null),Z(this,`thicknessAlt`,null),Z(this,`uniformBuf`,void 0),Z(this,`blurDirBufX`,void 0),Z(this,`blurDirBufY`,void 0),Z(this,`filterSizeBuf`,void 0),Z(this,`depthPipeline`,void 0),Z(this,`depthBlurPipeline`,void 0),Z(this,`thicknessPipeline`,void 0),Z(this,`thicknessBlurPipeline`,void 0),Z(this,`compositePipeline`,void 0),Z(this,`directSpherePipeline`,void 0),Z(this,`directSphereBgl`,void 0),Z(this,`directSphereBG`,null),Z(this,`directDepthTex`,null),Z(this,`obstaclePipeline`,void 0),Z(this,`obstacleBgl`,void 0),Z(this,`obstacleBG`,null),Z(this,`obstacleUniformBuf`,void 0),Z(this,`obstacleVtxBuf`,null),Z(this,`obstacleIdxBuf`,null),Z(this,`obstacleVertCount`,0),Z(this,`obstacleIdxCount`,0),Z(this,`obstacleIdxFormat`,`uint32`),Z(this,`depthBgl`,void 0),Z(this,`depthBlurBgl`,void 0),Z(this,`thicknessBgl`,void 0),Z(this,`thicknessBlurBgl`,void 0),Z(this,`compositeBgl`,void 0),Z(this,`depthBG`,void 0),Z(this,`thicknessBG`,void 0),Z(this,`depthBlurXBG`,null),Z(this,`depthBlurYBG`,null),Z(this,`thicknessBlurXBG`,null),Z(this,`thicknessBlurYBG`,null),Z(this,`compositeBG`,null),Z(this,`sampler`,void 0),Z(this,`macrosView`,null),Z(this,`macrosSampler`,void 0),Z(this,`maskBuffer`,null),Z(this,`maskDims`,[0,0,0]),Z(this,`sliceMaskAxis`,0),Z(this,`sliceMaskPos`,.5),Z(this,`sliceMaskActive`,!1),Z(this,`sliceMaskThickness`,.04),Z(this,`obstacleCenter`,[0,0,0]),Z(this,`obstacleRadius`,0),this.device=e,this.canvasFormat=t,this.getCanvasView=n,this.getCanvasSize=r,this.particleBuf=i,this.N=a,this.uniformBuf=e.createBuffer({size:368,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.obstacleUniformBuf=e.createBuffer({size:208,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.blurDirBufX=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.blurDirBufY=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.blurDirBufX,0,new Float32Array([1,0,0,0]).buffer),e.queue.writeBuffer(this.blurDirBufY,0,new Float32Array([0,1,0,0]).buffer),this.filterSizeBuf=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.filterSizeBuf,0,new Int32Array([18,0,0,0]).buffer),this.sampler=e.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),this.macrosSampler=e.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`}),this.buildPipelines()}setMacrosTexture(e){this.macrosView=e,this.compositeBG=null}buildPipelines(){let e=this.device;this.depthBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),this.thicknessBgl=this.depthBgl,this.depthBlurBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),this.thicknessBlurBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),this.compositeBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:5,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}}]}),this.directSphereBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]});let t=e.createShaderModule({code:Ce,label:`fluid-sphere`}),n=e.createShaderModule({code:we,label:`fluid-blur`}),r=e.createShaderModule({code:Te,label:`fluid-composite`});this.depthPipeline=e.createRenderPipeline({label:`fluid-depth`,layout:e.createPipelineLayout({bindGroupLayouts:[this.depthBgl]}),vertex:{module:t,entryPoint:`vs_sphere`},fragment:{module:t,entryPoint:`fs_depth`,targets:[{format:`r32float`}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.thicknessPipeline=e.createRenderPipeline({label:`fluid-thickness`,layout:e.createPipelineLayout({bindGroupLayouts:[this.thicknessBgl]}),vertex:{module:t,entryPoint:`vs_sphere`},fragment:{module:t,entryPoint:`fs_thickness`,targets:[{format:`r16float`,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),this.depthBlurPipeline=e.createRenderPipeline({label:`fluid-depth-blur`,layout:e.createPipelineLayout({bindGroupLayouts:[this.depthBlurBgl]}),vertex:{module:n,entryPoint:`vs_full`},fragment:{module:n,entryPoint:`fs_blur`,targets:[{format:`r32float`}]},primitive:{topology:`triangle-list`}}),this.thicknessBlurPipeline=e.createRenderPipeline({label:`fluid-thickness-blur`,layout:e.createPipelineLayout({bindGroupLayouts:[this.thicknessBlurBgl]}),vertex:{module:n,entryPoint:`vs_full`},fragment:{module:n,entryPoint:`fs_blur`,targets:[{format:`r16float`}]},primitive:{topology:`triangle-list`}}),this.compositePipeline=e.createRenderPipeline({label:`fluid-composite`,layout:e.createPipelineLayout({bindGroupLayouts:[this.compositeBgl]}),vertex:{module:r,entryPoint:`vs_full`},fragment:{module:r,entryPoint:`fs_composite`,targets:[{format:this.canvasFormat,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),this.obstacleBgl=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});let i=e.createShaderModule({code:De,label:`fluid-obstacle`});this.obstaclePipeline=e.createRenderPipeline({label:`fluid-obstacle`,layout:e.createPipelineLayout({bindGroupLayouts:[this.obstacleBgl]}),vertex:{module:i,entryPoint:`vs_obstacle`,buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`}]}]},fragment:{module:i,entryPoint:`fs_obstacle`,targets:[{format:this.canvasFormat}]},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.obstacleBG=e.createBindGroup({layout:this.obstacleBgl,entries:[{binding:0,resource:{buffer:this.obstacleUniformBuf}}]});let a=e.createShaderModule({code:Ee,label:`fluid-direct-sphere`});this.directSpherePipeline=e.createRenderPipeline({label:`fluid-direct-sphere`,layout:e.createPipelineLayout({bindGroupLayouts:[this.directSphereBgl]}),vertex:{module:a,entryPoint:`vs_sphere`},fragment:{module:a,entryPoint:`fs_direct`,targets:[{format:this.canvasFormat}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.depthBG=e.createBindGroup({layout:this.depthBgl,entries:[{binding:0,resource:{buffer:this.particleBuf}},{binding:1,resource:{buffer:this.uniformBuf}}]}),this.thicknessBG=e.createBindGroup({layout:this.thicknessBgl,entries:[{binding:0,resource:{buffer:this.particleBuf}},{binding:1,resource:{buffer:this.uniformBuf}}]})}ensureRTs(e,t){this.depthTex&&this.rtW===e&&this.rtH===t||(this.depthTex?.destroy(),this.depthTexAlt?.destroy(),this.depthTestTex?.destroy(),this.thicknessTex?.destroy(),this.thicknessAlt?.destroy(),this.depthTex=this.device.createTexture({label:`fluid-depth-rt`,size:[e,t],format:`r32float`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.depthTexAlt=this.device.createTexture({label:`fluid-depth-rt-alt`,size:[e,t],format:`r32float`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.depthTestTex=this.device.createTexture({label:`fluid-depth-test`,size:[e,t],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.thicknessTex=this.device.createTexture({label:`fluid-thickness-rt`,size:[e,t],format:`r16float`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.thicknessAlt=this.device.createTexture({label:`fluid-thickness-rt-alt`,size:[e,t],format:`r16float`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.rtW=e,this.rtH=t,this.depthBlurXBG=this.device.createBindGroup({layout:this.depthBlurBgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.depthTex.createView()},{binding:2,resource:{buffer:this.blurDirBufX}},{binding:3,resource:{buffer:this.filterSizeBuf}}]}),this.depthBlurYBG=this.device.createBindGroup({layout:this.depthBlurBgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.depthTexAlt.createView()},{binding:2,resource:{buffer:this.blurDirBufY}},{binding:3,resource:{buffer:this.filterSizeBuf}}]}),this.thicknessBlurXBG=this.device.createBindGroup({layout:this.thicknessBlurBgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.thicknessTex.createView()},{binding:2,resource:{buffer:this.blurDirBufX}},{binding:3,resource:{buffer:this.filterSizeBuf}}]}),this.thicknessBlurYBG=this.device.createBindGroup({layout:this.thicknessBlurBgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.thicknessAlt.createView()},{binding:2,resource:{buffer:this.blurDirBufY}},{binding:3,resource:{buffer:this.filterSizeBuf}}]}),this.compositeBG=null)}render(e,t,n,r,i,a){let[o,s]=this.getCanvasSize();if(o<=0||s<=0||(this.ensureRTs(o,s),!this.depthTex||!this.depthTexAlt||!this.depthTestTex||!this.thicknessTex||!this.thicknessAlt)||!this.macrosView)return;this.compositeBG||(this.compositeBG=this.device.createBindGroup({layout:this.compositeBgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.depthTex.createView()},{binding:2,resource:{buffer:this.uniformBuf}},{binding:3,resource:this.thicknessTex.createView()},{binding:4,resource:this.macrosView},{binding:5,resource:this.macrosSampler}]}));let c=t.clone().invert(),l=e.clone().invert(),u=new Float32Array(92);u[0]=1/o,u[1]=1/s,u[2]=0,u[3]=0,u[4]=n,u[5]=r,u[6]=0,u[7]=0,u.set(c.elements,8),u.set(t.elements,24),u.set(e.elements,40),u.set(l.elements,56),u[72]=i.x,u[73]=i.y,u[74]=i.z,u[75]=0,u[76]=a.x,u[77]=a.y,u[78]=a.z,u[79]=0,u[80]=0,u[81]=0,u[82]=0,u[83]=0,u[84]=this.obstacleCenter[0],u[85]=this.obstacleCenter[1],u[86]=this.obstacleCenter[2],u[87]=this.obstacleRadius,u[88]=this.maskDims[0],u[89]=this.maskDims[1],u[90]=this.maskDims[2],u[91]=0,this.device.queue.writeBuffer(this.uniformBuf,0,u.buffer);let d=this.device.createCommandEncoder({label:`fluid-surface`});{let e=d.beginRenderPass({colorAttachments:[{view:this.depthTex.createView(),clearValue:{r:be,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:this.depthTestTex.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});e.setPipeline(this.depthPipeline),e.setBindGroup(0,this.depthBG),e.draw(6,this.N),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.depthTexAlt.createView(),clearValue:{r:be,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(this.depthBlurPipeline),e.setBindGroup(0,this.depthBlurXBG),e.draw(6),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.depthTex.createView(),clearValue:{r:be,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(this.depthBlurPipeline),e.setBindGroup(0,this.depthBlurYBG),e.draw(6),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.thicknessTex.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(this.thicknessPipeline),e.setBindGroup(0,this.thicknessBG),e.draw(6,this.N),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.thicknessAlt.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(this.thicknessBlurPipeline),e.setBindGroup(0,this.thicknessBlurXBG),e.draw(6),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.thicknessTex.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(this.thicknessBlurPipeline),e.setBindGroup(0,this.thicknessBlurYBG),e.draw(6),e.end()}{let e=d.beginRenderPass({colorAttachments:[{view:this.getCanvasView(),loadOp:`load`,storeOp:`store`}]});e.setPipeline(this.compositePipeline),e.setBindGroup(0,this.compositeBG),e.draw(6),e.end()}this.device.queue.submit([d.finish()])}setSliceMask(e,t,n,r=.04){this.sliceMaskAxis=e,this.sliceMaskPos=t,this.sliceMaskActive=n,this.sliceMaskThickness=r}setObstacle(e,t){this.obstacleCenter=[e.x,e.y,e.z],this.obstacleRadius=t}setMaskBuffer(e,t){this.maskBuffer=e,this.maskDims=[t.W,t.H,t.D],this.directSphereBG=null}setObstacleGeometry(e,t){this.obstacleVtxBuf?.destroy(),this.obstacleIdxBuf?.destroy(),this.obstacleVtxBuf=this.device.createBuffer({size:e.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.obstacleVtxBuf,0,e.buffer,e.byteOffset,e.byteLength),this.obstacleVertCount=e.length/6,t?(this.obstacleIdxFormat=t.BYTES_PER_ELEMENT===2?`uint16`:`uint32`,this.obstacleIdxBuf=this.device.createBuffer({size:Math.max(t.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.obstacleIdxBuf,0,t.buffer,t.byteOffset,t.byteLength),this.obstacleIdxCount=t.length):(this.obstacleIdxBuf=null,this.obstacleIdxCount=0)}renderRawSpheres(e,t,n,r,i,a){let[o,s]=this.getCanvasSize();if(o<=0||s<=0||!this.macrosView)return;if((!this.directDepthTex||this.rtW!==o||this.rtH!==s)&&(this.directDepthTex?.destroy(),this.directDepthTex=this.device.createTexture({label:`direct-sphere-depth`,size:[o,s],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.rtW=o,this.rtH=s,this.directSphereBG=null),!this.directSphereBG){if(!this.maskBuffer)return;this.directSphereBG=this.device.createBindGroup({layout:this.directSphereBgl,entries:[{binding:0,resource:{buffer:this.particleBuf}},{binding:1,resource:{buffer:this.uniformBuf}},{binding:2,resource:this.macrosView},{binding:3,resource:this.macrosSampler},{binding:4,resource:{buffer:this.maskBuffer}}]})}let c=t.clone().invert(),l=e.clone().invert(),u=new Float32Array(92);u[0]=1/o,u[1]=1/s,u[2]=0,u[3]=0,u[4]=n,u[5]=r,u[6]=0,u[7]=0,u.set(c.elements,8),u.set(t.elements,24),u.set(e.elements,40),u.set(l.elements,56),u[72]=i.x,u[73]=i.y,u[74]=i.z,u[75]=0,u[76]=a.x,u[77]=a.y,u[78]=a.z,u[79]=0,u[80]=this.sliceMaskAxis,u[81]=this.sliceMaskPos,u[82]=+!!this.sliceMaskActive,u[83]=this.sliceMaskThickness,u[84]=this.obstacleCenter[0],u[85]=this.obstacleCenter[1],u[86]=this.obstacleCenter[2],u[87]=this.obstacleRadius,u[88]=this.maskDims[0],u[89]=this.maskDims[1],u[90]=this.maskDims[2],u[91]=0,this.device.queue.writeBuffer(this.uniformBuf,0,u.buffer);let d=this.device.createCommandEncoder({label:`direct-spheres`}),f=this.getCanvasView(),p=this.directDepthTex.createView();if(this.obstacleVtxBuf&&this.obstacleVertCount>0){let e=d.beginRenderPass({colorAttachments:[{view:f,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:p,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});e.setPipeline(this.obstaclePipeline),e.setBindGroup(0,this.obstacleBG),e.setVertexBuffer(0,this.obstacleVtxBuf),this.obstacleIdxBuf&&this.obstacleIdxCount>0?(e.setIndexBuffer(this.obstacleIdxBuf,this.obstacleIdxFormat),e.drawIndexed(this.obstacleIdxCount)):e.draw(this.obstacleVertCount),e.end()}let m=d.beginRenderPass({colorAttachments:[{view:f,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:p,depthLoadOp:this.obstacleVtxBuf?`load`:`clear`,depthClearValue:1,depthStoreOp:`store`}});m.setPipeline(this.directSpherePipeline),m.setBindGroup(0,this.directSphereBG),m.draw(6,this.N),m.end(),this.device.queue.submit([d.finish()])}setObstacleTransform(e,t,n){let r=new Float32Array(52);r.set(e.elements,0),r.set(t.elements,16),r.set(n.elements,32),r[48]=-1,r[49]=0,r[50]=0,r[51]=0,this.device.queue.writeBuffer(this.obstacleUniformBuf,0,r.buffer)}dispose(){this.depthTex?.destroy(),this.depthTexAlt?.destroy(),this.depthTestTex?.destroy(),this.thicknessTex?.destroy(),this.thicknessAlt?.destroy(),this.uniformBuf.destroy(),this.blurDirBufX.destroy(),this.blurDirBufY.destroy(),this.filterSizeBuf.destroy()}},Se=`
struct RenderUniforms {
    texelSize     : vec4f,    // texelSize.xy, pad, pad
    sphereTime    : vec4f,    // sphereSize, time, pad, pad
    invProjMat    : mat4x4f,
    projMat       : mat4x4f,
    viewMat       : mat4x4f,
    invViewMat    : mat4x4f,
    aabbMin       : vec4f,    // x, y, z, pad
    aabbMax       : vec4f,    // x, y, z, pad
    sliceMask     : vec4f,    // axis (0=x,1=y,2=z), pos[0..1], active (0/1), thickness[0..1]
    obstacle      : vec4f,    // centerX, centerY, centerZ, radius (kept for back-compat)
    latticeDims   : vec4f,    // W, H, D, _
};
`,Ce=Se+`
@group(0) @binding(0) var<storage, read> particles : array<vec4f>;
@group(0) @binding(1) var<uniform> u : RenderUniforms;

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv      : vec2f,
  @location(1) viewPos : vec3f,
};

const CORNERS = array<vec2f, 6>(
  vec2( 0.5,  0.5), vec2( 0.5, -0.5), vec2(-0.5, -0.5),
  vec2( 0.5,  0.5), vec2(-0.5, -0.5), vec2(-0.5,  0.5),
);

@vertex
fn vs_sphere(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VertOut {
  let size = u.sphereTime.x;
  let corner2 = CORNERS[vi] * size;
  let uv = CORNERS[vi] + 0.5;

  let worldPos = particles[ii].xyz;
  let viewPos = (u.viewMat * vec4f(worldPos, 1.0)).xyz;
  let outClip = u.projMat * vec4f(viewPos + vec3f(corner2, 0.0), 1.0);

  var out : VertOut;
  out.position = outClip;
  out.uv = uv;
  out.viewPos = viewPos;
  return out;
}

struct DepthOut {
  @location(0) depth : f32,
  @builtin(frag_depth) fragDepth : f32,
};

@fragment
fn fs_depth(@location(0) uv : vec2f, @location(1) viewPos : vec3f) -> DepthOut {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let nz = sqrt(1.0 - r2);
  let radius = u.sphereTime.x * 0.5;
  let realView = vec4f(viewPos + vec3f(nxy, nz) * radius, 1.0);
  let clipPos = u.projMat * realView;

  var out : DepthOut;
  out.fragDepth = clipPos.z / clipPos.w;
  // Output negative view-space z so the value is positive (camera looks down -Z).
  out.depth = -realView.z;
  return out;
}

@fragment
fn fs_thickness(@location(0) uv : vec2f) -> @location(0) vec4f {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let thickness = sqrt(1.0 - r2);
  let particleAlpha = 0.05;
  return vec4f(particleAlpha * thickness, 0.0, 0.0, 1.0);
}
`,we=`
@group(0) @binding(0) var samp     : sampler;
@group(0) @binding(1) var srcTex   : texture_2d<f32>;
@group(0) @binding(2) var<uniform> blurDir : vec4f;   // x,y = blur direction
@group(0) @binding(3) var<uniform> filterCfg : vec4i; // x = filterSize

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> VertOut {
  let pos = array<vec2f, 6>(
    vec2( 1.0,  1.0), vec2( 1.0, -1.0), vec2(-1.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0, -1.0), vec2(-1.0,  1.0),
  );
  let uv = array<vec2f, 6>(
    vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0),
    vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, 0.0),
  );
  var out : VertOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}

@fragment
fn fs_blur(@location(0) uv : vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(srcTex, 0));
  let iuv = uv * dims;
  let center = textureLoad(srcTex, vec2u(iuv), 0).r;

  let filterSize = filterCfg.x;
  let sigma = f32(filterSize) / 3.0;
  let sigmaInv = 1.0 / (2.0 * sigma * sigma);

  var sum = center;
  var wsum = 1.0;
  for (var x : i32 = 1; x <= filterSize; x = x + 1) {
    let off = blurDir.xy * f32(x);
    let l = textureLoad(srcTex, vec2u(iuv - off), 0).r;
    let r = textureLoad(srcTex, vec2u(iuv + off), 0).r;
    let w = exp(-f32(x * x) * sigmaInv);
    sum  = sum + (l + r) * w;
    wsum = wsum + 2.0 * w;
  }
  return vec4f(sum / wsum, 0.0, 0.0, 1.0);
}
`,Te=Se+`
@group(0) @binding(0) var samp        : sampler;
@group(0) @binding(1) var depthTex    : texture_2d<f32>;
@group(0) @binding(2) var<uniform> u  : RenderUniforms;
@group(0) @binding(3) var thicknessTex: texture_2d<f32>;
@group(0) @binding(4) var macrosTex   : texture_3d<f32>;
@group(0) @binding(5) var macrosSamp  : sampler;

// Turbo colormap — vivid blue→cyan→green→yellow→red velocity ramp.
fn turbo(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.19, 0.07, 0.23);
  let c1 = vec3f(0.10, 0.40, 0.95);
  let c2 = vec3f(0.10, 0.85, 0.85);
  let c3 = vec3f(0.30, 0.95, 0.30);
  let c4 = vec3f(0.98, 0.85, 0.10);
  let c5 = vec3f(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> VertOut {
  let pos = array<vec2f, 6>(
    vec2( 1.0,  1.0), vec2( 1.0, -1.0), vec2(-1.0, -1.0),
    vec2( 1.0,  1.0), vec2(-1.0, -1.0), vec2(-1.0,  1.0),
  );
  let uv = array<vec2f, 6>(
    vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0),
    vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, 0.0),
  );
  var out : VertOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = uv[vi];
  return out;
}

fn viewPosFromDepth(uv : vec2f, depthVal : f32) -> vec3f {
  // depthVal is positive view-space distance (we stored -viewPos.z).
  // Reconstruct via inv-proj of NDC.
  var ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - 2.0 * uv.y, 0.0, 1.0);
  ndc.z = -u.projMat[2].z + u.projMat[3].z / depthVal;
  let eye = u.invProjMat * ndc;
  return eye.xyz / eye.w;
}

fn loadDepth(iuv : vec2i) -> f32 {
  return abs(textureLoad(depthTex, vec2u(iuv), 0).r);
}

// Procedural cool gradient sky for reflection/refraction backdrop.
fn skyDir(d : vec3f) -> vec3f {
  let t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  let horizon = vec3f(0.05, 0.10, 0.18);    // dark blue-grey near horizon
  let zenith  = vec3f(0.55, 0.78, 1.05);    // ice cyan above
  let nadir   = vec3f(0.02, 0.03, 0.05);    // black below
  if d.y > 0.0 {
    return mix(horizon, zenith, pow(t, 0.6));
  }
  return mix(horizon, nadir, pow(1.0 - t, 0.7));
}

// Animated caustic-style lattice floor for refracted rays that head downward.
fn floorCol(world : vec3f, time : f32) -> vec3f {
  // Soft grid
  let gs = 0.3;
  let gx = abs(fract(world.x / gs) - 0.5);
  let gz = abs(fract(world.z / gs) - 0.5);
  let line = smoothstep(0.46, 0.50, max(gx, gz));
  let baseGrid = mix(vec3f(0.02, 0.04, 0.10), vec3f(0.10, 0.30, 0.55), line);

  // Animated multi-octave caustic — bright moving bands of focused light.
  let cs = world.xz * 1.5;
  let a = sin(cs.x * 3.0 + time * 0.7) + sin(cs.y * 2.7 + time * 0.5);
  let b = sin(cs.x * 1.8 - cs.y * 2.3 + time * 0.9);
  let c = sin((cs.x + cs.y) * 4.1 - time * 1.3);
  let cAccum = a * 0.5 + b * 0.5 + c * 0.4;
  let causticIntensity = pow(max(0.0, cAccum), 6.0) * 1.8;
  // Iridescent caustics: hue shifts based on caustic phase
  let phase = sin(cs.x * 1.2 + time * 0.3) * 0.5 + 0.5;
  let causticColor = mix(vec3f(0.40, 0.95, 1.30), vec3f(1.20, 0.70, 1.30), phase);

  return baseGrid + causticColor * causticIntensity;
}

@fragment
fn fs_composite(@location(0) uv : vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(depthTex, 0));
  let iuv = vec2i(uv * dims);

  let depthVal = loadDepth(iuv);
  let thickness = textureSample(thicknessTex, samp, uv).r;

  if depthVal >= 1e4 {
    // No fluid here — let the background show through.
    discard;
  }

  let surfaceView = viewPosFromDepth(uv, depthVal);
  let texel = u.texelSize.xy;

  // View-pos derivatives for normal. Use whichever side has smaller deltaZ
  // (avoids picking up huge silhouette discontinuities).
  let ddx1 = viewPosFromDepth(uv + vec2f( texel.x, 0.0), loadDepth(iuv + vec2i( 1, 0))) - surfaceView;
  let ddy1 = viewPosFromDepth(uv + vec2f(0.0,  texel.y), loadDepth(iuv + vec2i(0,  1))) - surfaceView;
  let ddx2 = surfaceView - viewPosFromDepth(uv + vec2f(-texel.x, 0.0), loadDepth(iuv + vec2i(-1, 0)));
  let ddy2 = surfaceView - viewPosFromDepth(uv + vec2f(0.0, -texel.y), loadDepth(iuv + vec2i(0, -1)));
  let ddx = select(ddx1, ddx2, abs(ddx1.z) > abs(ddx2.z));
  let ddy = select(ddy1, ddy2, abs(ddy1.z) > abs(ddy2.z));

  let normalView = -normalize(cross(ddx, ddy));
  let rayDirView = normalize(surfaceView);

  // ---- Refraction ----
  let refractDirView = refract(rayDirView, normalView, 1.0 / 1.333);
  let refractDirWorld = normalize((u.invViewMat * vec4f(refractDirView, 0.0)).xyz);

  let surfaceWorld = (u.invViewMat * vec4f(surfaceView, 1.0)).xyz;

  // Where does the refracted ray hit the "floor" (y = -1.0)?
  var refractedCol = skyDir(refractDirWorld);
  if refractDirWorld.y < -0.01 {
    let t = (-1.0 - surfaceWorld.y) / refractDirWorld.y;
    if t > 0.0 {
      let hit = surfaceWorld + refractDirWorld * t;
      refractedCol = floorCol(hit, u.sphereTime.y);
    }
  }

  // Sample LBM velocity along the refracted ray inside the fluid — averages
  // over the volume the fluid occupies, giving rich color from interior flow.
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let probeStep = refractDirWorld * (length(aabbSize) * 0.02);
  let probe0 = surfaceWorld + probeStep * 0.5;
  let probe1 = surfaceWorld + probeStep * 1.5;
  let probe2 = surfaceWorld + probeStep * 3.0;
  let uvw0 = clamp((probe0 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let uvw1 = clamp((probe1 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let uvw2 = clamp((probe2 - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let m0 = textureSampleLevel(macrosTex, macrosSamp, uvw0, 0.0).xyz;
  let m1 = textureSampleLevel(macrosTex, macrosSamp, uvw1, 0.0).xyz;
  let m2 = textureSampleLevel(macrosTex, macrosSamp, uvw2, 0.0).xyz;
  let avgVel = (m0 + m1 + m2) * (1.0 / 3.0);
  let speed = length(avgVel);
  let speedN = clamp(speed / 0.06, 0.0, 1.0);     // more sensitive
  let velocityColor = turbo(speedN);

  // Approximate vorticity by 6-tap finite difference on velocity field.
  let h = 1.5 / vec3f(160.0, 80.0, 80.0);
  let vxp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vxn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vyp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vyn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vzp = textureSampleLevel(macrosTex, macrosSamp, uvw0 + vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let vzn = textureSampleLevel(macrosTex, macrosSamp, uvw0 - vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let curlX = (vyp.z - vyn.z) - (vzp.y - vzn.y);
  let curlY = (vzp.x - vzn.x) - (vxp.z - vxn.z);
  let curlZ = (vxp.y - vxn.y) - (vyp.x - vyn.x);
  let vort = length(vec3f(curlX, curlY, curlZ));
  let vortN = clamp(vort * 60.0, 0.0, 1.0);

  // Add a positional hue shift — depth along the tunnel adds variety.
  let posPhase = uvw0.x * 6.283 + u.sphereTime.y * 0.4;
  let positionalTint = vec3f(
    0.5 + 0.5 * sin(posPhase),
    0.5 + 0.5 * sin(posPhase + 2.094),
    0.5 + 0.5 * sin(posPhase + 4.188)
  );

  // Beer-Lambert tint with thickness — absorb less when fast (more vivid).
  let absorbColor = mix(vec3f(0.95, 0.55, 0.25), vec3f(0.20, 0.30, 0.45), speedN);
  let transmittance = exp(-absorbColor * thickness * 1.6);
  refractedCol = refractedCol * transmittance;

  // ---- Vivid multi-channel color encoding ----
  // Speed lives in distinct, sharp BANDS — no smooth gradient → no mud.
  var bandColor = vec3f(0.06, 0.18, 0.55);            // deep electric blue (baseline)
  if speedN > 0.18 { bandColor = vec3f(0.10, 0.45, 1.00); }    // electric blue
  if speedN > 0.35 { bandColor = vec3f(0.05, 0.90, 0.90); }    // cyan
  if speedN > 0.55 { bandColor = vec3f(0.20, 0.95, 0.25); }    // green
  if speedN > 0.75 { bandColor = vec3f(1.00, 0.85, 0.10); }    // yellow
  if speedN > 0.92 { bandColor = vec3f(1.00, 0.30, 0.10); }    // red (highest)

  // Vorticity flash — sharp threshold for clear hotspots.
  let vortFlash = step(0.35, vortN) * vortN;
  bandColor = mix(bandColor, vec3f(1.35, 0.30, 0.95), vortFlash * 0.65);

  // Animated rainbow stripes scrolling downstream — adds time-varying info layer.
  let stripePhase = uvw0.x * 14.0 - u.sphereTime.y * 4.0;
  let stripeMask  = pow(0.5 + 0.5 * sin(stripePhase), 8.0) * 0.55;
  let stripeColor = vec3f(
    0.5 + 0.5 * sin(stripePhase),
    0.5 + 0.5 * sin(stripePhase + 2.094),
    0.5 + 0.5 * sin(stripePhase + 4.188),
  );
  bandColor = bandColor + stripeColor * stripeMask;

  // Density (rho) channel — bumps near obstacle, encoded as warm white halo.
  let rho = textureSampleLevel(macrosTex, macrosSamp, uvw0, 0.0).w;
  let rhoN = clamp((rho - 1.0) * 12.0 + 0.5, 0.0, 1.0);
  bandColor = bandColor + vec3f(1.15, 0.95, 0.55) * rhoN * 0.30;

  // Use the banded color as the dominant body tint.
  refractedCol = mix(refractedCol, bandColor * 1.3, 0.90);

  // ---- Reflection ----
  let reflectDirView = reflect(rayDirView, normalView);
  let reflectDirWorld = normalize((u.invViewMat * vec4f(reflectDirView, 0.0)).xyz);
  let reflectedCol = skyDir(reflectDirWorld);

  // ---- Fresnel ----
  let F0 = 0.02;
  let cosI = clamp(dot(normalView, -rayDirView), 0.0, 1.0);
  let fresnel = clamp(F0 + (1.0 - F0) * pow(1.0 - cosI, 5.0), 0.0, 1.0);

  // ---- Specular ----
  let lightDirView = normalize((u.viewMat * vec4f(0.5, 1.0, 0.6, 0.0)).xyz);
  let H = normalize(lightDirView - rayDirView);
  let spec = pow(max(0.0, dot(H, normalView)), 220.0) * 1.2;

  // Composite
  var finalCol = mix(refractedCol, reflectedCol, fresnel) + vec3f(spec);

  // Iridescence — thin-film rainbow at fresnel edges, animated like a soap film.
  let iriPhase = fresnel * 12.566 + u.sphereTime.y * 0.7;
  let iri = vec3f(
    0.5 + 0.5 * sin(iriPhase),
    0.5 + 0.5 * sin(iriPhase + 2.094),
    0.5 + 0.5 * sin(iriPhase + 4.188),
  );
  finalCol = finalCol + iri * fresnel * fresnel * 0.55;

  // Gamma
  finalCol = pow(max(finalCol, vec3f(0.0)), vec3f(1.0 / 2.2));

  // Alpha — thin everywhere, fresnel rim crisper. Body translucent so the
  // refracted floor caustics shine through.
  let alpha = clamp(0.25 + fresnel * 0.45 + thickness * 0.3, 0.05, 0.78);

  return vec4f(finalCol, alpha);
}
`,Ee=Se+`
@group(0) @binding(0) var<storage, read> particles : array<vec4f>;
@group(0) @binding(1) var<uniform> u : RenderUniforms;
@group(0) @binding(2) var macrosTex : texture_3d<f32>;
@group(0) @binding(3) var macrosSamp : sampler;
@group(0) @binding(4) var<storage, read> voxelMask : array<u32>;   // 0=fluid, 1=wall

struct VertOut {
  @builtin(position) position : vec4f,
  @location(0) uv      : vec2f,
  @location(1) viewPos : vec3f,
  @location(2) world   : vec3f,
};

const CORNERS = array<vec2f, 6>(
  vec2( 0.5,  0.5), vec2( 0.5, -0.5), vec2(-0.5, -0.5),
  vec2( 0.5,  0.5), vec2(-0.5, -0.5), vec2(-0.5,  0.5),
);

fn turbo(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.19, 0.07, 0.23);
  let c1 = vec3f(0.10, 0.40, 0.95);
  let c2 = vec3f(0.10, 0.85, 0.85);
  let c3 = vec3f(0.30, 0.95, 0.30);
  let c4 = vec3f(0.98, 0.85, 0.10);
  let c5 = vec3f(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

@vertex
fn vs_sphere(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VertOut {
  let size = u.sphereTime.x;
  let corner2 = CORNERS[vi] * size;
  let uv = CORNERS[vi] + 0.5;

  let worldPos = particles[ii].xyz;

  // Slice mask: when active, hide particles whose normalized position along
  // the slice axis falls outside [pos - thickness, pos + thickness].
  var clipped = false;
  if u.sliceMask.z > 0.5 {
    let axis = i32(u.sliceMask.x + 0.5);
    let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
    let lUvw = (worldPos - u.aabbMin.xyz) / aabbSize;
    var coord = 0.0;
    if axis == 0      { coord = lUvw.x; }
    else if axis == 1 { coord = lUvw.y; }
    else              { coord = lUvw.z; }
    if abs(coord - u.sliceMask.y) > u.sliceMask.w {
      clipped = true;
    }
  }

  // Exact obstacle cull via LBM voxel mask: clip particles whose lattice
  // cell is flagged as solid (mask == 1). Uses the EXACT voxelized shape,
  // so the cull region matches the mesh — no bounding-sphere overshoot.
  let W = i32(u.latticeDims.x);
  let H = i32(u.latticeDims.y);
  let D = i32(u.latticeDims.z);
  if W > 0 && H > 0 && D > 0 {
    let aabbSizeC = u.aabbMax.xyz - u.aabbMin.xyz;
    let lUvw2 = (worldPos - u.aabbMin.xyz) / aabbSizeC;
    let xi = i32(clamp(lUvw2.x * f32(W), 0.0, f32(W - 1)));
    let yi = i32(clamp(lUvw2.y * f32(H), 0.0, f32(H - 1)));
    let zi = i32(clamp(lUvw2.z * f32(D), 0.0, f32(D - 1)));
    let idx = u32(zi * W * H + yi * W + xi);
    let flag = voxelMask[idx];
    if flag == 1u { clipped = true; }
  }

  let viewPos = (u.viewMat * vec4f(worldPos, 1.0)).xyz;
  var outClip = u.projMat * vec4f(viewPos + vec3f(corner2, 0.0), 1.0);
  // Send clipped vertices to NDC-infinity so they're guaranteed culled.
  if clipped { outClip = vec4f(2.0, 2.0, 2.0, 1.0); }

  var out : VertOut;
  out.position = outClip;
  out.uv = uv;
  out.viewPos = viewPos;
  out.world = worldPos;
  return out;
}

struct FragOut {
  @location(0) color : vec4f,
  @builtin(frag_depth) fragDepth : f32,
};

@fragment
fn fs_direct(@location(0) uv : vec2f, @location(1) viewPos : vec3f, @location(2) world : vec3f) -> FragOut {
  let nxy = uv * 2.0 - 1.0;
  let r2 = dot(nxy, nxy);
  if r2 > 1.0 { discard; }
  let nz = sqrt(1.0 - r2);
  let normal = vec3f(nxy, nz);
  let radius = u.sphereTime.x * 0.5;

  // True view-space position of the sphere surface point under this pixel.
  let realView = vec4f(viewPos + normal * radius, 1.0);
  let clipPos = u.projMat * realView;
  let fragDepth = clipPos.z / clipPos.w;

  // Sample LBM velocity at the SPHERE CENTER world position.
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let lUvw = clamp((world - u.aabbMin.xyz) / aabbSize, vec3f(0.0), vec3f(1.0));
  let macros = textureSampleLevel(macrosTex, macrosSamp, lUvw, 0.0);
  let speed = length(macros.xyz);
  let speedN = clamp(speed / 0.10, 0.0, 1.0);
  let col = turbo(speedN);

  // Simple Lambert + soft rim. Light from upper-left.
  let lightDir = normalize(vec3f(-0.4, 0.8, 0.7));
  let ndotl = clamp(dot(normal, lightDir), 0.0, 1.0);
  let rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.0);
  let shaded = col * (0.45 + 0.65 * ndotl) + vec3f(rim * 0.25);

  var out : FragOut;
  out.color = vec4f(shaded, 1.0);
  out.fragDepth = fragDepth;
  return out;
}
`,De=`
struct ObstacleUniforms {
  viewMat   : mat4x4f,
  projMat   : mat4x4f,
  modelMat  : mat4x4f,
  upstream  : vec4f,    // direction the wind comes FROM (-X by default)
};
@group(0) @binding(0) var<uniform> u : ObstacleUniforms;

struct VOut {
  @builtin(position) clip : vec4f,
  @location(0) normalWorld : vec3f,
};

@vertex
fn vs_obstacle(@location(0) pos : vec3f, @location(1) norm : vec3f) -> VOut {
  let worldPos = (u.modelMat * vec4f(pos, 1.0)).xyz;
  let viewPos  = (u.viewMat  * vec4f(worldPos, 1.0)).xyz;
  let nWorld   = normalize((u.modelMat * vec4f(norm, 0.0)).xyz);
  var out : VOut;
  out.clip = u.projMat * vec4f(viewPos, 1.0);
  out.normalWorld = nWorld;
  return out;
}

fn turbo5(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.06, 0.18, 0.55);   // deep blue (back)
  let c1 = vec3f(0.10, 0.85, 0.85);   // cyan
  let c2 = vec3f(0.30, 0.95, 0.30);   // green
  let c3 = vec3f(1.00, 0.85, 0.10);   // yellow
  let c4 = vec3f(1.00, 0.30, 0.10);   // red (front)
  if tt < 0.25 { return mix(c0, c1, tt * 4.0); }
  if tt < 0.55 { return mix(c1, c2, (tt - 0.25) * 3.333); }
  if tt < 0.80 { return mix(c2, c3, (tt - 0.55) * 4.0); }
  return mix(c3, c4, (tt - 0.80) * 5.0);
}

@fragment
fn fs_obstacle(@location(0) n : vec3f) -> @location(0) vec4f {
  let nw = normalize(n);
  let frontness = clamp(dot(nw, u.upstream.xyz), 0.0, 1.0);
  var col = turbo5(frontness);
  // Soft Lambert lighting for shape readability.
  let lightDir = normalize(vec3f(-0.4, 0.85, 0.7));
  let ndotl = clamp(dot(nw, lightDir), 0.0, 1.0);
  col = col * (0.55 + 0.55 * ndotl) + vec3f(0.06);
  return vec4f(col, 1.0);
}
`,Oe=class{constructor(e,t){Z(this,`device`,void 0),Z(this,`canvas`,void 0),Z(this,`ctx`,void 0),Z(this,`format`,void 0),Z(this,`uniformBuf`,void 0),Z(this,`pipeline`,void 0),Z(this,`bgl`,void 0),Z(this,`bindGroup`,null),Z(this,`sampler`,void 0),Z(this,`macrosView`,null),Z(this,`axis`,`y`),Z(this,`pos`,.5),Z(this,`field`,`velocity`),this.device=e,this.canvas=t,this.ctx=t.getContext(`webgpu`),this.format=navigator.gpu.getPreferredCanvasFormat(),this.ctx.configure({device:e,format:this.format,alphaMode:`premultiplied`}),this.sampler=e.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`}),this.uniformBuf=e.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.buildPipeline()}buildPipeline(){this.bgl=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});let e=this.device.createShaderModule({code:ke,label:`slice-viewer`});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl]}),vertex:{module:e,entryPoint:`vs_full`},fragment:{module:e,entryPoint:`fs_slice`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`}})}setMacros(e){this.macrosView=e,this.bindGroup=null}setConfig(e,t,n){this.axis=e,this.pos=Math.max(0,Math.min(1,t)),this.field=n}render(e,t,n){if(!this.macrosView)return;this.bindGroup||(this.bindGroup=this.device.createBindGroup({layout:this.bgl,entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.macrosView},{binding:2,resource:{buffer:this.uniformBuf}}]}));let r=this.axis===`x`?0:this.axis===`y`?1:2,i=this.field===`velocity`?0:this.field===`pressure`?1:2,a=new ArrayBuffer(80),o=new Uint32Array(a),s=new Float32Array(a);o[0]=r,o[1]=i,o[2]=0,o[3]=0,s[4]=this.pos,s[5]=0,s[6]=0,s[7]=0,s[8]=e.x,s[9]=e.y,s[10]=e.z,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=0,s[16]=n.W,s[17]=n.H,s[18]=n.D,s[19]=0,this.device.queue.writeBuffer(this.uniformBuf,0,a);let c=this.device.createCommandEncoder({label:`slice-viewer`}),l=c.beginRenderPass({colorAttachments:[{view:this.ctx.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});l.setPipeline(this.pipeline),l.setBindGroup(0,this.bindGroup),l.draw(6),l.end(),this.device.queue.submit([c.finish()])}dispose(){this.uniformBuf.destroy()}},ke=`
struct U {
  axisField : vec4u,    // axis (0=x,1=y,2=z), fieldId, _, _
  posPad    : vec4f,    // pos, _, _, _
  aabbMin   : vec4f,
  aabbMax   : vec4f,
  dims      : vec4f,    // W, H, D, _
};
@group(0) @binding(0) var samp        : sampler;
@group(0) @binding(1) var macrosTex   : texture_3d<f32>;
@group(0) @binding(2) var<uniform> u  : U;

@vertex
fn vs_full(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4f {
  let pos = array<vec2f, 6>(
    vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0),
    vec2(-1.0, -1.0), vec2( 1.0,  1.0), vec2(-1.0,  1.0),
  );
  return vec4f(pos[vi], 0.0, 1.0);
}

fn turbo(t : f32) -> vec3f {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.10, 0.04, 0.23);
  let c1 = vec3f(0.10, 0.40, 0.95);
  let c2 = vec3f(0.10, 0.85, 0.85);
  let c3 = vec3f(0.30, 0.95, 0.30);
  let c4 = vec3f(0.98, 0.85, 0.10);
  let c5 = vec3f(1.00, 0.25, 0.10);
  if tt < 0.2 { return mix(c0, c1, tt * 5.0); }
  if tt < 0.4 { return mix(c1, c2, (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(c2, c3, (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(c3, c4, (tt - 0.6) * 5.0); }
  return mix(c4, c5, (tt - 0.8) * 5.0);
}

// Returns the lattice UVW [0,1]^3 for the slice fragment at canvas UV (s, t).
fn sliceUvw(s : f32, t : f32) -> vec3f {
  let p = u.posPad.x;
  let axis = u.axisField.x;
  if axis == 0u {     // X-slice: u = position, plane axes = (z, y)
    return vec3f(p, 1.0 - t, s);
  } else if axis == 1u {   // Y-slice: u = (x, z), v = pos
    return vec3f(s, p, 1.0 - t);
  }
  // Z-slice: u = (x, y), v = pos
  return vec3f(s, 1.0 - t, p);
}

fn sampleField(uvw : vec3f, fieldId : u32) -> f32 {
  let m = textureSampleLevel(macrosTex, samp, uvw, 0.0);
  if fieldId == 0u {     // velocity magnitude
    return length(m.xyz);
  } else if fieldId == 1u {   // pressure proxy = density - 1
    return abs(m.w - 1.0);
  }
  // vorticity magnitude via finite differences
  let h = 1.5 / u.dims.xyz;
  let vxp = textureSampleLevel(macrosTex, samp, uvw + vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vxn = textureSampleLevel(macrosTex, samp, uvw - vec3f(h.x, 0.0, 0.0), 0.0).xyz;
  let vyp = textureSampleLevel(macrosTex, samp, uvw + vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vyn = textureSampleLevel(macrosTex, samp, uvw - vec3f(0.0, h.y, 0.0), 0.0).xyz;
  let vzp = textureSampleLevel(macrosTex, samp, uvw + vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let vzn = textureSampleLevel(macrosTex, samp, uvw - vec3f(0.0, 0.0, h.z), 0.0).xyz;
  let cx = (vyp.z - vyn.z) - (vzp.y - vzn.y);
  let cy = (vzp.x - vzn.x) - (vxp.z - vxn.z);
  let cz = (vxp.y - vxn.y) - (vyp.x - vyn.x);
  return length(vec3f(cx, cy, cz));
}

@fragment
fn fs_slice(@builtin(position) fragPos : vec4f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(macrosTex, 0).xy);   // arbitrary, we'll use canvas dims
  // Convert fragPos to normalized [0,1] in canvas — assume Y down convention.
  let canvasDims = vec2f(dims);   // placeholder; we use fragPos directly via builtins below
  // fragPos is in pixel coords (0..canvasW, 0..canvasH). We don't know canvas size here,
  // but we can derive from textureDimensions of the *target*. WebGPU doesn't expose that
  // in the frag shader, so just normalize via fwidth — actually use a workaround:
  let uvw0 = sliceUvw(0.0, 0.0);
  // Simpler: assume the fullscreen quad spans [0,1] in framebuffer; we recompute from fragPos.
  // Use dpdx/dpdy to find the size — too fragile. Instead, derive uv from gl_FragCoord by
  // assuming a unit-step in fragPos → 1/textureDim. We'll just take the position as it is
  // in the small slice canvas (passed via a uniform if needed).
  // We render to a 320x320 canvas → we'll just hardcode the scale to 320 px width.
  let s = clamp(fragPos.x / 320.0, 0.0, 1.0);
  let t = clamp(fragPos.y / 320.0, 0.0, 1.0);
  let uvw = sliceUvw(s, t);
  let v = sampleField(uvw, u.axisField.y);

  // Normalize per field — these scales match the visible ranges of our LBM.
  var n = 0.0;
  if u.axisField.y == 0u {       n = v / 0.10; }
  else if u.axisField.y == 1u {  n = v / 0.04; }
  else {                         n = v * 30.0; }
  let col = turbo(n);

  return vec4f(col, 1.0);
}
`,Ae=1e6,je=`
struct Uniforms {
  dims  : vec4<u32>,            // W, H, D, 0
  scalars : vec4<f32>,          // visc (≈ μ at ρ=1), uIn, 0, 0
};
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var macros : texture_3d<f32>;
@group(0) @binding(2) var samp   : sampler;
@group(0) @binding(3) var<storage, read> mask : array<u32>;
@group(0) @binding(4) var<storage, read_write> outI32 : array<atomic<i32>>;

const ONE_THIRD : f32 = 0.33333333333;

fn idxOf(x : u32, y : u32, z : u32) -> u32 {
  return x + y * u.dims.x + z * u.dims.x * u.dims.y;
}

/// Sample (u_x, u_y, u_z) at integer cell coordinates. Coordinates outside
/// the lattice are clamped to the boundary (one-sided diff fallback).
fn sampleU(x : i32, y : i32, z : i32) -> vec3<f32> {
  let xc = clamp(x, 0, i32(u.dims.x) - 1);
  let yc = clamp(y, 0, i32(u.dims.y) - 1);
  let zc = clamp(z, 0, i32(u.dims.z) - 1);
  let dims_f = vec3<f32>(u.dims.xyz);
  let uvw = (vec3<f32>(f32(xc), f32(yc), f32(zc)) + 0.5) / dims_f;
  let m = textureSampleLevel(macros, samp, uvw, 0.0);
  return m.xyz;
}

@compute @workgroup_size(4, 4, 4)
fn cs_drag(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = u.dims.x;
  let H = u.dims.y;
  let D = u.dims.z;
  if (gid.x >= W || gid.y >= H || gid.z >= D) { return; }
  let i = idxOf(gid.x, gid.y, gid.z);

  // Need fluid cells only.
  if (mask[i] != 0u) { return; }

  // Identify which axis neighbours are solid (we contribute one face per).
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);

  let solidPx = (gid.x + 1u  <  W) && mask[idxOf(gid.x + 1u, gid.y, gid.z)] == 1u;
  let solidMx = (gid.x       >= 1u) && mask[idxOf(gid.x - 1u, gid.y, gid.z)] == 1u;
  let solidPy = (gid.y + 1u  <  H) && mask[idxOf(gid.x, gid.y + 1u, gid.z)] == 1u;
  let solidMy = (gid.y       >= 1u) && mask[idxOf(gid.x, gid.y - 1u, gid.z)] == 1u;
  let solidPz = (gid.z + 1u  <  D) && mask[idxOf(gid.x, gid.y, gid.z + 1u)] == 1u;
  let solidMz = (gid.z       >= 1u) && mask[idxOf(gid.x, gid.y, gid.z - 1u)] == 1u;

  if (!(solidPx || solidMx || solidPy || solidMy || solidPz || solidMz)) {
    return;
  }

  // Centre-cell ρ and pressure.
  let dims_f = vec3<f32>(u.dims.xyz);
  let uvw0 = (vec3<f32>(gid) + 0.5) / dims_f;
  let m0 = textureSampleLevel(macros, samp, uvw0, 0.0);
  let rho = m0.w;
  let p = (rho - 1.0) * ONE_THIRD;

  // Velocity gradients via central differences (clamped at boundaries).
  // Cells inside the solid have u ≈ 0 (no-slip BC), which gives a steep
  // wall gradient and a meaningful viscous traction. Staircase error is
  // partially absorbed by summing all 6 face contributions.
  let u_px = sampleU(ix + 1, iy,     iz);
  let u_mx = sampleU(ix - 1, iy,     iz);
  let u_py = sampleU(ix,     iy + 1, iz);
  let u_my = sampleU(ix,     iy - 1, iz);
  let u_pz = sampleU(ix,     iy,     iz + 1);
  let u_mz = sampleU(ix,     iy,     iz - 1);

  let dux_dx = (u_px.x - u_mx.x) * 0.5;
  let dux_dy = (u_py.x - u_my.x) * 0.5;
  let dux_dz = (u_pz.x - u_mz.x) * 0.5;
  let duy_dx = (u_px.y - u_mx.y) * 0.5;
  let duz_dx = (u_px.z - u_mx.z) * 0.5;

  // Strain-rate components touching F_x.
  let Sxx = dux_dx;
  let Sxy = 0.5 * (dux_dy + duy_dx);
  let Sxz = 0.5 * (dux_dz + duz_dx);

  let mu = u.scalars.x;
  let two_mu_Sxx = 2.0 * mu * Sxx;
  let two_mu_Sxy = 2.0 * mu * Sxy;
  let two_mu_Sxz = 2.0 * mu * Sxz;

  // F_x contribution per face. Convention: F_x = +p·d_x − 2μ·(S_xβ·d_β).
  // Verified: a stagnation-point face (d=+X, p>0, S≈0) gives F_x ≈ +p > 0,
  // i.e. the front of the obstacle drags downstream — same sign as flow.
  var fx : f32 = 0.0;
  if (solidPx) { fx = fx +  p - two_mu_Sxx; }
  if (solidMx) { fx = fx + -p + two_mu_Sxx; }
  if (solidPy) { fx = fx + -two_mu_Sxy; }
  if (solidMy) { fx = fx +  two_mu_Sxy; }
  if (solidPz) { fx = fx + -two_mu_Sxz; }
  if (solidMz) { fx = fx +  two_mu_Sxz; }

  if (fx != 0.0) {
    atomicAdd(&outI32[0], i32(fx * ${Ae.toExponential()}));
  }
}

@compute @workgroup_size(1)
fn cs_clear() {
  atomicStore(&outI32[0], 0);
}
`,Me=class{constructor(e){Z(this,`device`,void 0),Z(this,`uniformBuf`,void 0),Z(this,`outBuf`,void 0),Z(this,`readBuf`,void 0),Z(this,`pipelineDrag`,void 0),Z(this,`pipelineClear`,void 0),Z(this,`layout`,void 0),Z(this,`bindGroup`,null),Z(this,`W`,1),Z(this,`H`,1),Z(this,`D`,1),Z(this,`uIn`,.1),Z(this,`visc`,.02),Z(this,`readPending`,!1),Z(this,`lastFx`,0),Z(this,`frontalArea`,1),Z(this,`cdEMA`,0),Z(this,`emaAlpha`,.15),Z(this,`samplesSinceReset`,0),this.device=e,this.uniformBuf=e.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.outBuf=e.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.readBuf=e.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});let t=e.createShaderModule({code:je,label:`dragCoeff.wgsl`});this.layout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:`float`,viewDimension:`3d`}},{binding:2,visibility:GPUShaderStage.COMPUTE,sampler:{}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});let n=e.createPipelineLayout({bindGroupLayouts:[this.layout]});this.pipelineDrag=e.createComputePipeline({layout:n,compute:{module:t,entryPoint:`cs_drag`}}),this.pipelineClear=e.createComputePipeline({layout:n,compute:{module:t,entryPoint:`cs_clear`}})}setInputs(e,t,n){this.W=n.W,this.H=n.H,this.D=n.D;let r=this.device.createSampler({magFilter:`linear`,minFilter:`linear`});this.bindGroup=this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.uniformBuf}},{binding:1,resource:e},{binding:2,resource:r},{binding:3,resource:{buffer:t}},{binding:4,resource:{buffer:this.outBuf}}]}),this.cdEMA=0,this.samplesSinceReset=0}setUIn(e){this.uIn=e}setVisc(e){this.visc=e}setFrontalArea(e){this.frontalArea=Math.max(1,e)}compute(){if(!this.bindGroup||this.readPending)return;let e=new ArrayBuffer(32),t=new Uint32Array(e),n=new Float32Array(e);t[0]=this.W,t[1]=this.H,t[2]=this.D,t[3]=0,n[4]=this.visc,n[5]=this.uIn,n[6]=0,n[7]=0,this.device.queue.writeBuffer(this.uniformBuf,0,e);let r=this.device.createCommandEncoder({label:`drag-coeff`});{let e=r.beginComputePass();e.setPipeline(this.pipelineClear),e.setBindGroup(0,this.bindGroup),e.dispatchWorkgroups(1),e.end()}{let e=r.beginComputePass();e.setPipeline(this.pipelineDrag),e.setBindGroup(0,this.bindGroup),e.dispatchWorkgroups(Math.ceil(this.W/4),Math.ceil(this.H/4),Math.ceil(this.D/4)),e.end()}r.copyBufferToBuffer(this.outBuf,0,this.readBuf,0,4),this.device.queue.submit([r.finish()]),this.readPending=!0,this.readBuf.mapAsync(GPUMapMode.READ).then(()=>{let e=new Int32Array(this.readBuf.getMappedRange().slice(0));this.readBuf.unmap(),this.lastFx=e[0]/Ae;let t=this.computeInstCd();this.samplesSinceReset++,this.samplesSinceReset<=3?this.cdEMA=t:this.cdEMA=(1-this.emaAlpha)*this.cdEMA+this.emaAlpha*t,this.readPending=!1}).catch(()=>{this.readPending=!1})}computeInstCd(){let e=.5*1*this.uIn*this.uIn*this.frontalArea;return e<1e-9?0:this.lastFx/e}getLastCd(){return this.cdEMA}getLastFx(){return this.lastFx}dispose(){this.uniformBuf.destroy(),this.outBuf.destroy(),this.readBuf.destroy()}};async function Ne(e,t,n,r){e.computeBoundingBox();let i=e.boundingBox,a=new h;i.getSize(a);let o=new h;i.getCenter(o);let s=new Uint32Array(t*n*r),c=e.getAttribute(`position`);if(!c)return s;let l=e.getIndex(),u=l?l.count/3:c.count/3,d=new h,f=new h,p=new h,m=t*.3,g=n*.5,_=r*.5,v=Math.min(t,n,r)*.3/Math.max(a.x,a.y,a.z,1e-6);for(let e=0;e<u;e++){let i=l?l.getX(e*3):e*3,a=l?l.getX(e*3+1):e*3+1,u=l?l.getX(e*3+2):e*3+2;d.fromBufferAttribute(c,i).sub(o).multiplyScalar(v),f.fromBufferAttribute(c,a).sub(o).multiplyScalar(v),p.fromBufferAttribute(c,u).sub(o).multiplyScalar(v);for(let e=0;e<=4;e++)for(let i=0;i<=4-e;i++){let a=4-e-i,o=e/4,c=i/4,l=a/4,u=m+d.x*o+f.x*c+p.x*l,h=g+d.y*o+f.y*c+p.y*l,v=_+d.z*o+f.z*c+p.z*l,y=Math.round(u),b=Math.round(h),x=Math.round(v);y>=0&&y<t&&b>=0&&b<n&&x>=0&&x<r&&(s[y+b*t+x*t*n]=1)}}return s}function $(e,t=3e3){let n=document.createElement(`div`);n.textContent=e,n.style.cssText=[`position:fixed`,`bottom:24px`,`left:50%`,`transform:translateX(-50%)`,`background:#1e1e2e`,`color:#cdd6f4`,`padding:10px 20px`,`border-radius:8px`,`font-size:14px`,`z-index:9999`,`box-shadow:0 4px 16px rgba(0,0,0,0.6)`,`pointer-events:none`,`opacity:1`,`transition:opacity 0.4s`].join(`;`),document.body.appendChild(n),setTimeout(()=>{n.style.opacity=`0`,setTimeout(()=>n.remove(),400)},t)}var Pe=`// Inject compute shader: paint dye or add velocity impulse into the lattice.
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
`,Fe=class{constructor(e,t){Z(this,`canvas`,void 0),Z(this,`config`,G()),Z(this,`renderer`,void 0),Z(this,`scene`,void 0),Z(this,`camera`,void 0),Z(this,`controls`,void 0),Z(this,`latticeGroup`,void 0),Z(this,`obstacleMesh`,null),Z(this,`lbm`,null),Z(this,`dye`,null),Z(this,`volumeRenderer`,null),Z(this,`particles`,null),Z(this,`fluidSurface`,null),Z(this,`sliceViewer`,null),Z(this,`dragCalc`,null),Z(this,`lastDragComputeMs`,0),Z(this,`sliceActive`,!1),Z(this,`sliceIndicator`,null),Z(this,`simStepCount`,0),Z(this,`rafId`,0),Z(this,`running`,!1),Z(this,`lastFpsUpdate`,0),Z(this,`frameCount`,0),Z(this,`_gpuDevice`,null),Z(this,`_injectActive`,!1),Z(this,`_injectMode`,`impulse`),Z(this,`_injectPipeline`,null),Z(this,`_injectParamsBuf`,null),Z(this,`_injectBindGroupLayout`,null),Z(this,`orientDebounceId`,null),Z(this,`loop`,()=>{if(!this.running)return;if(this.rafId=requestAnimationFrame(this.loop),this.controls.update(),this.lbm&&!this.config.paused){let e=Math.max(0,this.config.simSpeed);this.subAccum+=e;let t=Math.floor(this.subAccum);this.subAccum-=t,t>6&&(t=6);for(let e=0;e<t;e++)this.lbm.step(),this.dye?.step(),this.simStepCount++}try{this.renderer.render(this.scene,this.camera)}catch(e){console.error(`render error`,e),this.running=!1;return}if(this.lbm&&this.particles&&this.fluidSurface){this.camera.updateMatrixWorld();let e=this.camera.matrixWorldInverse,t=this.camera.projectionMatrix,n=this.camera.position,{sx:r,sy:i,sz:a}=this.latticeWorld(),o=new h(-r*.5,-i*.5,-a*.5),s=new h(r*.5,i*.5,a*.5),{W:c,H:l,D:u}=K(this.config.N);if(!this.config.paused){let r=6*this.config.simSpeed;this.particles.advectOnly(e,t,n,o,s,{W:c,H:l,D:u},{dt:r})}let d=r/170*this.config.ballSize,f=performance.now()*.001;this.obstacleMesh&&(this.obstacleMesh.updateMatrixWorld(),this.fluidSurface.setObstacleTransform(e,t,this.obstacleMesh.matrixWorld)),this.fluidSurface.renderRawSpheres(e,t,d,f,o,s),this.sliceActive&&this.sliceViewer&&this.sliceViewer.render(o,s,{W:c,H:l,D:u})}let e=performance.now();if(this.frameCount++,this.dragCalc&&e-this.lastDragComputeMs>=500&&(this.dragCalc.compute(),this.lastDragComputeMs=e),e-this.lastFpsUpdate>=500){let t=this.frameCount*1e3/(e-this.lastFpsUpdate),n=document.getElementById(`rd-fps`);n&&(n.textContent=t.toFixed(0));let r=this.dragCalc?.getLastCd()??0,i=document.getElementById(`rd-cd`);i&&(i.textContent=r.toFixed(2));let a=document.getElementById(`cd-overlay-value`);a&&(a.textContent=r.toFixed(2)),this.frameCount=0,this.lastFpsUpdate=e}}),Z(this,`subAccum`,0),this.canvas=e}async start(){this.renderer=new g({canvas:this.canvas,antialias:!0,powerPreference:`high-performance`}),await this.renderer.init(),this.renderer.setClearColor(460555,1),this.handleResize(),this.scene=new s,this.scene.fog=new u(460555,.04),this.camera=new d(45,this.canvas.clientWidth/this.canvas.clientHeight,.1,200),this.camera.position.set(8,4,8),this.controls=new ne(this.camera,this.canvas),this.controls.enableDamping=!0,this.controls.dampingFactor=.08,this.controls.target.set(0,0,0),this.scene.add(new N(16777215,.15));let t=new m(16774368,.7);t.position.set(5,7,4),this.scene.add(t);let n=new m(7074006,.4);n.position.set(-6,2,-4),this.scene.add(n),this.latticeGroup=new e,this.scene.add(this.latticeGroup),this.rebuildLatticeBox(),this.rebuildObstacle();let r=new E(20,20,2039596,1315869);r.position.y=-this.latticeWorld().sy*.5-.01,this.scene.add(r);let i=this.renderer.backend.device;if(!i)console.error(`WebGPU device not available on renderer.backend.device`);else{this._gpuDevice=i;let{W:e,H:t,D:n}=K(this.config.N);this.lbm=new ce(i,e,t,n),this.lbm.uIn=this.config.uIn,this.lbm.visc=this.config.visc,this.lbm.aoaRad=this.config.aoaDeg*Math.PI/180,this.lbm.gravity=this.config.gravity,this.lbm.inletR=this.config.inletRadius,new Set([`sphere`,`cylinder`,`cone`,`wing`,`teapot`]).has(this.config.shapeId)&&this.lbm.setShape(this.config.shapeId),this.dye=new ue(i,e,t,n,()=>this.lbm.macrosTextureView),this.buildInjectPipeline(i);let r=this.canvas.getContext(`webgpu`),o=navigator.gpu.getPreferredCanvasFormat();this.volumeRenderer=new pe(i,o,()=>r.getCurrentTexture().createView()),this.volumeRenderer.setTextures(this.lbm.macrosTextureView,this.dye.currentView),this.particles=new me(i,o,()=>r.getCurrentTexture().createView(),()=>{let e=r.getCurrentTexture();return[e.width,e.height]}),this.particles.setMacrosTexture(this.lbm.macrosTextureView),this.particles.jetRadius=this.config.inletRadius,this.fluidSurface=new xe(i,o,()=>r.getCurrentTexture().createView(),()=>{let e=r.getCurrentTexture();return[e.width,e.height]},this.particles.getParticleBuffer(),this.particles.N),this.fluidSurface.setMacrosTexture(this.lbm.macrosTextureView),this.fluidSurface.setMaskBuffer(this.lbm.maskBuffer,K(this.config.N));let s=document.getElementById(`slice-canvas`);s&&(this.sliceViewer=new Oe(i,s),this.sliceViewer.setMacros(this.lbm.macrosTextureView)),this.dragCalc=new Me(i),this.dragCalc.setInputs(this.lbm.macrosTextureView,this.lbm.maskBuffer,K(this.config.N)),this.dragCalc.setUIn(this.config.uIn),this.dragCalc.setVisc(this.config.visc);let c=new a(1,1),u=new C({color:7074006,transparent:!0,opacity:.18,side:2,depthWrite:!1});this.sliceIndicator=new l(c,u),this.sliceIndicator.visible=!1,this.scene.add(this.sliceIndicator),this.rebuildObstacle()}this.wireUI(),this.wireDragDrop(),window.addEventListener(`resize`,()=>this.handleResize()),this.running=!0,this.loop()}wireUI(){let e=e=>document.querySelector(e),t=e(`#sl-N`),n=e(`#val-N`),r=e(`#cells-hint`);t.value=String(this.config.N);let i=()=>{n.textContent=String(this.config.N);let{W:e,H:t,D:i}=K(this.config.N),a=e*t*i,o=Math.round(a*19*4*2/(1024*1024));r.textContent=`${e}×${t}×${i} = ${a.toLocaleString()} cells · ${o} MB f-buffers`};i(),t.addEventListener(`input`,()=>{this.config.N=parseInt(t.value,10),i()}),t.addEventListener(`change`,()=>{this.applyResolution()});let a=e(`#sl-speed`),o=e(`#val-speed`);a.value=String(this.config.uIn),o.textContent=this.config.uIn.toFixed(3),a.addEventListener(`input`,()=>{this.config.uIn=parseFloat(a.value),o.textContent=this.config.uIn.toFixed(3),this.lbm&&(this.lbm.uIn=this.config.uIn),this.dragCalc?.setUIn(this.config.uIn),this.refreshReHud()});let s=e(`#sl-visc`),c=e(`#val-visc`);s.value=String(this.config.visc),c.textContent=this.config.visc.toFixed(4),s.addEventListener(`input`,()=>{this.config.visc=parseFloat(s.value),c.textContent=this.config.visc.toFixed(4),this.lbm&&(this.lbm.visc=this.config.visc),this.dragCalc?.setVisc(this.config.visc),this.refreshReHud()});let l=e(`#sl-aoa`),u=e(`#val-aoa`);l.value=String(this.config.aoaDeg),u.textContent=`${this.config.aoaDeg}°`,l.addEventListener(`input`,()=>{this.config.aoaDeg=parseFloat(l.value),u.textContent=`${this.config.aoaDeg}°`,this.lbm&&(this.lbm.aoaRad=this.config.aoaDeg*Math.PI/180)});let d=e(`#sl-inlet`),f=e(`#val-inlet`);d.value=String(this.config.inletRadius),f.textContent=`${Math.round(this.config.inletRadius*100)}%`,d.addEventListener(`input`,()=>{this.config.inletRadius=parseFloat(d.value),f.textContent=`${Math.round(this.config.inletRadius*100)}%`,this.lbm&&(this.lbm.inletR=this.config.inletRadius),this.particles&&(this.particles.jetRadius=this.config.inletRadius)});let p=e(`#sl-ball`),m=e(`#val-ball`);p.value=String(this.config.ballSize),m.textContent=`${this.config.ballSize.toFixed(2)}×`,p.addEventListener(`input`,()=>{this.config.ballSize=parseFloat(p.value),m.textContent=`${this.config.ballSize.toFixed(2)}×`});let g=e(`#sl-speed-mul`),_=e(`#val-speed-mul`);g.value=String(this.config.simSpeed),_.textContent=`${this.config.simSpeed.toFixed(2)}×`,g.addEventListener(`input`,()=>{this.config.simSpeed=parseFloat(g.value),_.textContent=`${this.config.simSpeed.toFixed(2)}×`});let v=e(`#shape-select`),y=e(`#shape-remote-group`);for(let e of ie){let t=document.createElement(`option`);t.value=e.id,t.textContent=e.name,y.appendChild(t)}v.value=this.config.shapeId,v.addEventListener(`change`,()=>{this.config.shapeId=v.value,this.resetOrientationUI(),this.rebuildObstacle()});let b=e(`#sl-xfrac`),x=e(`#val-xfrac`);b.value=String(this.config.obstacleXFrac),x.textContent=`${Math.round(this.config.obstacleXFrac*100)}%`,b.addEventListener(`input`,()=>{this.config.obstacleXFrac=parseFloat(b.value),x.textContent=`${Math.round(this.config.obstacleXFrac*100)}%`,this.applyObstacleTransform()});let S=e(`#sl-scale`),C=e(`#val-scale`),w=e(`#sl-yaw`),T=e(`#val-yaw`),E=e(`#sl-pitch`),D=e(`#val-pitch`),O=e(`#sl-roll`),ee=e(`#val-roll`);S.value=String(this.config.scaleMul),w.value=String(this.config.yawDeg),E.value=String(this.config.pitchDeg),O.value=String(this.config.rollDeg),C.textContent=this.config.scaleMul.toFixed(2),T.textContent=`${this.config.yawDeg}°`,D.textContent=`${this.config.pitchDeg}°`,ee.textContent=`${this.config.rollDeg}°`;let k=()=>this.applyObstacleTransform();S.addEventListener(`input`,()=>{this.config.scaleMul=parseFloat(S.value),C.textContent=this.config.scaleMul.toFixed(2),k()}),w.addEventListener(`input`,()=>{this.config.yawDeg=parseFloat(w.value),T.textContent=`${this.config.yawDeg}°`,k()}),E.addEventListener(`input`,()=>{this.config.pitchDeg=parseFloat(E.value),D.textContent=`${this.config.pitchDeg}°`,k()}),O.addEventListener(`input`,()=>{this.config.rollDeg=parseFloat(O.value),ee.textContent=`${this.config.rollDeg}°`,k()}),e(`#btn-reset-orient`).addEventListener(`click`,()=>{this.resetOrientationUI(),k()}),e(`#btn-reset`).addEventListener(`click`,()=>{this.lbm?.resetFlow(),this.particles?.resetAllParticles(),this.simStepCount=0});let A=e(`#btn-play`),te=e(`#btn-step`),ne=()=>{A.textContent=this.config.paused?`▶ Play`:`⏸ Pause`,te.disabled=!this.config.paused};A.addEventListener(`click`,()=>{this.config.paused=!this.config.paused,ne()}),te.addEventListener(`click`,()=>{if(this.config.paused&&(this.lbm?.step(),this.dye?.step(),this.simStepCount++,this.particles&&this.lbm)){this.camera.updateMatrixWorld();let e=this.camera.matrixWorldInverse,t=this.camera.projectionMatrix,n=this.camera.position,{sx:r,sy:i,sz:a}=this.latticeWorld(),o=new h(-r*.5,-i*.5,-a*.5),s=new h(r*.5,i*.5,a*.5),{W:c,H:l,D:u}=K(this.config.N);this.particles.advectOnly(e,t,n,o,s,{W:c,H:l,D:u})}}),window.addEventListener(`keydown`,e=>{e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.key===` `&&(e.preventDefault(),this.config.paused=!this.config.paused,ne())});let j=e(`#btn-slowmo`),M=!1;j.addEventListener(`click`,()=>{M=!M,this.config.simSpeed=M?.25:1,g.value=String(this.config.simSpeed),_.textContent=`${this.config.simSpeed.toFixed(2)}×`,j.textContent=M?`Slow-mo: On`:`Slow-mo`,j.classList.toggle(`active`,M)});let N=e(`#sl-grav-x`),P=e(`#sl-grav-y`),F=e(`#sl-grav-z`),re=e(`#val-grav-x`),I=e(`#val-grav-y`),L=e(`#val-grav-z`),R=()=>{this.config.gravity=[parseFloat(N.value),parseFloat(P.value),parseFloat(F.value)],re.textContent=this.config.gravity[0].toFixed(5),I.textContent=this.config.gravity[1].toFixed(5),L.textContent=this.config.gravity[2].toFixed(5),this.lbm&&(this.lbm.gravity=this.config.gravity)};N.addEventListener(`input`,R),P.addEventListener(`input`,R),F.addEventListener(`input`,R);let z=e(`#btn-mrt`);z.addEventListener(`click`,()=>{this.config.useMRT=!this.config.useMRT,this.lbm&&(this.lbm.useMRT=+!!this.config.useMRT),z.textContent=this.config.useMRT?`Collision: TRT`:`Collision: BGK`,z.classList.toggle(`active`,this.config.useMRT)});let B=e(`#btn-les`);B.addEventListener(`click`,()=>{this.config.useLES=!this.config.useLES,this.lbm&&(this.lbm.useLES=+!!this.config.useLES),B.textContent=this.config.useLES?`Turbulence: LES`:`Turbulence: Off`,B.classList.toggle(`active`,this.config.useLES)});let V=e(`#btn-slip`);V.addEventListener(`click`,()=>{this.config.freeSlip=!this.config.freeSlip,this.lbm&&(this.lbm.freeSlip=+!!this.config.freeSlip),V.textContent=this.config.freeSlip?`Walls: Free-slip`:`Walls: No-slip`,V.classList.toggle(`active`,this.config.freeSlip)});let H=e(`#btn-inject`),U=e(`#btn-inject-mode`);H.addEventListener(`click`,()=>{this._injectActive=!this._injectActive,H.textContent=this._injectActive?`Inject: On`:`Inject: Off`,H.classList.toggle(`active`,this._injectActive),U.disabled=!this._injectActive,this.controls&&(this.controls.enabled=!this._injectActive)}),U.addEventListener(`click`,()=>{this._injectMode=this._injectMode===`impulse`?`dye`:`impulse`,U.textContent=`Mode: ${this._injectMode===`impulse`?`Impulse`:`Dye`}`}),this.wireInject();let W=e(`#btn-slice`),G=e(`#sel-slice-axis`),q=e(`#sel-slice-field`),J=e(`#sl-slice-pos`),ae=e(`#val-slice-pos`),Y=document.getElementById(`slice-overlay`),X=e(`#slice-title-text`),oe=e(`#slice-legend-lo`),se=e(`#slice-legend-hi`),Z=()=>{ae.textContent=parseFloat(J.value).toFixed(2),X.textContent=`${G.value.toUpperCase()}-slice · ${q.value[0].toUpperCase()+q.value.slice(1)}`;let[e,t]={velocity:[`0`,`0.10`],pressure:[`0`,`0.04`],vorticity:[`0`,`0.033`]}[q.value];oe.textContent=e,se.textContent=t},ce=e(`#cb-slice-mask`),Q=()=>{if(!this.sliceViewer)return;let e=G.value,t=parseFloat(J.value);this.sliceViewer.setConfig(e,t,q.value),Z(),this.updateSliceIndicator(e,t);let n=e===`x`?0:e===`y`?1:2;this.fluidSurface?.setSliceMask(n,t,ce.checked,.04)};ce.addEventListener(`change`,Q),W.addEventListener(`click`,()=>{this.sliceActive=!this.sliceActive,W.textContent=this.sliceActive?`Slice: On`:`Slice: Off`,W.classList.toggle(`active`,this.sliceActive),Y&&(this.sliceActive?Y.removeAttribute(`hidden`):Y.setAttribute(`hidden`,``)),this.sliceIndicator&&(this.sliceIndicator.visible=this.sliceActive)}),G.addEventListener(`change`,Q),q.addEventListener(`change`,Q),J.addEventListener(`input`,Q),Q(),this.refreshReHud()}applyResolution(){if(!this.lbm||!this._gpuDevice)return;let{W:e,H:t,D:n}=K(this.config.N);this.lbm.resize(e,t,n),this.dye&&this.dye.dispose?.(),this.dye=new ue(this._gpuDevice,e,t,n,()=>this.lbm.macrosTextureView),this.dye.injectAmount=this.config.dyeAmount,this.volumeRenderer?.setTextures(this.lbm.macrosTextureView,this.dye.currentView),this.particles?.setMacrosTexture(this.lbm.macrosTextureView),this.fluidSurface?.setMacrosTexture(this.lbm.macrosTextureView),this.fluidSurface?.setMaskBuffer(this.lbm.maskBuffer,{W:e,H:t,D:n}),this.sliceViewer?.setMacros(this.lbm.macrosTextureView),this.dragCalc?.setInputs(this.lbm.macrosTextureView,this.lbm.maskBuffer,{W:e,H:t,D:n}),this.rebuildLatticeBox(),this.rebuildObstacle(),this.simStepCount=0,this.refreshReHud()}refreshReHud(){let e=q(this.config.uIn,this.config.visc,this.config.N),t=document.getElementById(`val-re`),n=document.getElementById(`rd-rey`);t&&(t.textContent=e.toFixed(0)),n&&(n.textContent=e.toFixed(0))}latticeWorld(){let{W:e,H:t,D:n}=K(this.config.N),r=10/e;return{sx:e*r,sy:t*r,sz:n*r,cell:r}}rebuildLatticeBox(){for(;this.latticeGroup.children.length;){let e=this.latticeGroup.children.pop();e.geometry?.dispose?.(),e.material?.dispose?.()}let{sx:e,sy:t,sz:n}=this.latticeWorld(),r=new v(e,t,n),o=new i(r),s=new O({transparent:!0,opacity:.45});s.color=new p(7074006);let c=new T(o,s);this.latticeGroup.add(c),r.dispose();let u=new a(n,t),d=new C({transparent:!0,opacity:.06,side:2});d.color=new p(16743129);let f=new l(u,d);f.position.set(-e*.5,0,0),f.rotation.y=Math.PI*.5,this.latticeGroup.add(f)}disposeMeshOrGroup(t){t instanceof e?t.traverse(e=>{e instanceof l&&(e.geometry?.dispose(),e.material?.dispose())}):(t.geometry?.dispose(),t.material?.dispose())}updateSliceIndicator(e,t){if(!this.sliceIndicator)return;let{sx:n,sy:r,sz:i}=this.latticeWorld(),a=this.sliceIndicator;e===`x`?(a.scale.set(i,r,1),a.rotation.set(0,Math.PI/2,0),a.position.set(-n*.5+n*t,0,0)):e===`y`?(a.scale.set(n,i,1),a.rotation.set(-Math.PI/2,0,0),a.position.set(0,-r*.5+r*t,0)):(a.scale.set(n,r,1),a.rotation.set(0,0,0),a.position.set(0,0,-i*.5+i*t))}setMeshLayer(e,t){if(e.layers.set(t),e.children)for(let n of e.children)this.setMeshLayer(n,t)}makeMat(){let e=y(D(b,A(-1,0,0)),0,1),t=A(.06,.18,.55),n=A(.1,.85,.85),r=A(.3,.95,.3),i=A(1,.85,.1),a=A(1,.3,.1),o=(e,t,n)=>M(t,n,e),s=x(0,.25,e),c=x(.25,.55,e),l=x(.55,.8,e),u=x(.8,1,e),d=o(s,t,n);d=o(c,d,r),d=o(l,d,i),d=o(u,d,a);let f=new S({roughness:.42,metalness:.08});return f.colorNode=d,f.emissiveNode=d.mul(.35),f}resetOrientationUI(){this.config.yawDeg=0,this.config.pitchDeg=0,this.config.rollDeg=0,this.config.scaleMul=1;let e=(e,t,n)=>{let r=document.getElementById(e),i=document.getElementById(`val-${e.slice(3)}`);r&&(r.value=t),i&&(i.textContent=n)};e(`sl-yaw`,`0`,`0°`),e(`sl-pitch`,`0`,`0°`),e(`sl-roll`,`0`,`0°`),e(`sl-scale`,`1`,`1.00`)}applyObstacleTransform(){if(!this.obstacleMesh)return;let e=this.obstacleMesh,t=e=>e*Math.PI/180,{sx:n}=this.latticeWorld();e.position.set(-n*.5+n*this.config.obstacleXFrac,0,0),e.rotation.set(t(this.config.rollDeg),t(this.config.yawDeg),t(this.config.pitchDeg)),e.scale.setScalar(Math.max(.01,this.config.scaleMul)),e.updateMatrixWorld(!0),this.orientDebounceId!==null&&clearTimeout(this.orientDebounceId),this.orientDebounceId=setTimeout(()=>{this.orientDebounceId=null,this.uploadObstacleToFluidSurface()},100)}rebuildObstacle(){this.obstacleMesh&&(this.scene.remove(this.obstacleMesh),this.disposeMeshOrGroup(this.obstacleMesh),this.obstacleMesh=null);let{sx:e,sy:i}=this.latticeWorld(),a=-e*.5+e*this.config.obstacleXFrac,o=i*.18,s=i*.42;switch(this.config.shapeId){case`cylinder`:{let e=new P(o,o,i*.85,48);this.obstacleMesh=new l(e,this.makeMat());break}case`cone`:{let e=new l(new n(o,2*s,32),this.makeMat());e.rotation.z=Math.PI/2,this.obstacleMesh=e;break}case`wing`:{let e=new f,n=[],i=[];for(let e=0;e<=32;e++){let r=e/32,a=5*.12*(.2969*Math.sqrt(Math.max(0,r))-.126*r-.3516*r*r+.2843*r*r*r-.1015*r*r*r*r),o=(r-.5)*2*s,c=a*s*.5;n.push(new t(o,c)),i.push(new t(o,-c))}e.moveTo(n[0].x,n[0].y);for(let t=1;t<n.length;t++)e.lineTo(n[t].x,n[t].y);for(let t=i.length-1;t>=0;t--)e.lineTo(i[t].x,i[t].y);e.closePath();let a=new r(e,{depth:s*3,bevelEnabled:!1});a.translate(0,0,-s*1.5);let o=new l(a,this.makeMat());this.obstacleMesh=o;break}case`teapot`:{let e=new k(o,12);this.obstacleMesh=new l(e,this.makeMat());break}case`sphere`:{let e=new I(o,48,32);this.obstacleMesh=new l(e,this.makeMat());break}default:{let e=z(this.config.shapeId);if(e){let t=new l(new I(o*.5,16,8),this.makeMat());this.obstacleMesh=t,this.kickRemoteModelLoad(e,o,s)}else{let e=new I(o,48,32);this.obstacleMesh=new l(e,this.makeMat())}break}}this.obstacleMesh.position.set(a,0,0);let c=e=>e*Math.PI/180;this.obstacleMesh.rotation.set(c(this.config.rollDeg),c(this.config.yawDeg),c(this.config.pitchDeg)),this.obstacleMesh.scale.setScalar(Math.max(.01,this.config.scaleMul)),this.scene.add(this.obstacleMesh);let u=z(this.config.shapeId)?.elongated===!0,d=this.config.shapeId===`cone`||this.config.shapeId===`wing`||this.config.shapeId===`cylinder`||u?s:o;this.particles?.setObstacle({x:a,y:0,z:0},d),this.fluidSurface?.setObstacle({x:a,y:0,z:0},d),this.particles?.resetAllParticles(),this.uploadObstacleToFluidSurface(),this.obstacleMesh.visible=!1}kickRemoteModelLoad(e,t,n){let r=e.id;$(`Loading ${e.name} (~${(e.sizeKB/1024).toFixed(1)} MB)…`),U(e.url).then(t=>{if(this.config.shapeId!==r)return;let i=n*1.1;if(t.applyMatrix4(new c().makeScale(i,i,i)),e.yawRad&&t.applyMatrix4(new c().makeRotationY(e.yawRad)),t.computeVertexNormals(),this.obstacleMesh){let e=this.obstacleMesh.position.x;this.scene.remove(this.obstacleMesh),this.disposeMeshOrGroup(this.obstacleMesh);let n=new l(t,this.makeMat());n.position.set(e,0,0);let r=e=>e*Math.PI/180;n.rotation.set(r(this.config.rollDeg),r(this.config.yawDeg),r(this.config.pitchDeg)),n.scale.setScalar(Math.max(.01,this.config.scaleMul)),this.obstacleMesh=n,this.scene.add(this.obstacleMesh),this.uploadObstacleToFluidSurface(),this.particles?.resetAllParticles(),this.obstacleMesh.visible=!1}$(`${e.name} loaded`)}).catch(t=>{console.warn(`remote model load failed`,t),$(`Failed to load ${e.name}`)})}uploadObstacleToFluidSurface(){if(!this.obstacleMesh||!this.fluidSurface)return;let e=[];if(this.obstacleMesh.updateMatrixWorld(!0),this.obstacleMesh.traverse(t=>{let n=t;if(!n.isMesh||!n.geometry)return;let r=n.geometry.clone();r.computeVertexNormals();let i=new c().copy(n.matrixWorld).premultiply(new c().copy(this.obstacleMesh.matrixWorld).invert());r.applyMatrix4(i),e.push(r)}),e.length===0)return;let t=e.length===1?e[0]:_(e,!1);if(!t)return;let n=t.attributes.position,r=t.attributes.normal,i=t.index,a=n.count,o=new Float32Array(a*6);for(let e=0;e<a;e++)o[e*6+0]=n.getX(e),o[e*6+1]=n.getY(e),o[e*6+2]=n.getZ(e),o[e*6+3]=r.getX(e),o[e*6+4]=r.getY(e),o[e*6+5]=r.getZ(e);let s=i?new Uint32Array(i.array):null;if(this.fluidSurface.setObstacleGeometry(o,s),this.lbm){let e=t.clone();e.applyMatrix4(this.obstacleMesh.matrixWorld);let{sx:n,sy:r,sz:i}=this.latticeWorld(),a=new h(-n*.5,-r*.5,-i*.5),o=new h(n,r,i),{W:s,H:c,D:l}=K(this.config.N),u=R(e,{W:s,H:c,D:l},a,o);this.lbm.setMaskBuffer(u);let d=0;for(let e=0;e<c;e++)for(let t=0;t<l;t++)for(let n=0;n<s;n++)if(u[n+e*s+t*s*c]===1){d++;break}this.dragCalc?.setFrontalArea(d),e.dispose()}for(let t of e)t.dispose();e.length>1&&t!==e[0]&&t.dispose()}wireDragDrop(){let e=document.getElementById(`drop-overlay`);this.canvas.addEventListener(`dragover`,t=>{t.preventDefault(),e.hidden=!1}),this.canvas.addEventListener(`dragleave`,()=>{e.hidden=!0}),this.canvas.addEventListener(`drop`,async t=>{t.preventDefault(),e.hidden=!0;let n=t.dataTransfer?.files[0];if(!n)return;let r=n.name.split(`.`).pop()?.toLowerCase();if(r!==`glb`&&r!==`obj`){$(`Only .glb and .obj files are supported`);return}$(`Loading mesh…`);try{let e=null;if(r===`glb`){let t=new w,r=await n.arrayBuffer();(await new Promise((e,n)=>{t.parse(r,``,e,n)})).scene.traverse(t=>{!e&&t instanceof l&&(e=t.geometry.clone())})}else{let t=new te,r=await n.text();t.parse(r).traverse(t=>{!e&&t instanceof l&&(e=t.geometry.clone())})}if(!e){$(`No mesh found in file`);return}if($(`Voxelizing…`),!this.lbm)return;let{W:t,H:i,D:a}={W:this.lbm.W,H:this.lbm.H,D:this.lbm.D},o=await Ne(e,t,i,a);this.lbm.setMaskBuffer(o),this.obstacleMesh&&(this.scene.remove(this.obstacleMesh),this.disposeMeshOrGroup(this.obstacleMesh),this.obstacleMesh=null);let{sx:s}=this.latticeWorld(),c=new l(e,this.makeMat());c.position.set(-s*.5+s*this.config.obstacleXFrac,0,0),this.obstacleMesh=c,this.scene.add(this.obstacleMesh);let u=document.getElementById(`shape-select`),d=u.querySelector(`option[value="custom"]`);d&&(d.disabled=!1,u.value=`custom`),$(`Upload complete`)}catch(e){console.error(`Upload failed`,e),$(`Upload failed — see console`)}})}setShape(e){this.config.shapeId=e,this.rebuildObstacle()}setResolution(e){this.config.N=Math.max(16,Math.min(256,Math.round(e))),this.rebuildLatticeBox(),this.rebuildObstacle()}stop(){this.running=!1,cancelAnimationFrame(this.rafId)}handleResize(){let e=this.canvas.clientWidth,t=this.canvas.clientHeight;this.renderer?.setSize(e,t,!1),this.camera&&(this.camera.aspect=e/Math.max(1,t),this.camera.updateProjectionMatrix())}buildInjectPipeline(e){this._injectBindGroupLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});let t=e.createShaderModule({code:Pe,label:`inject.wgsl`});this._injectPipeline=e.createComputePipeline({layout:e.createPipelineLayout({bindGroupLayouts:[this._injectBindGroupLayout]}),compute:{module:t,entryPoint:`cs_inject`}}),this._injectParamsBuf=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}dispatchInject(e,t,n){if(!this.lbm||!this._injectPipeline||!this._injectParamsBuf||!this._injectBindGroupLayout)return;let r=this._gpuDevice;if(!r)return;let i=Math.max(3,Math.round(this.lbm.H*.06)),a=+(this._injectMode===`impulse`),o=new ArrayBuffer(48),s=new Float32Array(o),c=new Uint32Array(o);s[0]=e,s[1]=t,s[2]=n,s[3]=i,s[4]=.2,s[5]=0,s[6]=0,c[7]=a,c[8]=this.lbm.W,c[9]=this.lbm.H,c[10]=this.lbm.D,c[11]=0,r.queue.writeBuffer(this._injectParamsBuf,0,o);let l=this.lbm.currentFBuffer,u=r.createBindGroup({layout:this._injectBindGroupLayout,entries:[{binding:0,resource:{buffer:this._injectParamsBuf}},{binding:1,resource:{buffer:l}}]}),d=r.createCommandEncoder({label:`inject`}),f=d.beginComputePass();f.setPipeline(this._injectPipeline),f.setBindGroup(0,u),f.dispatchWorkgroups(Math.ceil(this.lbm.W/4),Math.ceil(this.lbm.H/4),Math.ceil(this.lbm.D/4)),f.end(),r.queue.submit([d.finish()])}wireInject(){let e=this.canvas,n=!1,r=(n,r)=>{if(!this.lbm)return null;let i=e.getBoundingClientRect(),a=(n-i.left)/i.width*2-1,s=-((r-i.top)/i.height)*2+1,c=new o;c.setFromCamera(new t(a,s),this.camera);let{sx:l,sy:u,sz:d}=this.latticeWorld(),f=new re(new h(-l*.5,-u*.5,-d*.5),new h(l*.5,u*.5,d*.5)),p=new h;if(!c.ray.intersectBox(f,p))return null;let m=Math.round((p.x+l*.5)/l*(this.lbm.W-1)),g=Math.round((p.y+u*.5)/u*(this.lbm.H-1)),_=Math.round((p.z+d*.5)/d*(this.lbm.D-1));return[Math.max(0,Math.min(this.lbm.W-1,m)),Math.max(0,Math.min(this.lbm.H-1,g)),Math.max(0,Math.min(this.lbm.D-1,_))]};e.addEventListener(`pointerdown`,e=>{if(!this._injectActive)return;n=!0;let t=r(e.clientX,e.clientY);t&&this.dispatchInject(...t)}),e.addEventListener(`pointermove`,e=>{if(!this._injectActive||!n)return;let t=r(e.clientX,e.clientY);t&&this.dispatchInject(...t)}),e.addEventListener(`pointerup`,()=>{n=!1}),e.addEventListener(`pointerleave`,()=>{n=!1})}};export{Fe as App};