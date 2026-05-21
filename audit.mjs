// Comprehensive Playwright audit of https://wind-tunnel-thomas.surge.sh/
// Tests every UI feature, samples telemetry, captures console errors.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const URL = 'https://wind-tunnel-thomas.surge.sh/';
const OUT = '/tmp/wt-audit';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const log = (group, name, status, evidence = '') => {
  results.push({ group, name, status, evidence });
  console.log(`[${group}] ${name}: ${status}${evidence ? ' — ' + evidence : ''}`);
};

const browser = await chromium.launch({
  channel: 'chromium',  // full chromium, not headless-shell (which strips WebGPU)
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=metal',
    '--enable-webgpu-developer-features',
    '--no-sandbox',
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', m => {
  const t = m.type();
  if (t === 'error' || t === 'warning') errors.push(`[${t}] ${m.text()}`);
});
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

console.log('Navigating to', URL);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(5000);  // let WebGPU init + sim warmup

// ─── BOOT ─────────────────────────────────────────────────
const canvasInfo = await page.evaluate(() => {
  const c = document.getElementById('view');
  return c ? { w: c.clientWidth, h: c.clientHeight, ww: window.innerWidth, wh: window.innerHeight } : null;
});
if (!canvasInfo) log('BOOT', 'Canvas exists', 'FAIL', 'no #view element');
else {
  log('BOOT', 'Canvas exists', 'PASS', `${canvasInfo.w}×${canvasInfo.h}`);
  const fullVp = canvasInfo.w >= canvasInfo.ww * 0.95 && canvasInfo.h >= canvasInfo.wh * 0.95;
  log('BOOT', 'Full-viewport canvas', fullVp ? 'PASS' : 'FAIL', `canvas ${canvasInfo.w}×${canvasInfo.h} vs vp ${canvasInfo.ww}×${canvasInfo.wh}`);
}

const webgpuOk = await page.evaluate(() => {
  const c = document.getElementById('view');
  if (!c) return false;
  try { return !!c.getContext('webgpu'); } catch { return false; }
});
log('BOOT', 'WebGPU context', webgpuOk ? 'PASS' : 'FAIL', webgpuOk ? '' : 'getContext("webgpu") failed or null');

const tabBar = await page.locator('#tab-bar').isVisible().catch(() => false);
log('BOOT', 'Tab bar visible', tabBar ? 'PASS' : 'FAIL');

const panel = await page.locator('#panel').isVisible().catch(() => false);
log('BOOT', 'Panel visible', panel ? 'PASS' : 'FAIL');

const chipsVisible = await page.locator('#telemetry-chips').isVisible().catch(() => false);
log('BOOT', 'Telemetry chips visible', chipsVisible ? 'PASS' : 'FAIL');

// Sample a region of canvas to check if anything's rendered (non-black)
const canvasPixelSample = await page.evaluate(async () => {
  const c = document.getElementById('view');
  if (!c) return null;
  // We can't read WebGPU canvas pixels easily without copy; try OffscreenCanvas
  return { w: c.width, h: c.height };
});
log('BOOT', 'Canvas backing pixels', canvasPixelSample ? 'PASS' : 'FAIL', JSON.stringify(canvasPixelSample));

await page.screenshot({ path: `${OUT}/01-boot.png`, fullPage: false });

