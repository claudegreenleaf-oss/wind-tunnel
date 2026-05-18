# Wind Tunnel 3D — v2 Implementation Plan

**Status:** Draft v1
**Date:** 2026-05-18
**Owner:** Thomas Greenleaf

## Requirements Summary

Replace the existing 2D `wind-tunnel` site with a full **3D Lattice Boltzmann wind tunnel** running on **WebGPU**, with **volumetric raymarched smoke**, **8 preset 3D shapes + GLB/OBJ upload**, a **resolution slider (32³–192³ continuous)**, and **granular fluid controls** (wider physics ranges, gravity/buoyancy/turbulence, time controls, click-to-inject).

### Confirmed via interview
- **API:** WebGPU only (Chrome/Edge/Safari 18+/Firefox 142+; older browsers show a fallback message)
- **Renderer:** Volumetric raymarched smoke (only — no particles/slices/isosurfaces in v1)
- **Resolution:** Continuous slider 32³ → 192³, default ~96³ (re-allocates buffers on change)
- **Shapes:** 8 hand-picked 3D meshes (sphere, cube, cylinder, cone, NACA-section wing, Utah teapot, F1-style car silhouette, motorbike helmet) + drag-drop GLB/OBJ upload with on-GPU voxelization
- **Fluid controls (all four):**
  - Wider sliders / finer precision (wind speed, viscosity, Re, density)
  - More physics knobs (gravity vector, buoyancy, MRT vs BGK, Smagorinsky LES, free-slip toggle)
  - Time controls (play/pause/frame-step/slow-mo/sim-speed scrubber)
  - External forces (click in 3D scene to inject wind/dye/heat)
- **Strategy:** Replace the current `wind-tunnel` repo entirely; v1 (2D) lives in git history

## Acceptance Criteria

| # | Criterion | Test |
|---|---|---|
| AC1 | Runs at **≥45 fps** on 96³ on an M-series MacBook Air in Chrome | stats.js overlay |
| AC2 | Runs at **≥25 fps** on 128³ on the same machine | stats.js |
| AC3 | Resolution slider re-allocates buffers and resumes simulation within 500ms | manual + console timing |
| AC4 | 8 preset 3D shapes voxelize to the mask and obstruct flow visibly | visual |
| AC5 | GLB or OBJ file drag-dropped onto the canvas voxelizes within 2 seconds and the sim flows around it | manual upload of a test mesh |
| AC6 | Volumetric smoke renders with visible absorption + scattering; wake clearly visible | visual |
| AC7 | Orbit camera works: drag to rotate, wheel to zoom, right-drag to pan | manual |
| AC8 | All physics knobs functional (gravity vector, buoyancy, MRT toggle, Smagorinsky toggle, free-slip toggle) | manual + visible effect |
| AC9 | Time controls: Space pauses, ←/→ step, slider sets sim speed 0.1×–4× | manual |
| AC10 | Click-and-drag in 3D scene injects a puff of dye or wind force at the picked 3D point | manual |
| AC11 | C_d / C_l readout updates live with rolling chart | UI inspection |
| AC12 | Cylinder at Re≈200 in 3D shows vortex shedding (helical, periodic) | visual |
| AC13 | Bundle ≤900 KB gzipped (3D is heavier than 2D) | bundle analyzer |
| AC14 | On a browser without WebGPU, page shows a friendly "WebGPU required" message linking to compatibility info | manual test in Safari ≤17 |
| AC15 | Deployed at the same public URL as the previous v1 | curl 200 + visual |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Browser (WebGPU)                              │
│                                                                     │
│  ┌──────────────┐    ┌─────────────────────────────────────────┐    │
│  │  UI / DOM    │    │      Three.js (WebGPURenderer)          │    │
│  │  - sliders   │───▶│                                         │    │
│  │  - shape pick│    │  ┌────────────────────────────────────┐ │    │
│  │  - upload    │    │  │  D3Q19 LBM compute pipeline        │ │    │
│  │  - graph     │    │  │  - storage buffers fA, fB (ping)   │ │    │
│  │  - time ctl  │    │  │  - mask buffer (cell tags)         │ │    │
│  │  - orbit ctl │◀───│  │  - collide+stream compute pass     │ │    │
│  │  - click-inj │    │  │  - macros (rho, u) into 3D texture │ │    │
│  └──────────────┘    │  └────────────────────────────────────┘ │    │
│         ▲            │                                         │    │
│         │            │  ┌────────────────────────────────────┐ │    │
│         │            │  │  Mesh voxelizer (compute)          │ │    │
│         │            │  │  - rasterizes triangles → mask     │ │    │
│         │            │  │  - GLB/OBJ via three GLTFLoader    │ │    │
│         │            │  └────────────────────────────────────┘ │    │
│         │            │                                         │    │
│         │            │  ┌────────────────────────────────────┐ │    │
│         │            │  │  Dye advection (compute)           │ │    │
│         │            │  │  - 3D dye texture, semi-Lagrangian │ │    │
│         │            │  └────────────────────────────────────┘ │    │
│         │            │                                         │    │
│         │            │  ┌────────────────────────────────────┐ │    │
│         │            │  │  Volumetric raymarcher (fragment)  │ │    │
│         │            │  │  - back-to-front ray-march dye 3D  │ │    │
│         │            │  │  - Beer-Lambert absorption +       │ │    │
│         │            │  │    Henyey-Greenstein phase scatter │ │    │
│         │            │  │  - composite with mesh + bg        │ │    │
│         │            │  └────────────────────────────────────┘ │    │
│         │            │                                         │    │
│         │            │  ┌────────────────────────────────────┐ │    │
│         │            │  │  Force readback (compute reduce)   │ │    │
│         │            │  └────────────────────────────────────┘ │    │
│         └────────────│                                         │    │
│                      └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Stack
- **Three.js r0.184 WebGPURenderer** (TSL or pure WGSL)
- **WGSL** compute shaders for LBM, voxelization, dye advection, force reduction
- **WGSL** fragment shader for raymarched volumetric rendering
- **OrbitControls** from three/examples
- **GLTFLoader** / **OBJLoader** for upload
- **TypeScript + Vite 8** (keep existing build)

