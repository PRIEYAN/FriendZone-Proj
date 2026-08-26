# Celestial Cartography

**A cooperative constellation-drawing puzzle for Decentraland Mobile — built solo, vibe-coded with Claude.**

Submission for: Decentraland Friendzone Mobile Buildathon (Aug 15 – Sep 4, 2026)

---

## One-Liner

Friends stand in a dark planetarium dome and trace glowing lines between stars, together, to reveal mythic constellations — a shared "aha" moment that plays out in under a minute and invites a rematch.

## Elevator Pitch

Celestial Cartography drops players into a domed observatory lit only by scattered points of starlight. Any player can tap a star, then tap a second star, and a glowing line stretches between them — visible to everyone in the room, instantly. Get the right set of connections and the shape flares to life: an animated mythic figure (an archer, a bear, a dipper) blooms above the dome and a triumphant chime rings out. It's a puzzle nobody can solve alone by design — the fun is in someone else spotting the star you missed.

---

## Why This Idea

Out of twelve concepts drafted for this buildathon, Celestial Cartography scores highest on the thing that actually matters for a solo, AI-assisted build: **a small, well-defined state surface**.

- **Novelty:** High. Nothing else in the concept set does collaborative constellation-tracing — most competitors will lean toward parties, races, or hide-and-seek, all of which are more common in social-world builds.
- **Feasibility (solo, 3 weeks, vibe-coded):** The entire mechanic reduces to one repeating operation — *pick star A, pick star B, spawn a synced line, check the line set against a known pattern.* That's a small, auditable slice of logic, which matters a lot when an AI pair-programmer is writing most of it: fewer moving systems means fewer places for silent multiplayer bugs to hide.
- **Mobile fit:** No typing, no precision timing, no camera-heavy platforming. Everything is a single tap. That maps directly onto Decentraland's own mobile guidance (large touch targets, safe-area UI, no keyboard-only bindings).
- **Social stickiness:** It's cooperative, not competitive — there's no losing, only "we haven't found it yet." That tends to keep small friend groups engaged longer than a race or a scored mini-game, and it's easy to add more constellations later for repeat visits.

---

## Core Mechanics

