# Implementation plan — 8-feature batch

Order chosen to maximise independence (1–5 don't touch the solver) and minimise rework.

## 1. STL upload
**Files:** `src/app.ts` (drop handler)
**Steps:** import `STLLoader`, branch on `.stl`, run through `voxelizeAnyMesh`.
**Verify:** drop `.stl` cube → renders + collides.

## 2. Base obstacle catalogue
**Files:** `src/obstacles/modelRegistry.ts`, `src/app.ts` (parametric NACA generator), `index.html` (optgroups).
**Steps:** add new entries (≥ 25), grouped into optgroups; for NACA series add a parametric path in `rebuildObstacle` that takes the (m,p,t) digits.
**Verify:** count options ≥ 35, each loads without console error.

## 3. Floor
**Files:** `src/config.ts`, `src/app.ts`, `index.html`.
**Steps:**
- Config keys `floorEnabled`, `floorHeight`.
- Slider + checkbox in Shape panel.
- Build a floor `THREE.Mesh` plane + merge its voxels into the LBM mask alongside the obstacle.
**Verify:** floor on → particles can't go below it; off → unchanged.

## 4. Streamlines
**Files:** `src/render/particles3d.ts`, new `src/render/streamlineRender.ts` (or extend), `index.html` (toggle).
**Steps:**
- Extend particle buffer to keep last 8 positions (ring).
- New render pipeline using `line-strip` primitives.
- UI toggle, default = current particles.
**Verify:** toggle flips live, streamlines colour-mapped by speed.

## 5. Multi-inlet
**Files:** `src/sim/lbm3d.wgsl`, `src/sim/init3d.wgsl`, `src/sim/lbm3d.ts`, `src/render/particles3d.ts`, `src/config.ts`, `src/app.ts`, `index.html`.
**Steps:**
- Params struct: `array<vec4<f32>, 4>` for inlets (yFrac, zFrac, radius, enabled).
- WGSL: loop over enabled inlets in inlet BC + particle reseed.
- UI: per-jet sliders, add/remove buttons.
**Verify:** 2 jets at top/bottom → two visible streams; remove jet → no inflow there.

## 6. Friction map from hits
**Files:** new `src/sim/frictionField.ts`, `src/sim/lbm3d.ts`, `src/render/particles3d.ts`, `src/app.ts`.
**Steps:**
- New `frictionBuf: array<atomic<u32>>` length = W·H·D.
- Modify `cs_advect`: detect exit-into-solid event; atomicAdd at the voxel.
- New decay compute pass each LBM step: `count *= exp(−dt/τ)` (use multiply-by-fixed-point to stay int).
- Obstacle material: sample the friction buffer per fragment via voxel-world-position lookup; colour-ramp.
**Verify:** front face hot, wake cool, redistributes when shape changes.

## 7. Accuracy
**Steps:**
- Switch defaults: `useMRT=true`, `useLES=true`, `visc=0.010`.
- Compute per-link wall fraction `q` during voxelization (`linkQ` buffer, 19 directions per cell, only meaningful at fluid–solid boundary links).
- `lbm3d.wgsl` collide–stream: replace half-way bounce-back with Yu's interpolated BB using `q`.
**Verify:** Cd readout for sphere @ Re ≈ 400 lands in textbook 0.5–0.7 band; visible vortex shedding on cylinder.

## Commit cadence
After each numbered feature: `git add -A && git commit && git push`.

## Stop conditions
- Same WGSL compile error 3× in a row → bail, surface to user.
- Build fails after a feature → revert that feature, surface to user.
