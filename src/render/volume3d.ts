import * as THREE from 'three';

const VOLUME_VERT_WGSL = /* wgsl */`
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
`;

const VOLUME_FRAG_WGSL = /* wgsl */`
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
@group(0) @binding(0) var macrosTex   : texture_3d<f32>;
@group(0) @binding(1) var dyeTex      : texture_3d<f32>;
@group(0) @binding(2) var<uniform> u  : Uniforms;
@group(0) @binding(3) var linearSamp  : sampler;

struct FragIn {
  @builtin(position) pos : vec4<f32>,
  @location(0) worldPos  : vec3<f32>,
}

// Inferno-style ramp: deep blue → magenta → orange → yellow → white
fn inferno(t : f32) -> vec3<f32> {
  let tt = clamp(t, 0.0, 1.0);
  let c0 = vec3(0.04, 0.05, 0.20);
  let c1 = vec3(0.55, 0.06, 0.55);
  let c2 = vec3(1.00, 0.40, 0.30);
  let c3 = vec3(1.00, 0.92, 0.55);
  if tt < 0.33 { return mix(c0, c1, tt * 3.0); }
  if tt < 0.66 { return mix(c1, c2, (tt - 0.33) * 3.0); }
  return mix(c2, c3, (tt - 0.66) * 3.0);
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

  var accumColor = vec3(0.0);
  var transmit   = 1.0;

  for (var i = 0; i < nSteps; i++) {
    let tSample = tNear + (f32(i) + 0.5) * stepSize;
    let worldP  = ro + rd * tSample;
    let uvw     = (worldP - aMin) / aabbSize;

    if any(uvw < vec3(0.0)) || any(uvw > vec3(1.0)) { continue; }

    let macros  = textureSampleLevel(macrosTex, linearSamp, uvw, 0.0);
    let speed   = length(macros.xyz);
    let speedN  = clamp(speed / 0.18, 0.0, 1.0);
    let speedColor = inferno(speedN);

    let dye = textureSampleLevel(dyeTex, linearSamp, uvw, 0.0);
    let dyeIntensity = clamp(length(dye.rgb), 0.0, 1.5);

    // Per-step alpha kept small so dye-filled regions don't occlude the
    // rest of the volume; total opacity emerges from many small samples.
    let alpha = clamp(dyeIntensity * 0.08 + speedN * 0.025, 0.0, 0.35);

    // Color: dye glows, with a hint of speed-color where the flow is fast.
    let glow = dye.rgb * 1.5 + speedColor * speedN * 0.6;
    accumColor += transmit * alpha * glow;
    transmit   *= 1.0 - alpha;

    if transmit < 0.02 { break; }
  }

  return vec4(accumColor, 1.0 - transmit);
}
`;

export class VolumeRenderer {
  private device: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private uniformBuf!: GPUBuffer;
  private sampler!: GPUSampler;
  private canvasFormat: GPUTextureFormat;
  private getCanvasTextureView: () => GPUTextureView;

  private macrosView: GPUTextureView | null = null;
  private dyeView: GPUTextureView | null = null;

  constructor(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    getCanvasTextureView: () => GPUTextureView,
  ) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.getCanvasTextureView = getCanvasTextureView;
    this.createSampler();
    this.createUniformBuffer();
  }

  private createSampler() {
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
  }

  private createUniformBuffer() {
    // Uniforms layout (std140-aligned):
    //   viewMatrix  : mat4x4<f32> = 64 bytes
    //   projMatrix  : mat4x4<f32> = 64 bytes
    //   cameraPos   : vec4<f32>   = 16 bytes
    //   aabbMin     : vec4<f32>   = 16 bytes
    //   aabbMax     : vec4<f32>   = 16 bytes
    //   stepCount+3 : vec4<f32>   = 16 bytes
    // Total: 192 bytes
    this.uniformBuf = this.device.createBuffer({
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private bgl: GPUBindGroupLayout | null = null;

  /** Call after obtaining the macros and dye texture views. Updates bind group; pipeline built once. */
  setTextures(macrosView: GPUTextureView, dyeView: GPUTextureView) {
    this.macrosView = macrosView;
    this.dyeView = dyeView;
    if (!this.pipeline) {
      this.buildPipeline();
    } else {
      this.rebuildBindGroup();
    }
  }

  private rebuildBindGroup() {
    if (!this.macrosView || !this.dyeView || !this.bgl) return;
    this.bindGroup = this.device.createBindGroup({
      layout: this.bgl,
      entries: [
        { binding: 0, resource: this.macrosView },
        { binding: 1, resource: this.dyeView },
        { binding: 2, resource: { buffer: this.uniformBuf } },
        { binding: 3, resource: this.sampler },
      ],
    });
  }

  private buildPipeline() {
    if (!this.macrosView || !this.dyeView) return;

    this.bgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    this.rebuildBindGroup();

    const vertModule = this.device.createShaderModule({ code: VOLUME_VERT_WGSL, label: 'volume-vert' });
    const fragModule = this.device.createShaderModule({ code: VOLUME_FRAG_WGSL, label: 'volume-frag' });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl] }),
      vertex: {
        module: vertModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: fragModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.canvasFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'front',
      },
    });
  }

  render(
    viewMatrix: THREE.Matrix4,
    projMatrix: THREE.Matrix4,
    cameraPos: THREE.Vector3,
    aabbMin: THREE.Vector3,
    aabbMax: THREE.Vector3,
    stepCount = 32,
  ) {
    if (!this.pipeline || !this.bindGroup) return;

    // Pack uniforms
    const data = new Float32Array(48); // 192 bytes / 4
    // viewMatrix (offset 0, 16 floats)
    data.set(viewMatrix.elements, 0);
    // projMatrix (offset 16, 16 floats)
    data.set(projMatrix.elements, 16);
    // cameraPos (offset 32)
    data[32] = cameraPos.x; data[33] = cameraPos.y; data[34] = cameraPos.z; data[35] = 1;
    // aabbMin (offset 36)
    data[36] = aabbMin.x; data[37] = aabbMin.y; data[38] = aabbMin.z; data[39] = 0;
    // aabbMax (offset 40)
    data[40] = aabbMax.x; data[41] = aabbMax.y; data[42] = aabbMax.z; data[43] = 0;
    // stepCount (offset 44)
    data[44] = stepCount;
    data[45] = 0; data[46] = 0; data[47] = 0;

    this.device.queue.writeBuffer(this.uniformBuf, 0, data.buffer);

    const canvasView = this.getCanvasTextureView();
    const enc = this.device.createCommandEncoder({ label: 'volume-render' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: canvasView,
        loadOp: 'load',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(36);
    pass.end();
    this.device.queue.submit([enc.finish()]);
  }

  dispose() {
    this.uniformBuf?.destroy();
  }
}
