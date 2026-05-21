import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('/tmp/wt-new', { recursive: true });
const b = await chromium.launch({ channel:'chromium', headless:true, args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=metal','--no-sandbox'] });
const p = await (await b.newContext({ viewport:{width:1600,height:1000} })).newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
await p.waitForTimeout(6000);
// streamlines: check obstacle now visible + view-controls panel
await p.click('#tab-bar .tab[data-mode="streamlines"]');
await p.waitForTimeout(5000);
await p.screenshot({path:'/tmp/wt-new/streamlines-sphere.png'});
// switch shape to airfoil
await p.click('.phase-tab[data-phase="setup"]');
await p.waitForTimeout(200);
await p.selectOption('#shape-select','naca-2412');
await p.waitForTimeout(4000);
await p.screenshot({path:'/tmp/wt-new/streamlines-airfoil.png'});
// volume
await p.click('#tab-bar .tab[data-mode="volume"]');
await p.waitForTimeout(4500);
await p.screenshot({path:'/tmp/wt-new/volume.png'});
console.log('errors:', errs.slice(0,5));
await b.close();
