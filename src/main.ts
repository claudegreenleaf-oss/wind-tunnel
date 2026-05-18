import './style.css';
import { detectWebGPU } from './webgpu/detect';
import { renderSplash } from './ui/splash';

async function bootstrap() {
  const info = await detectWebGPU();
  if (!info.supported || !info.adapter) {
    renderSplash(info.reason ?? 'WebGPU unavailable');
    return;
  }

  // WebGPU available — load the heavy app lazily so the splash path stays small.
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const mod = await import('./app');
  const app = new mod.App(canvas, info.adapter);
  await app.start();
  (window as unknown as { app: typeof app }).app = app;
}

bootstrap().catch(err => {
  console.error('bootstrap failed', err);
  renderSplash(`Init failed: ${(err as Error).message}`);
});