### Solver: D3Q19 BGK
- 19 discrete velocities per cell, stored in 2 × storage buffers (ping-pong), `array<f32>` of length `19 * W * H * D`
- BGK collision + half-way bounce-back on solid cells (cell mask buffer, u32 per cell)
- Inlet: forced equilibrium at the -X face with `u = (U_in, 0, 0)`
- Outlet: zero-gradient at the +X face
- Top/bottom/front/back: choice of no-slip (bounce-back) or free-slip (mirror) — user-toggleable
- **MRT collision** option for stability at high Re
- **Smagorinsky LES** sub-grid model: adjust local relaxation via local strain rate

### Resolution handling
- A single `LatticeSpec { W, H, D }` reactive value
- On change: dispose old buffers/textures, allocate new sized buffers, re-run init pass
- Wind tunnel is anisotropic by default: `W = 2*N`, `H = N`, `D = N` (long-thin tunnel)
- N is the slider value (32 → 96 → 192)

### Volumetric rendering
- 3D dye texture (rgba16float) updated each frame by advection compute pass
- Per-frame: render a single fullscreen pass that ray-marches camera→far through the volume
- ~32 march steps per pixel
- Beer-Lambert absorption: `T(t) = exp(-σ * integral(dye_density))`
- Henyey-Greenstein phase function for forward scattering (g ≈ 0.6) — gives volumetric "shafts"
- Mesh of the obstacle drawn first (depth test), then volume raymarched, then composited

### Voxelization
- For preset meshes: pre-compute SDF on CPU at lattice resolution, upload as mask buffer
- For uploaded meshes: GPU compute shader that splats triangle samples into the mask buffer using conservative voxelization (one compute thread per triangle, draws to occupied cells)

### Time controls
- App owns a `simSpeed` (0.1× – 4×) and `paused` flag
- `paused`: skip the compute pass entirely
- `simSpeed > 1`: run multiple compute substeps per frame
- `simSpeed < 1`: run compute every Nth frame
- Frame-step button: while paused, run one compute pass

