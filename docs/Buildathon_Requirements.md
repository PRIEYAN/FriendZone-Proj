# Friendzone Mobile Buildathon — Requirements & Build Brief

**Last updated:** 2026-08-24
**Sources:** DoraHacks campaign page, official Terms & Conditions (Notion), Decentraland forum announcement thread (all 11 posts incl. 4 workshop recaps), Decentraland Creator Docs. All primary sources were read directly — see §12.

---

## 1. Deadline — read this first

DoraHacks lists the submission deadline as **2026/09/04 00:00**, which is **midnight at the start of Sep 4 — i.e. the end of Sep 3.** The page counter read *"10 days left for submission"* on Aug 24, which is consistent with that reading.

> ⚠️ **The timezone is not stated on the page.** Confirm it while logged in to DoraHacks. Until confirmed, **plan to submit by end of Sep 2** and treat Sep 3 as buffer. Do not assume you have all of Sep 4.

| Date | Milestone |
|---|---|
| Aug 6, 20:00 | Pre-registration opened |
| Aug 14, 20:00 | Build phase / submissions open |
| **Sep 4, 00:00** | **Submission deadline (= end of Sep 3)** |
| Sep 5 – 11 | Judging — every project tested in the Mobile App |
| Sep 13 | Winner reveal; MANA converted at this day's closing price |

**130 hackers registered** as of Aug 24.

---

## 2. Prizes — confirmed breakdown

$8,000 MANA pool, **top 5 paid**:

| Place | Prize |
|---|---|
| 🥇 1st | $3,000 MANA |
| 🥈 2nd | $2,000 MANA |
| 🥉 3rd | $1,500 MANA |
| 🏆 4th | $1,000 MANA |
| 🏆 5th | $500 MANA |

Plus:
- **$30 Merch Shop voucher** — first 50 eligible participants, one per person
- **Friendzone badge** — every eligible submission
- **Top 10** may be featured in **DCL Mobile Discover** (subject to compatibility + continued accessibility)
- Promising projects may be routed into **DCL Regenesis Labs Grants Season 2** or the **Decentraland Foundation Creator Success Program**

USD prizes convert to MANA at the **Sep 13, 2026 closing price**. Winners must supply an Ethereum-compatible wallet; payout targeted within 30 days.

**Read:** 5 paid slots out of 130 registrants. Top-10 featuring is the realistic target and is arguably worth more than 5th place ($500).

---

## 3. The Brief

> "Turn your Decentraland World into the Friendzone no one wants to leave!"

Build a **social hangout, multiplayer activity, cooperative challenge, or competitive game** that feels **intentionally designed for mobile from the start** and gives people a reason to **connect, stay longer, invite friends, and return regularly**.

---

## 4. Submission Requirements — every project must

1. Be a **scene deployed in a Decentraland World**, publicly accessible **throughout judging**
2. Create **meaningful social interaction** through environments, gameplay, activities, or social systems
3. Work as a **persistent standalone experience** — no scheduled event, host, performer, or moderator
4. Be **designed and tested for mobile** — touch controls, small screens
5. Be **open source in a public GitHub repository** under a clearly identified open-source license
6. Be submitted through **DoraHacks** before the deadline (GitHub/GitLab/Bitbucket link is a required field)
7. Be **original and not used in any past Decentraland competition**
8. Comply with the Buildathon T&C and Decentraland's Terms of Use

### 4.1 Written answers required in the submission
T&C §6 requires the submission to include:
- A short project description
- **How the experience was designed or optimized for mobile**
- **How it encourages social interaction**
- **Why users may return, replay, share, or invite others**

These map 1:1 onto judging criteria. Write them deliberately — they are scored content, not paperwork.

---

## 5. Ineligible — automatic disqualifiers (T&C §7)

