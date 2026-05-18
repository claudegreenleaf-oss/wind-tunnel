import { PRESETS } from '../obstacles/presets';
import type { SimConfig } from '../config';

export interface PanelHandlers {
  onShape: (id: string) => void;
  onDraw: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
  onVisc: (v: number) => void;
  onAoa: (deg: number) => void;
  onDye: (v: number) => void;
  onMode: (mode: number) => void;
}

export class ControlPanel {
  private readonly config: SimConfig;
  private readonly handlers: PanelHandlers;

  constructor(config: SimConfig, handlers: PanelHandlers) {
    this.config = config;
    this.handlers = handlers;
    this.populateShapeSelect();
    this.wireInputs();
    this.wireButtons();
    this.wireKeyboard();
    this.syncFromConfig();
  }

  private q<T extends Element>(sel: string): T {
    const el = document.querySelector<T>(sel);
    if (!el) throw new Error(`missing element: ${sel}`);
    return el;
  }

  private populateShapeSelect() {
    const sel = this.q<HTMLSelectElement>('#shape-select');
    sel.innerHTML = '';
    for (const p of PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      sel.appendChild(opt);
    }
    sel.value = this.config.shapeId;
    sel.addEventListener('change', () => this.handlers.onShape(sel.value));
  }

  private wireInputs() {
    const speed = this.q<HTMLInputElement>('#sl-speed');
    speed.addEventListener('input', () => {
      this.config.uIn = parseFloat(speed.value);
      this.q<HTMLElement>('#val-speed').textContent = this.config.uIn.toFixed(3);
      this.handlers.onSpeed(this.config.uIn);
      this.updateRe();
    });

    const visc = this.q<HTMLInputElement>('#sl-visc');
    visc.addEventListener('input', () => {
      this.config.visc = parseFloat(visc.value);
      this.q<HTMLElement>('#val-visc').textContent = this.config.visc.toFixed(4);
      this.handlers.onVisc(this.config.visc);
      this.updateRe();
    });

    const aoa = this.q<HTMLInputElement>('#sl-aoa');
    aoa.addEventListener('input', () => {
      this.config.aoaDeg = parseFloat(aoa.value);
      this.q<HTMLElement>('#val-aoa').textContent = `${this.config.aoaDeg.toFixed(0)}°`;
      this.handlers.onAoa(this.config.aoaDeg);
    });

    const dye = this.q<HTMLInputElement>('#sl-dye');
    dye.addEventListener('input', () => {
      this.config.dyeAmount = parseFloat(dye.value);
      this.q<HTMLElement>('#val-dye').textContent = this.config.dyeAmount.toFixed(2);
      this.handlers.onDye(this.config.dyeAmount);
    });
  }

  private wireButtons() {
    this.q<HTMLButtonElement>('#btn-draw').addEventListener('click', () => this.handlers.onDraw());
    this.q<HTMLButtonElement>('#btn-reset').addEventListener('click', () => this.handlers.onReset());

    const chips = document.querySelectorAll<HTMLButtonElement>('#viz-modes .chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const m = parseInt(chip.dataset.mode ?? '0', 10);
        this.config.vizMode = m;
        this.setActiveMode();
        this.handlers.onMode(m);
      });
    });
  }

  private wireKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.config.paused = !this.config.paused;
          break;
        case 'r':
        case 'R':
          this.handlers.onReset();
          break;
        case '1': case '2': case '3': case '4': {
          const m = parseInt(e.key, 10) - 1;
          this.config.vizMode = m;
          this.setActiveMode();
          this.handlers.onMode(m);
          break;
        }
      }
    });
  }

  /** Push config values into the DOM (used at startup and after presets change them). */
  syncFromConfig() {
    this.q<HTMLInputElement>('#sl-speed').value = String(this.config.uIn);
    this.q<HTMLElement>('#val-speed').textContent = this.config.uIn.toFixed(3);
    this.q<HTMLInputElement>('#sl-visc').value = String(this.config.visc);
    this.q<HTMLElement>('#val-visc').textContent = this.config.visc.toFixed(4);
    this.q<HTMLInputElement>('#sl-aoa').value = String(this.config.aoaDeg);
    this.q<HTMLElement>('#val-aoa').textContent = `${this.config.aoaDeg.toFixed(0)}°`;
    this.q<HTMLInputElement>('#sl-dye').value = String(this.config.dyeAmount);
    this.q<HTMLElement>('#val-dye').textContent = this.config.dyeAmount.toFixed(2);
    this.q<HTMLSelectElement>('#shape-select').value = this.config.shapeId;
    this.setActiveMode();
    this.updateRe();
  }

  private updateRe() {
    const L = 40; // characteristic length in cells (updated externally if needed)
    const re = (this.config.uIn * L) / Math.max(this.config.visc, 1e-6);
    this.q<HTMLElement>('#val-re').textContent = re.toFixed(0);
  }

  private setActiveMode() {
    const chips = document.querySelectorAll<HTMLButtonElement>('#viz-modes .chip');
    chips.forEach(chip => {
      const m = parseInt(chip.dataset.mode ?? '0', 10);
      chip.classList.toggle('active', m === this.config.vizMode);
    });
  }
}