1. **The Dome.** Players spawn inside a planetarium — a dark skybox dome with a scattered field of star entities (small emissive spheres or point-light billboards).
2. **Star Selection.** Any player taps a star to "pick it up" (visually highlights). A second tap on another star draws a glowing line segment between them.
3. **Shared State.** Every drawn line is a synced entity — all players in the world see the same lines appear in real time, regardless of who drew them.
4. **Pattern Matching.** The scene holds a small hardcoded set of valid star-pairings per constellation. Once the full set of correct pairs exists among the drawn lines, the constellation is "solved."
5. **Reveal.** On solve: the completed shape's lines flare brighter, a simple animated outline (e.g. an archer silhouette) fades in above the pattern, and a success chime plays. A short on-screen banner announces the constellation by name.
6. **Reset / Next.** After a few seconds, the board can be nudged into the next constellation (either automatically or via a "Next" prompt), so a group can chain through the full set in one sitting.
7. **Mistakes are free.** Wrong lines don't penalize — they just don't count toward the pattern, and can be tapped again to erase. No fail state, no timer pressure (unlike Rooftop Party or Parkour Race, there's nothing to lose).

## MVP Scope (solo, cut down from the original 3-person/3-week plan)

Since this is being built solo rather than by the original 3-person team the concept doc assumed, the scope is deliberately trimmed:

| Original team scope | Solo MVP cut |
|---|---|
| 3–4 constellations | **2 constellations** (e.g. Orion + the Big Dipper — one iconic/harder, one simple/forgiving) |
| Radial hint menu on star tap | **Passive glow hint** — the correct *next* star pulses faintly after ~10s of inactivity |
| Full mythic-figure reveal animation (archer appears) | **Simple glowing line-art outline** fade-in, no rigged character animation |
| Custom ambient sci-fi audio track | **One royalty-free ambient loop** + a single success chime |
| Polished shader-based star glow | **Emissive material + point light**, no custom shaders |

This keeps every system small enough to reason about, test on-device, and hand to Claude in focused, verifiable chunks rather than one sprawling feature.

---

## Mobile UI / Controls

- **Movement:** Standard Decentraland virtual joystick (bottom-left), unchanged from default mobile scheme.
- **Selection:** A single large tap-to-select on any visible star — no aim-and-hold, no secondary buttons.
- **Feedback:** Selected star pulses/brightens so the player has clear confirmation before the second tap.
- **Hint affordance:** A small "?" icon in a screen corner nudges the passive hint system if a group seems stuck — tap it to make the next correct star glow for a few seconds.
- **No text input, no complex menus.** Everything follows Decentraland's mobile guidance: large touch targets (3× scale), safe-area layout, `isMobile()`-branched UI, no keyboard-only bindings.

---

## Social Hooks

- **Forced collaboration without forced dialogue.** You don't need voice chat to play — but pointing at your screen and yelling "no, THAT star" is exactly what makes people want to play it with friends instead of strangers.
- **Visible shared progress.** Every player sees every line as it's drawn, so there's a constant low-level "someone's working on it" signal even if you're not the one tapping.
- **Shareable payoff.** The reveal moment (glowing shape + mythic outline) is a natural screenshot/clip moment — the kind of beat that gets posted, which is free marketing for a hackathon demo.
- **Replayable by design.** Once the group solves both constellations, resetting the board for a second round costs nothing — no cooldown, no penalty, just "let's do it again but faster."

---

## Inspiration

- Ancient stargazing traditions — Babylonian and Mayan astronomy, the twelve Zodiac constellations.
- Childhood connect-the-dots puzzles, translated into a shared 3D space instead of a single sheet of paper.
- Communal sky-gazing rituals (e.g. Māori star lore gatherings) — the idea that looking at the sky together is itself a social act, not just an individual one.

---

## Technical Approach (Decentraland SDK7)

- **Environment:** Dome skybox + starfield built from simple low-poly primitives (small spheres) with emissive materials; no custom mesh import required for MVP.
- **Interaction:** `PointerEvents` / click triggers attached to each star entity to register taps.
- **Line rendering:** A thin cylinder or stretched cube transform positioned and rotated between two star coordinates on selection — cheap to compute, cheap to render.
- **Multiplayer sync:** Drawn lines and "solved" flags are marked with `syncEntity` so state is consistent across every connected client without needing an external backend.
- **Pattern check:** Constellation definitions are hardcoded arrays of valid star-ID pairs; a solved check is a simple set comparison run whenever a new line is added — no external logic server needed.
- **Audio:** Decentraland's built-in `AudioSource` component for the ambient loop and the success chime.
- **Performance guardrails:** Cap total simultaneous lines, keep star count modest (dozens, not hundreds), and avoid per-frame effects — this is a static-geometry scene with event-driven changes only, which keeps mobile frame rate predictable.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Puzzle feels ambiguous with no reference image | Passive glow hint system nudges the next correct star without solving it for the player |
| Sync lag if many lines are drawn near-simultaneously | Cap simultaneous in-flight lines; keep the "solved" check lightweight and only re-run on new-line events, not every frame |
| Mobile taps miss small stars | Oversized invisible tap-target colliders around each visible star, well beyond the visual sprite size |
| Solo build timeline slips | MVP is intentionally cut to 2 constellations and simplified VFX (see scope table above) so there's always a demoable build, even if stretch polish doesn't land |

---

## Demo Script (target: under 60 seconds)

1. Judge loads the world on mobile — dark dome, scattered stars, soft ambient hum.
2. Judge taps a star (it pulses), taps a second star — a glowing line snaps into place.
3. A second player (or the judge's teammate) taps two more stars from their own device — their line appears instantly on the judge's screen too.
4. After the final correct pair is drawn, the shape flares, a glowing outline of Orion fades in above the dome, and a chime plays. On-screen banner: **"Orion — Complete!"**
5. The group immediately starts the Big Dipper without any loading screen, to show repeatability in the same session.
6. Judges walk away having seen: real-time multiplayer sync, a clean mobile-only control scheme, and a full puzzle loop from empty board to payoff — in well under a minute.

---

## Build Plan (solo, ~3 weeks)

- **Week 1:** Dome scene, star placement, ambient audio, tap-to-select working locally (single client, no sync yet).
- **Week 2:** `syncEntity` wiring for lines and solved-state, pattern-matching logic for both constellations, passive hint system.
- **Week 3:** Reveal animation/outline fade-in, mobile UI pass (touch target sizing, safe-area check on a real device), performance pass, record demo, write up submission.

---

## Status

Idea locked, scope trimmed for solo build. Next step: scaffold the SDK7 project structure and get the dome + first tappable star pair working end-to-end on one client before adding sync.
