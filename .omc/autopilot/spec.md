# Wind Tunnel — 8-feature batch (2026-05-20)

User answers folded in: streamline overlay with toggle (default = current dots), friction window = ~10 s EMA, inlets = 1–4 free-position rich model, accuracy fix = wake retune **and** interpolated BCs.

## Feature 1 — STL upload (in addition to existing GLB/OBJ)
- Add `STLLoader` (three/addons/loaders/STLLoader.js).
- Extension switch in `src/app.ts` drop-overlay handler: `glb | obj | stl`.
- Voxelize via existing `voxelizeAnyMesh` pipeline; no other changes.
- Acceptance: drop a `.stl` cube onto the canvas → mesh appears, particles deflect around it.

## Feature 2 — More base obstacles
- Add ≥ 25 new entries to `src/obstacles/modelRegistry.ts`.
- Categories (optgroups in HTML): Primitives (existing) · Vehicles · Aircraft · Airfoils · Characters · Misc.
- Vehicles: keep Ferrari/Buggy/MilkTruck/ToyCar; add Porsche, Lamborghini, Pickup, F1.
- Aircraft: P-51 Mustang, F-22, Cessna, glider, Boeing 747, helicopter, paper plane.
- Airfoils (procedural — extend the existing NACA wing case so they don't depend on a CDN): NACA 0012, 2412, 4412, 6412, 23012, supercritical SC(2)-0714.
- Characters: keep Astronaut/Soldier/X-Bot.
- Misc: keep Duck/Stork/Flamingo/Parrot/Fox/Horse/Robot/LeePerry/DamagedHelmet/Drone, add: shark, missile, drone propeller, rocket, golf ball.
- Verify CDN URLs are reachable (jsdelivr / threejs.org / Sketchfab static mirrors).
- Acceptance: dropdown lists ≥ 35 obstacles in optgroups; every option loads without console error.

## Feature 3 — Streamline overlay
- Both modes via toggle:
  - **Particles** (default, current behaviour) — sphere impostors as today.
  - **Streamlines** — render each particle's *recent trail* as a colored polyline strip.
- Implementation: extend `prevPos` buffer to a ring of N=8 history slots per particle. Each frame, shift and write current position. A new `LineTubeRenderer` (line-strip primitive in WebGPU) renders one strip per particle, vertex colour = `turbo(speed)`.
- UI toggle in Flow panel: `Render: Particles | Streamlines`.
- Acceptance: toggle flips rendering live; streamline mode shows continuous color-mapped trails comparable in feel to AirShaper screenshots. Particles mode unchanged from current behaviour.

## Feature 4 — Particle size slider
- Already in place (`#sl-ball`). No new work required. Ensure it also scales the streamline tube thickness when streamline mode is active.

## Feature 5 — Adjustable floor
- Add `floorHeight` (world units) and `floorEnabled` to config.
- Solid floor = horizontal plane at y = floorY, voxelized into the LBM mask.
- Renders as a semi-transparent quad in Three.js.
- Slider range −0.5 → 0.0 of `sy` (off by default = below the lattice).
- Acceptance: with floor enabled, particles cannot pass below it; flow develops a boundary layer along it; obstacle Cd changes when the obstacle sits close to the floor (ground effect).

## Feature 6 — Multi-inlet model
- New config: `inlets: Inlet[]` where `Inlet = { yFrac, zFrac, radius, enabled }`. Max 4 entries.
- Refactor LBM3D struct: move single `uIn` + `inletR` into a per-inlet block in the params uniform (max 4 entries × vec4 ≈ 64 B). Inlet count as u32.
- WGSL inlet logic: loop over inlets; for each, compute distance from cell to (yFrac, zFrac); if inside its radius, apply equilibrium with uIn.
- Particle reseed: pick a random inlet weighted by area, sample disc inside it.
- UI: `Inlets` section in Shape panel. List of jets with per-jet position/size sliders + add/remove buttons.
- Acceptance: define 2 jets at top + bottom → flow develops two distinct streams. Define 4 jets → quadrant entry. Removing jets pauses inflow there.

## Feature 7 — Live friction map from particle hits
- New GPU storage buffer `frictionHits: array<atomic<u32>>` indexed by voxel cell.
- In particle `cs_advect`: if a particle's substep crosses into a solid voxel, atomicAdd at that voxel before reseed.
- Each LBM step: a small decay compute pass multiplies `frictionHits` by exp(−dt/τ) with τ ≈ 600 frames (~10 s at 60 Hz).
- Obstacle material's colour ramp now samples the hit buffer (via texture binding) at the fragment's nearest voxel, instead of relying on `dot(normal, upstream)`.
- Acceptance: hot spots appear where particles actually impact (front of obstacle, wings, leading edges); cool spots in the wake; shape changes redistribute the heat over ~1 s.

## Feature 8 — Accuracy: wake **and** boundary layer
- **Default tuning** (no new code):
  - `useMRT=true` (TRT collision)
  - `useLES=true` (Smagorinsky)
  - Default `visc` lowered from 0.020 → 0.010
  - Default `uIn` 0.12 (unchanged)
  - Result: Re doubled, wake sheds vortices, LES handles sub-grid stress.
- **Interpolated bounce-back (Filippova–Hänel / Yu et al.)**:
  - For each fluid–solid link, compute the wall fraction q ∈ (0,1] by sub-cell ray-cast against the original mesh during voxelization.
  - Store q in a new buffer `linkQ: array<f32>` aligned with the 19-direction streaming.
  - In `lbm3d.wgsl` collide–stream step: replace half-way bounce-back with `f_iopp(x,t+1) = (1 − 2q) f_i + 2q f_iopp` (Yu's formula) when q < 0.5, and `f_iopp(x,t+1) = (1/(2q)) f_i + ((2q−1)/(2q)) f_iopp + …` when q ≥ 0.5. This gives O(h²) wall convergence vs O(h) for bounce-back.
- Acceptance: sphere Cd at Re ≈ 400 reads ~0.6 (textbook 0.65 ± 0.1) — currently ~0.3 with half-way bounce-back. Wake shows visible Karman vortex shedding for a cylinder.

## Out of scope (for this batch)
- Inlet direction control (deferred — current spec is flow-axis aligned only).
- FBX/PLY/3MF loaders (STL only this round).
- Mobile / non-WebGPU fallback.
- Persisting inlet configurations between sessions.

## Verification gate per feature
After each feature: `npm run build`, `npm run preview`, hit the local URL, smoke-check that the new control works and no console errors. Commit + push to `3d/foundation`.