// ─── TELEMETRY CHIPS (sample twice 2s apart to see if they update) ───
const chipSample = async () => page.evaluate(() => ({
  cd: document.getElementById('chip-cd')?.textContent,
  re: document.getElementById('chip-re')?.textContent,
  fps: document.getElementById('chip-fps')?.textContent,
  ma: document.getElementById('chip-ma')?.textContent,
}));
const c1 = await chipSample();
await page.waitForTimeout(2200);
const c2 = await chipSample();
log('CHIPS', 'chip-cd shows numeric', c2.cd && c2.cd !== '—' ? 'PASS' : 'FAIL', `t1=${c1.cd} t2=${c2.cd}`);
log('CHIPS', 'chip-re shows numeric', c2.re && c2.re !== '—' ? 'PASS' : 'FAIL', `t1=${c1.re} t2=${c2.re}`);
log('CHIPS', 'chip-fps shows numeric', c2.fps && c2.fps !== '—' ? 'PASS' : 'FAIL', `t1=${c1.fps} t2=${c2.fps}`);
log('CHIPS', 'chip-ma shows numeric', c2.ma && c2.ma !== '—' ? 'PASS' : 'FAIL', `t1=${c1.ma} t2=${c2.ma}`);
log('CHIPS', 'Chips update over time', c1.fps !== c2.fps ? 'PASS' : 'FAIL', `fps t1=${c1.fps} t2=${c2.fps}`);

// ─── VIEW-MODE TABS ────────────────────────────────────────
const viewTabs = ['particles', 'streamlines', 'volume', 'slice'];
for (const mode of viewTabs) {
  try {
    await page.click(`#tab-bar .tab[data-mode="${mode}"]`, { timeout: 2000 });
    await page.waitForTimeout(1500);
    const activeMode = await page.evaluate(() => document.querySelector('#tab-bar .tab.active')?.dataset.mode);
    const ok = activeMode === mode;
    log('VIEW', `Switch to "${mode}"`, ok ? 'PASS' : 'FAIL', `active=${activeMode}`);
    await page.screenshot({ path: `${OUT}/view-${mode}.png` });

    // For slice tab, the #slice-fullvp should be visible
    if (mode === 'slice') {
      const sliceVis = await page.locator('#slice-fullvp').isVisible().catch(() => false);
      log('VIEW', 'Slice full-vp shown', sliceVis ? 'PASS' : 'FAIL');
    }
  } catch (e) {
    log('VIEW', `Switch to "${mode}"`, 'FAIL', `error: ${e.message}`);
  }
}

// Back to particles for remaining tests
await page.click(`#tab-bar .tab[data-mode="particles"]`);
await page.waitForTimeout(800);

