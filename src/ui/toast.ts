export function showToast(message: string, durationMs = 3000) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1e1e2e', 'color:#cdd6f4', 'padding:10px 20px',
    'border-radius:8px', 'font-size:14px', 'z-index:9999',
    'box-shadow:0 4px 16px rgba(0,0,0,0.6)', 'pointer-events:none',
    'opacity:1', 'transition:opacity 0.4s',
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, durationMs);
}
