# Celestial Cartography — Build Workflow

Working plan from **2026-08-24** to submission. Target submit date **Sep 2**, with Sep 3
as buffer (the DoraHacks deadline reads `2026/09/04 00:00`, i.e. end of Sep 3).

Source of truth for the idea: [Celestial_Cartography_Project_Description.md](Celestial_Cartography_Project_Description.md)
Source of truth for the rules: [Buildathon_Requirements.md](Buildathon_Requirements.md)

---

## Where the build stands

The v1 MVP (three constellations, a fade-in figure, one chime) shipped. What
follows is the v2 pass that turned it into a game rather than a demo, split into
modules with fixed file ownership — see [Build_Contract.md](Build_Contract.md).

| Module | What it added | Status |
|---|---|---|
| M1 Sky Atlas | 10 constellations, 10 mythic figures, difficulty tiers | Done |
| M2 VFX | meteors, ripples, travel sparks, shockwaves, bursts, motes | Done |
| M3 Audio | 8 new synthesised effects, richer drone, 3.2s fanfare | Done |
| M4 Motion | lines that draw themselves, star arrival wave, idle twinkle | Done |
| M5 Scoring | streaks, score, 1-3 star ratings, rank ladder | Done |
| M6 HUD | difficulty marks, live score, sky atlas strip, staged banner | Done |
| M7 Scenery | telescope, compass rose, horizon ridge, moon, benches | Done |
| M8 Integration | the choreography: what a tap and a solve look and sound like | Done |
| M9 Testing | offline playthrough + Chrome/GPU smoke test | Done |

Every module was verified by `npm test` before it was committed.

### Budgets as measured

| | Measured | Budget |
|---|---|---|
| Entities | 301, flat for the session | 500 |
| Material writes, idle | 64/second | 400/second |
| Material writes, one solve | 952 | 6000 |
| Stars per constellation | max 8 | 8 (32-bit pair mask) |

### What remains

1. Test on a real phone via `npm run start:mobile`.
2. Stats Panel: >90% on High Graphics Profile.
3. Deploy to a World, confirm the dark sky and hidden minimap actually apply.
4. Replace the placeholder thumbnail, record the demo, write the four §4.1 answers.
5. Submit the BUIDL.

## Local dev loop

```bash
npm test                          # the offline playthrough — run this first
npm run start:mobile              # QR -> real phone. The only view that matters.

npm run start:web -- --no-browser # terminal 1: preview server
npm run preview:gpu 8000          # terminal 2: Chrome on the RTX 3050

npm run test:browser              # both of the above, unattended, + screenshots
```

The GPU scripts used to live in a scratch directory that no longer exists; they
are `tools/gpu-preview.sh` and `tools/browser-test.mjs` now, in the repo, where
they can be reviewed. Both push Chrome onto the discrete card through the NVIDIA
ICD with ANGLE on Vulkan, and `test:browser` fails the run outright if it finds
itself on SwiftShader rather than quietly reporting software-rendered numbers.

---

## Rules that constrain every phase

- No point lights, no particle systems — unsupported on the mobile client
- Nothing bound to `IA_ACTION_3`–`IA_ACTION_6`
- Nothing in the bottom-right corner
- Must be fully playable and satisfying **alone** (T&C §6) while being visibly
  social (T&C §7)
- Every asset must be one we hold rights to (T&C §8)
