import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('/tmp/wt-inflow', { recursive: true });
const b = await chromium.launch({ channel:'chromium', headless:true, args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=metal','--no-sandbox'] });
const p = await (await b.newContext({ viewport:{width:1600,height:1000} })).newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
await p.waitForTimeout(6000);
await p.click('#tab-bar .tab[data-mode="streamlines"]');
await p.waitForTimeout(5000);
await p.screenshot({path:'/tmp/wt-inflow/sphere-default.png'});

// widen inlet
await p.click('.phase-tab[data-phase="run"]');
await p.waitForTimeout(300);
await p.$eval('#sl-inlet', (el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}, '0.35');
await p.waitForTimeout(5000);
await p.screenshot({path:'/tmp/wt-inflow/sphere-wide-inlet.png'});

console.log('errors:', errs.length);
for (const e of errs.slice(0,3)) console.log(' ', e.slice(0,150));
await b.close();
