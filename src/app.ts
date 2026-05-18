import * as THREE from 'three';
import { WebGPURenderer, MeshStandardNodeMaterial, LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { defaultConfig, latticeDims, computeRe } from './config';
import { LBM3D } from './sim/lbm3d';
import type { ShapeId } from './sim/voxelize';

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
  private obstacleMesh: THREE.Mesh | null = null;

  private lbm: LBM3D | null = null;
  private simStepCount = 0;
  private rafId = 0;
  private running = false;

  // fps smoothing
  private lastFpsUpdate = 0;
  private frameCount = 0;

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
      const { W, H, D } = latticeDims(this.config.N);
      this.lbm = new LBM3D(device, W, H, D);
      this.lbm.uIn = this.config.uIn;
      this.lbm.visc = this.config.visc;
      this.lbm.aoaRad = (this.config.aoaDeg * Math.PI) / 180;
      this.lbm.gravity = this.config.gravity;
      this.lbm.setShape(this.config.shapeId as ShapeId);
    }

    this.wireUI();

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

  private rebuildObstacle() {
    if (this.obstacleMesh) {
      this.scene.remove(this.obstacleMesh);
      this.obstacleMesh.geometry.dispose();
      (this.obstacleMesh.material as THREE.Material).dispose();
      this.obstacleMesh = null;
    }
    const { sx, sy } = this.latticeWorld();
    // Place obstacle 30% of the way along the tunnel (from the inlet).
    const x = -sx * 0.5 + sx * 0.3;
    const r = sy * 0.18;
    let geom: THREE.BufferGeometry;
    switch (this.config.shapeId) {
      case 'cylinder':
        geom = new THREE.CylinderGeometry(r, r, sy * 0.85, 48);
        break;
      case 'sphere':
      default:
        geom = new THREE.SphereGeometry(r, 48, 32);
        break;
    }
    const mat = new MeshStandardNodeMaterial({
      color: 0xe7e9f0,
      roughness: 0.32,
      metalness: 0.04,
      emissive: 0x14141d,
    });
    this.obstacleMesh = new THREE.Mesh(geom, mat);
    this.obstacleMesh.position.set(x, 0, 0);
    this.scene.add(this.obstacleMesh);
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
}
