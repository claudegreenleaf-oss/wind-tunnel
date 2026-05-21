// Visual audit: screenshot every state, save for human/LLM inspection
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const URL = 'https://wind-tunnel-thomas.surge.sh/';
const OUT = '/tmp/wt-visual';
mkdirSync(OUT, { recursive: true });

const shot = async (page, name, desc) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  → ${name}.png — ${desc}`);
  manifest.push({ name, desc });
};
const manifest = [];

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=metal','--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log('=== BOOT ===');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);   // let sim warm up
await shot(page, '01-boot-default', 'Default state: sphere + flowing particles');

// ─── VIEW MODES ────────────────────────────────────────────
console.log('=== VIEW MODES ===');
for (const mode of ['particles','streamlines','volume','slice']) {
  await page.click(`#tab-bar .tab[data-mode="${mode}"]`);
  await page.waitForTimeout(3500);  // streamlines needs warmup
  await shot(page, `02-view-${mode}`, `View mode: ${mode}`);
}

// back to particles
await page.click('#tab-bar .tab[data-mode="particles"]');
await page.waitForTimeout(1500);

// ─── SHAPE CHANGES ─────────────────────────────────────────
console.log('=== SHAPES ===');
await page.click('.phase-tab[data-phase="setup"]');
await page.waitForTimeout(300);

for (const shape of ['sphere','cube','cylinder','cone','torus','teapot','naca-0012','naca-2412','naca-4412']) {
  await page.selectOption('#shape-select', shape).catch(() => {});
  await page.waitForTimeout(2500);  // shape regeneration takes a bit
  await shot(page, `03-shape-${shape}`, `Shape: ${shape}`);
}

await page.selectOption('#shape-select', 'sphere');
await page.waitForTimeout(2000);

// ─── TRANSFORM SLIDERS ─────────────────────────────────────
console.log('=== TRANSFORMS ===');
const setSlider = async (sel, val) => {
  await page.$eval(sel, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, val);
};

await setSlider('#sl-xfrac', '0.15'); await page.waitForTimeout(1500);
await shot(page, '04-pos-15', 'Position 15% (near inlet)');
await setSlider('#sl-xfrac', '0.85'); await page.waitForTimeout(1500);
await shot(page, '04-pos-85', 'Position 85% (near outlet)');
await setSlider('#sl-xfrac', '0.3'); await page.waitForTimeout(500);

await setSlider('#sl-scale', '0.4'); await page.waitForTimeout(1500);
await shot(page, '05-scale-04', 'Scale 0.4× (small)');
await setSlider('#sl-scale', '2.3'); await page.waitForTimeout(1500);
await shot(page, '05-scale-23', 'Scale 2.3× (large)');
await setSlider('#sl-scale', '1.0'); await page.waitForTimeout(500);

await setSlider('#sl-yaw', '-90'); await page.waitForTimeout(800);
await shot(page, '06-yaw-neg90', 'Yaw −90°');
await setSlider('#sl-yaw', '0'); await page.waitForTimeout(300);

// Test airfoil + yaw together for visual rotation confirmation
await page.selectOption('#shape-select', 'naca-2412');
await page.waitForTimeout(2500);
await shot(page, '07-airfoil-flat', 'Airfoil flat (yaw=0)');
await setSlider('#sl-yaw', '60'); await page.waitForTimeout(1200);
await shot(page, '07-airfoil-yaw60', 'Airfoil yaw 60° (should be rotated)');
await setSlider('#sl-yaw', '0');
await page.selectOption('#shape-select', 'sphere');
await page.waitForTimeout(2000);

// ─── FLOOR ─────────────────────────────────────────────────
console.log('=== FLOOR ===');
await page.check('#cb-floor');
await setSlider('#sl-floor', '0.3');
await page.waitForTimeout(2000);
await shot(page, '08-floor-high', 'Floor enabled at 30% height');
await page.uncheck('#cb-floor');
await page.waitForTimeout(1500);
await shot(page, '08-floor-off', 'Floor disabled');

// ─── RUN PHASE: visual confirmations ───────────────────────
console.log('=== RUN PHASE ===');
await page.click('.phase-tab[data-phase="run"]');
await page.waitForTimeout(300);

// Inlet size — should visibly change spawn region
await setSlider('#sl-inlet', '0.04'); await page.waitForTimeout(2000);
await shot(page, '09-inlet-small', 'Inlet 4% (tiny spawn region)');
await setSlider('#sl-inlet', '0.45'); await page.waitForTimeout(2000);
await shot(page, '09-inlet-large', 'Inlet 45% (huge spawn region)');
await setSlider('#sl-inlet', '0.12'); await page.waitForTimeout(1500);

// Ball size — particle size should change
await page.click('button.adv-chip[data-adv="flow-adv"]');
await page.waitForTimeout(200);
await setSlider('#sl-ball', '3.0'); await page.waitForTimeout(1500);
await shot(page, '10-ball-large', 'Ball size 3× (large dots)');
await setSlider('#sl-ball', '0.3'); await page.waitForTimeout(1500);
await shot(page, '10-ball-small', 'Ball size 0.3× (tiny dots)');
await setSlider('#sl-ball', '1.0');

// Reset flow — should wipe and re-fill
await page.click('#btn-reset');
await page.waitForTimeout(400);
await shot(page, '11-reset-just-after', 'Just after reset (should be empty/wiping)');
await page.waitForTimeout(3000);
await shot(page, '11-reset-recovered', 'After 3s, flow should be refilled');

// Pause
await page.click('#btn-play');
await page.waitForTimeout(500);
await shot(page, '12-paused', 'Paused state (no motion)');
await page.click('#btn-play');
await page.waitForTimeout(500);

// Inject dye
await page.click('#btn-inject');
await page.waitForTimeout(2500);
await shot(page, '13-inject-on', 'Inject ON — dye should be appearing');

// Switch to volume mode while injecting
await page.click('#tab-bar .tab[data-mode="volume"]');
await page.waitForTimeout(3500);
await shot(page, '13-volume-with-inject', 'Volumetric view with active injection (smoke)');

await page.click('#tab-bar .tab[data-mode="particles"]');
await page.waitForTimeout(800);
await page.click('#btn-inject');

// ─── SLICE VIEW DETAIL ─────────────────────────────────────
console.log('=== SLICE FIELDS ===');
await page.click('.phase-tab[data-phase="analyse"]');
await page.waitForTimeout(300);
await page.click('#tab-bar .tab[data-mode="slice"]');
await page.waitForTimeout(2000);

for (const axis of ['x','y','z']) {
  await page.selectOption('#sel-slice-axis', axis);
  await page.waitForTimeout(800);
  for (const field of ['velocity','pressure','vorticity']) {
    await page.selectOption('#sel-slice-field', field);
    await page.waitForTimeout(1200);
    await shot(page, `14-slice-${axis}-${field}`, `Slice ${axis.toUpperCase()}-${field}`);
  }
}

// ─── FINAL SUMMARY ─────────────────────────────────────────
console.log(`\nTook ${manifest.length} screenshots → ${OUT}/`);
console.log(`Console errors: ${errors.length}`);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ manifest, errors: errors.slice(0,30) }, null, 2));

await browser.close();
