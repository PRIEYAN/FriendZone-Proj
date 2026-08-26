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

Two constellations, chained back to back:

| | Stars | Lines |
|---|---|---|
| The Big Dipper | 7 | 7 |
| Orion | 7 | 7 |

- **Tap a star** to pick it up — it **pulses** so you know it's armed; **tap a second** to draw the line.
- **Tap the same star twice** to cancel a selection.
- **Re-draw an existing line** to erase it. Wrong lines never block a solve.
- **Tap `?`** for a nudge — one star from a missing edge lights up. It never
  draws the line for you.
- After ~12 seconds of inactivity that hint appears on its own.

Solve it and the lines flare, a **mythic figure blooms** behind them in glowing
line-art — the Great Bear around the Dipper, the Hunter around Orion — a chime
rings, and the banner names both. Take the next sky when the group is ready, or
let it roll on by itself.

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
  index.ts          entry point, UI renderer setup
  config.ts         every tunable — sizes, colours, glow, timings
  constellations.ts star + edge data, authored in 2D and projected onto the dome
  state.ts          the single synced component (the whole multiplayer surface)
  stars.ts          interactive star pool: anchor + oversized hit box + billboard
  lines.ts          pre-allocated line pool, drawn from the synced bitmask
  game.ts           tap handling, solve detection, reveal, board advance
  hints.ts          the passive hint
  figures.ts        the mythic outlines revealed on solve
  presence.ts       who else is in the dome
  ui.tsx            the HUD
tools/
  generate_assets.py  synthesises every binary asset this scene ships
```

**Multiplayer in one component.** All shared state is a single `GameState`
component on a single synced entity: which constellation is up, a bitmask of
drawn lines, whether it is solved, and how many have been completed. Every
client renders from that. There is exactly one source of truth to inspect when
sync misbehaves, which matters more than elegance when the deadline is short.

**Selection stays local.** Which star *you* have picked up is never synced, so
two players can be mid-selection at once without fighting over a shared cursor.

**Pools, not churn.** Stars and lines are allocated once at load and toggled
with `VisibilityComponent`. Entity count is flat for the whole session.

**No per-frame work beyond timers.** The one system ticks a hint timer and a
reveal timer, and re-renders lines only when the mask actually changes. The
star pulse is the only continuous animation and it touches at most two entities.

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

## Mobile-first, specifically

This scene was built against the mobile client's real constraints, not adapted
down from desktop:

- **No point lights.** `PBPointLight` is not functional on the mobile client, so
  every glow in the scene is an emissive PBR material.
- **No particle systems.** Unimplemented on mobile; effects are geometry-based.
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
- **SDK pinned to 7.26.0.** Workshop #3 recommended 7.27+ for desktop/mobile UI
  scaling parity, but 7.27 is not published to npm yet. Run `npm run upgrade`
  once it lands.

---

## Licence

MIT — see [LICENSE](LICENSE).
