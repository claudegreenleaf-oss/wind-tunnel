/**
 * Streamline renderer — RK4 advection of seed points through the LBM velocity
 * field, rendered as coloured line-strip ribbons.
 *
 * Architecture:
 *   - Compute pass: RK4 advects N_SEEDS particles; each particle writes one
 *     vertex into a ring-buffer of TRACE_LEN positions + speed values.
 *   - Render pass: draws each trace as a line-strip; vertex colour mapped to
 *     local speed through the turbo ramp.
 *
 * The ring-buffer layout is: [TRACE_LEN × N_SEEDS] vertices, stride 4 f32s
 * (x, y, z, speed). Each seed occupies TRACE_LEN consecutive vertices.
 * Every compute dispatch advances a global head pointer by 1, writing the
 * newest sample at [seed * TRACE_LEN + (head % TRACE_LEN)].
 *
 * Render reads the ring buffer starting from (head+1) % TRACE_LEN so it draws
 * oldest → newest (tail → head) — a continuous snake that fades as older
 * vertices get overwritten.
 */

import * as THREE from 'three';

const TRACE_LEN = 220;     // full inlet→outlet ribbon
const N_SEEDS   = 120;     // 10×12 grid on a single inlet plane (AirShaper-style)

// ─── Compute shader ──────────────────────────────────────────────────────────

const COMPUTE_WGSL = /* wgsl */`
struct Uniforms {
  aabbMin   : vec4<f32>,
  aabbMax   : vec4<f32>,
  dims      : vec4<u32>,    // W, H, D, head (ring-buffer write pointer)
  dt        : f32,
  _pad0     : f32,
  _pad1     : f32,
  _pad2     : f32,
}

// Output: TRACE_LEN * N_SEEDS vertices, each is (x, y, z, speed)
struct Vertex {
  pos   : vec3<f32>,
  speed : f32,
}

@group(0) @binding(0) var<uniform>        u        : Uniforms;
@group(0) @binding(1) var                 macrosTex: texture_3d<f32>;
@group(0) @binding(2) var                 samp     : sampler;
@group(0) @binding(3) var<storage, read_write> verts : array<Vertex>;

// Seed table — read-only once written at init; we never reset seeds, just
// keep advecting so the lines perpetually snake downstream and reseed at inlet.
@group(0) @binding(4) var<storage, read_write> seeds : array<vec4<f32>>;

const TRACE_LEN : u32 = ${TRACE_LEN}u;
const N_SEEDS   : u32 = ${N_SEEDS}u;

// Sample velocity from the macros texture. macros layout: (ux, uy, uz, rho)
// stored in a 3D RGBA32F texture — same convention as dragCoeff/volume/slice.
fn sampleVelocity(worldPos : vec3<f32>) -> vec3<f32> {
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;
  let uv = (worldPos - u.aabbMin.xyz) / aabbSize;
  if any(uv < vec3(0.0)) || any(uv > vec3(1.0)) { return vec3(0.0); }
  let s = textureSampleLevel(macrosTex, samp, uv, 0.0);
  // LBM velocity is in cells-per-step. To advect in world coords we multiply
  // by (world-per-cell) = aabbSize.x / dims.x. With typical lattice u ≈ 0.1
  // and AABB side 1.0, dt=0.08 gives ~0.0001 world units / frame — far too
  // slow for a 64-step ribbon. Scale up so a streamline traverses ~half the
  // domain over its trace length.
  // Larger multiplier so each integration step covers ~1% of the domain in X.
  // With 220 steps that gives ~2x AABB coverage — every streamline reaches
  // the outlet boundary (and OOB-terminates there) even when flow slows in
  // the wake region.
  let wScale = aabbSize.x / f32(u.dims.x);
  return s.xyz * wScale * 140.0;
}

// RK4 step: advance worldPos by dt through velocity field.
fn rk4(pos : vec3<f32>, dt : f32) -> vec3<f32> {
  let k1 = sampleVelocity(pos);
  let k2 = sampleVelocity(pos + k1 * (dt * 0.5));
  let k3 = sampleVelocity(pos + k2 * (dt * 0.5));
  let k4 = sampleVelocity(pos + k3 * dt);
  return pos + (k1 + k2 * 2.0 + k3 * 2.0 + k4) * (dt / 6.0);
}

// PCG hash — cheap random for reseed.
fn pcg(v : u32) -> u32 {
  var s = v * 747796405u + 2891336453u;
  s = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (s >> 22u) ^ s;
}
fn rng(seed : u32) -> f32 { return f32(pcg(seed)) / 4294967296.0; }

// Each thread = one seed on the inlet plane. Integrate the FULL streamline
// from seed point downstream for TRACE_LEN RK4 steps; write all points into
// verts[idx*TRACE_LEN .. idx*TRACE_LEN + TRACE_LEN-1]. Re-run every frame so
// the streamlines update as the flow evolves.
@compute @workgroup_size(32)
fn cs_advect(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if idx >= N_SEEDS { return; }

  let dt = u.dt;
  let aabbSize = u.aabbMax.xyz - u.aabbMin.xyz;

  var pos = seeds[idx].xyz;
  var lastSpeed : f32 = 0.0;
  var terminated : bool = false;

  for (var k : u32 = 0u; k < TRACE_LEN; k = k + 1u) {
    let vel   = sampleVelocity(pos);
    let speed = length(vel);
    verts[idx * TRACE_LEN + k] = Vertex(pos, select(speed, lastSpeed, terminated));
    if !terminated {
      let nextPos = rk4(pos, dt);
      let uv = (nextPos - u.aabbMin.xyz) / aabbSize;
      let oob = any(uv < vec3(0.0)) || any(uv > vec3(1.0));
      if oob || speed < 0.000001 {
        terminated = true;
      } else {
        pos = nextPos;
        lastSpeed = speed;
      }
    }
  }
}
`;

