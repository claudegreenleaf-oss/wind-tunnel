import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

/** Rolling C_d/C_l readout + small uPlot graph in the side panel. */
export class HUD {
  private cdEl: HTMLElement;
  private clEl: HTMLElement;
  private reEl: HTMLElement;
  private fpsEl: HTMLElement;

  private plot: uPlot;
  private buf: { t: number[]; cd: number[] } = { t: [], cd: [] };
  private readonly maxSamples = 300;

  // fps smoothing
  private lastFpsUpdate = 0;
  private frameCount = 0;

  constructor() {
    this.cdEl = document.getElementById('rd-cd')!;
    this.clEl = document.getElementById('rd-cl')!;
    this.reEl = document.getElementById('rd-rey')!;
    this.fpsEl = document.getElementById('rd-fps')!;

    const target = document.getElementById('cd-chart')!;
    const opts: uPlot.Options = {
      width: target.clientWidth || 280,
      height: 90,
      pxAlign: false,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false }, y: { auto: true } },
      axes: [
        { stroke: '#8c8fa3', grid: { stroke: '#1f1f2c' }, ticks: { stroke: '#1f1f2c' }, size: 20 },
        { stroke: '#8c8fa3', grid: { stroke: '#1f1f2c' }, ticks: { stroke: '#1f1f2c' }, size: 30 },
      ],
      series: [
        {},
        { stroke: '#6bf0d6', width: 1.5, points: { show: false } },
      ],
    };
    this.plot = new uPlot(opts, [[], []], target);
    window.addEventListener('resize', () => {
      this.plot.setSize({ width: target.clientWidth, height: 90 });
    });
  }

  pushForce(cd: number, cl: number, re: number) {
    this.cdEl.textContent = isFinite(cd) ? cd.toFixed(2) : '—';
    this.clEl.textContent = isFinite(cl) ? cl.toFixed(2) : '—';
    this.reEl.textContent = isFinite(re) ? re.toFixed(0) : '—';

    const t = this.buf.t.length ? this.buf.t[this.buf.t.length - 1] + 1 : 0;
    this.buf.t.push(t);
    this.buf.cd.push(isFinite(cd) ? cd : 0);
    if (this.buf.t.length > this.maxSamples) {
      this.buf.t.shift();
      this.buf.cd.shift();
    }
    this.plot.setData([this.buf.t, this.buf.cd]);
  }

  tickFps(nowMs: number) {
    this.frameCount++;
    if (nowMs - this.lastFpsUpdate >= 500) {
      const fps = (this.frameCount * 1000) / (nowMs - this.lastFpsUpdate);
      this.fpsEl.textContent = fps.toFixed(0);
      this.frameCount = 0;
      this.lastFpsUpdate = nowMs;
    }
  }
}
