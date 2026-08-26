# Celestial Cartography — Build Workflow

Working plan from **2026-08-24** to submission. Target submit date **Sep 2**, with Sep 3
as buffer (the DoraHacks deadline reads `2026/09/04 00:00`, i.e. end of Sep 3).

Source of truth for the idea: [Celestial_Cartography_Project_Description.md](Celestial_Cartography_Project_Description.md)
Source of truth for the rules: [Buildathon_Requirements.md](Buildathon_Requirements.md)

---

## Where the build stands

| Concept doc calls for | Status |
|---|---|
| Dark dome + scattered starfield | Built (floor, horizon ring, 70 background stars) |
| Tap star A → tap star B → glowing line | Built |
| Lines synced to all players in real time | Built (one synced `GameState` component) |
| Pattern matching → solved | Built (bitmask set comparison) |
| 2 constellations, chained | Built (Big Dipper, Orion) |
| Passive glow hint after inactivity + `?` button | Built |
| Mistakes free, re-tap to erase | Built |
| Oversized mobile tap targets | Built (~4.7× visual size) |
| Mobile safe-area UI | Built (`screenInset: 'interactable'`) |
| Stars look like starlight, not squares | **Done** — generated radial-glow sprite |
| Selected star *pulses* | **Done** — sine pulse on selected + hinted |
| Mythic figure outline blooms on solve | **Done** — Great Bear, The Hunter |
| Ambient loop + success chime | **Done** — synthesised, we own the rights |
| "Next" prompt as well as auto-advance | **Done** — button + auto fallback |

All five closed. Phases 1–4 complete; Phase 5 (verify and ship) is what remains.

---

## Phase 1 — Visual identity (the dome has to read as a planetarium)

1. **Star glow sprite.** Generate a radial-gradient RGBA PNG and put it on the star
   billboards instead of flat emissive. Two triangles still, but it reads as light
   rather than a white square. Same sprite for background stars at lower intensity.
2. **Pulse animation.** The concept doc is specific: "Selected star pulses/brightens
   so the player has clear confirmation before the second tap." A sine-driven
   emissive + scale pulse on the selected star and the hinted star. Only ever 1–2
   entities animate, so the per-frame cost stays negligible.
3. **Dark sky.** `skyboxConfig.fixedTime: 0` is already in `scene.json` but only
   applies on a deployed World, not local preview. Verify on first deploy.

## Phase 2 — The payoff (this is the clip-worthy moment)

4. **Mythic figure reveal.** MVP cut from the concept doc: "Simple glowing line-art
   outline fade-in, no rigged character animation." Each constellation gets a
   polyline silhouette — the Bear for the Big Dipper, the Hunter for Orion —
   authored in the same 2D sky-plane space as the stars, projected onto the dome
   just beyond them, fading in over ~1.5s on solve while the puzzle lines flare.
5. **Reveal choreography.** Lines flare → figure fades in → banner names the
   constellation. Staged, not simultaneous, so it reads as an event.

## Phase 3 — Audio

6. **Generate, don't source.** Synthesise an ambient drone loop and a success chime
   with Python, encode to MP3 with ffmpeg. Self-generated means we hold the rights
   outright, which is exactly what T&C §8 demands and what shipping a random
   royalty-free file does not cleanly give us.

## Phase 4 — Flow

7. **"Next" prompt.** Concept doc: advance "either automatically or via a 'Next'
   prompt". Add an explicit button during the reveal so a group can move on when
   *they* are ready, with the auto-advance as a fallback so a lone judge is never
   stuck.

## Phase 5 — Verify and ship

8. Build clean, type check clean, entity budget under control.
9. Test on a real phone via `npm run start:mobile`.
10. Stats Panel: >90% on High Graphics Profile.
11. Deploy to a World, confirm the dark sky and hidden minimap actually apply.
12. Replace the placeholder thumbnail, record the demo, write the four §4.1 answers.
13. Push to a standalone public GitHub repo, submit the BUIDL.

---

## Local dev loop

```bash
npm run start:mobile     # QR -> real phone. The only view that matters.
bash $SCRATCH/dcl-gpu.sh # desktop preview on the RTX 3050
bash $SCRATCH/gpu-watch.sh  # watch swMaps; >10 means it fell back to software
```

`$SCRATCH` = `/tmp/claude-1000/-home-prieyan-friendZone/a161cce1-8090-49e1-9af3-1c5d85ba265c/scratchpad`

---

## Rules that constrain every phase

- No point lights, no particle systems — unsupported on the mobile client
- Nothing bound to `IA_ACTION_3`–`IA_ACTION_6`
- Nothing in the bottom-right corner
- Must be fully playable and satisfying **alone** (T&C §6) while being visibly
  social (T&C §7)
- Every asset must be one we hold rights to (T&C §8)
