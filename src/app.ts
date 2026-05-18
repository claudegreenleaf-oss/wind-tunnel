import * as THREE from 'three';
import { WebGPURenderer, MeshStandardNodeMaterial, LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { defaultConfig, latticeDims, computeRe } from './config';
import { LBM3D } from './sim/lbm3d';
import { DyeField3D } from './sim/dye3d';
import { VolumeRenderer } from './render/volume3d';
import type { ShapeId } from './sim/voxelize';
import { voxelizeMesh } from './obstacles/upload';
import { showToast } from './ui/toast';

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
  private readonly config = defaultConfig();

  private renderer!: WebGPURenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private latticeGroup!: THREE.Group;
  private obstacleMesh: THREE.Mesh | THREE.Group | null = null;

  private lbm: LBM3D | null = null;
  private dye: DyeField3D | null = null;
  private volumeRenderer: VolumeRenderer | null = null;
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
    this.camera.position.set(8, 4, 8);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

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
      const { W, H, D } = latticeDims(this.config.N);
      this.lbm = new LBM3D(device, W, H, D);
      this.lbm.uIn = this.config.uIn;
      this.lbm.visc = this.config.visc;
      this.lbm.aoaRad = (this.config.aoaDeg * Math.PI) / 180;
      this.lbm.gravity = this.config.gravity;
      this.lbm.setShape(this.config.shapeId as ShapeId);

      // Phase 3: 3D dye field
      this.dye = new DyeField3D(device, W, H, D, () => this.lbm!.macrosTextureView);

      // Inject pipeline
      this.buildInjectPipeline(device);

      // Phase 2: volumetric raymarcher overlaid on Three.js canvas
      const ctx = this.canvas.getContext('webgpu') as GPUCanvasContext;
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.volumeRenderer = new VolumeRenderer(device, canvasFormat, () => ctx.getCurrentTexture().createView());
      this.volumeRenderer.setTextures(this.lbm.macrosTextureView, this.dye.currentView);
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
      const { W, H, D } = latticeDims(this.config.N);
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

    const dyeSlider = q<HTMLInputElement>('#sl-dye');
    const dyeVal = q<HTMLSpanElement>('#val-dye');
    dyeSlider.value = String(this.config.dyeAmount);
    dyeVal.textContent = this.config.dyeAmount.toFixed(2);
    dyeSlider.addEventListener('input', () => {
      this.config.dyeAmount = parseFloat(dyeSlider.value);
      dyeVal.textContent = this.config.dyeAmount.toFixed(2);
    });

    const speedMul = q<HTMLInputElement>('#sl-speed-mul');
    const speedMulVal = q<HTMLSpanElement>('#val-speed-mul');
    speedMul.value = String(this.config.simSpeed);
    speedMulVal.textContent = `${this.config.simSpeed.toFixed(2)}×`;
    speedMul.addEventListener('input', () => {
      this.config.simSpeed = parseFloat(speedMul.value);
      speedMulVal.textContent = `${this.config.simSpeed.toFixed(2)}×`;
    });

    const shapeSelect = q<HTMLSelectElement>('#shape-select');
    shapeSelect.value = this.config.shapeId;
    shapeSelect.addEventListener('change', () => {
      const id = shapeSelect.value as ShapeId;
      this.config.shapeId = id;
      this.rebuildObstacle();
      if (this.lbm) this.lbm.setShape(id);
    });

    q<HTMLButtonElement>('#btn-reset').addEventListener('click', () => {
      this.lbm?.resetFlow();
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
        this.simStepCount++;
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

    // Physics: MRT/TRT toggle
    const mrtBtn = q<HTMLButtonElement>('#btn-mrt');
    mrtBtn.addEventListener('click', () => {
      this.config.useMRT = !this.config.useMRT;
      if (this.lbm) this.lbm.useMRT = this.config.useMRT ? 1 : 0;
      mrtBtn.textContent = this.config.useMRT ? 'Collision: MRT' : 'Collision: BGK';
      mrtBtn.classList.toggle('active', this.config.useMRT);
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

    this.refreshReHud();
  }

  private applyResolution() {
    if (!this.lbm) return;
    const { W, H, D } = latticeDims(this.config.N);
    this.lbm.resize(W, H, D);
    this.lbm.setShape(this.config.shapeId as ShapeId);
    this.rebuildLatticeBox();
    this.rebuildObstacle();
    this.simStepCount = 0;
    this.refreshReHud();
  }

  private refreshReHud() {
    const re = computeRe(this.config.uIn, this.config.visc, this.config.N);
    const reEl = document.getElementById('val-re');
    const reHud = document.getElementById('rd-rey');
    if (reEl) reEl.textContent = re.toFixed(0);
    if (reHud) reHud.textContent = re.toFixed(0);
  }

  private latticeWorld() {
    // Map lattice cells to world units. We pick W=10 wide (in world space).
    const { W, H, D } = latticeDims(this.config.N);
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
    const inletMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    inletMat.color = new THREE.Color(0xff7ad9);
    const inlet = new THREE.Mesh(inletGeom, inletMat);
    inlet.position.set(-sx * 0.5, 0, 0);
    inlet.rotation.y = Math.PI * 0.5;
    this.latticeGroup.add(inlet);
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

  private makeMat() {
    return new MeshStandardNodeMaterial({
      color: 0xe7e9f0,
      roughness: 0.32,
      metalness: 0.04,
      emissive: 0x14141d,
    });
  }

  private rebuildObstacle() {
    if (this.obstacleMesh) {
      this.scene.remove(this.obstacleMesh);
      this.disposeMeshOrGroup(this.obstacleMesh);
      this.obstacleMesh = null;
    }
    const { sx, sy } = this.latticeWorld();
    const x = -sx * 0.5 + sx * 0.3;
    const r = sy * 0.18;
    const halfLen = sy * 0.42;

    switch (this.config.shapeId) {
      case 'cylinder': {
        const geom = new THREE.CylinderGeometry(r, r, sy * 0.85, 48);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'cone': {
        const geom = new THREE.ConeGeometry(r, 2 * halfLen, 32);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        mesh.rotation.z = -Math.PI / 2;
        this.obstacleMesh = mesh;
        break;
      }
      case 'wing': {
        const shape = new THREE.Shape();
        const pts = 32;
        const topPts: THREE.Vector2[] = [];
        const botPts: THREE.Vector2[] = [];
        for (let i = 0; i <= pts; i++) {
          const xc = i / pts;
          const sq = Math.sqrt(Math.max(0, xc));
          const yt = 5 * 0.12 * (0.2969 * sq - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1015 * xc * xc * xc * xc);
          const px = (xc - 0.5) * 2 * halfLen;
          const py = yt * halfLen * 0.5;
          topPts.push(new THREE.Vector2(px, py));
          botPts.push(new THREE.Vector2(px, -py));
        }
        shape.moveTo(topPts[0].x, topPts[0].y);
        for (let i = 1; i < topPts.length; i++) shape.lineTo(topPts[i].x, topPts[i].y);
        for (let i = botPts.length - 1; i >= 0; i--) shape.lineTo(botPts[i].x, botPts[i].y);
        shape.closePath();
        const extrudeSettings = { depth: halfLen * 3, bevelEnabled: false };
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.translate(0, 0, -halfLen * 1.5);
        const mesh = new THREE.Mesh(geom, this.makeMat());
        this.obstacleMesh = mesh;
        break;
      }
      case 'teapot': {
        const geom = new TeapotGeometry(r, 12);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'f1car': {
        const group = new THREE.Group();
        // Main hull: scaled sphere
        const hullGeom = new THREE.SphereGeometry(r, 32, 16);
        const hull = new THREE.Mesh(hullGeom, this.makeMat());
        hull.scale.set(1.0, 0.4, 0.7);
        group.add(hull);
        // 4 wheels
        const wr = r * 0.2;
        const wh = r * 0.15;
        const wx = r * 0.6;
        const wz = r * 0.6;
        const wheelPositions: [number, number, number][] = [
          [wx, 0, wz], [wx, 0, -wz], [-wx, 0, wz], [-wx, 0, -wz],
        ];
        for (const [wPx, wPy, wPz] of wheelPositions) {
          const wGeom = new THREE.CylinderGeometry(wr, wr, wh * 2, 16);
          const wheel = new THREE.Mesh(wGeom, this.makeMat());
          wheel.position.set(wPx, wPy, wPz);
          group.add(wheel);
        }
        this.obstacleMesh = group;
        break;
      }
      case 'helmet': {
        const geom = new THREE.SphereGeometry(r, 48, 32);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
      case 'sphere':
      default: {
        const geom = new THREE.SphereGeometry(r, 48, 32);
        this.obstacleMesh = new THREE.Mesh(geom, this.makeMat());
        break;
      }
    }

    this.obstacleMesh.position.set(x, 0, 0);
    this.scene.add(this.obstacleMesh);
  }

  private wireDragDrop() {
    const overlay = document.getElementById('drop-overlay')!;

    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      overlay.hidden = false;
    });

    this.canvas.addEventListener('dragleave', () => {
      overlay.hidden = true;
    });

    this.canvas.addEventListener('drop', async (e) => {
      e.preventDefault();
      overlay.hidden = true;
      const file = e.dataTransfer?.files[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'glb' && ext !== 'obj') {
        showToast('Only .glb and .obj files are supported');
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
        uploadMesh.position.set(-sx * 0.5 + sx * 0.3, 0, 0);
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

    // Volumetric overlay — runs after Three.js so it composites on top.
    if (this.volumeRenderer && this.lbm) {
      this.camera.updateMatrixWorld();
      const view = this.camera.matrixWorldInverse;
      const proj = this.camera.projectionMatrix;
      const camPos = this.camera.position;
      const { sx, sy, sz } = this.latticeWorld();
      const aabbMin = new THREE.Vector3(-sx * 0.5, -sy * 0.5, -sz * 0.5);
      const aabbMax = new THREE.Vector3(sx * 0.5, sy * 0.5, sz * 0.5);
      // Update dye view each frame in case ping-pong swapped
      if (this.dye) {
        this.volumeRenderer.setTextures(this.lbm.macrosTextureView, this.dye.currentView);
      }
      this.volumeRenderer.render(view, proj, camPos, aabbMin, aabbMax, 32);
    }

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 500) {
      const fps = (this.frameCount * 1000) / (now - this.lastFpsUpdate);
      const fpsEl = document.getElementById('rd-fps');
      if (fpsEl) fpsEl.textContent = fps.toFixed(0);
      const cdEl = document.getElementById('rd-cd');
      if (cdEl) cdEl.textContent = `${this.simStepCount} steps`;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  };

  private subAccum = 0;

  /** Placeholder for Track C canvas click-inject wiring. */
  private wireInject() {
    // Track C will implement canvas mousedown/mousemove handlers here.
  }

  /** Placeholder for Track C inject pipeline setup. Fields kept here to avoid TS errors. */
  private buildInjectPipeline(_device: GPUDevice) {
    void this._gpuDevice;
    void this._injectActive;
    void this._injectMode;
    void this._injectPipeline;
    void this._injectParamsBuf;
    void this._injectBindGroupLayout;
  }
}