### Click-injection
- On pointer-down/drag in the 3D scene: raycast against the lattice AABB, get the 3D entry point + ray direction
- Inject either dye (additive into the 3D dye texture at the picked voxel + neighborhood) or a momentum impulse (additive to the velocity field's f distribution)

## Implementation Steps

### Phase 0 — WebGPU scaffold (≈1 hour)
- Detect WebGPU; if absent show a "Requires WebGPU" splash
- Swap Three.js renderer to WebGPURenderer
- Verify a hello-cube renders

### Phase 1 — D3Q19 compute LBM (≈6 hours)
- WGSL compute shader: `collide_stream.wgsl`
- Storage buffers fA, fB (length 19 × N_cells)
- Mask buffer (u32 cell tags)
- Macros 3D texture (rgba16float: rho + u.xyz)
- Validate: Poiseuille channel (no obstacle), expect parabolic profile

### Phase 2 — Volumetric raymarcher (≈4 hours)
- 3D dye texture (rgba16float)
- Raymarch fragment shader: front-face of lattice AABB, march N steps
- Beer-Lambert + HG phase
- Composite with depth-tested obstacle mesh
- Validate: inject a stationary dye blob, fly camera around it

### Phase 3 — Dye advection + injection (≈2 hours)
- Compute shader: semi-Lagrangian backward sample of 3D dye texture using LBM velocity
- Inlet injection: bands of color at the -X face, gaps between bands → discrete streamlines
- Validate: dye flows downstream visibly

### Phase 4 — 3D shape presets (≈3 hours)
- Eight three.js geometries (sphere, cube, cylinder, cone, wing, teapot, car, helmet)
- For each: CPU SDF generation → upload to mask buffer
- Shape selector UI; rotation handles via TransformControls

### Phase 5 — GLB/OBJ upload + voxelizer (≈4 hours)
- Drag-drop overlay on the canvas
- GLTFLoader + OBJLoader read
- GPU conservative voxelizer compute shader (one workgroup per triangle, splat AABB into mask)
- Validate: drop a teapot.glb, watch it appear and obstruct flow

### Phase 6 — Resolution slider (≈2 hours)
- Resolution slider 32–192 with throttled change (only re-allocates when user releases)
- Buffer disposal + reallocation in `LBMSolver3D.setResolution(N)`
- Re-voxelize current shape into new mask
- Reset flow

### Phase 7 — Granular fluid knobs (≈3 hours)
- Gravity vector (3 sliders or 3D widget)
- Density slider (affects buoyancy with temperature field — defer temp field; use density as constant force factor for now)
- MRT vs BGK toggle (separate WGSL compile or runtime flag)
- Smagorinsky LES toggle (sub-grid viscosity)
- Free-slip vs no-slip wall toggle
- Wider slider ranges everywhere

### Phase 8 — Time controls (≈1 hour)
- Play/pause button (replaces or augments Space key)
- Frame-step button (active only when paused)
- Sim speed slider 0.1×–4×
- Optional: timeline scrubber for the rolling C_d chart

### Phase 9 — Click-to-inject (≈2 hours)
- Pointer raycast against lattice AABB
- Two modes: "inject dye" / "inject wind impulse" — toggle button
- Drag = continuous injection

### Phase 10 — UI restructure + polish (≈2 hours)
- Side panel becomes: Shape, Resolution, Flow (basic), Physics (advanced), Visualization, Time, Readout
- Collapsible sections
- Orbit help / WASD camera hint overlay
- Dark theme stays; add subtle volumetric bloom

### Phase 11 — Deploy (≈30 min)
- Verify on Chrome + Edge + Safari 18
- Push to existing `wind-tunnel` repo (replaces v1 entirely)
- Vercel auto-deploys on push

**Estimated total: 30–35 hours of implementation.**

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WebGPU device loss at high resolution (192³ → 1+ GB) | Medium | Sim halts | Slider caps at 192³; expose VRAM estimate next to slider; handle `device.lost` event with a "reload" prompt |
| Volumetric raymarch too slow at high res | High | <30 fps | Adaptive marching steps based on resolution; depth-based early termination; jitter to reduce banding so we can use fewer steps |
| MRT/Smagorinsky options bloat the shader and break stability | Medium | Visible explosions | Default to BGK; MRT and Smagorinsky behind explicit toggle; cap viscosity slider so tau > 0.5 + epsilon always |
| OBJ/GLB voxelization is slow or buggy for high-poly meshes | High | UX freeze on upload | Worker-thread CPU pre-pass to convert mesh to triangle buffer; GPU compute conservative voxelizer; show progress bar |
| Browser support: only Chrome/Edge/Safari18/FF142 | Certain | Visitors on older browsers see nothing | Splash page with browser compat info; suggest "open in Chrome" |
| Three.js WebGPU backend still has rough edges (r0.184) | Medium | Subtle bugs | Use pure WGSL via Three.js's raw compute API where TSL is awkward; pin Three.js version |
| Click-to-inject raycast against arbitrary camera is fiddly | Medium | Feature broken | Use a unit-cube proxy with raycaster; intersect ray with lattice volume; pick the first intersection inside the AABB |
| Free-slip walls at the front/back/top/bottom of a long tunnel may cause inlet/outlet weirdness | Low | Numerical drift | Default to no-slip on top/bottom, free-slip on front/back |
| Bundle bloats past 900 KB gzipped with GLTFLoader + WebGPU paths | Medium | Misses AC13 | Tree-shake; lazy-load loaders behind upload button |

## Out of Scope (v2)
- Multiplayer / collaborative
- Heat transfer with temperature field (we only use density-as-buoyancy)
- Compressible flow / shock physics
- Recording / video export
- Mobile UX (3D LBM in a phone browser is a stretch — desktop primary)
- Particle viz, slice planes, Q-criterion isosurfaces (deferred — volumetric only)

---

**Recommended execution path:** Sequential phases; verify each in Playwright before moving on. Commit after every phase. Push to GitHub after Phase 6 (mid-point) and again at Phase 11.
