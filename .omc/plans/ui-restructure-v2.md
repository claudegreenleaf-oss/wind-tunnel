# Wind Tunnel — UI Restructure v2 (real IA, not a reskin)

**Status:** Ready for executor. One focused pass.
**Live site:** https://wind-tunnel-thomas.surge.sh/
**Predecessor:** commit `c8e893d` (reskinned panel; did NOT restructure IA — user feedback: "basically none of it works, and the original confusing layout … remains")
**Scope:** `index.html`, `src/style.css`, `src/app.ts`. No new files. No simulation/WGSL changes.

---

## 1. Diagnosis — why the user said "none of it works"

Code is intact (WebGPU, LBM, particles, streamlines, volume, slice all wired). The failure is **UX, not engine**.

| Symptom | Root cause | Fix lane |
|---|---|---|
| Panel feels identical to before | The `c8e893d` reskin kept all 9 `<section class="group">` blocks in `index.html:41–241` in the same vertical stack. Only colors and typography changed. | IA rewrite (§3) |
| 9 collapse headers compete for attention; "Advanced inlets" is a `<details>` nested **inside** a collapsed `<section>` — collapse-within-collapse. | `index.html:129–132`. | IA rewrite (§3) |
| Clicking the **Volumetric** tab looks like nothing happens | Dye is **only injected by manual click+drag** when `Inject: On` + `Mode: Dye` (`app.ts:1650`, `1717–1723`). No continuous inlet source. `volume3d.ts:198` density = `dyeIntensity*0.95 + speedN*0.35*smokeMask` → with zero dye, the volume is ~35% of speed alone, very dim. The renderer **is** drawing; the field is empty. | Auto-inject dye when Volumetric tab active (§4) |
| Clicking the **Streamlines** tab — first second is blank, then jagged ribbons appear | Seeds are reset on tab activation (`app.ts:741`), then ribbons fill the ring buffer over `TRACE_LEN` frames. No "warming" hint shown. | Add a 1-line status pill (§4) |
| **Slice** tab is independently toggleable from `Slice viewer` section ("Slice: On") **and** from the top tab — these two controls fight each other (`app.ts:687–701` makes the `Slice: On` button click the slice tab; but clicking the slice tab directly doesn't set `sliceActive`). | Same flag is reachable via two paths with different side-effects. | Collapse to one source of truth (§4) |
| Panel scrolls a lot at default 320px width on a 1440px screen — sliders run off | `--panel-w: 320px` (style.css:22) + 9 sections × 4–6 controls each = ~12 viewport heights of scroll. | IA rewrite reduces sections to 3 tabs, each ≤6 controls visible (§3) |

**Bottom line:** the renderer code is fine. The panel and the canvas-tab payloads need real IA, plus one tiny render-time tweak so the Volumetric tab is visibly non-empty.

---

## 2. Decisions locked in (and one open question)

- Panel uses **three internal "phase" tabs**: `Setup` / `Run` / `Analyse`. These are distinct from the **four canvas view-mode tabs** at the top of the viewport (`Particles` / `Streamlines` / `Volumetric` / `Slice`). The viewport tabs answer "what am I looking at?"; the panel tabs answer "what am I configuring?".
- **Advanced details** become a single `[Advanced]` toggle chip per section, expanding inline. No nested `<details>` and no `.collapsed` sections inside the new layout.
- **Cd readout** stays as the large floating overlay (`#cd-overlay`, already exists, `index.html:257–261`). Other telemetry (Cl, Re, fps) lives in the `Analyse` tab.
- **Resolution** moves under `Setup → Advanced` — it's a one-time config knob, not a per-run dial.
- **`Slice viewer` "Slice: On" button** is removed. The slice tab on the viewport is the only on/off switch. The `Analyse → Slice` panel only configures axis/field/position/3D-mask.

### Open question (logged for follow-up, not blocking)

- **Should the Volumetric tab auto-inject a continuous dye stream at the inlet?** Default in this plan: **yes** (set `dye.injectAmount` non-zero whenever `viewMode === 'volume'`, zero otherwise). Alternative: keep manual-only and add a one-shot "Seed dye" button. Picking the auto behaviour because the user's main complaint is "doesn't work" — silent-empty Volumetric tab is the #1 culprit. Appended to `.omc/plans/open-questions.md`.

---

## 3. New panel information architecture

### Visual mockup (ASCII)

```
┌──────────────────────────────── viewport ───────────────────────────────┐ ┌── panel ──┐
│ [Particles] [Streamlines] [Volumetric] [Slice]   ← canvas view tabs    │ │ Wind      │
│ ────────────────────────────                                            │ │ Tunnel    │
│                                                                         │ │           │
│   (canvas)                                                              │ │┌─────────┐│
│                                                                         │ ││ Setup   ││  ← 3 phase tabs
│                                                                         │ ││  Run    ││    (active: bg accent)
│                                                                         │ ││ Analyse ││
│                                                                         │ │└─────────┘│
│                                                                         │ │           │
│                                                                         │ │ SHAPE     │
│                                                                         │ │ [select▾] │
│                                                                         │ │ Position  │
│                                                                         │ │ [──●──]   │
│                                                                         │ │ Scale     │
│                                                                         │ │ [──●──]   │
│                                                                         │ │ Yaw       │
│                                                                         │ │ [──●──]   │
│                                                                         │ │ [Advanced]│  ← chip toggles 4 rows
│                                                                         │ │           │
│                                                                         │ │ FLOOR     │
│                                                                         │ │ ☐ Enable  │
│                                                                         │ │ Height    │
│                                                                         │ │ [──●──]   │
│                                                                         │ │           │
│                                                                         │ │ ─Reset─   │
└─────────────────────────────────────────────────────────────────────────┘ └───────────┘
```

### Phase-tab payloads (controls reorganised, **same DOM IDs** — only their wrapper changes)

| Panel tab | Section | Always-visible | Advanced (chip) |
|---|---|---|---|
| **Setup** | Shape | `#shape-select`, `#sl-xfrac` (Position), `#sl-scale` (Scale), `#sl-yaw` (Yaw) | `#sl-pitch`, `#sl-roll`, `#btn-reset-orient` |
| **Setup** | Floor | `#cb-floor` (Enable), `#sl-floor` (Height) | — |
| **Setup** | Resolution | — (hidden by default; expert knob) | `#sl-N` + `#cells-hint` |
| **Run** | Flow | `#sl-speed` (Wind speed), `#sl-visc` (Viscosity), `#sl-aoa` (Angle of attack), `#sl-inlet` (Inlet size) | `#sl-ball` (Ball size), `#inlets-host` (per-jet rows, no nested summary) |
| **Run** | Physics | `#btn-mrt`, `#btn-les`, `#btn-slip` (one row of 3 toggle buttons) | `#sl-grav-x`, `#sl-grav-y`, `#sl-grav-z` |
| **Run** | Time | `#btn-play`, `#btn-step`, `#btn-slowmo` (one row), `#sl-speed-mul` | `#btn-reset` (Reset flow) — small destructive chip in the corner |
| **Run** | Inject | `#btn-inject`, `#btn-inject-mode`, hint text | — |
| **Analyse** | Slice | `#sel-slice-axis`, `#sel-slice-field`, `#sl-slice-pos`, `#cb-slice-mask` (no more `#btn-slice`) | — |
| **Analyse** | Telemetry | Readout grid: `#rd-cd`, `#rd-cl`, `#rd-rey`, `#rd-fps` | — |
| **Analyse** | Physics tests | `#btn-run-tests`, `#tests-summary`, `#tests-results` | — |

**Section count per phase tab: Setup 3 · Run 4 · Analyse 3.** No tab exceeds 6.

---

## 4. File-by-file changes

### 4.1 `index.html`

**Replace** the body of `<aside id="panel">` (lines 32–246) with this structure. **All existing IDs are preserved** — only the wrapping markup changes. The collapse/resize JS in lines 345–397 still works (the `.group h2` collapse listener becomes a no-op since `.group` is removed; remove that listener too).

```html
<aside id="panel">
  <button id="panel-collapse-btn" title="Collapse panel">&#x2039;</button>

  <header>
    <h1>Wind Tunnel</h1>
    <div class="sub">WebGPU · D3Q19 · 3D LBM</div>
  </header>

  <!-- Phase tabs -->
  <nav class="phase-tabs" role="tablist">
    <button class="phase-tab active" data-phase="setup">Setup</button>
    <button class="phase-tab" data-phase="run">Run</button>
    <button class="phase-tab" data-phase="analyse">Analyse</button>
  </nav>

  <!-- SETUP ───────────────────────── -->
  <div class="phase-panel" data-phase="setup">

    <section class="block">
      <h3>Shape</h3>
      <select id="shape-select"> … (existing options) … </select>
      <label>Position <span class="val" id="val-xfrac">30%</span>
        <input id="sl-xfrac" type="range" min="0.05" max="0.95" step="0.01" value="0.3" /></label>
      <label>Scale <span class="val" id="val-scale">1.00</span>
        <input id="sl-scale" type="range" min="0.3" max="2.5" step="0.01" value="1" /></label>
      <label>Yaw <span class="val" id="val-yaw">0°</span>
        <input id="sl-yaw" type="range" min="-180" max="180" step="1" value="0" /></label>
      <button class="adv-chip" data-adv="shape-adv">Advanced ▾</button>
      <div class="adv" id="shape-adv" hidden>
        <label>Pitch <span class="val" id="val-pitch">0°</span>
          <input id="sl-pitch" type="range" min="-90" max="90" step="1" value="0" /></label>
        <label>Roll <span class="val" id="val-roll">0°</span>
          <input id="sl-roll" type="range" min="-180" max="180" step="1" value="0" /></label>
        <button id="btn-reset-orient" class="btn">Reset orientation</button>
      </div>
    </section>

    <section class="block">
      <h3>Floor</h3>
      <label class="checkbox"><input id="cb-floor" type="checkbox" /><span>Enable</span></label>
      <label>Height <span class="val" id="val-floor">0%</span>
        <input id="sl-floor" type="range" min="0" max="0.5" step="0.005" value="0" /></label>
    </section>

    <section class="block">
      <h3>Resolution</h3>
      <button class="adv-chip" data-adv="res-adv">Advanced ▾</button>
      <div class="adv" id="res-adv" hidden>
        <label>N (lattice) <span class="val" id="val-N"></span>
          <input id="sl-N" type="range" min="32" max="192" step="1" /></label>
        <div class="hint" id="cells-hint"></div>
      </div>
    </section>
  </div>

  <!-- RUN ─────────────────────────── -->
  <div class="phase-panel" data-phase="run" hidden>

    <section class="block">
      <h3>Flow</h3>
      <label>Wind speed <span class="val" id="val-speed"></span>
        <input id="sl-speed" type="range" min="0.005" max="0.18" step="0.001" /></label>
      <label>Viscosity (Re <span id="val-re"></span>) <span class="val" id="val-visc"></span>
        <input id="sl-visc" type="range" min="0.0005" max="0.06" step="0.0001" /></label>
      <label>Angle of attack <span class="val" id="val-aoa"></span>
        <input id="sl-aoa" type="range" min="-30" max="30" step="1" /></label>
      <label>Inlet size <span class="val" id="val-inlet">12%</span>
        <input id="sl-inlet" type="range" min="0.04" max="0.45" step="0.005" value="0.12" /></label>
      <button class="adv-chip" data-adv="flow-adv">Advanced ▾</button>
      <div class="adv" id="flow-adv" hidden>
        <label>Ball size <span class="val" id="val-ball">1.00×</span>
          <input id="sl-ball" type="range" min="0.3" max="3" step="0.05" value="1" /></label>
        <div class="hint">Per-jet inlets:</div>
        <div id="inlets-host"></div>
      </div>
    </section>

    <section class="block">
      <h3>Physics</h3>
      <div class="row">
        <button id="btn-mrt" class="btn btn-toggle">Collision: BGK</button>
        <button id="btn-les" class="btn btn-toggle">Turb: Off</button>
        <button id="btn-slip" class="btn btn-toggle">Walls: No-slip</button>
      </div>
      <button class="adv-chip" data-adv="phys-adv">Advanced ▾</button>
      <div class="adv" id="phys-adv" hidden>
        <label>Gravity X <span class="val" id="val-grav-x">0.000</span>
          <input id="sl-grav-x" type="range" min="-0.001" max="0.001" step="0.00005" value="0" /></label>
        <label>Gravity Y <span class="val" id="val-grav-y">0.000</span>
          <input id="sl-grav-y" type="range" min="-0.001" max="0.001" step="0.00005" value="0" /></label>
        <label>Gravity Z <span class="val" id="val-grav-z">0.000</span>
          <input id="sl-grav-z" type="range" min="-0.001" max="0.001" step="0.00005" value="0" /></label>
      </div>
    </section>

    <section class="block">
      <h3>Time</h3>
      <div class="row">
        <button id="btn-play" class="btn">⏸ Pause</button>
        <button id="btn-step" class="btn" disabled>▶| Step</button>
        <button id="btn-slowmo" class="btn btn-toggle">Slow-mo</button>
      </div>
      <label>Sim speed <span class="val" id="val-speed-mul"></span>
        <input id="sl-speed-mul" type="range" min="0.1" max="4" step="0.05" /></label>
      <div class="row"><button id="btn-reset" class="btn btn-danger">Reset flow</button></div>
    </section>

    <section class="block">
      <h3>Inject</h3>
      <div class="row">
        <button id="btn-inject" class="btn btn-toggle">Inject: Off</button>
        <button id="btn-inject-mode" class="btn" disabled>Mode: Impulse</button>
      </div>
      <div class="hint">Click+drag on canvas while active.</div>
    </section>
  </div>

  <!-- ANALYSE ─────────────────────── -->
  <div class="phase-panel" data-phase="analyse" hidden>

    <section class="block">
      <h3>Telemetry</h3>
      <div class="readout">
        <div><span class="lbl">Cd</span><span id="rd-cd">—</span></div>
        <div><span class="lbl">Cl</span><span id="rd-cl">—</span></div>
        <div><span class="lbl">Re</span><span id="rd-rey">—</span></div>
        <div><span class="lbl">fps</span><span id="rd-fps">—</span></div>
      </div>
    </section>

    <section class="block">
      <h3>Slice</h3>
      <div class="hint">Switch to the <strong>Slice</strong> view tab to see the slice fill the viewport.</div>
      <div class="row">
        <label class="inline">Axis</label>
        <select id="sel-slice-axis">
          <option value="x">X (perp. to flow)</option>
          <option value="y" selected>Y (horizontal)</option>
          <option value="z">Z (vertical along flow)</option>
        </select>
      </div>
      <div class="row">
        <label class="inline">Field</label>
        <select id="sel-slice-field">
          <option value="velocity" selected>Velocity</option>
          <option value="pressure">Pressure</option>
          <option value="vorticity">Vorticity</option>
        </select>
      </div>
      <label>Position <span class="val" id="val-slice-pos"></span>
        <input id="sl-slice-pos" type="range" min="0" max="1" step="0.005" value="0.5" /></label>
      <label class="checkbox"><input id="cb-slice-mask" type="checkbox" /><span>Mask 3D view to slice</span></label>
    </section>

    <section class="block">
      <h3>Physics tests</h3>
      <div class="row">
        <button id="btn-run-tests" class="btn">Run all</button>
        <span id="tests-summary" class="hint"></span>
      </div>
      <ul id="tests-results"></ul>
    </section>
  </div>

  <footer>
    <kbd>drag</kbd> orbit · <kbd>scroll</kbd> zoom · <kbd>Space</kbd> pause
  </footer>
</aside>
```

**Also remove:**
- `index.html:190–191` — the `#btn-slice` row (the only on/off slice control is the viewport tab now).
- `index.html:345–349` — the `.group h2` collapse JS handler. Replace with two new handlers (phase-tab switcher + advanced-chip toggle) — kept in the same `<script>` block:

```js
// Phase tab switching
document.querySelectorAll('.phase-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const phase = btn.dataset.phase;
    document.querySelectorAll('.phase-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.phase-panel').forEach(p => {
      p.hidden = p.dataset.phase !== phase;
    });
  });
});

// Advanced chip toggle
document.querySelectorAll('.adv-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const target = document.getElementById(chip.dataset.adv);
    if (!target) return;
    const open = target.hidden;
    target.hidden = !open;
    chip.textContent = open ? 'Advanced ▴' : 'Advanced ▾';
    chip.classList.toggle('open', open);
  });
});
```

### 4.2 `src/style.css`

**Append** (do not rewrite existing rules — they still drive sliders, buttons, readout):

```css
/* ── Phase tabs (panel-internal) ─────────────────────── */
.phase-tabs {
  display: flex;
  margin: 8px 12px 0;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 3px;
  gap: 3px;
}
.phase-tab {
  flex: 1; background: transparent; border: none;
  color: var(--fg-dim); font-family: var(--sans);
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 7px 0; border-radius: 4px;
  cursor: pointer; transition: color .15s, background .15s;
}
.phase-tab:hover { color: var(--fg); }
.phase-tab.active { background: var(--accent); color: #001; }

.phase-panel { padding: 4px 0 12px; }
.phase-panel[hidden] { display: none !important; }

/* ── Block (replaces .group) ─────────────────────────── */
.block { padding: 14px 18px 6px; border-top: 1px solid var(--line); }
.block:first-of-type { border-top: none; }
.block h3 {
  font-family: var(--sans); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.13em;
  color: var(--fg-muted); margin: 0 0 10px;
}

/* ── Advanced chip + body ────────────────────────────── */
.adv-chip {
  background: transparent; border: 1px solid var(--line);
  color: var(--fg-dim); font-family: var(--sans); font-size: 10.5px;
  padding: 4px 10px; border-radius: 999px; cursor: pointer;
  letter-spacing: 0.06em; margin: 2px 0 8px;
  transition: color .15s, border-color .15s;
}
.adv-chip:hover { color: var(--accent); border-color: var(--accent); }
.adv-chip.open { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
.adv { padding-top: 4px; border-top: 1px dashed var(--line); margin-top: -4px; }
.adv[hidden] { display: none !important; }

/* ── Danger button ───────────────────────────────────── */
.btn.btn-danger { color: var(--danger); border-color: rgba(255,94,108,0.3); }
.btn.btn-danger:hover { background: rgba(255,94,108,0.1); border-color: var(--danger); }
```

### 4.3 `src/app.ts`

Three small surgical changes — **no rewiring of existing slider/button listeners**, just removals and additions.

1. **Remove the `#btn-slice` handler block** (lines 687–701). The slice toggle now lives entirely on the viewport tab bar.

2. **Make the viewport-tab Slice activation own `sliceActive`.** In `wireTabBar()` `setMode()` (line 727), set `this.sliceActive = (mode === 'slice')` and update `this.sliceIndicator.visible` from that. So clicking the Slice viewport tab is the ONE source of truth.

3. **Auto-inject dye when Volumetric is active.** In `wireTabBar()` `setMode()`:
   ```ts
   if (this.dye) {
     this.dye.injectAmount = (mode === 'volume') ? 0.7 : 0;
   }
   ```
   Plus add a continuous inlet-dye dispatch each frame inside the `viewMode === 'volume'` branch of the render loop (line 1580). The `DyeField3D` already has an inject pipeline — just call `this.dye.step(dt)` style. If no public method exists, add one wrapper that runs the existing inject shader at the inlet for one workgroup per frame (constructor already plumbs `injectParamsBuf`). **If that wrapper is not trivially exposable in one diff, fall back to: set `injectAmount` high and rely on the existing dye injection path that the `Inject` tool uses (auto-call it from the render loop when `viewMode === 'volume'`).** Executor picks the cheaper route, document the choice in the commit.

4. **Add a "warming" hint for Streamlines.** In `setMode()` for `streamlines`, briefly show a toast: `showToast('Seeding streamlines…')` (the `showToast` util is already imported, `app.ts:23`). 1.5s, then fade.

5. **Initial active phase tab = Setup**, already set by `class="active"` in HTML — no JS needed.

### 4.4 No changes to

- `src/render/streamlines.ts` — works as designed
- `src/render/volume3d.ts` — works once dye is non-empty
- `src/render/sliceViewer.ts`, `particles3d.ts`, `fluidSurface.ts` — untouched
- All `src/sim/*` — untouched
- `src/tests/physicsTests.ts` — untouched

---

## 5. Acceptance criteria (eyeball after deploy)

User opens https://wind-tunnel-thomas.surge.sh/ on desktop:

1. **Panel shows three flat tabs `Setup / Run / Analyse`** under the "Wind Tunnel" header. Active tab pill is teal.
2. **`Setup` tab visible by default** with exactly three sections — Shape, Floor, Resolution — each with an `Advanced` chip (Resolution shows only the chip).
3. **Clicking `Run`** swaps the panel to Flow / Physics / Time / Inject — four sections — without scroll on a 900px-tall window at 320px panel width.
4. **Clicking `Analyse`** swaps to Telemetry / Slice / Physics tests. Cd, Cl, Re, fps all visible at once.
5. **No nested `<details>` anywhere.** Advanced groups expand inline.
6. **Viewport tab "Volumetric" actually shows volumetric smoke** — colourful 3D dye trailing the obstacle within ~2 seconds of clicking the tab, even with no manual `Inject` activity.
7. **Viewport tab "Streamlines" shows ribbons within ~1 second**, with a brief "Seeding streamlines…" toast.
8. **Viewport tab "Slice" fills the viewport with the 2D slice plot**, and the 3D indicator plane is visible when switching back to Particles/Streamlines/Volumetric.
9. **No "Slice: On / Off" button in the panel.** Slice on/off is the viewport tab.
10. **Hard reset:** clicking `Reset flow` in `Run → Time` reseeds particles and wipes the LBM, same as today.
11. **Keyboard:** `Space` still pauses (existing handler untouched).
12. **Cd overlay top-left still shows the large drag-coefficient number.**

If any of the 12 above fails, the executor halts and reports.

---

## 6. Rationale (short)

- **Three phase tabs > nine collapsible sections.** Fitts's law + Miller's 7±2. Each tab fits on one screen.
- **Setup/Run/Analyse mirrors how a sim is actually used** — set up the obstacle, run the flow, read off the numbers. Same metaphor as MATLAB Simulink, ANSYS Workbench, AirShaper itself.
- **Advanced chips > nested `<details>`** because chips render the same shape regardless of nesting depth and never produce the "collapse inside collapse inside collapse" feel.
- **Viewport view-mode tabs stay where they are** because they're a different question ("what am I looking at?") and the user already understands them — they just need to actually work.
- **Auto-dye on Volumetric** is the single highest-impact fix for "none of it works."

---

## 7. Out of scope (logged for follow-up)

- Adding `Cl` actual computation (currently always `—` in HUD). The HUD reads `rd-cl` but `dragCalc` doesn't compute Cl yet.
- Saving panel-tab choice in `localStorage`.
- Mobile layout for the phase tabs (current `@media (max-width: 760px)` still works because phase tabs are inside `#panel`).
- Renaming "Volumetric" to "Smoke" or "Dye" — possible UX win, deferred.
- The `Inject` tool in `Run` is now arguably redundant with auto-dye; consider hiding it behind Advanced in a future pass.

---

## 8. Executor notes

- Estimated effort: **1 focused pass, ~90 min.** Pure markup + CSS + ~30 lines of `app.ts` edits.
- No new files. No new dependencies. No WGSL changes.
- Build: `npm run build` (vite) then deploy via existing surge.sh flow.
- Verify locally first; the 12 acceptance points above are the smoke test.
