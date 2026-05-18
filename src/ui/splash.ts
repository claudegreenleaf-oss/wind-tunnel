/** Render the "WebGPU required" splash for unsupported browsers. */
export function renderSplash(reason: string) {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="splash">
      <div class="splash-card">
        <div class="splash-mark">⚡</div>
        <h1>WebGPU required</h1>
        <p>This wind tunnel uses WebGPU compute shaders to run a 3D Lattice
        Boltzmann fluid solver in real time. Your browser doesn't have WebGPU enabled.</p>
        <div class="splash-detail">${escapeHtml(reason)}</div>
        <div class="splash-row">
          <a class="splash-btn" href="https://caniuse.com/webgpu" target="_blank" rel="noopener">Browser compatibility</a>
          <a class="splash-btn primary" href="https://www.google.com/chrome/" target="_blank" rel="noopener">Get Chrome</a>
        </div>
        <p class="splash-tip">Tip: Chrome 113+, Edge 113+, Safari 18+, and Firefox 142+ all support WebGPU.</p>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
