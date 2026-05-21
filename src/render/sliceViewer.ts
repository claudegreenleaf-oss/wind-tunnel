/**
 * Picture-in-picture slice viewer.
 *
 * Renders a 2D cross-section of the LBM macros 3D texture into its own
 * small canvas (overlay HTML element). The cross-section is defined by:
 *   axis  : 'x' | 'y' | 'z'   — which axis the slice is perpendicular to
 *   pos   : 0..1              — normalized position along that axis
 *   field : 'velocity' | 'pressure' | 'vorticity' — what to color by
 *
 * The slice canvas runs on the SAME WebGPU device as the main canvas, so
 * we can reuse the macros texture directly. Each frame the fragment shader
 * samples the appropriate lattice cell and applies a turbo colormap.
 */

import * as THREE from 'three';

export type SliceAxis = 'x' | 'y' | 'z';
export type SliceField = 'velocity' | 'pressure' | 'vorticity';

export class SliceViewer {
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private ctx: GPUCanvasContext;
  private format: GPUTextureFormat;

  private uniformBuf: GPUBuffer;
  private pipeline!: GPURenderPipeline;
  private bgl!: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null = null;
  private sampler: GPUSampler;

  private macrosView: GPUTextureView | null = null;

  // Slice config (mutated from app.ts via setConfig)
  axis: SliceAxis = 'y';
  pos = 0.5;
  field: SliceField = 'velocity';

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    this.ctx = canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({
      device, format: this.format,
      alphaMode: 'premultiplied',
    });

    this.sampler = device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge',
    });

    // Uniforms: axisField(vec4u) + posPad(vec4f) + aabbMin + aabbMax + dims
    //   5 × 16 = 80 bytes
    this.uniformBuf = device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.buildPipeline();
  }

  private buildPipeline() {
    this.bgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const mod = this.device.createShaderModule({ code: SLICE_WGSL, label: 'slice-viewer' });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl] }),
      vertex: { module: mod, entryPoint: 'vs_full' },
      fragment: {
        module: mod, entryPoint: 'fs_slice',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  setMacros(view: GPUTextureView) {
    this.macrosView = view;
    this.bindGroup = null;
  }

  setConfig(axis: SliceAxis, pos: number, field: SliceField) {
    this.axis = axis;
    this.pos = Math.max(0, Math.min(1, pos));
    this.field = field;
  }

  render(aabbMin: THREE.Vector3, aabbMax: THREE.Vector3, dims: { W: number; H: number; D: number }) {
    if (!this.macrosView) return;
    if (!this.bindGroup) {
      this.bindGroup = this.device.createBindGroup({
        layout: this.bgl,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: this.macrosView },
          { binding: 2, resource: { buffer: this.uniformBuf } },
        ],
      });
    }

    // Pack uniforms
    const axisIdx = this.axis === 'x' ? 0 : this.axis === 'y' ? 1 : 2;
    const fieldIdx = this.field === 'velocity' ? 0 : this.field === 'pressure' ? 1 : 2;
    const buf = new ArrayBuffer(80);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    // axisField (vec4u)
    u32[0] = axisIdx; u32[1] = fieldIdx; u32[2] = 0; u32[3] = 0;
    // posPad (vec4f)
    f32[4] = this.pos; f32[5] = 0; f32[6] = 0; f32[7] = 0;
    // aabbMin
    f32[8] = aabbMin.x; f32[9] = aabbMin.y; f32[10] = aabbMin.z; f32[11] = 0;
    // aabbMax
    f32[12] = aabbMax.x; f32[13] = aabbMax.y; f32[14] = aabbMax.z; f32[15] = 0;
    // dims
    f32[16] = dims.W; f32[17] = dims.H; f32[18] = dims.D; f32[19] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, buf);

    const enc = this.device.createCommandEncoder({ label: 'slice-viewer' });
    const rp = enc.beginRenderPass({
      colorAttachments: [{
        view: this.ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear', storeOp: 'store',
      }],
    });
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, this.bindGroup);
    rp.draw(6);
    rp.end();
    this.device.queue.submit([enc.finish()]);
  }

  dispose() {
    this.uniformBuf.destroy();
  }
}

const SLICE_WGSL = /* wgsl */`
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

  // Normalize per field. Pressure range bumped to 0.15 — density drift of
  // up to ~13% (ρ ~ 0.87) was clamping the field to solid red at the old 0.04 scale.
  var n = 0.0;
  if u.axisField.y == 0u {       n = v / 0.10; }
  else if u.axisField.y == 1u {  n = v / 0.15; }
  else {                         n = v * 30.0; }
  let col = turbo(n);

  return vec4f(col, 1.0);
}
`;