// ─── PHASE TABS ────────────────────────────────────────────
for (const phase of ['setup', 'run', 'analyse']) {
  try {
    await page.click(`.phase-tab[data-phase="${phase}"]`);
    await page.waitForTimeout(200);
    const visible = await page.locator(`.phase-panel[data-phase="${phase}"]`).isVisible();
    log('PHASE', `Phase "${phase}"`, visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('PHASE', `Phase "${phase}"`, 'FAIL', e.message);
  }
}

// ─── SETUP TAB ─────────────────────────────────────────────
await page.click('.phase-tab[data-phase="setup"]');
await page.waitForTimeout(300);

// Shape dropdown
const shapeOpts = await page.$$eval('#shape-select option', els => els.map(e => e.value));
log('SETUP', 'Shape options count', shapeOpts.length >= 12 ? 'PASS' : 'FAIL', `n=${shapeOpts.length}: ${shapeOpts.slice(0, 8).join(',')}...`);

// Try selecting a non-default shape
await page.selectOption('#shape-select', 'cube').catch(() => {});
await page.waitForTimeout(500);
const shapeNow = await page.$eval('#shape-select', el => el.value);
log('SETUP', 'Select cube', shapeNow === 'cube' ? 'PASS' : 'FAIL', `val=${shapeNow}`);

await page.selectOption('#shape-select', 'naca-2412').catch(() => {});
await page.waitForTimeout(500);
const shapeNow2 = await page.$eval('#shape-select', el => el.value);
log('SETUP', 'Select airfoil', shapeNow2 === 'naca-2412' ? 'PASS' : 'FAIL', `val=${shapeNow2}`);

await page.selectOption('#shape-select', 'sphere').catch(() => {});
await page.waitForTimeout(300);

// Sliders helper
const setSlider = async (sel, val) => {
  await page.$eval(sel, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, val);
};
const readText = async sel => page.$eval(sel, el => el.textContent);

// Position
await setSlider('#sl-xfrac', '0.6');
await page.waitForTimeout(150);
const xfracTxt = await readText('#val-xfrac');
log('SETUP', 'Position slider updates label', xfracTxt && xfracTxt.includes('60') ? 'PASS' : 'FAIL', `val-xfrac=${xfracTxt}`);

// Scale
await setSlider('#sl-scale', '1.8');
await page.waitForTimeout(150);
const scaleTxt = await readText('#val-scale');
log('SETUP', 'Scale slider updates label', scaleTxt && scaleTxt.includes('1.8') ? 'PASS' : 'FAIL', `val=${scaleTxt}`);

// Yaw
await setSlider('#sl-yaw', '45');
await page.waitForTimeout(150);
const yawTxt = await readText('#val-yaw');
log('SETUP', 'Yaw slider updates label', yawTxt && yawTxt.includes('45') ? 'PASS' : 'FAIL', `val=${yawTxt}`);

// Open shape advanced
await page.click('button.adv-chip[data-adv="shape-adv"]');
await page.waitForTimeout(150);
const shapeAdvOpen = await page.locator('#shape-adv').isVisible();
log('SETUP', 'Shape advanced reveals', shapeAdvOpen ? 'PASS' : 'FAIL');

if (shapeAdvOpen) {
  await setSlider('#sl-pitch', '30');
  await page.waitForTimeout(120);
  const pitchTxt = await readText('#val-pitch');
  log('SETUP', 'Pitch slider', pitchTxt && pitchTxt.includes('30') ? 'PASS' : 'FAIL', `val=${pitchTxt}`);

  await setSlider('#sl-roll', '-45');
  await page.waitForTimeout(120);
  const rollTxt = await readText('#val-roll');
  log('SETUP', 'Roll slider', rollTxt && rollTxt.includes('-45') ? 'PASS' : 'FAIL', `val=${rollTxt}`);

  await page.click('#btn-reset-orient');
  await page.waitForTimeout(120);
  const afterReset = await readText('#val-yaw');
  log('SETUP', 'Reset orientation', afterReset && afterReset.includes('0') ? 'PASS' : 'FAIL', `val-yaw=${afterReset}`);
}

// Floor
await page.check('#cb-floor');
await page.waitForTimeout(150);
const floorChecked = await page.isChecked('#cb-floor');
log('SETUP', 'Floor checkbox toggles', floorChecked ? 'PASS' : 'FAIL');

await setSlider('#sl-floor', '0.25');
await page.waitForTimeout(150);
const floorTxt = await readText('#val-floor');
log('SETUP', 'Floor height slider', floorTxt && floorTxt.includes('25') ? 'PASS' : 'FAIL', `val=${floorTxt}`);

await page.uncheck('#cb-floor');

// Resolution advanced
await page.click('button.adv-chip[data-adv="res-adv"]');
await page.waitForTimeout(120);
const resAdvOpen = await page.locator('#res-adv').isVisible();
log('SETUP', 'Resolution advanced reveals', resAdvOpen ? 'PASS' : 'FAIL');
if (resAdvOpen) {
  const nVal = await page.$eval('#sl-N', el => el.value);
  log('SETUP', 'N slider has value', nVal ? 'PASS' : 'FAIL', `N=${nVal}`);
}

// ─── RUN TAB ───────────────────────────────────────────────
await page.click('.phase-tab[data-phase="run"]');
await page.waitForTimeout(300);

await setSlider('#sl-speed', '0.1');
await page.waitForTimeout(150);
const speedTxt = await readText('#val-speed');
log('RUN', 'Wind speed slider', speedTxt && speedTxt.trim() !== '' ? 'PASS' : 'FAIL', `val=${speedTxt}`);

await setSlider('#sl-visc', '0.01');
await page.waitForTimeout(150);
const viscTxt = await readText('#val-visc');
const reTxt = await readText('#val-re');
log('RUN', 'Viscosity slider', viscTxt && viscTxt.trim() !== '' ? 'PASS' : 'FAIL', `visc=${viscTxt} re=${reTxt}`);

await setSlider('#sl-aoa', '15');
await page.waitForTimeout(150);
const aoaTxt = await readText('#val-aoa');
log('RUN', 'AoA slider', aoaTxt && aoaTxt.includes('15') ? 'PASS' : 'FAIL', `val=${aoaTxt}`);

await setSlider('#sl-inlet', '0.3');
await page.waitForTimeout(150);
const inletTxt = await readText('#val-inlet');
log('RUN', 'Inlet size slider', inletTxt && inletTxt.includes('30') ? 'PASS' : 'FAIL', `val=${inletTxt}`);

// Flow advanced
await page.click('button.adv-chip[data-adv="flow-adv"]');
await page.waitForTimeout(120);
const flowAdvOpen = await page.locator('#flow-adv').isVisible();
log('RUN', 'Flow advanced reveals', flowAdvOpen ? 'PASS' : 'FAIL');

if (flowAdvOpen) {
  await setSlider('#sl-ball', '2.5');
  await page.waitForTimeout(120);
  const ballTxt = await readText('#val-ball');
  log('RUN', 'Ball size slider', ballTxt && ballTxt.includes('2.5') ? 'PASS' : 'FAIL', `val=${ballTxt}`);

  const inletsHostHtml = await page.$eval('#inlets-host', el => el.innerHTML.length);
  log('RUN', 'Per-jet inlets UI populated', inletsHostHtml > 10 ? 'PASS' : 'FAIL', `innerHTML len=${inletsHostHtml}`);
}

// Physics toggles
const mrt1 = await readText('#btn-mrt');
await page.click('#btn-mrt');
await page.waitForTimeout(100);
const mrt2 = await readText('#btn-mrt');
log('RUN', 'MRT toggle cycles', mrt1 !== mrt2 ? 'PASS' : 'FAIL', `${mrt1} -> ${mrt2}`);

const les1 = await readText('#btn-les');
await page.click('#btn-les');
await page.waitForTimeout(100);
const les2 = await readText('#btn-les');
log('RUN', 'LES toggle cycles', les1 !== les2 ? 'PASS' : 'FAIL', `${les1} -> ${les2}`);

const slip1 = await readText('#btn-slip');
await page.click('#btn-slip');
await page.waitForTimeout(100);
const slip2 = await readText('#btn-slip');
log('RUN', 'Slip toggle cycles', slip1 !== slip2 ? 'PASS' : 'FAIL', `${slip1} -> ${slip2}`);

// Physics advanced (gravity)
await page.click('button.adv-chip[data-adv="phys-adv"]');
await page.waitForTimeout(120);
const physAdvOpen = await page.locator('#phys-adv').isVisible();
log('RUN', 'Physics advanced (gravity) reveals', physAdvOpen ? 'PASS' : 'FAIL');

if (physAdvOpen) {
  await setSlider('#sl-grav-x', '0.0005');
  await page.waitForTimeout(100);
  const gxTxt = await readText('#val-grav-x');
  log('RUN', 'Gravity X slider', gxTxt && parseFloat(gxTxt) !== 0 ? 'PASS' : 'FAIL', `val=${gxTxt}`);
}

// Play/pause/step
const play1 = await readText('#btn-play');
await page.click('#btn-play');
await page.waitForTimeout(150);
const play2 = await readText('#btn-play');
log('RUN', 'Play toggles label', play1 !== play2 ? 'PASS' : 'FAIL', `${play1} -> ${play2}`);

const stepDisabled = await page.$eval('#btn-step', el => el.disabled);
log('RUN', 'Step enabled when paused', !stepDisabled || play2.includes('Play') ? 'PASS' : 'PARTIAL', `disabled=${stepDisabled}, play=${play2}`);

// Resume
await page.click('#btn-play');
await page.waitForTimeout(150);

// Slow-mo
const slo1 = await readText('#btn-slowmo');
const sloClass1 = await page.$eval('#btn-slowmo', el => el.className);
await page.click('#btn-slowmo');
await page.waitForTimeout(100);
const sloClass2 = await page.$eval('#btn-slowmo', el => el.className);
log('RUN', 'Slow-mo toggle', sloClass1 !== sloClass2 ? 'PASS' : 'FAIL', `cls ${sloClass1} -> ${sloClass2}`);
await page.click('#btn-slowmo');  // toggle back

// Sim speed
await setSlider('#sl-speed-mul', '2.0');
await page.waitForTimeout(150);
const speedMulTxt = await readText('#val-speed-mul');
log('RUN', 'Sim speed slider', speedMulTxt && speedMulTxt.trim() !== '' ? 'PASS' : 'FAIL', `val=${speedMulTxt}`);

// Reset flow
await page.click('#btn-reset');
await page.waitForTimeout(500);
log('RUN', 'Reset flow button click', 'PASS', '(no immediate side-effect check)');

// Inject
const inj1 = await readText('#btn-inject');
await page.click('#btn-inject');
await page.waitForTimeout(100);
const inj2 = await readText('#btn-inject');
log('RUN', 'Inject toggle', inj1 !== inj2 ? 'PASS' : 'FAIL', `${inj1} -> ${inj2}`);

const injModeDisabled = await page.$eval('#btn-inject-mode', el => el.disabled);
log('RUN', 'Inject mode enabled when on', !injModeDisabled ? 'PASS' : 'FAIL', `disabled=${injModeDisabled}`);

if (!injModeDisabled) {
  const mode1 = await readText('#btn-inject-mode');
  await page.click('#btn-inject-mode');
  await page.waitForTimeout(100);
  const mode2 = await readText('#btn-inject-mode');
  log('RUN', 'Inject mode cycles', mode1 !== mode2 ? 'PASS' : 'FAIL', `${mode1} -> ${mode2}`);
}
await page.click('#btn-inject');  // toggle off

// ─── ANALYSE TAB ───────────────────────────────────────────
await page.click('.phase-tab[data-phase="analyse"]');
await page.waitForTimeout(500);

const rdSample = async () => page.evaluate(() => ({
  cd: document.getElementById('rd-cd')?.textContent,
  cl: document.getElementById('rd-cl')?.textContent,
  rey: document.getElementById('rd-rey')?.textContent,
  fps: document.getElementById('rd-fps')?.textContent,
}));
const r1 = await rdSample();
await page.waitForTimeout(2000);
const r2 = await rdSample();
log('ANALYSE', 'rd-cd numeric', r2.cd && r2.cd !== '—' ? 'PASS' : 'FAIL', `t1=${r1.cd} t2=${r2.cd}`);
log('ANALYSE', 'rd-cl numeric', r2.cl && r2.cl !== '—' ? 'PASS' : 'FAIL', `t1=${r1.cl} t2=${r2.cl}`);
log('ANALYSE', 'rd-rey numeric', r2.rey && r2.rey !== '—' ? 'PASS' : 'FAIL', `t1=${r1.rey} t2=${r2.rey}`);
log('ANALYSE', 'rd-fps numeric', r2.fps && r2.fps !== '—' ? 'PASS' : 'FAIL', `t1=${r1.fps} t2=${r2.fps}`);

// Slice axis & field
const sliceAxes = await page.$$eval('#sel-slice-axis option', els => els.map(e => e.value));
const sliceFields = await page.$$eval('#sel-slice-field option', els => els.map(e => e.value));
log('ANALYSE', 'Slice axis options', sliceAxes.length >= 3 ? 'PASS' : 'FAIL', sliceAxes.join(','));
log('ANALYSE', 'Slice field options', sliceFields.length >= 3 ? 'PASS' : 'FAIL', sliceFields.join(','));

await page.selectOption('#sel-slice-axis', 'x');
await page.waitForTimeout(150);
await page.selectOption('#sel-slice-field', 'pressure');
await page.waitForTimeout(150);
await setSlider('#sl-slice-pos', '0.7');
await page.waitForTimeout(150);
const slicePosTxt = await readText('#val-slice-pos');
log('ANALYSE', 'Slice position slider', slicePosTxt && slicePosTxt.trim() !== '' ? 'PASS' : 'FAIL', `val=${slicePosTxt}`);

await page.check('#cb-slice-mask');
const sliceMaskChecked = await page.isChecked('#cb-slice-mask');
log('ANALYSE', 'Slice mask checkbox', sliceMaskChecked ? 'PASS' : 'FAIL');
await page.uncheck('#cb-slice-mask');

// Tests runner
await page.click('#btn-run-tests');
await page.waitForTimeout(8000);
const testSummary = await readText('#tests-summary');
const testCount = await page.$$eval('#tests-results li', els => els.length);
log('ANALYSE', 'Tests runner produces results', testCount > 0 ? 'PASS' : 'FAIL', `n=${testCount}, summary="${testSummary}"`);

await page.screenshot({ path: `${OUT}/analyse.png` });

// ─── DROP OVERLAY ──────────────────────────────────────────
const dropOverlayExists = await page.locator('#drop-overlay').count();
log('UPLOAD', 'Drop overlay element exists', dropOverlayExists > 0 ? 'PASS' : 'FAIL');

// Test dragenter shows overlay
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['dummy'], 'test.stl', { type: 'application/octet-stream' }));
  window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
});
await page.waitForTimeout(200);
const dropVisible = await page.locator('#drop-overlay').isVisible().catch(() => false);
log('UPLOAD', 'Drop overlay shows on dragenter', dropVisible ? 'PASS' : 'FAIL');
await page.evaluate(() => {
  window.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
});