- One-time events or temporary activations
- Event series in an otherwise empty or largely unbuilt World
- Projects that **function only during scheduled event times**
- Projects that **depend on a host, performer, or moderator**
- Empty venues, stages, or meeting spaces without persistent interaction
- **Single-player experiences without a meaningful social component**
- Experiences that can't be reliably accessed or tested on the Mobile App
- No public GitHub repo
- Malicious code, plagiarism, unauthorized content
- Late submissions

### 5.1 The central design constraint
Two rules pull against each other and **both must be satisfied**:

> It must work **standalone for one judge alone on a phone** (§4.3) — *and* it must not be a **single-player experience without meaningful social component** (§5).

So: a solo judge must get a complete, satisfying experience **and** be able to see that the thing is genuinely social. Practical resolution — make the multiplayer layer *visible even when alone* (persistent traces of other players, shared/accumulated state, live sync that's obvious the moment a second person joins), and never gate core progress behind a minimum player count.

---

## 6. Judging Criteria (7, verbatim questions)

| # | Criterion | The question judges ask |
|---|---|---|
| 1 | **Mobile-First Experience** | Does it feel intentionally designed for mobile rather than adapted from desktop? |
| 2 | **Social Value** | Does it encourage interaction, cooperation, competition, communication or shared participation? |
| 3 | **Mobile UX and Accessibility** | Are controls, interfaces, text, onboarding and interactions suitable for touch and small screens? |
| 4 | **Performance and Optimization** | Does it load and run smoothly within mobile limitations? |
| 5 | **Creativity and Originality** | Is the concept fresh, imaginative, memorable or surprising? |
| 6 | **Retention and Discovery Value** | Does it give users a reason to return, share, or invite friends? |
| 7 | **Overall Execution** | Is it complete, stable, coherent and **ready to be featured for users**? |

**No weights are published** — not on DoraHacks, not in the T&C. Treat all seven as roughly equal.

**Tiebreak (T&C §9):** equal scores are broken on **Mobile-First Experience, Retention and Discovery Value, and Overall Execution**.

**The organizers' own stated bias — quote:**
> "A simple, polished and enjoyable mobile experience may score higher than a technically complex project that is difficult to understand, performs poorly or lacks meaningful social interaction."

Echoed in the kickoff recap: *"Small and polished can beat big and complicated."* This is stated three separate times across sources. **Scope small, polish hard.**

---

## 7. Technical Requirements & Mobile Constraints

### 7.1 Hard numbers
- **SDK 7.27+** (below this, UI scales differently between desktop and mobile)
- **Performance target: above 90% on the High Graphics Profile on a mid-range phone**
- Textures capped at **1024×1024**; export UI assets at **~2x** for device pixel ratios
- Mobile client **1.12.1+** required for the `interactable` screen inset

### 7.2 ⚠️ NOT supported on mobile — verify against your design
- **Particle systems** — not implemented
- **Scene dynamic lights** (`PBPointLight`) — protocol exists, **not functional**
- **AssetLoad component** — no resource pre-loading
- **Audio Event / Audio Analysis components** — not implemented
- **UI nine-slice tiling** — stretch only
- **Proximity voice chat — DESKTOP ONLY**
- Touch-only input: no hover, no keyboard shortcuts, no right-click, no gestures planned
- **Portrait mode not supported**
- Explorer chat cannot be hidden via scene code
- Mobile UI editing in Creator Hub not available yet

### 7.3 Safe areas (`screenInset`)
```ts
ReactEcsRenderer.setUiRenderer(ui, { screenInset: 'device' })       // default: notch/status bar
ReactEcsRenderer.setUiRenderer(ui, { screenInset: 'interactable' }) // + client controls — RECOMMENDED
ReactEcsRenderer.setUiRenderer(ui, { screenInset: 'none' })         // full canvas, manage manually
```
Or per-component: `<ScreenInsetArea>` / `<InteractableArea>` from `@dcl/sdk/react-ecs`.

- `'interactable'` reserves ~25% of the **desktop** screen's left side — branch with `isMobile()`
- Never hardcode inset values; read at runtime
- Don't double-inset (renderer setting *and* wrapper component)
- **Placement:** center for dialogs, top-center for notifications, center-bottom for hints. **Avoid bottom-right** (collides with action buttons).

### 7.4 Controls
- `ScreenControlsComponent` — hide/show joystick, crosshair, action buttons; replace icons; rebind the main action button; create custom controls; update at runtime
- `InputModifier` to disable specific actions; **Avatar Locomotion Settings** for movement speed
- **Don't bind essential actions to `IA_ACTION_3`–`IA_ACTION_6`** (number keys 1–4) — not touch-accessible
- Camera modes: Default (social), Fixed (mini-games), Orbital (galleries), Cinematic (intros) — fewer controls needed = simpler mobile experience

### 7.5 Mobile preview
```bash
npm run start -- --mobile     # QR code → LAN URL, hot reload
```
Or Creator Hub → dropdown next to Preview → "Show QR Code for Mobile". **Phone and dev machine must be on the same Wi-Fi.** `--mobile` does not also launch the desktop explorer — run two terminals to test both.

### 7.6 Performance playbook (Workshop #4, measured on a real Motorola Edge 60 Pro)
Their optimization pass achieved **70%+ fewer triangles, 90%+ fewer entities, 2x+ FPS**:
- Dedupe materials/meshes (they removed 136 duplicates), compress textures to ≤1024²
- **Merge geometry** — 2,500 meshes → ~70 by merging per room
- Load only the local area; stream in/out as the player moves
- No allocations inside loops; **frame-skip** systems that don't need per-frame updates
- **Collisions: use Box primitives, strip collision from decorative objects, keep visual and collider meshes separate** (one tree with per-leaf colliders tanked a scene)
- Prefer **material emission over extra lights**; keep particle counts controlled
- Phones share CPU/GPU memory, transparency is expensive, and **performance degrades as the device heats up**

**Kuruk's three rules:** measure on a real device before trusting anything; mobile budgets are limits not suggestions; how you load matters more than how polished individual assets are.

### 7.7 First-30-seconds guidance (Workshops #1–#2)
- *"The first 30 seconds should give players a reason to stay"*
- Think about what the player sees **at second 3** — a blank screen reads as broken, not loading
- Preload UI images inside a hidden UI element to avoid the white flash on first appearance
- Design for **two thumbs**, not a cursor; keep frequent actions in comfortable thumb zones
- Large touch targets — bigger than desktop buttons, especially for repeated actions

---

## 8. Legal / Admin (T&C)

- **Organizer:** DCL Regenesis Labs Foundation ("RGL"), Cayman Islands. Governed by Cayman law. Effective Aug 3, 2026.
- **Eligibility:** worldwide, legal age in your jurisdiction, where not prohibited by law
- **RGL / Decentraland Foundation contributors may participate but cannot win prizes** — and any team including one becomes non-competitive
- **Teams:** allowed; all members must be listed on the DoraHacks submission **before the deadline**. One entry = one placement prize. Prize goes in full to a designated representative; **RGL will not split it** — agree the split before submitting.
- **IP:** you retain ownership. You grant RGL a non-exclusive, worldwide, royalty-free license to test, display, record, reproduce and promote the project (judging, recaps, spotlights, showcases, DCL Mobile Discover, marketing).
- **You must have rights to every asset** — code, models, music, images, trademarks. Third-party material only where its license permits.
- **Disqualification for:** false info, manipulating judging, plagiarism, **artificially inflating engagement data**, malicious code, harassment, bad faith.
- **RGL is explicitly not responsible for "projects becoming unavailable during judging."** Your uptime is your problem — submit early, keep backups.
- **No AI-usage restriction appears anywhere in the T&C.** Vibe-coding is not prohibited. (Workshop #1 actively recommended AI tooling — Creator Hub MCP Server, and installing the **SDK Skills** so AI tools get Decentraland-specific context and stop emitting invalid parameters.)

---

## 9. What This Means For Our Two Concepts

Both concept docs in this folder predate these rules. Verdict: **build Celestial Cartography.**

### Sus Signal — disqualified as written, on three independent grounds
1. **Needs 5–8 simultaneous players.** Cannot work as a "persistent standalone experience"; a lone judge during Sep 5–11 sees an empty room.
2. **Its demo script assumes a hosted lobby** ("judges join a lobby of 5–6, mix of real players + hackathon crew"). T&C §7 explicitly excludes projects that depend on a host or function only during scheduled event times.
3. **Its discussion phase depends on voice chat — which is desktop-only on mobile.** The doc's plan to use "Decentraland's built-in comms" for accusations does not exist on the target platform. The core mechanic has no delivery vehicle.

Any one of these is fatal. Do not build this for this buildathon.

### Celestial Cartography — compliant, with two required fixes
Fits cleanly: solo-playable, better with friends, no host, no server, persistent by default. Scores well on Mobile UX (single tap), Performance (static geometry, event-driven), Creativity (constellation-tracing is uncommon).

**Fix 1 — point lights don't work on mobile.** The doc specifies "point-light billboards" and "Emissive material + point light." `PBPointLight` is non-functional on the mobile client. **Use emissive materials only** — which Workshop #4 recommends anyway. Also: **no particle systems**, so any sparkle/stardust VFX must be geometry or texture-based.

**Fix 2 — prove the social component (§5.1).** "Single-player experiences without a meaningful social component are not eligible." Synced lines satisfy this in principle, but a judge alone must still *see* it. Suggested: persist drawn constellations between sessions so an arriving player finds what others left; show a visible count of who's in the dome; make another player's line appear with an unmistakable live animation.

**Retention** is the remaining weak criterion — "pleasant doesn't get shared." Mitigate inside existing scope: make the solve reveal loud and clip-worthy (dome blackout → lines blaze → name card), ship 2 constellations so there's a second round, and make the solo path genuinely complete since that's what judges will actually experience.

---

## 10. Revised Plan — 10 days (Aug 24 → Sep 2 target)

| Days | Work |
|---|---|
| Aug 24–26 | Scaffold SDK 7.27+ project, dome + starfield (emissive only), tap-to-select, **deploy a World immediately** — get the "it's live" risk retired on day one |
| Aug 27–29 | `syncEntity` lines, pattern matching, 2 constellations, persistent solved state |
| Aug 30–31 | Mobile UI pass: `screenInset: 'interactable'`, oversized tap colliders, thumb zones, first-3-seconds screen, preloaded UI textures |
| Sep 1 | Performance pass on a **real phone** — Stats Panel, High profile, target >90%; merge geometry, strip decorative colliders |
| Sep 2 | Reveal polish, record demo, write the four §4.1 answers, **submit**. Final Troubleshooting Session is today — use it. |
| Sep 3 | Buffer only |
| Sep 5–11 | **Spot-check the World is still live, repeatedly** |

---

## 11. Pre-Submission Checklist

**Done — in the build:**
- [x] SDK7 project scaffolded, builds clean (`npm run build`, type checker passes)
- [x] Emissive-only lighting — no `PBPointLight` anywhere
- [x] No particle systems
- [x] UI at `screenInset: 'interactable'` on mobile, `'device'` on desktop
- [x] Nothing in the bottom-right corner; hint button bottom-left, 92px on mobile
- [x] Oversized pointer colliders on stars (`CL_POINTER` only)
- [x] Single tap on `IA_POINTER`; nothing bound to `IA_ACTION_3`–`IA_ACTION_6`
- [x] Font sizes branched via `isMobile()`
- [x] Playable and solvable completely alone
- [x] Social layer visible to a solo judge (HUD states lines are shared; names present players)
- [x] Multiplayer sync implemented (one synced `GameState` component)
- [x] Entity budget: 117 total, flat for the session (pools, no churn)
- [x] Night sky via `skyboxConfig.fixedTime: 0`; minimap hidden
- [x] Public-repo licence: MIT `LICENSE` at repo root
- [x] Original work, written for this Buildathon
- [x] Constellation data validated (no dupes, no orphan stars, 21-bit pair space)

**Outstanding — needs you:**
- [ ] Confirm the **deadline timezone** on DoraHacks while logged in
- [ ] Register as a hacker on the DoraHacks campaign
- [ ] Claim a Decentraland NAME and set `worldConfiguration.name` in `scene.json`
- [ ] `npm run deploy` to a World; confirm publicly accessible, no password
- [ ] **Test on a real phone** via `npm run start:mobile` (QR, same Wi-Fi)
- [ ] Stats Panel: verify **>90% on High Graphics Profile** on a mid-range device
- [ ] Verify sync across 2+ devices
- [ ] Replace `images/scene-thumbnail.png` with a real screenshot
- [ ] Optional: add licence-cleared `assets/audio/ambient.mp3` + `chime.mp3`, set `AUDIO_ENABLED = true`
- [ ] Push to a **public GitHub repo** (see note below)
- [ ] Record demo video (mobile screen capture)
- [ ] Draft the four written answers (§4.1)
- [ ] **Submit the BUIDL** — target Sep 2
- [ ] Confirm World live Sep 5, spot-check through Sep 11

> **Repo note:** `/home/prieyan/friendZone` is not its own git repository — it currently
> sits inside the repo at `/home/prieyan`. Before submitting, run `git init` in
> `friendZone/` and push it to GitHub as a standalone public repo, or the submission
> fails T&C §7 (no public repository).

> **SDK note:** pinned to **7.26.0**, the latest published on npm. Workshop #3
> recommended 7.27+ for desktop/mobile UI scaling parity, but 7.27 is not released
> yet. Run `npm run upgrade` once it lands.

---


## 12. Sources (all read directly)

| Source | Status |
|---|---|
| [DoraHacks campaign page](https://dorahacks.io/hackathon/friendzone/detail) | ✅ Read — prizes, criteria, requirements, timeline |
| [Terms & Conditions (Notion)](https://confirmed-copper-f3a.notion.site/Friendzone-Buildathon-Terms-Conditions-3b15f96e0b7080ec841ee9575b06c562) | ✅ Read in full — all 18 sections |
| [Forum announcement thread](https://forum.decentraland.org/t/friendzone-buildathon-news-updates-announcements/25353) | ✅ Read — all 11 posts, 4 workshop recaps |
| [Building for Mobile — Overview](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/overview) | ✅ Read — perf target, `isMobile()`, input rules |
| [Mobile Safe Areas](https://docs.decentraland.org/creator/build-for-mobile/develop/safe-area) | ✅ Read — `screenInset` API |
| [Missing Features on Mobile](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features) | ✅ Read — the unsupported list in §7.2 |
| [Preview on Mobile](https://docs.decentraland.org/creator/build-for-mobile/develop/preview-on-mobile) | ✅ Read — QR flow |
| [Eventbrite listing](https://www.eventbrite.com/e/decentraland-friendzone-mobile-buildathon-tickets-1997326657800) | ✅ Read |

**Workshop recordings:** [Kickoff AMA](https://www.youtube.com/watch?v=dWd_RGItkw0) · [#1 Creator Hub](https://youtu.be/tK5-fyBVnK0) · [#2 Building for Mobile](https://www.youtube.com/watch?v=FBr2gye3qh8) · [#3 Mobile UX & Controls](https://youtu.be/5OmTTzpPdDc) · [#4 Performance & VFX](https://youtu.be/tc1PwYKW1Kc)
**Support:** [Friendzone Discord channel](https://discord.com/channels/417796904760639509/1537803999435038801)
**Assets:** OpenDCL catalog (8,800+ free GLB/glTF), Genesis Plaza assets, Decentraland Tools for Blender

**Still unverified:** the exact deadline timezone. No criteria weights are published anywhere — this is confirmed absent, not merely unfound.