// ─── Render shader ───────────────────────────────────────────────────────────

const RENDER_WGSL = /* wgsl */`
struct Uniforms {
  viewProj  : mat4x4<f32>,
  speedMax  : f32,
  traceLen  : u32,
  nSeeds    : u32,
  head      : u32,
  aspect    : f32,    // viewport height / width
  width     : f32,    // ribbon half-width in NDC
  pad0      : f32,
  pad1      : f32,
}

struct Vertex {
  pos   : vec3<f32>,
  speed : f32,
}

@group(0) @binding(0) var<uniform>            u     : Uniforms;
@group(0) @binding(1) var<storage, read>      verts : array<Vertex>;

struct VertOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) col        : vec3<f32>,
  @location(1) alpha      : f32,
}

fn turbo(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  if tt < 0.2 { return mix(vec3(0.19, 0.07, 0.23), vec3(0.10, 0.40, 0.95), tt * 5.0); }
  if tt < 0.4 { return mix(vec3(0.10, 0.40, 0.95), vec3(0.10, 0.85, 0.85), (tt - 0.2) * 5.0); }
  if tt < 0.6 { return mix(vec3(0.10, 0.85, 0.85), vec3(0.30, 0.95, 0.30), (tt - 0.4) * 5.0); }
  if tt < 0.8 { return mix(vec3(0.30, 0.95, 0.30), vec3(0.98, 0.85, 0.10), (tt - 0.6) * 5.0); }
  return mix(vec3(0.98, 0.85, 0.10), vec3(1.00, 0.25, 0.10), (tt - 0.8) * 5.0);
}

// Triangle-list topology, 6 vertices per segment (2 triangles forming a quad).
// Vertex count per seed = (TRACE_LEN - 1) * 6.  Each segment uses two ring-buffer
// samples (k, k+1) and emits a screen-space ribbon offset perpendicular to the
// projected tangent.  This is the standard "screen-space line" technique —
// gives AirShaper-style thick colored streamlines instead of 1-pixel lines.
@vertex
fn vs_main(@builtin(vertex_index) vi : u32) -> VertOut {
  let traceLen  = u.traceLen;
  let segsPerSeed = traceLen - 1u;

  let segGlobal = vi / 6u;
  let inSeg     = vi % 6u;
  let seedIdx   = segGlobal / segsPerSeed;
  let segInSeed = segGlobal % segsPerSeed;

  // Two-triangle quad per segment: (k,-)(k,+)(k+1,-) and (k,+)(k+1,-)(k+1,+).
  // endpoint = 1 means use sample k+1; side = +1/-1 picks the offset side.
  var endpoint : u32 = 0u;
  var side     : f32 = -1.0;
  if (inSeg == 1u) { endpoint = 0u; side =  1.0; }
  else if (inSeg == 2u) { endpoint = 1u; side = -1.0; }
  else if (inSeg == 3u) { endpoint = 0u; side =  1.0; }
  else if (inSeg == 4u) { endpoint = 1u; side = -1.0; }
  else if (inSeg == 5u) { endpoint = 1u; side =  1.0; }

  let bufIdxA = seedIdx * traceLen + segInSeed;
  let bufIdxB = bufIdxA + 1u;
  let vA = verts[bufIdxA];
  let vB = verts[bufIdxB];
  let usePos   = select(vA.pos,   vB.pos,   endpoint == 1u);
  let useSpeed = select(vA.speed, vB.speed, endpoint == 1u);

  // Project both endpoints to clip; compute tangent in aspect-corrected NDC
  // (y * aspect so 1 NDC unit on x and y span the same number of pixels).
  let clipA = u.viewProj * vec4f(vA.pos, 1.0);
  let clipB = u.viewProj * vec4f(vB.pos, 1.0);
  let ndcA  = clipA.xy / clipA.w;
  let ndcB  = clipB.xy / clipB.w;
  let pixA  = vec2f(ndcA.x, ndcA.y * u.aspect);
  let pixB  = vec2f(ndcB.x, ndcB.y * u.aspect);
  var t_pix = pixB - pixA;
  let tlen  = max(length(t_pix), 1e-5);
  t_pix     = t_pix / tlen;
  // Unit-length perpendicular in pixel space.
  let perp_pix = vec2f(-t_pix.y, t_pix.x);
  // Convert offset back to NDC (un-correct y).
  let offset_ndc = vec2f(perp_pix.x, perp_pix.y / u.aspect) * side * u.width;

  let clipUse = u.viewProj * vec4f(usePos, 1.0);
  let offset  = offset_ndc * clipUse.w;

  var out : VertOut;
  out.clip  = vec4f(clipUse.x + offset.x, clipUse.y + offset.y, clipUse.z, clipUse.w);
  let speedN = clamp(useSpeed / u.speedMax, 0.0, 1.0);
  out.col    = turbo(speedN);
  // Slight tail fade so the start of each streamline is a little softer than
  // the head, but no big age dropoff — full streamline is always visible.
  let frac   = (f32(segInSeed) + f32(endpoint)) / f32(segsPerSeed);
  out.alpha  = 0.45 + 0.55 * smoothstep(0.0, 0.25, frac);
  return out;
}

@fragment
fn fs_main(in : VertOut) -> @location(0) vec4<f32> {
  return vec4(in.col * in.alpha, in.alpha);
}
`;