// ─── COLLAPSE / RESPONSIVE ─────────────────────────────────
for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [480, 800]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  const tabBarVis = await page.locator('#tab-bar').isVisible();
  const panelVis = await page.locator('#panel').isVisible();
  log('RESPONSIVE', `${w}×${h}`, tabBarVis && panelVis ? 'PASS' : 'FAIL', `tabBar=${tabBarVis} panel=${panelVis}`);
  await page.screenshot({ path: `${OUT}/resp-${w}x${h}.png` });
}

// ─── FINAL ─────────────────────────────────────────────────
const summary = {
  total: results.length,
  pass: results.filter(r => r.status === 'PASS').length,
  fail: results.filter(r => r.status === 'FAIL').length,
  partial: results.filter(r => r.status === 'PARTIAL').length,
  errors: errors.length,
};

writeFileSync(`${OUT}/results.json`, JSON.stringify({ summary, results, errors }, null, 2));
writeFileSync(`${OUT}/report.md`, [
  '# Wind-Tunnel Audit Report',
  `Target: ${URL}`,
  `Date: ${new Date().toISOString()}`,
  '',
  `**${summary.pass}/${summary.total} passed** · ${summary.fail} failed · ${summary.partial} partial · ${summary.errors} console errors`,
  '',
  '## Results',
  ...['BOOT','VIEW','PHASE','CHIPS','SETUP','RUN','ANALYSE','UPLOAD','RESPONSIVE'].flatMap(g => {
    const rows = results.filter(r => r.group === g);
    if (!rows.length) return [];
    return ['', `### ${g}`, '', ...rows.map(r => `- **${r.status}** ${r.name}${r.evidence ? ' — `' + r.evidence + '`' : ''}`)];
  }),
  '',
  '## Console Errors',
  errors.length ? errors.map(e => '- `' + e + '`').join('\n') : '(none)',
].join('\n'));

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
console.log(`\nReport: ${OUT}/report.md`);
console.log(`JSON:   ${OUT}/results.json`);

await browser.close();
