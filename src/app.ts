import * as THREE from 'three';
import { WebGPURenderer, MeshStandardNodeMaterial, LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { vec3, dot, clamp, mix as tslMix, smoothstep, normalWorld } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { voxelizeAnyMesh } from './obstacles/voxelizeAnyMesh';
import { REMOTE_MODELS, getRemoteModel, type RemoteModel } from './obstacles/modelRegistry';
import { loadRemoteModel } from './obstacles/loadRemote';
import { defaultConfig, latticeDims, computeRe } from './config';
import { LBM3D } from './sim/lbm3d';
import { LBM2D } from './sim/lbm2d';
import { DyeField3D } from './sim/dye3d';
import { VolumeRenderer } from './render/volume3d';
import { ParticleSystem } from './render/particles3d';
import { FluidSurfaceRenderer } from './render/fluidSurface';
import { SliceViewer, type SliceAxis, type SliceField } from './render/sliceViewer';
import { DragCoeffCalc } from './sim/dragCoeff';
import type { ShapeId } from './sim/voxelize';
import { voxelizeMesh } from './obstacles/upload';
import { showToast } from './ui/toast';
import INJECT_WGSL from './sim/inject.wgsl?raw';
import { runAllPhysicsTests } from './tests/physicsTests';
import { StreamlineRenderer } from './render/streamlines';

/**
 * Top-level orchestrator (3D).
 *
 * Phase 0 milestone: WebGPU renderer wired up, scene with a wireframe lattice
 * volume + an obstacle mesh (sphere) + orbit camera + adequate lighting.
 *
 * Subsequent phases will plug in the D3Q19 LBM compute pipeline, 3D dye field,
 * volumetric raymarcher, etc.
 */
export class App {
  private readonly canvas: HTMLCanvasElement;
  private readonly config = (() => {
    const c = defaultConfig();
    // mode2D + scene2D persist across reloads because changing them requires
    // a full LBM/renderer rebuild — easiest path is reload page on toggle.
    try {
      if (localStorage.getItem('wt-mode2d') === '1') c.mode2D = true;
      const s = localStorage.getItem('wt-scene2d');
      if (s === 'circle' || s === 'cavity') c.scene2D = s;
    } catch {}
    return c;
  })();

  private renderer!: WebGPURenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private latticeGroup!: THREE.Group;
  private obstacleMesh: THREE.Mesh | THREE.Group | null = null;
  private floorMesh: THREE.Mesh | null = null;

  private lbm: LBM3D | LBM2D | null = null;
  private dye: DyeField3D | null = null;
  private volumeRenderer: VolumeRenderer | null = null;
  private particles: ParticleSystem | null = null;
  private fluidSurface: FluidSurfaceRenderer | null = null;
  private streamlines: StreamlineRenderer | null = null;
  private sliceViewer: SliceViewer | null = null;
  private dragCalc: DragCoeffCalc | null = null;

  // Active view mode — set by tab bar clicks, consumed in render loop.
  private viewMode: 'particles' | 'streamlines' | 'slice' = 'particles';
  /** ms timestamp of the last drag-coefficient compute dispatch. */
  private lastDragComputeMs = 0;
  private sliceActive = false;
  private sliceIndicator: THREE.Mesh | null = null;
  private simStepCount = 0;
  private rafId = 0;
  private running = false;

  // fps smoothing
  private lastFpsUpdate = 0;
  private frameCount = 0;

  // GPU device (set in start(), used by inject pipeline)
  private _gpuDevice: GPUDevice | null = null;

  // Inject mode state (wired in Track C)
  private _injectActive = false;
  private _injectMode: 'impulse' | 'dye' = 'impulse';
  private _injectPipeline: GPUComputePipeline | null = null;
  private _injectParamsBuf: GPUBuffer | null = null;
  private _injectBindGroupLayout: GPUBindGroupLayout | null = null;

  // Adapter is accepted (and ignored for now) so the constructor signature is
  // ready for Phase 1, where we'll attach the LBM compute pipeline directly to it.
  constructor(canvas: HTMLCanvasElement, _adapter: GPUAdapter) {
    this.canvas = canvas;
  }

  async start() {
    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    await this.renderer.init();
    this.renderer.setClearColor(0x07070b, 1);
    this.handleResize();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07070b, 0.04);

    this.camera = new THREE.PerspectiveCamera(45, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 200);
    if (this.config.mode2D) {
      // Top-down looking down -Z at the LBM2D plane (XY). Camera distance
      // 13 with FOV 45° fits the AABB (sx=10, sy=5) comfortably.
      this.camera.position.set(0, 0, 13);
      this.camera.up.set(0, 1, 0);
    } else {
      this.camera.position.set(8, 4, 8);
    }

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    // (2D mode: leave orbit unlocked until we're sure the default top-down
    // pose actually shows the scene properly; tightening to a fixed pose
    // before the rest of the pipeline is verified just makes debugging
    // harder.)

    // Lighting: key + rim, plus a soft ambient.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.7);
    key.position.set(5, 7, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6bf0d6, 0.4);
    rim.position.set(-6, 2, -4);
    this.scene.add(rim);

    // Lattice AABB visualization: a hairline cube showing the simulation volume.
    this.latticeGroup = new THREE.Group();
    this.scene.add(this.latticeGroup);
    this.rebuildLatticeBox();

    // Obstacle placeholder: a sphere at 1/3 of the way along the tunnel.
    this.rebuildObstacle();

    // Subtle floor for spatial reference.
    const grid = new THREE.GridHelper(20, 20, 0x1f1f2c, 0x14141d);
    grid.position.y = -this.latticeWorld().sy * 0.5 - 0.01;
    this.scene.add(grid);

    // Construct the LBM compute pipeline on the device.
    const device = (this.renderer as unknown as { backend: { device: GPUDevice } }).backend.device;
    if (!device) {
      console.error('WebGPU device not available on renderer.backend.device');
    } else {
      this._gpuDevice = device;
      const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
      if (this.config.mode2D) {
        // D2Q9 lattice for the 2D scenes. Domain is W×H × 1-cell-thick in Z
        // so the existing 3D renderers can sample its macros texture unchanged.
        // Force a wider inlet in 2D — the existing 3D particle code spawns
        // particles in a YZ disc of radius config.inletRadius. In 2D mode
        // the Z dimension is thin and most of that disc lands outside the
        // LBM2D's inlet band, so almost every particle reseed-loops every
        // frame. Bumping the radius to 0.45 covers most of the Y band.
        this.config.inletRadius = 0.45;
        this.config.inlets[0]!.radius = 0.45;
        const lbm2 = new LBM2D(device, W, H);
        lbm2.uIn = this.config.uIn;
        lbm2.visc = this.config.visc;
        lbm2.inletR = this.config.inletRadius;
        lbm2.setShape(this.config.scene2D, this.config.obstacleXFrac, this.config.scaleMul);
        this.lbm = lbm2;
      } else {
        this.lbm = new LBM3D(device, W, H, D);
        this.lbm.uIn = this.config.uIn;
        this.lbm.visc = this.config.visc;
        this.lbm.aoaRad = (this.config.aoaDeg * Math.PI) / 180;
        this.lbm.gravity = this.config.gravity;
        this.lbm.inletR = this.config.inletRadius;
        // Only the parametric primitives have an LBM-side voxelizer; remote
        // models flow through rebuildObstacle → uploadObstacleToFluidSurface.
        const BUILTINS: ReadonlySet<string> = new Set(['sphere', 'cylinder', 'cone', 'wing', 'teapot']);
        if (BUILTINS.has(this.config.shapeId)) {
          this.lbm.setShape(this.config.shapeId as ShapeId);
        }
      }

      // Phase 3: 3D dye field
      this.dye = new DyeField3D(device, W, H, D, () => this.lbm!.macrosTextureView);

      // Inject pipeline
      this.buildInjectPipeline(device);

      // Phase 2: volumetric raymarcher overlaid on Three.js canvas
      const ctx = this.canvas.getContext('webgpu') as GPUCanvasContext;
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.volumeRenderer = new VolumeRenderer(device, canvasFormat, () => ctx.getCurrentTexture().createView());
      this.volumeRenderer.setTextures(this.lbm.macrosTextureView, this.dye.currentView);

      // GPU particle system: 140k tracer particles for sharp wind-tunnel streamlines.
      this.particles = new ParticleSystem(
        device,
        canvasFormat,
        () => ctx.getCurrentTexture().createView(),
        () => {
          const t = ctx.getCurrentTexture();
          return [t.width, t.height];
        },
      );
      this.particles.setMacrosTexture(this.lbm.macrosTextureView, this.lbm.maskBuffer);
      this.particles.jetRadius = this.config.inletRadius;
      this.syncInletsToGpu();

      // Screen-space fluid surface renderer (Splash-style: depth → smooth → normals → fresnel).
      this.fluidSurface = new FluidSurfaceRenderer(
        device,
        canvasFormat,
        () => ctx.getCurrentTexture().createView(),
        () => {
          const t = ctx.getCurrentTexture();
          return [t.width, t.height];
        },
        this.particles.getParticleBuffer(),
        this.particles.N,
      );
      this.fluidSurface.setMacrosTexture(this.lbm.macrosTextureView);
      this.fluidSurface.setMaskBuffer(this.lbm.maskBuffer, latticeDims(this.config.N, this.config.mode2D));

      // Streamline renderer — RK4-advected ribbons through the velocity field.
      this.streamlines = new StreamlineRenderer(
        device,
        canvasFormat,
        () => ctx.getCurrentTexture().createView(),
        () => { const t = ctx.getCurrentTexture(); return [t.width, t.height]; },
      );
      this.streamlines.setMacrosTexture(this.lbm.macrosTextureView);
      const i0 = this.config.inlets[0]!;
      this.streamlines.setInletConfig(i0.yFrac, i0.zFrac, i0.radius);

      // Slice viewer — uses the full-viewport canvas when slice tab is active,
      // or the PiP canvas when another tab shows it as an overlay.
      // We prefer the full-viewport canvas; the PiP canvas is separate.
      const sliceCanvas = document.getElementById('slice-canvas') as HTMLCanvasElement | null;
      if (sliceCanvas) {
        this.sliceViewer = new SliceViewer(device, sliceCanvas);
        this.sliceViewer.setMacros(this.lbm.macrosTextureView);
      }

      // Drag coefficient: integrates pressure × normal over fluid–solid faces
      // every ~500 ms and reports Cd into the HUD.
      this.dragCalc = new DragCoeffCalc(device);
      this.dragCalc.setInputs(this.lbm.macrosTextureView, this.lbm.maskBuffer, latticeDims(this.config.N, this.config.mode2D));
      this.dragCalc.setUIn(this.config.uIn);
      this.dragCalc.setVisc(this.config.visc);

      // 3D indicator showing where the slice cuts through the lattice.
      const sliceGeom = new THREE.PlaneGeometry(1, 1);
      const sliceMat = new MeshBasicNodeMaterial({
        color: 0x6bf0d6,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.sliceIndicator = new THREE.Mesh(sliceGeom, sliceMat);
      this.sliceIndicator.visible = false;
      this.scene.add(this.sliceIndicator);

      // Now that fluidSurface + LBM are live, push the initial obstacle through
      // the unified collision pipeline (Three.js mesh → voxelized LBM mask →
      // GPU obstacle render). This makes the initial sphere match exactly.
      this.rebuildObstacle();
    }

    this.wireUI();
    this.wireDragDrop();

    window.addEventListener('resize', () => this.handleResize());
    this.running = true;
    this.loop();
  }

  private wireUI() {
    const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

    const nSlider = q<HTMLInputElement>('#sl-N');
    const nVal = q<HTMLSpanElement>('#val-N');
    const cellsHint = q<HTMLElement>('#cells-hint');
    nSlider.value = String(this.config.N);
    const updateNLabel = () => {
      nVal.textContent = String(this.config.N);
      const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
      const cells = W * H * D;
      const mb = Math.round((cells * 19 * 4 * 2) / (1024 * 1024));
      cellsHint.textContent = `${W}×${H}×${D} = ${cells.toLocaleString()} cells · ${mb} MB f-buffers`;
    };
    updateNLabel();
    nSlider.addEventListener('input', () => {
      this.config.N = parseInt(nSlider.value, 10);
      updateNLabel();
    });
    nSlider.addEventListener('change', () => {
      this.applyResolution();
    });

    const speedSlider = q<HTMLInputElement>('#sl-speed');
    const speedVal = q<HTMLSpanElement>('#val-speed');
    speedSlider.value = String(this.config.uIn);
    speedVal.textContent = this.config.uIn.toFixed(3);
    speedSlider.addEventListener('input', () => {
      this.config.uIn = parseFloat(speedSlider.value);
      speedVal.textContent = this.config.uIn.toFixed(3);
      if (this.lbm) this.lbm.uIn = this.config.uIn;
      this.dragCalc?.setUIn(this.config.uIn);
      this.refreshReHud();
    });

    const viscSlider = q<HTMLInputElement>('#sl-visc');
    const viscVal = q<HTMLSpanElement>('#val-visc');
    viscSlider.value = String(this.config.visc);
    viscVal.textContent = this.config.visc.toFixed(4);
    viscSlider.addEventListener('input', () => {
      this.config.visc = parseFloat(viscSlider.value);
      viscVal.textContent = this.config.visc.toFixed(4);
      if (this.lbm) this.lbm.visc = this.config.visc;
      this.dragCalc?.setVisc(this.config.visc);
      this.refreshReHud();
    });

    const aoaSlider = q<HTMLInputElement>('#sl-aoa');
    const aoaVal = q<HTMLSpanElement>('#val-aoa');
    aoaSlider.value = String(this.config.aoaDeg);
    aoaVal.textContent = `${this.config.aoaDeg}°`;
    aoaSlider.addEventListener('input', () => {
      this.config.aoaDeg = parseFloat(aoaSlider.value);
      aoaVal.textContent = `${this.config.aoaDeg}°`;
      if (this.lbm) this.lbm.aoaRad = (this.config.aoaDeg * Math.PI) / 180;
    });

    const inletSlider = q<HTMLInputElement>('#sl-inlet');
    const inletVal = q<HTMLSpanElement>('#val-inlet');
    inletSlider.value = String(this.config.inletRadius);
    inletVal.textContent = `${Math.round(this.config.inletRadius * 100)}%`;
    inletSlider.addEventListener('input', () => {
      this.config.inletRadius = parseFloat(inletSlider.value);
      inletVal.textContent = `${Math.round(this.config.inletRadius * 100)}%`;
      if (this.lbm) this.lbm.inletR = this.config.inletRadius;
      if (this.particles) this.particles.jetRadius = this.config.inletRadius;
      // Shorthand slider also drives the first inlet's radius so the simple
      // and advanced views stay consistent.
      this.config.inlets[0]!.radius = this.config.inletRadius;
      this.syncInletsToGpu();
      const i0 = this.config.inlets[0]!;
      this.streamlines?.setInletConfig(i0.yFrac, i0.zFrac, i0.radius);
    });

    // Build the per-inlet advanced UI inside #inlets-host. Always 4 rows.
    this.buildInletsUI();

    const ballSlider = q<HTMLInputElement>('#sl-ball');
    const ballVal = q<HTMLSpanElement>('#val-ball');
    ballSlider.value = String(this.config.ballSize);
    ballVal.textContent = `${this.config.ballSize.toFixed(2)}×`;
    ballSlider.addEventListener('input', () => {
      this.config.ballSize = parseFloat(ballSlider.value);
      ballVal.textContent = `${this.config.ballSize.toFixed(2)}×`;
    });

    const speedMul = q<HTMLInputElement>('#sl-speed-mul');
    const speedMulVal = q<HTMLSpanElement>('#val-speed-mul');
    speedMul.value = String(this.config.simSpeed);
    speedMulVal.textContent = `${this.config.simSpeed.toFixed(2)}×`;
    speedMul.addEventListener('input', () => {
      this.config.simSpeed = parseFloat(speedMul.value);
      speedMulVal.textContent = `${this.config.simSpeed.toFixed(2)}×`;
    });

    // 2D mode toggle + scene selector. Changing mode reloads the page so we
    // don't have to tear down and rebuild every renderer's bind groups.
    const mode2DCb = q<HTMLInputElement>('#cb-mode2d');
    const rowScene2D = q<HTMLDivElement>('#row-scene2d');
    const scene2DSel = q<HTMLSelectElement>('#sel-scene2d');
    mode2DCb.checked = this.config.mode2D;
    scene2DSel.value = this.config.scene2D;
    rowScene2D.hidden = !this.config.mode2D;
    mode2DCb.addEventListener('change', () => {
      try {
        if (mode2DCb.checked) localStorage.setItem('wt-mode2d', '1');
        else localStorage.removeItem('wt-mode2d');
      } catch {}
      location.reload();
    });
    scene2DSel.addEventListener('change', () => {
      const v = scene2DSel.value as 'circle' | 'cavity';
      this.config.scene2D = v;
      try { localStorage.setItem('wt-scene2d', v); } catch {}
      if (this.lbm instanceof LBM2D) {
        this.lbm.setShape(v, this.config.obstacleXFrac, this.config.scaleMul);
      }
    });

    const shapeSelect = q<HTMLSelectElement>('#shape-select');
    const remotePlaceholder = q<HTMLOptGroupElement>('#shape-remote-group');
    // Replace the single "Models" optgroup with one optgroup per category so
    // the dropdown stays browsable as the catalogue grows.
    const customOption = shapeSelect.querySelector('option[value="custom"]');
    const byCategory = new Map<string, typeof REMOTE_MODELS>();
    for (const m of REMOTE_MODELS) {
      const c = (m as any).category ?? 'misc';
      const arr = byCategory.get(c) ?? [];
      arr.push(m);
      byCategory.set(c, arr);
    }
    const categoryLabel: Record<string, string> = {
      aircraft: 'Aircraft', vehicles: 'Vehicles', characters: 'Characters',
      animals: 'Animals', objects: 'Objects', misc: 'Misc',
    };
    const categoryOrder = ['aircraft', 'vehicles', 'characters', 'animals', 'objects', 'misc'];
    remotePlaceholder.remove();
    for (const cat of categoryOrder) {
      const list = byCategory.get(cat);
      if (!list) continue;
      const group = document.createElement('optgroup');
      group.label = categoryLabel[cat] ?? cat;
      for (const m of list) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        group.appendChild(opt);
      }
      shapeSelect.insertBefore(group, customOption);
    }
    shapeSelect.value = this.config.shapeId;
    shapeSelect.addEventListener('change', () => {
      this.config.shapeId = shapeSelect.value;
      // Every new shape starts from neutral orientation/scale so the registry
      // defaults are visible; the user can then dial in their own transform.
      this.resetOrientationUI();
      // rebuildObstacle handles both built-in primitives and remote .glb
      // models. For remotes, a placeholder sphere is swapped in until the
      // fetch resolves.
      this.rebuildObstacle();
    });

    // Orientation + scale sliders. Each one re-applies the obstacle transform
    // (rotation+scale) and re-voxelizes so the LBM mask stays in sync. We
    // debounce the voxelize step so dragging the slider is responsive.
    const xfracSlider = q<HTMLInputElement>('#sl-xfrac');
    const xfracVal = q<HTMLSpanElement>('#val-xfrac');
    xfracSlider.value = String(this.config.obstacleXFrac);
    xfracVal.textContent = `${Math.round(this.config.obstacleXFrac * 100)}%`;
    xfracSlider.addEventListener('input', () => {
      this.config.obstacleXFrac = parseFloat(xfracSlider.value);
      xfracVal.textContent = `${Math.round(this.config.obstacleXFrac * 100)}%`;
      this.applyObstacleTransform();
    });

    const scaleSlider = q<HTMLInputElement>('#sl-scale');
    const scaleVal = q<HTMLSpanElement>('#val-scale');
    const yawSlider = q<HTMLInputElement>('#sl-yaw');
    const yawVal = q<HTMLSpanElement>('#val-yaw');
    const pitchSlider = q<HTMLInputElement>('#sl-pitch');
    const pitchVal = q<HTMLSpanElement>('#val-pitch');
    const rollSlider = q<HTMLInputElement>('#sl-roll');
    const rollVal = q<HTMLSpanElement>('#val-roll');

    scaleSlider.value = String(this.config.scaleMul);
    yawSlider.value = String(this.config.yawDeg);
    pitchSlider.value = String(this.config.pitchDeg);
    rollSlider.value = String(this.config.rollDeg);
    scaleVal.textContent = this.config.scaleMul.toFixed(2);
    yawVal.textContent = `${this.config.yawDeg}°`;
    pitchVal.textContent = `${this.config.pitchDeg}°`;
    rollVal.textContent = `${this.config.rollDeg}°`;

    const onTransform = () => this.applyObstacleTransform();
    scaleSlider.addEventListener('input', () => {
      this.config.scaleMul = parseFloat(scaleSlider.value);
      scaleVal.textContent = this.config.scaleMul.toFixed(2);
      onTransform();
    });
    yawSlider.addEventListener('input', () => {
      this.config.yawDeg = parseFloat(yawSlider.value);
      yawVal.textContent = `${this.config.yawDeg}°`;
      onTransform();
    });
    pitchSlider.addEventListener('input', () => {
      this.config.pitchDeg = parseFloat(pitchSlider.value);
      pitchVal.textContent = `${this.config.pitchDeg}°`;
      onTransform();
    });
    rollSlider.addEventListener('input', () => {
      this.config.rollDeg = parseFloat(rollSlider.value);
      rollVal.textContent = `${this.config.rollDeg}°`;
      onTransform();
    });

    q<HTMLButtonElement>('#btn-reset-orient').addEventListener('click', () => {
      this.resetOrientationUI();
      onTransform();
    });

    // Floor controls — checkbox + height slider re-voxelize the LBM mask
    // each time so collisions follow.
    const floorCb = q<HTMLInputElement>('#cb-floor');
    const floorSl = q<HTMLInputElement>('#sl-floor');
    const floorVal = q<HTMLSpanElement>('#val-floor');
    floorCb.checked = this.config.floorEnabled;
    floorSl.value = String(this.config.floorYFrac);
    floorVal.textContent = `${Math.round(this.config.floorYFrac * 100)}%`;
    floorCb.addEventListener('change', () => {
      this.config.floorEnabled = floorCb.checked;
      this.particles?.resetAllParticles();
      this.applyFloor();
    });
    floorSl.addEventListener('input', () => {
      this.config.floorYFrac = parseFloat(floorSl.value);
      floorVal.textContent = `${Math.round(this.config.floorYFrac * 100)}%`;
      if (this.config.floorEnabled) {
        this.particles?.resetAllParticles();
        this.applyFloor();
      }
    });

    // Physics test runner. Algebraic tests are sync; GPU tests pause the
    // live sim, run a brief diagnostic, then return control.
    const testsBtn = q<HTMLButtonElement>('#btn-run-tests');
    const testsList = q<HTMLUListElement>('#tests-results');
    const testsSummary = q<HTMLSpanElement>('#tests-summary');
    testsBtn.addEventListener('click', async () => {
      testsBtn.disabled = true;
      testsSummary.textContent = 'Running…';
      testsList.innerHTML = '';
      try {
        const results = await runAllPhysicsTests(this.lbm ?? undefined);
        const passed = results.filter((r) => r.passed).length;
        testsSummary.textContent = `${passed}/${results.length} passed`;
        for (const r of results) {
          const li = document.createElement('li');
          li.className = r.passed ? 'pass' : 'fail';
          const name = document.createElement('span');
          name.className = 'name';
          name.textContent = r.name;
          const value = document.createElement('span');
          value.className = 'value';
          value.textContent = r.message || `${r.value.toExponential(2)} (≤ ${r.tolerance.toExponential(1)})`;
          li.appendChild(name);
          li.appendChild(value);
          testsList.appendChild(li);
        }
      } catch (err) {
        testsSummary.textContent = 'Error — see console';
        console.error('Physics tests failed', err);
      } finally {
        testsBtn.disabled = false;
      }
    });

    q<HTMLButtonElement>('#btn-reset').addEventListener('click', () => {
      this.lbm?.resetFlow();
      this.particles?.resetAllParticles();
      this.simStepCount = 0;
    });

    const playBtn = q<HTMLButtonElement>('#btn-play');
    const stepBtn = q<HTMLButtonElement>('#btn-step');
    const refreshPlay = () => {
      playBtn.textContent = this.config.paused ? '▶ Play' : '⏸ Pause';
      stepBtn.disabled = !this.config.paused;
    };
    playBtn.addEventListener('click', () => {
      this.config.paused = !this.config.paused;
      refreshPlay();
    });
    stepBtn.addEventListener('click', () => {
      if (this.config.paused) {
        this.lbm?.step();
        this.dye?.step();
        this.simStepCount++;
        // Also advance the particles one frame so they visibly move on Step.
        if (this.particles && this.lbm) {
          this.camera.updateMatrixWorld();
          const view = this.camera.matrixWorldInverse;
          const proj = this.camera.projectionMatrix;
          const camPos = this.camera.position;
          const { sx, sy, sz } = this.latticeWorld();
          const aabbMin = new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5);
          const aabbMax = new THREE.Vector3(sx * 0.5, sy * 0.5, sz * 0.5);
          const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
          this.particles.advectOnly(view, proj, camPos, aabbMin, aabbMax, { W, H, D });
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.config.paused = !this.config.paused;
        refreshPlay();
      }
    });

    // Slow-mo toggle
    const slowmoBtn = q<HTMLButtonElement>('#btn-slowmo');
    let slowmoActive = false;
    slowmoBtn.addEventListener('click', () => {
      slowmoActive = !slowmoActive;
      this.config.simSpeed = slowmoActive ? 0.25 : 1.0;
      speedMul.value = String(this.config.simSpeed);
      speedMulVal.textContent = `${this.config.simSpeed.toFixed(2)}×`;
      slowmoBtn.textContent = slowmoActive ? 'Slow-mo: On' : 'Slow-mo';
      slowmoBtn.classList.toggle('active', slowmoActive);
    });

    // Physics: gravity sliders
    const gravX = q<HTMLInputElement>('#sl-grav-x');
    const gravY = q<HTMLInputElement>('#sl-grav-y');
    const gravZ = q<HTMLInputElement>('#sl-grav-z');
    const gravXVal = q<HTMLSpanElement>('#val-grav-x');
    const gravYVal = q<HTMLSpanElement>('#val-grav-y');
    const gravZVal = q<HTMLSpanElement>('#val-grav-z');
    const updateGrav = () => {
      this.config.gravity = [
        parseFloat(gravX.value),
        parseFloat(gravY.value),
        parseFloat(gravZ.value),
      ];
      gravXVal.textContent = this.config.gravity[0].toFixed(5);
      gravYVal.textContent = this.config.gravity[1].toFixed(5);
      gravZVal.textContent = this.config.gravity[2].toFixed(5);
      if (this.lbm) this.lbm.gravity = this.config.gravity;
    };
    gravX.addEventListener('input', updateGrav);
    gravY.addEventListener('input', updateGrav);
    gravZ.addEventListener('input', updateGrav);

    // Physics: collision-operator cycle (BGK → TRT → Regularized).
    // Regularized BGK is Latt & Chopard's stress-projection variant, ported
    // from MarcosAsh/Lattice_Fluid_Dynamics (MIT). It costs the same as TRT
    // but is far more stable at moderate-to-high Re because it projects out
    // unstable higher-order non-equilibrium moments each step.
    const mrtBtn = q<HTMLButtonElement>('#btn-mrt');
    const collisionMode = (): 'BGK' | 'MRT' | 'Regularized' => {
      if (this.config.useRegularized) return 'Regularized';
      if (this.config.useMRT) return 'MRT';
      return 'BGK';
    };
    const setCollisionMode = (m: 'BGK' | 'MRT' | 'Regularized') => {
      this.config.useMRT = (m === 'MRT');
      this.config.useRegularized = (m === 'Regularized');
      if (this.lbm) {
        this.lbm.useMRT = this.config.useMRT ? 1 : 0;
        this.lbm.useRegularized = this.config.useRegularized ? 1 : 0;
      }
      mrtBtn.textContent = `Collision: ${m}`;
      mrtBtn.classList.toggle('active', m !== 'BGK');
    };
    // Initialise label from current config.
    setCollisionMode(collisionMode());
    mrtBtn.addEventListener('click', () => {
      const next: 'BGK' | 'MRT' | 'Regularized' =
        collisionMode() === 'BGK' ? 'MRT'
        : collisionMode() === 'MRT' ? 'Regularized'
        : 'BGK';
      setCollisionMode(next);
    });

    // Physics: LES toggle
    const lesBtn = q<HTMLButtonElement>('#btn-les');
    lesBtn.addEventListener('click', () => {
      this.config.useLES = !this.config.useLES;
      if (this.lbm) this.lbm.useLES = this.config.useLES ? 1 : 0;
      lesBtn.textContent = this.config.useLES ? 'Turbulence: LES' : 'Turbulence: Off';
      lesBtn.classList.toggle('active', this.config.useLES);
    });

    // Physics: free-slip wall toggle
    const slipBtn = q<HTMLButtonElement>('#btn-slip');
    slipBtn.addEventListener('click', () => {
      this.config.freeSlip = !this.config.freeSlip;
      if (this.lbm) this.lbm.freeSlip = this.config.freeSlip ? 1 : 0;
      slipBtn.textContent = this.config.freeSlip ? 'Walls: Free-slip' : 'Walls: No-slip';
      slipBtn.classList.toggle('active', this.config.freeSlip);
    });

    // Tools: inject
    const injectBtn = q<HTMLButtonElement>('#btn-inject');
    const injectModeBtn = q<HTMLButtonElement>('#btn-inject-mode');
    injectBtn.addEventListener('click', () => {
      this._injectActive = !this._injectActive;
      injectBtn.textContent = this._injectActive ? 'Inject: On' : 'Inject: Off';
      injectBtn.classList.toggle('active', this._injectActive);
      injectModeBtn.disabled = !this._injectActive;
      if (this.controls) this.controls.enabled = !this._injectActive;
    });
    injectModeBtn.addEventListener('click', () => {
      this._injectMode = this._injectMode === 'impulse' ? 'dye' : 'impulse';
      injectModeBtn.textContent = `Mode: ${this._injectMode === 'impulse' ? 'Impulse' : 'Dye'}`;
    });

    this.wireInject();

    // Slice viewer controls.
    const sliceAxis = q<HTMLSelectElement>('#sel-slice-axis');
    const sliceField = q<HTMLSelectElement>('#sel-slice-field');
    const slicePos = q<HTMLInputElement>('#sl-slice-pos');
    const slicePosVal = q<HTMLSpanElement>('#val-slice-pos');
    const sliceTitle = q<HTMLSpanElement>('#slice-title-text');
    const sliceLegendLo = q<HTMLSpanElement>('#slice-legend-lo');
    const sliceLegendHi = q<HTMLSpanElement>('#slice-legend-hi');

    const refreshSliceLabels = () => {
      slicePosVal.textContent = parseFloat(slicePos.value).toFixed(2);
      const axisLbl = sliceAxis.value.toUpperCase();
      const fieldLbl = sliceField.value[0].toUpperCase() + sliceField.value.slice(1);
      const label = `${axisLbl}-slice · ${fieldLbl}`;
      sliceTitle.textContent = label;
      // Also update the full-viewport slice header labels
      const vpTitle = document.getElementById('slice-vp-title');
      if (vpTitle) vpTitle.textContent = label;
      const ranges: Record<string, [string, string]> = {
        velocity: ['0', '0.10'],
        pressure: ['0', '0.04'],
        vorticity: ['0', '0.033'],
      };
      const [lo, hi] = ranges[sliceField.value];
      sliceLegendLo.textContent = lo;
      sliceLegendHi.textContent = hi;
      const vpLo = document.getElementById('slice-vp-legend-lo');
      const vpHi = document.getElementById('slice-vp-legend-hi');
      if (vpLo) vpLo.textContent = lo;
      if (vpHi) vpHi.textContent = hi;
    };

    const sliceMaskCb = q<HTMLInputElement>('#cb-slice-mask');
    const pushSliceConfig = () => {
      if (!this.sliceViewer) return;
      const axisStr = sliceAxis.value as SliceAxis;
      const pos = parseFloat(slicePos.value);
      this.sliceViewer.setConfig(axisStr, pos, sliceField.value as SliceField);
      refreshSliceLabels();
      this.updateSliceIndicator(axisStr, pos);
      const axisIdx: 0 | 1 | 2 = axisStr === 'x' ? 0 : axisStr === 'y' ? 1 : 2;
      this.fluidSurface?.setSliceMask(axisIdx, pos, sliceMaskCb.checked, 0.04);
    };
    sliceMaskCb.addEventListener('change', pushSliceConfig);

    sliceAxis.addEventListener('change', pushSliceConfig);
    sliceField.addEventListener('change', pushSliceConfig);
    slicePos.addEventListener('input', pushSliceConfig);
    pushSliceConfig();

    this.wireTabBar();
    this.refreshReHud();
  }

  /** Wire the top tab bar: pip animation + view-mode switching. */
  private wireTabBar() {
    const tabs = document.querySelectorAll<HTMLButtonElement>('#tab-bar .tab');
    const pip  = document.getElementById('tab-pip');
    const sliceFullVp = document.getElementById('slice-fullvp');

    const movePip = (activeTab: HTMLButtonElement) => {
      if (!pip) return;
      const bar = document.getElementById('tab-bar');
      if (!bar) return;
      const barRect = bar.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      pip.style.left  = (tabRect.left - barRect.left) + 'px';
      pip.style.width = tabRect.width + 'px';
    };

    // Wire view-specific floating controls (Streamlines: resolution + width)
    const viewControls = document.getElementById('view-controls');
    const vNSlider = document.getElementById('sl-vN') as HTMLInputElement | null;
    const vNVal    = document.getElementById('val-vN');
    const vWSlider = document.getElementById('sl-vWidth') as HTMLInputElement | null;
    const vWVal    = document.getElementById('val-vWidth');
    if (vNSlider && vNVal) {
      vNSlider.value = String(this.config.N);
      vNVal.textContent = String(this.config.N);
      vNSlider.addEventListener('input', () => {
        vNVal.textContent = vNSlider.value;
        this.config.N = parseInt(vNSlider.value, 10);
        // Sync the original Setup-tab slider too
        if (nSlider) { nSlider.value = vNSlider.value; updateNLabel(); }
      });
      vNSlider.addEventListener('change', () => this.applyResolution());
    }
    if (vWSlider && vWVal) {
      vWVal.textContent = vWSlider.value;
      this.streamlines?.setRibbonWidth(parseFloat(vWSlider.value) / 1000);
      vWSlider.addEventListener('input', () => {
        vWVal.textContent = vWSlider.value;
        this.streamlines?.setRibbonWidth(parseFloat(vWSlider.value) / 1000);
      });
    }

    const setMode = (mode: 'particles' | 'streamlines' | 'slice') => {
      this.viewMode = mode;

      // Show/hide view-specific floating controls
      if (viewControls) {
        if (mode === 'streamlines') viewControls.removeAttribute('hidden');
        else viewControls.setAttribute('hidden', '');
      }

      // Toggle full-viewport slice canvas visibility
      if (sliceFullVp) {
        if (mode === 'slice') sliceFullVp.removeAttribute('hidden');
        else sliceFullVp.setAttribute('hidden', '');
      }

      // Slice tab is the single source of truth for sliceActive
      this.sliceActive = (mode === 'slice');
      if (this.sliceIndicator) this.sliceIndicator.visible = this.sliceActive;

      if (this.dye) {
        this.dye.injectAmount = this.config.dyeAmount;
      }

      // Reset streamline seeds on switch so ribbons start fresh; show warming hint
      if (mode === 'streamlines' && this.streamlines) {
        const { sx, sy, sz } = this.latticeWorld();
        const aabbMin = new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5);
        const aabbMax = new THREE.Vector3( sx * 0.5,  sy * 0.5,  sz * 0.5);
        this.streamlines.resetSeeds(aabbMin, aabbMax);
        showToast('Seeding streamlines…');
      }
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        movePip(tab);
        setMode(tab.dataset.mode as 'particles' | 'streamlines' | 'slice');
      });
    });

    // Initialise pip on first active tab
    const initialActive = document.querySelector<HTMLButtonElement>('#tab-bar .tab.active');
    if (initialActive) {
      // Defer one frame so layout is complete
      requestAnimationFrame(() => movePip(initialActive));
    }
    // Keep pip in sync after window resize (viewport width changes)
    window.addEventListener('resize', () => {
      const active = document.querySelector<HTMLButtonElement>('#tab-bar .tab.active');
      if (active) movePip(active);
    });
  }

  private applyResolution() {
    if (!this.lbm || !this._gpuDevice) return;
    const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
    this.lbm.resize(W, H, D);
    // LBM resize destroys + reallocates its macros texture and mask buffer.
    // Rebuild the dye field at the new dims, then rebind all downstream
    // renderers to the fresh LBM textures.
    if (this.dye) {
      this.dye.dispose?.();
    }
    this.dye = new DyeField3D(this._gpuDevice, W, H, D, () => this.lbm!.macrosTextureView);
    this.dye.injectAmount = this.config.dyeAmount;
    this.volumeRenderer?.setTextures(this.lbm.macrosTextureView, this.dye.currentView);
    this.particles?.setMacrosTexture(this.lbm.macrosTextureView, this.lbm.maskBuffer);
    this.fluidSurface?.setMacrosTexture(this.lbm.macrosTextureView);
    this.fluidSurface?.setMaskBuffer(this.lbm.maskBuffer, { W, H, D });
    this.streamlines?.setMacrosTexture(this.lbm.macrosTextureView);
    this.sliceViewer?.setMacros(this.lbm.macrosTextureView);
    this.dragCalc?.setInputs(this.lbm.macrosTextureView, this.lbm.maskBuffer, { W, H, D });
    this.rebuildLatticeBox();
    // rebuildObstacle re-voxelizes into the new mask + repushes geometry.
    this.rebuildObstacle();
    this.simStepCount = 0;
    this.refreshReHud();
  }

  private refreshReHud() {
    const re = computeRe(this.config.uIn, this.config.visc, this.config.N, this.lbm?.charLengthCells);
    const reEl = document.getElementById('val-re');
    const reHud = document.getElementById('rd-rey');
    if (reEl) reEl.textContent = re.toFixed(0);
    if (reHud) reHud.textContent = re.toFixed(0);
  }

  private latticeWorld() {
    // Map lattice cells to world units. We pick W=10 wide (in world space).
    const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
    const worldWidth = 10;
    const cell = worldWidth / W;
    return { sx: W * cell, sy: H * cell, sz: D * cell, cell };
  }

  private rebuildLatticeBox() {
    while (this.latticeGroup.children.length) {
      const c = this.latticeGroup.children.pop()!;
      (c as THREE.Mesh).geometry?.dispose?.();
      ((c as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.();
    }
    const { sx, sy, sz } = this.latticeWorld();
    const box = new THREE.BoxGeometry(sx, sy, sz);
    const edges = new THREE.EdgesGeometry(box);
    const lineMat = new LineBasicNodeMaterial({ transparent: true, opacity: 0.45 });
    lineMat.color = new THREE.Color(0x6bf0d6);
    const line = new THREE.LineSegments(edges, lineMat);
    this.latticeGroup.add(line);
    box.dispose();

    // Inlet indicator: a faint plane on the -X face.
    const inletGeom = new THREE.PlaneGeometry(sz, sy);
    const inletMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.05, side: THREE.DoubleSide });
    inletMat.color = new THREE.Color(0x6bf0d6);
    const inlet = new THREE.Mesh(inletGeom, inletMat);
    inlet.position.set(-sx * 0.5, 0, 0);
    inlet.rotation.y = Math.PI * 0.5;
    this.latticeGroup.add(inlet);
  }

  /** Push the current inlet array into LBM3D + ParticleSystem. */
  private syncInletsToGpu() {
    if (this.lbm instanceof LBM3D) this.lbm.inlets = this.config.inlets.map((i) => ({ ...i }));
    if (this.particles) this.particles.inlets = this.config.inlets.map((i) => ({ ...i }));
  }

  /** Build 4 inlet rows (Y / Z / Size sliders + Enable checkbox) into #inlets-host. */
  private buildInletsUI() {
    const host = document.getElementById('inlets-host');
    if (!host) return;
    host.innerHTML = '';
    for (let k = 0; k < this.config.inlets.length; k++) {
      const inlet = this.config.inlets[k]!;
      const row = document.createElement('div');
      row.className = 'inlet-row';
      row.innerHTML = `
        <div class="inlet-head">
          <label class="checkbox">
            <input type="checkbox" data-inlet="${k}" data-field="enabled" ${inlet.enabled ? 'checked' : ''}/>
            <span>Inlet ${k + 1}</span>
          </label>
        </div>
        <label class="inlet-slider">Y <span class="val">${Math.round(inlet.yFrac * 100)}%</span>
          <input type="range" min="0.05" max="0.95" step="0.005" value="${inlet.yFrac}" data-inlet="${k}" data-field="yFrac" />
        </label>
        <label class="inlet-slider">Z <span class="val">${Math.round(inlet.zFrac * 100)}%</span>
          <input type="range" min="0.05" max="0.95" step="0.005" value="${inlet.zFrac}" data-inlet="${k}" data-field="zFrac" />
        </label>
        <label class="inlet-slider">Size <span class="val">${Math.round(inlet.radius * 100)}%</span>
          <input type="range" min="0.02" max="0.45" step="0.005" value="${inlet.radius}" data-inlet="${k}" data-field="radius" />
        </label>
      `;
      host.appendChild(row);
    }
    host.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
      const k = parseInt(el.dataset.inlet ?? '0', 10);
      const field = el.dataset.field as 'enabled' | 'yFrac' | 'zFrac' | 'radius';
      el.addEventListener('input', () => {
        const inlet = this.config.inlets[k]!;
        if (field === 'enabled') {
          inlet.enabled = el.checked;
        } else {
          const v = parseFloat(el.value);
          inlet[field] = v;
          const valSpan = el.parentElement?.querySelector('.val');
          if (valSpan) valSpan.textContent = `${Math.round(v * 100)}%`;
        }
        // Keep the shorthand slider in sync when the user edits inlet 1's radius.
        if (k === 0 && field === 'radius') {
          this.config.inletRadius = inlet.radius;
          if (this.lbm) this.lbm.inletR = inlet.radius;
          if (this.particles) this.particles.jetRadius = inlet.radius;
          const sl = document.getElementById('sl-inlet') as HTMLInputElement | null;
          const lv = document.getElementById('val-inlet');
          if (sl) sl.value = String(inlet.radius);
          if (lv) lv.textContent = `${Math.round(inlet.radius * 100)}%`;
        }
        this.syncInletsToGpu();
      });
    });
  }

  /**
   * Reconcile the floor mesh in the scene with config (floorEnabled,
   * floorYFrac) and re-voxelize so the LBM mask gets the floor band.
   * Cheap to call on every slider input.
   */
  private applyFloor() {
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      (this.floorMesh.material as THREE.Material).dispose();
      this.floorMesh = null;
    }
    if (this.config.floorEnabled) {
      const { sx, sy, sz } = this.latticeWorld();
      const floorY = -sy * 0.5 + sy * this.config.floorYFrac;
      const geom = new THREE.PlaneGeometry(sx, sz);
      const mat = new MeshBasicNodeMaterial({
        color: 0x4a7088,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, floorY, 0);
      this.scene.add(mesh);
      this.floorMesh = mesh;
    }
    // Re-voxelize so the mask picks up (or drops) the floor band.
    this.uploadObstacleToFluidSurface();
  }

  private disposeMeshOrGroup(obj: THREE.Mesh | THREE.Group) {
    if (obj instanceof THREE.Group) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          (child.material as THREE.Material)?.dispose();
        }
      });
    } else {
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose();
    }
  }

  /** Position+orient the slice indicator plane based on axis + position [0,1]. */
  private updateSliceIndicator(axis: SliceAxis, pos: number) {
    if (!this.sliceIndicator) return;
    const { sx, sy, sz } = this.latticeWorld();
    const m = this.sliceIndicator;
    if (axis === 'x') {
      m.scale.set(sz, sy, 1);
      m.rotation.set(0, Math.PI / 2, 0);
      m.position.set(-sx * 0.5 + sx * pos, 0, 0);
    } else if (axis === 'y') {
      m.scale.set(sx, sz, 1);
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.position.set(0, -sy * 0.5 + sy * pos, 0);
    } else {
      m.scale.set(sx, sy, 1);
      m.rotation.set(0, 0, 0);
      m.position.set(0, 0, -sz * 0.5 + sz * pos);
    }
  }

  /** Recursively assign a Three.js layer to a Mesh or Group of meshes. */
  private setMeshLayer(obj: THREE.Object3D, layer: number) {
    obj.layers.set(layer);
    if ((obj as THREE.Group).children) {
      for (const c of obj.children) this.setMeshLayer(c, layer);
    }
  }

  private makeMat() {
    // Friction-driven obstacle material.
    // Wind blows in +X (from inlet at -X to outlet at +X). The windward face
    // is the one whose normal points BACK toward the inlet (i.e. -X). That
    // face takes the highest stagnation-pressure / friction load.
    //   windward face (facing inlet) → hot red/yellow (high friction)
    //   shoulders                    → green/cyan (moderate)
    //   leeward face (wake side)     → deep blue (low friction)
    const upstream = vec3(-1, 0, 0);
    const frontness = clamp(dot(normalWorld, upstream), 0, 1);

    // Cp-style turbo ramp.  Brightened low-Cp end so the leeward face is
    // visible against the dark background — Three.js Standard material with
    // dim ambient was rendering pure dark blue as nearly invisible.
    const c0 = vec3(0.30, 0.45, 0.95);   // bright blue (back)
    const c1 = vec3(0.20, 0.85, 0.95);   // cyan
    const c2 = vec3(0.30, 0.95, 0.30);   // green
    const c3 = vec3(1.00, 0.85, 0.10);   // yellow
    const c4 = vec3(1.00, 0.30, 0.10);   // red (front)

    const seg = (t: ReturnType<typeof smoothstep>, a: ReturnType<typeof vec3>, b: ReturnType<typeof vec3>) => tslMix(a, b, t);
    const t1 = smoothstep(0.00, 0.25, frontness);
    const t2 = smoothstep(0.25, 0.55, frontness);
    const t3 = smoothstep(0.55, 0.80, frontness);
    const t4 = smoothstep(0.80, 1.00, frontness);
    let col = seg(t1, c0, c1);
    col = seg(t2, col, c2);
    col = seg(t3, col, c3);
    col = seg(t4, col, c4);

    const mat = new MeshStandardNodeMaterial({
      roughness: 0.42,
      metalness: 0.08,
    });
    mat.colorNode = col;
    // Stronger emissive so the surface heatmap is fully visible from any
    // camera angle — drag visualisation reads the obstacle as a self-lit
    // pressure map rather than a darkly shaded mesh.
    mat.emissiveNode = col.mul(0.85);
    return mat;
  }

  /** Reset orientation/scale sliders + config to neutral. Does not re-voxelize. */
  private resetOrientationUI() {
    this.config.yawDeg = 0;
    this.config.pitchDeg = 0;
    this.config.rollDeg = 0;
    this.config.scaleMul = 1;
    const set = (id: string, val: string, txt: string) => {
      const sl = document.getElementById(id) as HTMLInputElement | null;
      const sp = document.getElementById(`val-${id.slice(3)}`) as HTMLSpanElement | null;
      if (sl) sl.value = val;
      if (sp) sp.textContent = txt;
    };
    set('sl-yaw', '0', '0°');
    set('sl-pitch', '0', '0°');
    set('sl-roll', '0', '0°');
    set('sl-scale', '1', '1.00');
  }

  /**
   * Push the current yaw/pitch/roll/scale onto the obstacle mesh and re-voxelize
   * so the LBM mask follows. We debounce the voxelize step (100ms) so dragging
   * a slider stays interactive — the mesh visibly rotates every frame, the
   * physics catches up shortly after.
   */
  private orientDebounceId: ReturnType<typeof setTimeout> | null = null;
  private applyObstacleTransform() {
    if (!this.obstacleMesh) return;
    const m = this.obstacleMesh;
    const deg2rad = (d: number) => (d * Math.PI) / 180;
    // Position: slide the obstacle along the flow axis. xFrac ∈ (0,1) maps
    // 0 → inlet, 1 → outlet (linear in lattice width).
    const { sx } = this.latticeWorld();
    m.position.set(-sx * 0.5 + sx * this.config.obstacleXFrac, 0, 0);
    // Three.js applies rotations in order X → Y → Z by default. We want yaw
    // (Y) around the vertical, pitch (Z) around the side axis, roll (X) along
    // the flow — so we order the Euler set so the resulting rotation matches
    // intuition for a wind-tunnel test article.
    m.rotation.set(
      deg2rad(this.config.rollDeg),       // X = roll (along flow)
      deg2rad(this.config.yawDeg),        // Y = yaw (vertical)
      deg2rad(this.config.pitchDeg),      // Z = pitch (side axis)
    );
    m.scale.setScalar(Math.max(0.01, this.config.scaleMul));
    m.updateMatrixWorld(true);

    // Wipe particles on every slider tick. The container stays empty during
    // the drag (no stale-particle / mask-edge transients to worry about) and
    // refills naturally from the inlet over ~1 s once the user releases.
    this.particles?.resetAllParticles();
    if (this.orientDebounceId !== null) clearTimeout(this.orientDebounceId);
    this.orientDebounceId = setTimeout(() => {
      this.orientDebounceId = null;
      // Final re-voxelization once the user has settled.
      this.uploadObstacleToFluidSurface();
    }, 100);
  }

  private rebuildObstacle() {
    if (this.obstacleMesh) {
      this.scene.remove(this.obstacleMesh);
      this.disposeMeshOrGroup(this.obstacleMesh);
      this.obstacleMesh = null;
    }
    // 2D mode: LBM2D voxelizes its own scene internally; there's no
    // Three.js obstacle mesh, and the LBM3D-only mask upload path doesn't
    // apply.
    if (this.config.mode2D) return;
    const { sx, sy } = this.latticeWorld();
    const x = -sx * 0.5 + sx * this.config.obstacleXFrac;
    const r = sy * 0.18;
    const halfLen = sy * 0.42;

    switch (this.config.shapeId) {
      case 'cylinder': {
        // Higher radial segment count → smoother round silhouette in the
        // voxelized collision mask, eliminating polygonal stair-stepping in
        // the wake when viewed end-on.
        const geom = new THREE.CylinderGeometry(r, r, sy * 0.85, 96, 1);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'cone': {
        const geom = new THREE.ConeGeometry(r, 2 * halfLen, 64);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        // Apex points into the wind (-X), base trails downstream (+X) —
        // matches the voxelize convention.
        mesh.rotation.z = Math.PI / 2;
        this.obstacleMesh = mesh;
        break;
      }
      case 'wing':
      case 'naca-0006':
      case 'naca-0012':
      case 'naca-0024':
      case 'naca-2412':
      case 'naca-4412':
      case 'naca-6412': {
        // 4-digit NACA airfoil profile: m = max camber (%c), p = position
        // of max camber (10ths of c), tt = thickness (%c). "wing" stays as
        // 0012 for backward-compat; the rest decode the id.
        let m = 0, p = 0.5, tt = 0.12;
        if (this.config.shapeId.startsWith('naca-')) {
          const d = this.config.shapeId.slice(5);
          m  = parseInt(d[0]!, 10) / 100;
          p  = parseInt(d[1]!, 10) / 10;
          tt = parseInt(d.slice(2), 10) / 100;
          if (p === 0) p = 0.5;
        }
        const shape = new THREE.Shape();
        // Cosine-spaced sampling concentrates points at the leading and
        // trailing edges where curvature is highest — standard practice for
        // airfoil discretization. 200 chordwise samples give a smooth LE that
        // voxelizes into a properly curved collision silhouette instead of a
        // visibly faceted polygon.
        const pts = 200;
        const topPts: THREE.Vector2[] = [];
        const botPts: THREE.Vector2[] = [];
        const sxc = halfLen * 2;  // chord length in world units
        for (let i = 0; i <= pts; i++) {
          // Cosine spacing: xc = ½(1 − cos(βπ)) packs samples near xc=0 and xc=1.
          const beta = (Math.PI * i) / pts;
          const xc = 0.5 * (1 - Math.cos(beta));
          const sq = Math.sqrt(Math.max(0, xc));
          const yt = 5 * tt * (0.2969 * sq - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1015 * xc * xc * xc * xc);
          let yc = 0, dyc_dx = 0;
          if (m > 0) {
            if (xc < p) {
              yc = (m / (p * p)) * (2 * p * xc - xc * xc);
              dyc_dx = (2 * m / (p * p)) * (p - xc);
            } else {
              yc = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
              dyc_dx = (2 * m / ((1 - p) * (1 - p))) * (p - xc);
            }
          }
          const theta = Math.atan(dyc_dx);
          const xu = xc - yt * Math.sin(theta);
          const yu = yc + yt * Math.cos(theta);
          const xl = xc + yt * Math.sin(theta);
          const yl = yc - yt * Math.cos(theta);
          // yu/yl are fractions of chord (per NACA polynomial); world-y must
          // therefore be yu*sxc, not yu*sxc*0.5 — the old halving rendered a
          // NACA 0012 at ~6 % thickness instead of the labelled 12 %.
          topPts.push(new THREE.Vector2((xu - 0.5) * sxc, yu * sxc));
          botPts.push(new THREE.Vector2((xl - 0.5) * sxc, yl * sxc));
        }
        shape.moveTo(topPts[0].x, topPts[0].y);
        for (let i = 1; i < topPts.length; i++) shape.lineTo(topPts[i].x, topPts[i].y);
        for (let i = botPts.length - 1; i >= 0; i--) shape.lineTo(botPts[i].x, botPts[i].y);
        shape.closePath();
        // steps: span the extrusion across multiple Z slices so the
        // barycentric voxel stamper fills the wing volume without striping
        // gaps at high lattice resolutions.
        const extrudeSettings = { depth: halfLen * 3, bevelEnabled: false, steps: 8, curveSegments: 32 };
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.translate(0, 0, -halfLen * 1.5);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        this.obstacleMesh = mesh;
        break;
      }
      case 'cube': {
        const geom = new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'pyramid': {
        const geom = new THREE.ConeGeometry(r * 1.2, r * 1.8, 4);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        mesh.rotation.z = Math.PI / 2;
        this.obstacleMesh = mesh;
        break;
      }
      case 'torus': {
        const geom = new THREE.TorusGeometry(r, r * 0.35, 48, 96);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'capsule': {
        const geom = new THREE.CapsuleGeometry(r * 0.55, r * 1.5, 24, 48);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        mesh.rotation.z = Math.PI / 2;
        this.obstacleMesh = mesh;
        break;
      }
      case 'icosahedron': {
        const geom = new THREE.IcosahedronGeometry(r, 0);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'octahedron': {
        const geom = new THREE.OctahedronGeometry(r, 0);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'dodecahedron': {
        const geom = new THREE.DodecahedronGeometry(r, 0);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'tetrahedron': {
        const geom = new THREE.TetrahedronGeometry(r * 1.2, 0);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'teapot': {
        const geom = new TeapotGeometry(r, 24);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'sphere': {
        const geom = new THREE.SphereGeometry(r, 96, 64);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      default: {
        // Anything not a built-in shape is treated as a remote model id.
        // Start it as a placeholder sphere so the scene has something while
        // the .glb fetch is in flight, then swap once the geometry resolves.
        const model = getRemoteModel(this.config.shapeId);
        if (!model) {
          const geom = new THREE.SphereGeometry(r, 96, 64);
          this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        } else {
          const placeholder = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 32, 16), this.makeMat());
          this.obstacleMesh = placeholder;
          this.kickRemoteModelLoad(model, r, halfLen);
        }
        break;
      }
    }

    this.obstacleMesh.position.set(x, 0, 0);
    // Apply current orientation + scale sliders before voxelizing so the
    // LBM mask matches what's on screen.
    const deg2rad = (d: number) => (d * Math.PI) / 180;
    this.obstacleMesh.rotation.set(
      deg2rad(this.config.rollDeg),
      deg2rad(this.config.yawDeg),
      deg2rad(this.config.pitchDeg),
    );
    this.obstacleMesh.scale.setScalar(Math.max(0.01, this.config.scaleMul));
    this.scene.add(this.obstacleMesh);

    // Update the obstacle bound, then WIPE all particles (per user spec —
    // changing shape should clear the scene and let the new flow develop).
    const remoteElongated = getRemoteModel(this.config.shapeId)?.elongated === true;
    const elongated = this.config.shapeId === 'cone' || this.config.shapeId === 'wing' ||
                      this.config.shapeId === 'cylinder' || remoteElongated;
    const boundR = elongated ? halfLen : r;
    this.particles?.setObstacle({ x, y: 0, z: 0 }, boundR);
    this.fluidSurface?.setObstacle({ x, y: 0, z: 0 }, boundR);
    this.particles?.resetAllParticles();

    // Extract the obstacle's geometry into our WebGPU pipeline so it shares
    // the depth buffer with the particles → proper depth occlusion from any
    // camera angle for ANY shape. Hide the Three.js mesh to avoid drawing twice.
    this.uploadObstacleToFluidSurface();
    this.obstacleMesh.visible = false;
  }

  /**
   * Kick off a remote .glb fetch for `model`, then swap the placeholder
   * obstacle for the real geometry when it lands. If the user changes shape
   * mid-fetch, the result is discarded so we don't overwrite a newer choice.
   */
  private kickRemoteModelLoad(model: RemoteModel, r: number, halfLen: number) {
    const target = model.id;
    showToast(`Loading ${model.name} (~${(model.sizeKB / 1024).toFixed(1)} MB)…`);
    loadRemoteModel(model.url).then((geom) => {
      // Bail out if the user picked something else while we were fetching.
      if (this.config.shapeId !== target) return;

      // Scale: longest side maps to ~1.1 * halfLen — leaves headroom on
      // every side for flow to develop. (Tighter than the cylinder/cone
      // defaults because real-mesh bboxes are looser than their visible silhouette.)
      const targetSize = halfLen * 1.1;
      geom.applyMatrix4(new THREE.Matrix4().makeScale(targetSize, targetSize, targetSize));
      if (model.yawRad) {
        geom.applyMatrix4(new THREE.Matrix4().makeRotationY(model.yawRad));
      }
      geom.computeVertexNormals();

      // Replace the placeholder with the real mesh in place.
      if (this.obstacleMesh) {
        const x = this.obstacleMesh.position.x;
        this.scene.remove(this.obstacleMesh);
        this.disposeMeshOrGroup(this.obstacleMesh);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        mesh.position.set(x, 0, 0);
        // Carry the current orientation/scale slider state into the swap.
        const d2r = (d: number) => (d * Math.PI) / 180;
        mesh.rotation.set(
          d2r(this.config.rollDeg),
          d2r(this.config.yawDeg),
          d2r(this.config.pitchDeg),
        );
        mesh.scale.setScalar(Math.max(0.01, this.config.scaleMul));
        this.obstacleMesh = mesh;
        this.scene.add(this.obstacleMesh);
        this.uploadObstacleToFluidSurface();
        this.particles?.resetAllParticles();
        this.obstacleMesh.visible = false;
      }
      showToast(`${model.name} loaded`);
      // Note: r is captured for parity with built-ins but the merged mesh
      // already came pre-centered + unit-normalised so `r` isn't used here.
      void r;
    }).catch((err) => {
      console.warn('remote model load failed', err);
      showToast(`Failed to load ${model.name}`);
    });
  }

  /** Merge all meshes under obstacleMesh into a single interleaved buffer + indices. */
  private uploadObstacleToFluidSurface() {
    if (!this.obstacleMesh || !this.fluidSurface) return;

    // Collect geometries (in obstacle-local coords, BAKED with each child's transform
    // so the group's children align correctly when drawn in our pipeline).
    const collected: THREE.BufferGeometry[] = [];
    this.obstacleMesh.updateMatrixWorld(true);
    this.obstacleMesh.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry.clone();
      g.computeVertexNormals();
      // Bake child's local transform relative to the obstacle root into the geometry,
      // so all children share the same coordinate space.
      const local = new THREE.Matrix4().copy(m.matrixWorld).premultiply(
        new THREE.Matrix4().copy(this.obstacleMesh!.matrixWorld).invert(),
      );
      g.applyMatrix4(local);
      collected.push(g);
    });

    if (collected.length === 0) return;
    const merged = collected.length === 1 ? collected[0] : mergeGeometries(collected, false);
    if (!merged) return;

    const posAttr = merged.attributes.position;
    const normAttr = merged.attributes.normal;
    const idxAttr = merged.index;
    const vCount = posAttr.count;
    const inter = new Float32Array(vCount * 6);
    for (let i = 0; i < vCount; i++) {
      inter[i * 6 + 0] = posAttr.getX(i);
      inter[i * 6 + 1] = posAttr.getY(i);
      inter[i * 6 + 2] = posAttr.getZ(i);
      inter[i * 6 + 3] = normAttr.getX(i);
      inter[i * 6 + 4] = normAttr.getY(i);
      inter[i * 6 + 5] = normAttr.getZ(i);
    }
    const indices = idxAttr ? new Uint32Array(idxAttr.array as ArrayLike<number>) : null;
    this.fluidSurface.setObstacleGeometry(inter, indices);

    // UNIFIED COLLISION: voxelize the exact same merged geometry into the LBM
    // solid mask. The merged geometry is in OBSTACLE-LOCAL coords (which is
    // what the GPU obstacle pipeline expects — it applies the obstacle's
    // modelMatrix in the vertex shader). For voxelization we need WORLD
    // coords, so clone and bake the obstacle's world matrix in.
    if (this.lbm) {
      const worldGeom = merged.clone();
      worldGeom.applyMatrix4(this.obstacleMesh.matrixWorld);
      const { sx, sy, sz } = this.latticeWorld();
      const aabbMin = new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5);
      const aabbSize = new THREE.Vector3(sx, sy, sz);
      const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);
      // Build pre-solid mask for the floor BEFORE voxelization. This way the
      // flood-fill sees the floor as a wall and any fluid pocket trapped
      // between obstacle and floor is correctly classified as interior.
      // (Old order — flood-fill THEN floor OR — left stale fluid pockets.)
      const floorRow = this.config.floorEnabled
        ? Math.max(1, Math.min(H - 1, Math.round(this.config.floorYFrac * H)))
        : 0;
      let preSolid: Uint32Array | undefined;
      if (floorRow > 0) {
        preSolid = new Uint32Array(W * H * D);
        for (let y = 0; y < floorRow; y++) {
          for (let z = 0; z < D; z++) {
            for (let x = 0; x < W; x++) {
              preSolid[x + y * W + z * W * H] = 1;
            }
          }
        }
      }
      const mask = voxelizeAnyMesh(worldGeom, { W, H, D }, aabbMin, aabbSize, preSolid);
      // Frontal (y-z) silhouette area excluding the floor band so drag is
      // measured on the body alone.
      let frontalCells = 0;
      for (let y = floorRow; y < H; y++) {
        for (let z = 0; z < D; z++) {
          for (let x = 0; x < W; x++) {
            if (mask[x + y * W + z * W * H] === 1) { frontalCells++; break; }
          }
        }
      }
      this.lbm.setMaskBuffer(mask);
      // Kill any particle currently inside the freshly-voxelized mask. The
      // bounding-sphere kill misses cylinder caps / airfoil tips; this
      // exact-mask sweep evicts them so they don't appear "stuck on the
      // surface" while waiting to age out.
      this.particles?.killParticlesInsideObstacle();
      this.dragCalc?.setFrontalArea(frontalCells);
      // Characteristic length ≈ √(frontal area). Drives Reynolds-number
      // display so the HUD shows U·D/ν, not U·N/4·1/ν. For a circular
      // frontal silhouette this equals D·√(π)/2 ≈ 0.886·D, close enough
      // for HUD purposes regardless of shape.
      this.lbm.charLengthCells = Math.max(1, Math.round(Math.sqrt(frontalCells)));
      worldGeom.dispose();
    }

    // Free the clones.
    for (const g of collected) g.dispose();
    if (collected.length > 1 && merged !== collected[0]) merged.dispose();
  }

  private wireDragDrop() {
    const overlay = document.getElementById('drop-overlay')!;

    // Listen at window level so the overlay shows as soon as the user starts
    // dragging anywhere on the page, not only over the canvas.
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth++;
      if (e.dataTransfer?.types?.includes('Files')) overlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => { e.preventDefault(); });
    window.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) overlay.hidden = true;
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragDepth = 0;
      overlay.hidden = true;
      const file = e.dataTransfer?.files[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'glb' && ext !== 'obj' && ext !== 'stl') {
        showToast('Supported formats: .glb, .obj, .stl');
        return;
      }

      showToast('Loading mesh…');

      try {
        let geometry: THREE.BufferGeometry | null = null;

        if (ext === 'glb') {
          const loader = new GLTFLoader();
          const buf = await file.arrayBuffer();
          const gltf = await new Promise<any>((resolve, reject) => {
            loader.parse(buf, '', resolve, reject);
          });
          gltf.scene.traverse((child: THREE.Object3D) => {
            if (!geometry && child instanceof THREE.Mesh) {
              geometry = child.geometry.clone();
            }
          });
        } else if (ext === 'stl') {
          // STLLoader.parse accepts ArrayBuffer (binary STL) or string (ASCII STL).
          // We hand it the binary buffer and let it detect which form it is.
          const loader = new STLLoader();
          const buf = await file.arrayBuffer();
          geometry = loader.parse(buf);
        } else {
          const loader = new OBJLoader();
          const text = await file.text();
          const obj = loader.parse(text);
          obj.traverse((child: THREE.Object3D) => {
            if (!geometry && child instanceof THREE.Mesh) {
              geometry = child.geometry.clone();
            }
          });
        }

        if (!geometry) {
          showToast('No mesh found in file');
          return;
        }

        showToast('Voxelizing…');

        if (!this.lbm) return;
        const { W, H, D } = { W: this.lbm.W, H: this.lbm.H, D: this.lbm.D };
        const mask = await voxelizeMesh(geometry, W, H, D);
        this.lbm.setMaskBuffer(mask);

        // Show a custom mesh as the obstacle
        if (this.obstacleMesh) {
          this.scene.remove(this.obstacleMesh);
          this.disposeMeshOrGroup(this.obstacleMesh);
          this.obstacleMesh = null;
        }
        const { sx } = this.latticeWorld();
        const uploadMesh = new THREE.Mesh(geometry, this.makeMat());
        uploadMesh.position.set(-sx * 0.5 + sx * this.config.obstacleXFrac, 0, 0);
        this.obstacleMesh = uploadMesh;
        this.scene.add(this.obstacleMesh);

        // Mark the custom option as active in the select
        const sel = document.getElementById('shape-select') as HTMLSelectElement;
        const customOpt = sel.querySelector('option[value="custom"]') as HTMLOptionElement | null;
        if (customOpt) {
          customOpt.disabled = false;
          sel.value = 'custom';
        }

        showToast('Upload complete');
      } catch (err) {
        console.error('Upload failed', err);
        showToast('Upload failed — see console');
      }
    });
  }

  setShape(id: string) {
    this.config.shapeId = id;
    this.rebuildObstacle();
  }

  setResolution(N: number) {
    this.config.N = Math.max(16, Math.min(256, Math.round(N)));
    this.rebuildLatticeBox();
    this.rebuildObstacle();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private handleResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer?.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }
  }

  private loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    this.controls.update();

    // LBM substeps. Sim speed > 1 stacks substeps; < 1 throttles via accumulator.
    if (this.lbm && !this.config.paused) {
      const subBudget = Math.max(0, this.config.simSpeed);
      // Integer steps directly; fractional speeds modulate via deterministic rounding.
      this.subAccum += subBudget;
      let steps = Math.floor(this.subAccum);
      this.subAccum -= steps;
      // Hard-cap to avoid runaway when tab returns from background
      if (steps > 6) steps = 6;
      for (let s = 0; s < steps; s++) {
        this.lbm.step();
        this.dye?.step();
        this.simStepCount++;
      }
    }

    try {
      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      console.error('render error', err);
      this.running = false;
      return;
    }

    // ── Per-frame GPU rendering, branched by active view mode ───────────────
    if (this.lbm) {
      this.camera.updateMatrixWorld();
      const view    = this.camera.matrixWorldInverse;
      const proj    = this.camera.projectionMatrix;
      const camPos  = this.camera.position;
      const { sx, sy, sz } = this.latticeWorld();
      const aabbMin = new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5);
      const aabbMax = new THREE.Vector3( sx * 0.5,  sy * 0.5,  sz * 0.5);
      const { W, H, D } = latticeDims(this.config.N, this.config.mode2D);

      if (this.viewMode === 'particles' && this.particles && this.fluidSurface) {
        // ── Particles (default) ── sphere impostors via FluidSurfaceRenderer
        if (!this.config.paused) {
          const dt = 6.0 * this.config.simSpeed;
          this.particles.advectOnly(view, proj, camPos, aabbMin, aabbMax, { W, H, D }, { dt });
        }
        const sphereSize = (sx / 170) * this.config.ballSize;
        const t = performance.now() * 0.001;
        if (this.obstacleMesh) {
          this.obstacleMesh.updateMatrixWorld();
          this.fluidSurface.setObstacleTransform(view, proj, this.obstacleMesh.matrixWorld);
        }
        this.fluidSurface.renderRawSpheres(view, proj, sphereSize, t, aabbMin, aabbMax);

      } else if (this.viewMode === 'streamlines' && this.streamlines) {
        // ── Streamlines ── RK4 ribbons + Cp-shaded obstacle.
        // Draw the obstacle into the canvas before the streamline pass so its
        // pixels sit underneath the ribbons (streamlines blend over with their
        // own alpha, the obstacle remains visible through gaps).
        if (this.fluidSurface && this.obstacleMesh) {
          this.obstacleMesh.updateMatrixWorld();
          this.fluidSurface.setObstacleTransform(view, proj, this.obstacleMesh.matrixWorld);
          this.fluidSurface.setObstacleFlowParams(aabbMin, aabbMax, this.config.uIn);
          this.fluidSurface.renderObstacleOnly();
        }
        const slDt = this.config.paused ? 0 : 0.08 * this.config.simSpeed;
        this.streamlines.render(view, proj, aabbMin, aabbMax, { W, H, D }, slDt);


      } else if (this.viewMode === 'slice') {
        // ── Full-viewport slice ──
        if (this.sliceViewer) {
          this.sliceViewer.render(aabbMin, aabbMax, { W, H, D });
        }
      }

      // PiP slice overlay in non-slice modes (only when btn-slice is active)
      if (this.viewMode !== 'slice' && this.sliceActive && this.sliceViewer) {
        this.sliceViewer.render(aabbMin, aabbMax, { W, H, D });
      }
    }

    const now = performance.now();
    this.frameCount++;

    // Dispatch a drag-coefficient compute pass every 500 ms — the integrator
    // is cheap (one pass over the lattice) and the readback is async so it
    // doesn't stall the render loop.
    if (this.dragCalc && now - this.lastDragComputeMs >= 500) {
      this.dragCalc.compute();
      this.lastDragComputeMs = now;
    }

    if (now - this.lastFpsUpdate >= 500) {
      const fps = (this.frameCount * 1000) / (now - this.lastFpsUpdate);

      // Analyse tab readout (existing IDs — keep working)
      const fpsEl = document.getElementById('rd-fps');
      if (fpsEl) fpsEl.textContent = fps.toFixed(0);
      const cd = this.dragCalc?.getLastCd() ?? 0;
      const cl = this.dragCalc?.getLastCl() ?? 0;
      const cdEl = document.getElementById('rd-cd');
      if (cdEl) cdEl.textContent = cd.toFixed(2);
      const clEl = document.getElementById('rd-cl');
      if (clEl) clEl.textContent = cl.toFixed(2);

      // Floating telemetry chips (new)
      const chipCd = document.getElementById('chip-cd');
      if (chipCd) chipCd.textContent = cd.toFixed(2);
      const chipFps = document.getElementById('chip-fps');
      if (chipFps) chipFps.textContent = fps.toFixed(0);
      const chipRe = document.getElementById('chip-re');
      if (chipRe) {
        const re = computeRe(this.config.uIn, this.config.visc, this.config.N, this.lbm?.charLengthCells);
        chipRe.textContent = re >= 1000 ? (re / 1000).toFixed(1) + 'k' : re.toFixed(0);
      }
      const chipMa = document.getElementById('chip-ma');
      if (chipMa) {
        // Mach number: u_lattice / c_s where c_s = 1/√3 ≈ 0.577
        const ma = this.config.uIn / (1 / Math.sqrt(3));
        chipMa.textContent = ma.toFixed(3);
      }

      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  };

  private subAccum = 0;

  private buildInjectPipeline(device: GPUDevice) {
    this._injectBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const module = device.createShaderModule({ code: INJECT_WGSL, label: 'inject.wgsl' });
    this._injectPipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this._injectBindGroupLayout] }),
      compute: { module, entryPoint: 'cs_inject' },
    });
    // 48 bytes: vec3f center(12) + f32 radius(4) + vec3f impulse(12) + u32 type_(4) + vec3u dims(12) + u32 pad(4)
    this._injectParamsBuf = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private dispatchInject(cx: number, cy: number, cz: number) {
    if (!this.lbm || !this._injectPipeline || !this._injectParamsBuf || !this._injectBindGroupLayout) return;
    const device = this._gpuDevice;
    if (!device) return;

    const radius = Math.max(3, Math.round(this.lbm.H * 0.06));
    const strength = 0.20;                              // bigger pulse — visible drag effect
    const typeVal = this._injectMode === 'impulse' ? 1 : 0;

    const rawBuf = new ArrayBuffer(48);
    const f32 = new Float32Array(rawBuf);
    const u32 = new Uint32Array(rawBuf);
    f32[0] = cx; f32[1] = cy; f32[2] = cz;
    f32[3] = radius;
    f32[4] = strength; f32[5] = 0; f32[6] = 0;
    u32[7] = typeVal;
    u32[8] = this.lbm.W; u32[9] = this.lbm.H; u32[10] = this.lbm.D;
    u32[11] = 0;
    device.queue.writeBuffer(this._injectParamsBuf, 0, rawBuf);

    const fBuf = this.lbm.currentFBuffer;
    const bg = device.createBindGroup({
      layout: this._injectBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._injectParamsBuf } },
        { binding: 1, resource: { buffer: fBuf } },
      ],
    });

    const enc = device.createCommandEncoder({ label: 'inject' });
    const pass = enc.beginComputePass();
    pass.setPipeline(this._injectPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(
      Math.ceil(this.lbm.W / 4),
      Math.ceil(this.lbm.H / 4),
      Math.ceil(this.lbm.D / 4),
    );
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  private wireInject() {
    const canvas = this.canvas;
    let pointerDown = false;

    const canvasToLattice = (clientX: number, clientY: number): [number, number, number] | null => {
      if (!this.lbm) return null;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

      const { sx, sy, sz } = this.latticeWorld();
      const box = new THREE.Box3(
        new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5),
        new THREE.Vector3(sx * 0.5, sy * 0.5, sz * 0.5),
      );
      const target = new THREE.Vector3();
      if (!raycaster.ray.intersectBox(box, target)) return null;

      const ix = Math.round(((target.x + sx * 0.5) / sx) * (this.lbm.W - 1));
      const iy = Math.round(((target.y + sy * 0.5) / sy) * (this.lbm.H - 1));
      const iz = Math.round(((target.z + sz * 0.5) / sz) * (this.lbm.D - 1));
      return [
        Math.max(0, Math.min(this.lbm.W - 1, ix)),
        Math.max(0, Math.min(this.lbm.H - 1, iy)),
        Math.max(0, Math.min(this.lbm.D - 1, iz)),
      ];
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (!this._injectActive) return;
      pointerDown = true;
      const lc = canvasToLattice(e.clientX, e.clientY);
      if (lc) this.dispatchInject(...lc);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this._injectActive || !pointerDown) return;
      const lc = canvasToLattice(e.clientX, e.clientY);
      if (lc) this.dispatchInject(...lc);
    });
    canvas.addEventListener('pointerup', () => { pointerDown = false; });
    canvas.addEventListener('pointerleave', () => { pointerDown = false; });
  }
}