// ─── StreamlineRenderer class ─────────────────────────────────────────────────

export class StreamlineRenderer {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;
  private getCanvasView: () => GPUTextureView;
  private getCanvasSize: () => [number, number];

  readonly TRACE_LEN = TRACE_LEN;
  readonly N_SEEDS   = N_SEEDS;

  /** Inlet circle (single, centred-by-default). Fractions of the AABB. */
  private inletConfig: { yFrac: number; zFrac: number; radius: number } = {
    yFrac: 0.5, zFrac: 0.5, radius: 0.12,
  };

  setInletConfig(yFrac: number, zFrac: number, radius: number) {
    this.inletConfig = { yFrac, zFrac, radius };
    this.seeded = false;   // reseed next frame
  }

  /** Half-width of the ribbons in NDC units. ~0.0025 = ~4 px on a 1600-px viewport. */
  private ribbonWidth = 0.0025;
  setRibbonWidth(w: number) { this.ribbonWidth = Math.max(0.0001, w); }

  // GPU buffers
  private vertBuf!: GPUBuffer;   // TRACE_LEN * N_SEEDS * 4 f32s
  private seedBuf!: GPUBuffer;   // N_SEEDS * 4 f32s (current position)
  private computeUniBuf!: GPUBuffer;
  private renderUniBuf!: GPUBuffer;
  private sampler!: GPUSampler;

  // Pipelines
  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private computeBgl!: GPUBindGroupLayout;
  private renderBgl!: GPUBindGroupLayout;
  private computeBG: GPUBindGroup | null = null;
  private renderBG: GPUBindGroup | null = null;

  // Depth target (created/resized on demand)
  private depthTex: GPUTexture | null = null;
  private depthW = 0;
  private depthH = 0;

