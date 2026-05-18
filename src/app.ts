import * as THREE from 'three';
import { defaultConfig, computeRe } from './config';
import { LBMSolver } from './sim/lbm/solver';
import { DyeField } from './sim/dye/dye';
import { CompositeRenderer } from './render/composite';
import { ForceComputer } from './sim/forces/forces';
import { ObstacleManager } from './obstacles';
import { ControlPanel } from './ui/panel';
import { HUD } from './ui/hud';
import { FreeDrawController } from './obstacles/freeDraw';

/**
 * Top-level orchestrator. Owns the renderer, solver, dye field, obstacle manager,
 * force computer, composite renderer, and UI. Runs the requestAnimationFrame loop.
 */
export class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly config = defaultConfig();
  private readonly lbm: LBMSolver;
  private readonly dye: DyeField;
  private readonly forces: ForceComputer;
  private readonly composite: CompositeRenderer;
  private readonly obstacles: ObstacleManager;
  // panel and drawCtrl are constructed for their side effects (event listeners);
  // we don't read them after construction.
  private readonly hud: HUD;

  private running = false;
  private rafId = 0;
  private frame = 0;
  private latestRe = 0;

  // C_d/C_l smoothing (EMA)
  private cdEma = 0;
  private clEma = 0;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1); // we render at lattice resolution then upscale via canvas
    this.renderer.autoClear = false;

    const { width, height } = this.config;

    // Initial obstacle: a cylinder at 1/3 of the way along x, centered vertically.
    this.obstacles = new ObstacleManager(width, height, {
      kind: 'preset',
      presetId: 'cylinder',
      cx: Math.round(width * 0.3),
      cy: Math.round(height * 0.5),
      scale: Math.round(Math.min(width, height) * 0.1),  // ~10% of min dim
      rot: 0,
    });

    this.lbm = new LBMSolver(this.renderer, width, height, this.obstacles.texture);
    this.lbm.uIn = this.config.uIn;
    this.lbm.visc = this.config.visc;
    this.lbm.aoaRad = (this.config.aoaDeg * Math.PI) / 180;

    this.dye = new DyeField(this.renderer, width, height, this.obstacles.texture);
    this.dye.amount = this.config.dyeAmount;

    this.forces = new ForceComputer(this.renderer, width, height);
    this.composite = new CompositeRenderer(width, height);
    this.composite.mode = this.config.vizMode;
    this.composite.speedScale = 1 / Math.max(this.config.uIn, 1e-3);

    this.hud = new HUD();

    const overlay = document.getElementById('draw-overlay')! as HTMLElement;
    const drawCtrl = new FreeDrawController(overlay, this.canvas, {
      onPoint: () => { /* live preview omitted for simplicity */ },
      onCommit: (poly) => {
        // Flip y from DOM (top-down) to lattice (bottom-up) and feed as normalized.
        const flipped: Array<[number, number]> = poly.map(([nx, ny]) => [nx, 1 - ny]);
        this.obstacles.setPolygon(flipped);
        this.config.shapeId = 'custom';
        this.lbm.reset(this.renderer);
        this.dye.reset(this.renderer);
      },
      onCancel: () => { /* nothing */ },
    });

    new ControlPanel(this.config, {
      onShape: (id) => {
        if (id === 'custom') return;
        this.obstacles.setPreset(id);
        this.config.shapeId = id;
        this.lbm.reset(this.renderer);
        this.dye.reset(this.renderer);
      },
      onDraw: () => drawCtrl.enable(),
      onReset: () => {
        this.lbm.reset(this.renderer);
        this.dye.reset(this.renderer);
      },
      onSpeed: (v) => {
        this.lbm.uIn = v;
        this.composite.speedScale = 1 / Math.max(v, 1e-3);
      },
      onVisc: (v) => { this.lbm.visc = v; },
      onAoa: (deg) => {
        this.obstacles.setRotation(-(deg * Math.PI) / 180);
      },
      onDye: (v) => { this.dye.amount = v; },
      onMode: (m) => { this.composite.mode = m; },
    });

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  start() {
    this.running = true;
    this.loop(performance.now());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private handleResize() {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    // Use the lattice resolution as the drawing buffer — canvas CSS handles upscale.
    this.renderer.setSize(this.config.width, this.config.height, false);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  private loop = (nowMs: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    this.tick(nowMs);
  };

  private tick(nowMs: number) {
    if (!this.config.paused) {
      // Multiple LBM substeps per render frame for smoother flow at lower resolutions.
      const substeps = 2;
      for (let s = 0; s < substeps; s++) {
        this.lbm.step(this.renderer);
        this.dye.step(this.renderer, this.lbm.macroTexture, this.obstacles.texture);
      }
      this.frame += substeps;

      // Force readback every 4 frames (amortize cost).
      if (this.frame % 4 === 0) {
        const { Fx, Fy } = this.forces.compute(
          this.renderer,
          this.lbm.fTextureA,
          this.lbm.fTextureB,
          this.lbm.fTextureC,
          this.obstacles.texture,
        );
        // Convert to dimensionless coefficients.
        // C_d = 2 * F / (rho * U^2 * L), with rho = 1, L = obstacle projected width.
        const L = this.obstacles.charLengthCells;
        const denom = Math.max(this.lbm.uIn * this.lbm.uIn * L, 1e-6);
        const cd = (2 * Fx) / denom;
        const cl = (2 * Fy) / denom;
        const a = 0.25;
        this.cdEma = (1 - a) * this.cdEma + a * cd;
        this.clEma = (1 - a) * this.clEma + a * cl;
        this.latestRe = computeRe(this.lbm.uIn, this.lbm.visc, L);
        this.hud.pushForce(this.cdEma, this.clEma, this.latestRe);
      }
    }

    // Composite to default framebuffer (canvas).
    this.composite.render(
      this.renderer,
      null,
      this.lbm.macroTexture,
      this.dye.texture,
      this.obstacles.texture,
    );

    this.hud.tickFps(nowMs);
  }
}
