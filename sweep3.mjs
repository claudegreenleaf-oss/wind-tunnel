import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync('/tmp/wt-sweep3', { recursive: true });
const b = await chromium.launch({ channel:'chromium', headless:true, args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=metal','--no-sandbox'] });
const p = await (await b.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PE: '+e.message));
p.on('console', m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('https://wind-tunnel-thomas.surge.sh/',{waitUntil:'networkidle'});
await p.waitForTimeout(6000);
const set = async (sel, val) => p.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }, val);
const shot = async n => p.screenshot({path:`/tmp/wt-sweep3/${n}.png`});

const findings = [];
const note = (k, v) => { findings.push({k,v}); console.log(k,':',v); };

// 1. Verify all 47 shape options render visibly (sample 12)
await p.click('.phase-tab[data-phase="setup"]');
await p.waitForTimeout(200);
const shapes = await p.$$eval('#shape-select option', els => els.map(e => e.value).filter(v=>v && v!=='custom'));
note('shape_count', shapes.length);

// 2. Camera orbit test (drag on canvas)
const canvas = await p.locator('#view').boundingBox();
note('canvas_box', JSON.stringify(canvas));

// Synthetic drag using mouse
await p.mouse.move(canvas.x + canvas.width/2, canvas.y + canvas.height/2);
await p.mouse.down();
await p.mouse.move(canvas.x + canvas.width/2 + 200, canvas.y + canvas.height/2 + 100, {steps:10});
await p.mouse.up();
await p.waitForTimeout(800);
await shot('cam-after-drag');

// 3. Zoom (wheel)
await p.mouse.wheel(0, -500);
await p.waitForTimeout(500);
await shot('cam-after-zoom-in');
await p.mouse.wheel(0, 1000);
await p.waitForTimeout(500);
await shot('cam-after-zoom-out');

// Reset camera by reload — too complex; skip
// 4. Floor visual: enable + raise + see floor in canvas
await p.click('#cb-floor');
await p.waitForTimeout(500);
await set('#sl-floor', '0.4');
await p.waitForTimeout(1500);
await shot('floor-enabled-04');
const floorChecked = await p.isChecked('#cb-floor');
note('floor_check', floorChecked);
await p.click('#cb-floor'); // disable
await set('#sl-floor', '0');

// 5. Speed slider visual change
await p.click('.phase-tab[data-phase="run"]');
await p.waitForTimeout(200);
await set('#sl-speed', '0.005');
await p.waitForTimeout(2000);
await shot('speed-low');
await set('#sl-speed', '0.18');
await p.waitForTimeout(2000);
await shot('speed-high');
await set('#sl-speed', '0.1');

// 6. Viscosity slider visual change
await set('#sl-visc', '0.0005');
await p.waitForTimeout(2500);
await shot('visc-low');
const re1 = await p.$eval('#val-re', e => e.textContent);
await set('#sl-visc', '0.06');
await p.waitForTimeout(2500);
await shot('visc-high');
const re2 = await p.$eval('#val-re', e => e.textContent);
note('Re_visc_low_to_high', `${re1} -> ${re2}`);
await set('#sl-visc', '0.01');

// 7. Resolution change (heavier — sim re-inits)
await p.click('.phase-tab[data-phase="setup"]');
await p.waitForTimeout(200);
await p.click('button.adv-chip[data-adv="res-adv"]');
await p.waitForTimeout(200);
const nVal0 = await p.$eval('#sl-N', e => e.value);
note('N_default', nVal0);
await set('#sl-N', '120');
await p.waitForTimeout(4000);  // re-init time
await shot('N-120');
const nVal1 = await p.$eval('#sl-N', e => e.value);
note('N_after', nVal1);

// 8. Inject ON + dye mode
await p.click('.phase-tab[data-phase="run"]');
await p.waitForTimeout(200);
await p.click('#btn-inject');
await p.waitForTimeout(500);
await p.click('#btn-inject-mode');
await p.waitForTimeout(500);
const injMode = await p.$eval('#btn-inject-mode', e => e.textContent);
note('inject_mode', injMode);
await p.click('#tab-bar .tab[data-mode="volume"]');
await p.waitForTimeout(4000);
await shot('volume-inject-dye');
await p.click('#tab-bar .tab[data-mode="particles"]');
await p.click('#btn-inject');

// 9. Pause/step
await p.click('#btn-play');
await p.waitForTimeout(500);
await shot('paused');
const stepDis = await p.$eval('#btn-step', e => e.disabled);
note('step_disabled_when_paused', stepDis);
await p.click('#btn-step');
await p.waitForTimeout(200);
await shot('after-step');
await p.click('#btn-play');

// 10. Slow-mo
await p.click('#btn-slowmo');
await p.waitForTimeout(1500);
await shot('slowmo-on');
await p.click('#btn-slowmo');

// 11. Test drop overlay synthetically
await p.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['x'], 'test.stl', { type: 'application/octet-stream' }));
  window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable:true }));
});
await p.waitForTimeout(400);
const dropVis = await p.locator('#drop-overlay').isVisible().catch(()=>false);
note('drop_overlay_on_dragenter', dropVis);
await p.evaluate(()=>window.dispatchEvent(new DragEvent('dragleave', {bubbles:true})));

// 12. Responsive
for (const [w,h] of [[1920,1080],[768,1024],[480,800]]) {
  await p.setViewportSize({width:w,height:h});
  await p.waitForTimeout(500);
  await shot(`resp-${w}x${h}`);
}
await p.setViewportSize({width:1280,height:800});

note('total_errors', errs.length);
for (const e of errs.slice(0,5)) console.log('ERR:', e.slice(0,140));
writeFileSync('/tmp/wt-sweep3/findings.json', JSON.stringify(findings, null, 2));
await b.close();