  private macrosView: GPUTextureView | null = null;
  private head = 0;
  private seeded = false;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    getCanvasView: () => GPUTextureView,
    getCanvasSize: () => [number, number],
  ) {
    this.device        = device;
    this.canvasFormat  = canvasFormat;
    this.getCanvasView = getCanvasView;
    this.getCanvasSize = getCanvasSize;

    this.buildBuffers();
    this.buildPipelines();
  }

  setMacrosTexture(view: GPUTextureView) {
    this.macrosView = view;
    this.computeBG  = null; // invalidate
    this.renderBG   = null;
    this.rebuildBindGroups();
  }

  /** Polar grid of seed points filling the active inlet circle at the inflow
   *  face. Every streamline starts where flow actually enters the domain. */
  private initSeeds(aabbMin: THREE.Vector3, aabbMax: THREE.Vector3) {
    const data = new Float32Array(N_SEEDS * 4);
    const aabbSize = new THREE.Vector3().subVectors(aabbMax, aabbMin);
    const inlet = this.inletConfig;
    // Inlet plane: just inside the inflow face so the seeds aren't exactly on
    // the boundary (where wall handling could zero them out).
    const xPlane = aabbMin.x + aabbSize.x * 0.005;
    const cy = aabbMin.y + aabbSize.y * inlet.yFrac;
    const cz = aabbMin.z + aabbSize.z * inlet.zFrac;
    // Inlet radius in world units: smaller of the two transverse half-spans
    // so a 50 % "radius" still fits in a non-square AABB.
    const inletR = inlet.radius * Math.min(aabbSize.y, aabbSize.z);
    // Polar grid: rings × spokes ≈ N_SEEDS, spokes scale with ring radius
    // (Fibonacci-ish lattice for even coverage).
    let i = 0;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < N_SEEDS; k++) {
      // r ∈ [0, inletR] using sqrt for uniform area density
      const r = inletR * Math.sqrt((k + 0.5) / N_SEEDS);
      const theta = k * golden;
      const dy = r * Math.cos(theta);
      const dz = r * Math.sin(theta);
      data[i * 4 + 0] = xPlane;
      data[i * 4 + 1] = cy + dy;
      data[i * 4 + 2] = cz + dz;
      data[i * 4 + 3] = 0;
      i++;
    }
    // Pre-fill the verts buffer with the seed position so the first frame's
    // render doesn't show stray (0,0,0) lines while cs_advect catches up.
    const ring = new Float32Array(TRACE_LEN * N_SEEDS * 4);
    for (let s = 0; s < N_SEEDS; s++) {
      for (let t = 0; t < TRACE_LEN; t++) {
        const o = (s * TRACE_LEN + t) * 4;
        ring[o + 0] = data[s * 4 + 0]!;
        ring[o + 1] = data[s * 4 + 1]!;
        ring[o + 2] = data[s * 4 + 2]!;
        ring[o + 3] = 0;
      }
    }
    this.device.queue.writeBuffer(this.seedBuf, 0, data);
    this.device.queue.writeBuffer(this.vertBuf, 0, ring);
    this.head   = 0;
    this.seeded = true;
  }

  private buildBuffers() {
    const vertBytes = TRACE_LEN * N_SEEDS * 4 * 4; // 4 f32 per vertex
    this.vertBuf = this.device.createBuffer({
      size:  vertBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'streamline-verts',
    });
    this.seedBuf = this.device.createBuffer({
      size:  N_SEEDS * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'streamline-seeds',
    });
    this.computeUniBuf = this.device.createBuffer({
      // 3×vec4 (48) + f32 dt with 16-byte WGSL alignment padding = 64
      size:  64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'streamline-compute-uni',
    });
    this.renderUniBuf = this.device.createBuffer({
      size:  96,  // mat4(64) + 4×u32(16) + aspect/width/2 pad(16)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'streamline-render-uni',
    });
    this.sampler = this.device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge',
    });
  }

  private buildPipelines() {
    // Compute BGL
    this.computeBgl = this.device.createBindGroupLayout({
      label: 'streamline-compute-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    const compMod = this.device.createShaderModule({ code: COMPUTE_WGSL, label: 'streamline-compute' });
    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.computeBgl] }),
      compute: { module: compMod, entryPoint: 'cs_advect' },
      label: 'streamline-compute-pipeline',
    });

    // Render BGL
    this.renderBgl = this.device.createBindGroupLayout({
      label: 'streamline-render-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    const rendMod = this.device.createShaderModule({ code: RENDER_WGSL, label: 'streamline-render' });
    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.renderBgl] }),
      vertex:   { module: rendMod, entryPoint: 'vs_main' },
      fragment: {
        module:  rendMod,
        entryPoint: 'fs_main',
        targets: [{
          format: this.canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
      label: 'streamline-render-pipeline',
    });
  }

  private rebuildBindGroups() {
    if (!this.macrosView) return;
    this.computeBG = this.device.createBindGroup({
      layout: this.computeBgl,
      label:  'streamline-compute-bg',
      entries: [
        { binding: 0, resource: { buffer: this.computeUniBuf } },
        { binding: 1, resource: this.macrosView },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: this.vertBuf } },
        { binding: 4, resource: { buffer: this.seedBuf } },
      ],
    });
    this.renderBG = this.device.createBindGroup({
      layout: this.renderBgl,
      label:  'streamline-render-bg',
      entries: [
        { binding: 0, resource: { buffer: this.renderUniBuf } },
        { binding: 1, resource: { buffer: this.vertBuf } },
      ],
    });
  }

  private ensureDepth(w: number, h: number) {
    if (this.depthW === w && this.depthH === h && this.depthTex) return;
    this.depthTex?.destroy();
    this.depthTex = this.device.createTexture({
      size: [w, h],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      label: 'streamline-depth',
    });
    this.depthW = w;
    this.depthH = h;
  }

  render(
    viewMatrix: THREE.Matrix4,
    projMatrix: THREE.Matrix4,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    dims: { W: number; H: number; D: number },
    dt = 0.012,
  ) {
    if (!this.macrosView) return;
    if (!this.seeded) this.initSeeds(aabbMin, aabbMax);
    if (!this.computeBG || !this.renderBG) this.rebuildBindGroups();
    if (!this.computeBG || !this.renderBG) return;

    const [cw, ch] = this.getCanvasSize();
    this.ensureDepth(cw, ch);

    // ── Write compute uniforms (64 bytes: 3×vec4 + f32 padded to vec4) ──
    {
      const d = new Float32Array(16);
      d[0] = aabbMin.x; d[1] = aabbMin.y; d[2] = aabbMin.z; d[3] = 0;
      d[4] = aabbMax.x; d[5] = aabbMax.y; d[6] = aabbMax.z; d[7] = 0;
      const ui = new Uint32Array(d.buffer, 32, 4);
      ui[0] = dims.W; ui[1] = dims.H; ui[2] = dims.D; ui[3] = this.head;
      d[12] = dt; d[13] = 0; d[14] = 0; d[15] = 0;
      this.device.queue.writeBuffer(this.computeUniBuf, 0, d);
    }

    // ── Write render uniforms (96 bytes) ──
    {
      const viewProj = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);
      const rd = new Float32Array(24);
      rd.set(viewProj.elements, 0);          // viewProj: bytes 0-63
      rd[16] = 0.45;                         // speedMax — push the gradient warmer (cyan→yellow→red across the bulk flow)
      const ri = new Uint32Array(rd.buffer, 68, 3);
      ri[0] = TRACE_LEN;
      ri[1] = N_SEEDS;
      ri[2] = this.head;
      rd[20] = ch / Math.max(cw, 1);         // aspect (h/w)
      rd[21] = this.ribbonWidth;             // half-width in NDC
      this.device.queue.writeBuffer(this.renderUniBuf, 0, rd);
    }

    const enc = this.device.createCommandEncoder({ label: 'streamline-enc' });

    // Compute: advance all seeds (skip when paused)
    if (dt > 0) {
      const pass = enc.beginComputePass({ label: 'streamline-compute' });
      pass.setPipeline(this.computePipeline);
      pass.setBindGroup(0, this.computeBG);
      pass.dispatchWorkgroups(Math.ceil(N_SEEDS / 32));
      pass.end();
    }

    // Render: draw line strips
    {
      const canvasView = this.getCanvasView();
      const pass = enc.beginRenderPass({
        label: 'streamline-render',
        colorAttachments: [{
          view:     canvasView,
          loadOp:   'load',
          storeOp:  'store',
        }],
        depthStencilAttachment: {
          view:              this.depthTex!.createView(),
          depthLoadOp:       'clear',
          depthStoreOp:      'store',
          depthClearValue:   1.0,
        },
      });
      pass.setPipeline(this.renderPipeline);
      pass.setBindGroup(0, this.renderBG);

      // Single draw call: N_SEEDS × (TRACE_LEN-1) segments × 2 endpoints
      const totalVerts = N_SEEDS * (TRACE_LEN - 1) * 6;
      pass.draw(totalVerts);
      pass.end();
    }

    this.device.queue.submit([enc.finish()]);
    // No ring buffer — every frame recomputes the full streamline from each
    // seed, so there is no head pointer to advance.
  }

  resetSeeds(aabbMin: THREE.Vector3, aabbMax: THREE.Vector3) {
    this.initSeeds(aabbMin, aabbMax);
  }

  dispose() {
    this.vertBuf?.destroy();
    this.seedBuf?.destroy();
    this.computeUniBuf?.destroy();
    this.renderUniBuf?.destroy();
    this.depthTex?.destroy();
  }
}
