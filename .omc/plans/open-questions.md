# Open Questions

## ui-restructure-v2 — 2026-05-20

- [ ] **Auto-inject dye on Volumetric viewport tab?** Plan defaults to YES (set `dye.injectAmount=0.7` when `viewMode === 'volume'`, 0 otherwise, and call dye-inject each frame). Alternative: keep manual-only and add a one-shot "Seed dye" button in the Volumetric mode. — Matters because: this is the single highest-impact fix for the user's "none of it works" feedback. If user prefers explicit/manual seeding for purist reasons, switch to button approach.
- [ ] **Should "Inject" tool stay in `Run` tab once auto-dye is on?** It overlaps with auto-dye for the Volumetric view but is still useful as an impulse injector in Particles/Streamlines. Plan keeps it; future pass may hide behind Advanced.
- [ ] **Cl computation:** HUD shows `Cl` but `DragCoeffCalc` never computes it. Out of scope for this restructure; needs a follow-up plan.
- [ ] **Persist active panel tab in localStorage?** Plan does not. Easy add-on if desired.
- [ ] **Rename "Volumetric" → "Smoke" or "Dye"?** Possibly clearer; deferred.
