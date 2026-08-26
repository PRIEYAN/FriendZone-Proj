# Celestial Cartography

**A cooperative constellation-drawing dome for Decentraland Mobile.**

Stand in a dark planetarium, tap two stars, and a glowing line stretches between
them — visible instantly to everyone else in the dome. Get the whole shape right
and the constellation flares to life. Nobody has to be in charge, nobody can
lose, and a wrong line costs nothing but a second tap.

Built for the [Decentraland Friendzone Mobile Buildathon](https://dorahacks.io/hackathon/friendzone/detail)
(Aug 14 – Sep 4, 2026).

---

## Play

Ten constellations, chained back to back, easiest first:

| | Stars | Lines | |
|---|---|---|---|
| Triangulum | 3 | 3 | ● |
| Crux | 4 | 2 | ● |
| Corvus | 5 | 5 | ● |
| Cassiopeia | 5 | 4 | ● |
| Lyra | 5 | 5 | ●● |
| Aquila | 5 | 4 | ●● |
| Cygnus | 6 | 5 | ●● |
| The Big Dipper | 7 | 7 | ●● |
| Orion | 7 | 7 | ●●● |
| Scorpius | 8 | 7 | ●●● |

- **Tap a star** to pick it up — it **pulses** so you know it's armed; **tap a
  second** and a line is *drawn* between them, growing from the star you tapped
  first. Each star sounds a different note, so tracing a shape plays a little
  melody.
- **Tap the same star twice** to cancel a selection.
- **Re-draw an existing line** to erase it. Wrong lines never block a solve and
  never break a streak — the game says "not that one", softly, and moves on.
- **Tap `?`** for a nudge — one star from a missing edge lights up. It never
  draws the line for you. After ~12 seconds of inactivity it appears on its own.

Correct edges build a **streak**, and the streak drives a multiplier. Each board
is scored against a par time derived from its own edge count, and rated one to
three stars — never zero, because solving is never failing. Total score walks a
rank ladder from **Stargazer** to **Celestial Cartographer**, and a **sky atlas**
strip across the top tracks which of the ten you have taken.

Solve one and the lines flare in sequence, a **mythic figure draws itself on**
behind them in glowing line-art — the Great Bear around the Dipper, the Hunter
around Orion, the Scorpion around Scorpius — a shockwave rolls out across the
dome and a chime rings while the drone ducks under it. The banner names the
constellation, the figure, your rating and your time. Take the next sky when the
group is ready, or let it roll on by itself.

Every line you draw appears instantly on everyone else's screen.

---

## Run it

```bash
npm install
npm run start            # desktop preview
npm run start:mobile     # QR code → open on a real phone
```

Mobile preview needs your phone and this machine on the same Wi-Fi. `--mobile`
does not also launch the desktop explorer; run both scripts in two terminals to
compare them side by side.

### Deploy to a World

Set your Decentraland NAME in `scene.json` first:

```json
"worldConfiguration": { "name": "your-name.dcl.eth" }
```

```bash
npm run build
npm run deploy -- --target-content https://worlds-content-server.decentraland.org
```

---

## How it is built

```
src/
  index.ts          entry point: builds every pool, then registers the systems
  config.ts         every tunable — sizes, colours, glow, timings
  constellations.ts star + edge data, authored in 2D and projected onto the dome
  figures.ts        the mythic outlines, drawn on stroke by stroke at solve
  state.ts          the single synced component (the whole multiplayer surface)
  scoring.ts        streaks, score, star ratings, ranks — pure, no ECS at all
  stars.ts          interactive star pool: anchor + oversized hit box + billboard
  lines.ts          pre-allocated line pool, animated from the synced bitmask
  game.ts           tap handling, solve detection, and all the choreography
  hints.ts          the passive hint
  vfx.ts            pooled meteors, ripples, sparks, shockwaves, bursts, motes
  audio.ts          a round-robin voice pool for ten synthesised effects
  dome.ts           floor, horizon ring, background starfield
  scenery.ts        telescope, compass rose, horizon ridge, moon, benches
  wayfinding.ts     which way to turn to find the sky that matters
  presence.ts       who else is in the dome
  ui.tsx            the HUD
tools/
  generate_assets.py  synthesises every binary asset this scene ships
  sim/                the offline playthrough — see Testing below
  browser-test.mjs    Chrome + GPU smoke test
  gpu-preview.sh      opens the preview on the discrete GPU
```

**301 entities**, allocated during load and flat for the entire session.

**Multiplayer in one component.** All shared state is a single `GameState`
component on a single synced entity: which constellation is up, a bitmask of
drawn lines, whether it is solved, and how many have been completed. Every
client renders from that. There is exactly one source of truth to inspect when
sync misbehaves, which matters more than elegance when the deadline is short.

**Selection stays local.** Which star *you* have picked up is never synced, so
two players can be mid-selection at once without fighting over a shared cursor.

**Pools, not churn.** Stars and lines are allocated once at load and toggled
with `VisibilityComponent`. Entity count is flat for the whole session.

**Animation is rationed, not spread out.** A material write on the real client
is a CRDT message plus a shader-parameter update, and it is the cheapest way for
a scene full of movement to become unaffordable on a phone without anything
looking obviously wrong. So every animator early-outs on a single counter when
it has nothing to do, the idle star shimmer recomputes eight times a second
instead of sixty, the drifting motes update at fifteen, the scenery at ten, and
a figure stroke stops being written the moment it settles. The test suite
asserts the resulting rate rather than trusting any of it: **64 material writes
per second** in an idle dome, **952 for an entire solve**.

**The figure completes your drawing.** Orion's outline deliberately omits the
shoulders, belt and legs — those are already on screen as the lines the players
drew. It adds the head, bow, club and tunic around them, so the reveal reads as
the sky finishing your sentence rather than redrawing it.

**Every asset is generated, not sourced.** `tools/generate_assets.py` draws the
star sprite from a radial falloff and synthesises the ambient drone and chime
from sine partials. Nothing is downloaded or sampled, so the project holds
outright rights to all of it — cleaner than shipping a third-party file whose
licence terms would have to travel with the repo. Re-run it any time:
`python3 tools/generate_assets.py` (needs ffmpeg).

---

## Testing

```bash
npm test              # the offline playthrough
npm run test:mobile   # same, with isMobile() true, and verbose
npm run test:browser  # Chrome on the discrete GPU
```

**The offline playthrough** is the primary test. The scene's real host is an
Explorer that cannot be scripted and cannot be stepped frame by frame, so
`tools/sim` bundles the actual source against a mock runtime, calls `main()`,
and then plays the game the way a player does — it reads the HUD, presses the
HUD's own buttons, and taps stars through the pointer callbacks the scene
registered on its own entities. Nothing reaches into game logic directly, so a
button wired to nothing, a tap target on the wrong entity, or a board that fails
to advance all fail here.

`@dcl/sdk/math` is deliberately *not* mocked; it resolves to the real
`@dcl/ecs-math`, because the dome projection and the quaternion line rotations
are exactly what a fake would paper over.

It plays all ten constellations end to end and asserts, among other things, that
the entity count never moves, that twenty idle seconds throw nothing, that every
solved board scores between one and three stars, and that the material write
rate stays inside budget.

**The browser test** covers the one thing the simulator cannot: that the bundle
the CLI produced loads in a real client, on real hardware. It boots the preview
server, resolves the scene entity from the content manifest, fetches the file
`scene.json` names as `main`, then opens the explorer in Chrome and screenshots
it into `docs/shots/`. Chrome is launched through the NVIDIA ICD with ANGLE on
Vulkan and the run fails if it finds itself on SwiftShader — a software
rasteriser would produce numbers that mean nothing.

To play it yourself on the discrete GPU:

```bash
npm run start:web -- --no-browser   # terminal 1
npm run preview:gpu 8000            # terminal 2
```

---

## Mobile-first, specifically

This scene was built against the mobile client's real constraints, not adapted
down from desktop:

- **No point lights.** `PBPointLight` is not functional on the mobile client, so
  every glow in the scene is an emissive PBR material.
- **No particle systems.** Unimplemented on mobile, so every effect in the scene
  — meteors, tap ripples, travel sparks, the solve shockwave, edge bursts, the
  drifting motes — is pooled geometry with an emissive material, allocated at
  load and shown or hidden rather than spawned.
- **Safe areas.** The renderer runs at `screenInset: 'interactable'` on mobile,
  keeping the HUD clear of the joystick, chat and camera controls. Desktop falls
  back to `'device'`, because `'interactable'` would waste a quarter of a desktop
  screen.
- **Thumbs, not cursors.** The hint button is 92px on mobile against 64 on
  desktop, and sits bottom-**left** — the bottom-right corner belongs to the
  client's own action button.
- **Oversized tap targets.** Every star carries an invisible pointer collider
  roughly 4.7× its visual size, on `CL_POINTER` only so it never blocks movement.
- **Readable type.** Font sizes scale up on mobile; the 10px default is
  unreadable on a phone.
- **One input, one gesture.** Single tap on `IA_POINTER` only. Nothing is bound
  to `IA_ACTION_3`–`IA_ACTION_6`, which are not touch-accessible.
- **Cheap geometry.** Stars are billboarded planes — two triangles each — not
  spheres, wearing a generated radial-glow sprite so they read as starlight
  rather than white squares. Lines and figure strokes are stretched boxes. The
  minimap is switched off to give the dome the whole screen.
- **Night sky by configuration.** `skyboxConfig.fixedTime: 0` makes the sky dark
  at the source, rather than building a dome mesh to hide it.

---

## Buildathon compliance

| Requirement | How this scene meets it |
|---|---|
| Deployed in a Decentraland World | `worldConfiguration.name` in `scene.json` |
| Persistent standalone experience | No host, no schedule, no server. Loads and plays on arrival. |
| Meaningful social interaction | Lines sync live between all players; the HUD names who is present |
| Designed and tested for mobile | See the section above |
| Open source, public repo | MIT, `LICENSE` |
| Original work | Written for this Buildathon |

**On the standalone/social tension.** The rules require the scene to work for a
single visitor with no host, while excluding "single-player experiences without
a meaningful social component." This scene resolves that by being fully solvable
alone while making the shared layer visible even when you are: the HUD always
states that your lines appear for anyone who joins, and names the other
stargazers the moment there are any.

---

## Known limitations

Stated plainly rather than discovered by a judge:

- **Shared state is session-scoped.** `syncEntity` keeps state consistent between
  connected players, but it is not backed by a server — when the last player
  leaves the dome, the board resets. True cross-session persistence (a dome that
  remembers the constellations previous visitors completed) needs the
  Decentraland Multiplayer Server. That is the first thing I would add.
- **Sync is last-write-wins.** If two players complete their second tap inside
  the same sync window, one line can be lost and has to be re-tapped. There is
  no penalty for this, and no fail state to corrupt.
- **`images/scene-thumbnail.png` is still the template placeholder.** Replace it
  with a real screenshot before submitting.
- **Scoring is per-session and per-client.** Streaks, score and rank live in
  plain module state, not in the synced component — only the board itself and
  the dome's fastest time are shared. Two players in the same dome are working
  the same puzzle but keeping their own score, which is the right default for a
  co-op game and the wrong one for a leaderboard.
- **SDK pinned to 7.26.0.** Workshop #3 recommended 7.27+ for desktop/mobile UI
  scaling parity, but 7.27 is not published to npm yet. Run `npm run upgrade`
  once it lands.

---

## Licence

MIT — see [LICENSE](LICENSE).
