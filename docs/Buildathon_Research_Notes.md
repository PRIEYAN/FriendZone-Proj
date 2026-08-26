# Friendzone Buildathon — Research Notes

Source-by-source record of what each resource actually said. Captured **2026-08-24**.
This is the raw reference; [Buildathon_Requirements.md](Buildathon_Requirements.md) is the distilled brief built from it.

---

# SOURCE 1 — DoraHacks Campaign Page

`https://dorahacks.io/hackathon/friendzone/detail`
*Behind an AWS WAF captcha; loaded on retry with a browser user-agent.*

### Page metadata
- Prize Pool: **8,000 USD**
- Counter: **"10 days left for submission"** (as of Aug 24)
- **Hackers: 130**
- Status: Virtual
- Tags: Ethereum, Open Source, Metaverse, Decentraland, Mobile, Gaming, Platform technology, **Godot**, **TypeScript**, **Blender**, **Unity**
- Submission Requirements field: **"GitHub/Gitlab/Bitbucket Link Required"**
- Organizer message: "Decentraland Regenesis Labs"

### Event timeline (as displayed)
```
Pre-registration   2026/08/06 20:00
Submission         2026/08/14 20:00
Deadline           2026/09/04 00:00
```
Note the deadline is **00:00 on Sep 4** = end of Sep 3. Timezone not displayed on the page.

### Introduction (verbatim)
> "Turn your Decentraland World into the Friendzone no one wants to leave!"
> "Build a social hangout, multiplayer activity, cooperative challenge or competitive game that feels intentionally designed for mobile users from the start and gives people a reason to connect, stay longer, invite friends and return regularly."
> "Teams are allowed. All projects must be open source."

### Prizes and Recognition
```
🥇 1st Place: $3,000 in MANA
🥈 2nd Place: $2,000 in MANA
🥉 3rd Place: $1,500 in MANA
🏆 4th Place: $1,000 in MANA
🏆 5th Place:   $500 in MANA
```
- **Merch:** first 50 eligible participants with a valid submission → $30 Decentraland Merch Shop voucher
- **Badge:** every participant with an eligible submission → exclusive Friendzone badge for their Decentraland profile
- **DCL Mobile Discover:** top 10 projects may receive special featuring, "subject to technical compatibility, continued accessibility and content requirements"

### Timeline (as written)
- August 14, 2026 — Friendzone Kickoff and Build Phase Begins
- August 14 – September 4, 2026 — Three-Week Build Phase
- September 4, 2026 — Submission Deadline
- September 5–11, 2026 — Judging
- September 13, 2026 — Winner Reveal and Closing Event

### Workshops and Support — topics covered
Creator Hub workflows · Mobile building and testing · UX, touch controls and performance · Concept feedback and troubleshooting · Deployment, GitHub and submission support. Recordings shared after each session; help via the dedicated Friendzone channel in the Decentraland Discord.

### Submission Requirements (verbatim list)
Each project must:
- Be a scene **deployed in a Decentraland World** and remain publicly accessible throughout judging
- Create **meaningful social interaction** through environments, gameplay, activities or social systems
- Work as a **persistent standalone experience** without requiring a scheduled event, host, performer or moderator
- Be designed and tested for **mobile devices, touch controls and small screens**
- Be **open source** and published in a **public GitHub repository**
- Be submitted through DoraHacks before the deadline
- Be **original and not used in past Decentraland competitions**
- Comply with the Friendzone Buildathon Terms & Conditions and Decentraland's Terms of Use

> "Empty venues and single-player experiences without a meaningful social component are not eligible. Projects may include interactive hangouts, multiplayer activities, cooperative or competitive games, party games, group challenges or completely new social concepts."

### How Judging Works — the 7 criteria, verbatim
1. **Mobile-First Experience:** "Does the project feel intentionally designed for mobile rather than adapted from a desktop experience?"
2. **Social Value:** "Does it encourage interaction, cooperation, competition, communication or shared participation?"
3. **Mobile UX and Accessibility:** "Are controls, interfaces, text, onboarding and interactions suitable for touch devices and small screens?"
4. **Performance and Optimization:** "Does the experience load and run smoothly within mobile limitations?"
5. **Creativity and Originality:** "Is the concept fresh, imaginative, memorable or surprising?"
6. **Retention and Discovery Value:** "Does the project give users a reason to return, share the experience or invite friends?"
7. **Overall Execution:** "Is the project complete, stable, coherent and ready to be featured for users?"

> "Judging focuses on how well the project works as a mobile-first social experience, not only on technical complexity. **A simple, polished and enjoyable mobile experience may score higher than a technically complex project that is difficult to understand, performs poorly or lacks meaningful social interaction.** Every eligible project is tested directly in the Decentraland Mobile App."

**No weights or percentages appear anywhere on the page.**

### Continue Beyond the Buildathon
Promising submissions may be selected for further incubation via:
- **DCL Regenesis Labs Grants Program — Season 2**
- **Decentraland Foundation Creator Success Program**

"Selected teams may receive guidance, visibility and opportunities to continue improving, expanding and preparing their experiences for a wider audience." Not guaranteed; depends on quality, potential, program requirements and capacity.

### Developer Resources listed on the page
Creator Hub · Creator Hub AI Skills · DCL Apps (Android/iOS/Windows/Mac) · Quickstart · Basic UI · Player Interaction · **Multiplayer Server** · Building for Mobile · Mobile Preview · **Sample Mobile Scenes** · Mobile UI · Optimize Mobile Performance · Customize Mobile Controls · Publish Your Scene

**Assets:**
- **OpenDCL Asset Catalog** — 8,800+ free open-source GLB/glTF props, environments, structures (added by Regenesis Labs)
- **Genesis Plaza assets** — reusable models, textures, landscaping; `.blend` file available; Stom's Genesis Plaza Asset Repository
- Procedural landscaping assets
- **Decentraland Tools for Blender** — add-on with parcel grids, wearable limits, texture optimization, LOD generation, GLB export with DCL settings
- **Blender MCP Server** — connect an AI agent (Claude Code named explicitly) to Blender to create/edit GLTF/GLB models, materials and textures via text prompts

---

# SOURCE 2 — Official Terms & Conditions

Notion page linked from the forum. *JS-rendered; retrieved via Notion's `loadPageChunk` API across two chunks.*

**Effective Date:** August 3, 2026
**Organizer:** DCL Regenesis Labs Foundation ("RGL"), a Cayman Islands Foundation Company

### §1 Overview
Free-to-enter building competition for "persistent, mobile-first social experiences for Decentraland." Runs **August 14 – September 13, 2026**. Projects submitted through the official DoraHacks campaign **by September 4, 2026, at the deadline time displayed on the campaign page.**

### §2 Acceptance
Registering, participating, submitting, or accepting a reward = agreement. Also subject to terms of Decentraland, DoraHacks, GitHub and any third-party services used.

### §3 Eligibility
Open to individuals and teams worldwide except where prohibited by law. Participants represent they have legal capacity, are of legal age in their jurisdiction, are permitted to use Decentraland/digital assets/cryptocurrency, are permitted to receive prizes, and that all submitted information is accurate. RGL may request additional verification info.

### §3.1 RGL / Decentraland Foundation participation
Contributors of RGL and the Decentraland Foundation **may participate but are not eligible for prizes**, and may not join a team competing for a prize. Any submission including such a contributor is **non-competitive and ineligible for prizes**. They may still build, submit and engage "for learning, experimentation and fun."

### §4 How to Participate
1. Register through the official Friendzone DoraHacks campaign
2. Build a qualifying experience in Decentraland Worlds
3. Design and test the experience in the Decentraland Mobile App
4. Deploy the experience and keep it publicly accessible
5. Publish the project code in a **public GitHub repository under an open-source license**
6. Submit through DoraHacks before the deadline

### §5 Team Participation
Teams allowed. **Every member must be listed as a contributor/team member in the DoraHacks submission before the deadline.** One project = one entry = **one placement prize**. If a team wins, all members authorize the designated representative to receive the **full** prize. Teams must agree the split themselves, ideally before submission. RGL transfers to the representative's wallet and its obligations are then "fully discharged" — **RGL will not divide prizes or resolve team disputes.**

### §6 Submission Requirements
Each submission must:
- Be deployed in a Decentraland World
- Be a **persistent and independently accessible** experience
- Be designed and tested in the Decentraland Mobile App
- Include meaningful social interaction, gameplay, or shared activities
- **Work without requiring a scheduled host, performer, or moderator**
- Remain publicly accessible and functional **throughout judging**
- Be open source in a public GitHub repository
- Be submitted through the official DoraHacks campaign
- Include a short project description
- **Explain how the experience was designed or optimized for mobile**
- **Explain how it encourages social interaction**
- **Explain why users may return, replay, share, or invite others**

RGL may request reasonable info or access needed to test and verify a submission.

### §7 Ineligible Submissions
- One-time events or temporary activations
- Event series hosted in an otherwise empty or largely unbuilt World
- **Projects that function only during scheduled event times**
- **Projects that depend on a host, performer, or moderator**
- Empty venues, stages, or meeting spaces without meaningful persistent interaction
- **Single-player experiences without a meaningful social component**
- Experiences that cannot be reliably accessed or tested on the Decentraland Mobile App
- Submissions without a public GitHub repository
- Malicious code, plagiarism, unauthorized content, unlawful material
- Violations of Decentraland's Terms of Use or Content Policy
- Late submissions

"RGL determines whether a submission satisfies the eligibility requirements."

### §8 Intellectual Property and Open Source
Participants **retain ownership** of original IP. Participants represent they have necessary rights/licenses for all code, assets, music, trademarks, images, characters. Third-party and pre-existing materials only where their licenses permit. **Source code must be published under a clearly identified open-source license.**

By entering, participants grant RGL a **non-exclusive, worldwide, royalty-free license** to access, test, display, record, reproduce and promote the project for: administering and judging; Friendzone communications and recaps; project and creator spotlights; community showcases; **DCL Mobile Discover**; promoting Decentraland, DCL Mobile and future builder initiatives. "This promotional license does not transfer ownership."

### §9 Judging
All eligible submissions "will be tested on Decentraland Mobile App and reviewed individually by the official jury." Criteria:
- Mobile-First Experience
- Social Value
- Mobile UX and Accessibility
- Performance and Optimization
- Creativity and Originality
- Retention and Discovery Value
- Overall Execution

"Final rankings will be based on the combined jury scores."

**Tiebreak:** where projects receive equal final scores, the jury may consider **Mobile-First Experience, Retention and Discovery Value, and Overall Execution.**

"Judges may not be able to identify every technical issue during testing. A project's acceptance or score does not represent certification that the project is error-free, secure, or suitable for any particular purpose. The jury's and RGL's decisions are final and binding."

### §10 Prizes and Recognition
- **MANA Prizes:** "The total MANA prize pool is $8,000." — *the T&C states no per-place breakdown; that appears only on DoraHacks.*
- **DCL Mobile Discover:** top ten eligible for special placement; subject to technical compatibility, availability, content requirements, continued accessibility. RGL determines timing, duration, format and placement.
- **Friendzone Badge:** every participant associated with an eligible submission; must provide DCL account/wallet info.
- **Merch Vouchers:** first 50 eligible **individual** participants associated with a valid submission; **max one per participant**; team members must be listed before the deadline; subject to store availability, redemption conditions, shipping availability.

### §11 MANA Conversion and Prize Distribution
USD-denominated prizes converted to MANA at **the closing market price of MANA on Sunday, September 13, 2026**, using "a reputable market data source selected by RGL." Winners must provide a valid **Ethereum-compatible wallet address**. RGL aims to distribute **within 30 days** of announcement and receipt of required info.

Participants are responsible for: correct wallet information; maintaining wallet access; wallet/network/conversion/transaction implications; **taxes, reporting obligations and fees** in their jurisdiction. RGL not responsible for prizes sent to an incorrect address supplied by the participant.

### §12 Disqualification
For: false or misleading information; manipulating the submission or judging process; plagiarism or infringement; **artificially inflating engagement or participation data**; malicious or unsafe code; harassment or inappropriate conduct; violating the Terms or platform policies; fraud or bad faith.

"Where reasonably possible, RGL may allow participants to correct minor administrative or technical submission issues. **RGL is not required to accept corrections after the deadline.**"

### §13 Publicity
Project name, team name, usernames, project materials, screenshots, recordings, submitted descriptions and public social profiles may be displayed in connection with the Buildathon. Winners may be invited to interviews, showcases, livestreams, promotional content — "voluntary unless otherwise agreed."

### §14 Technical Issues and Availability
Participants are responsible for creating, testing, deploying and **maintaining** their projects. RGL is **not** responsible for: internet/wallet/blockchain/device/network failures; downtime or errors affecting Decentraland, DoraHacks, GitHub or third parties; failed/incomplete/delayed/corrupted submissions; mobile compatibility issues; loss of source code or project data; changes to external platforms/APIs/software; **"projects becoming unavailable during judging."**

> "Participants should submit early and maintain independent backups of their work."

### §15 Modification, Suspension, or Cancellation
RGL may modify the Terms, adjust the schedule, replace judges, suspend participation, or cancel — for technical issues, security, legal requirements, fraud, force majeure, or fair-administration concerns. Material changes communicated through official Friendzone or DoraHacks channels.

### §16 Limitation of Liability
No liability for indirect, incidental, special, consequential or punitive damages. Participation, third-party platform use, deployment of submitted code and digital-asset interaction are at the participant's own risk.

### §17 Privacy
Info submitted via DoraHacks processed under those platforms' policies too. RGL may process participant info to administer, contact, verify eligibility, judge, distribute prizes and badges, prevent fraud, publish results and showcases, and evaluate the Buildathon. **"Participants should not include confidential, private, or sensitive information in public repositories or public submissions."**

### §18 General
Governed by **the laws of the Cayman Islands**. Severability applies. Non-enforcement is not waiver. **In conflicts between the Terms and promotional materials, the Terms take precedence** — but "dates and submission information displayed on the official DoraHacks campaign may be used to clarify operational details."

> ⚠️ **Note:** there is **no clause anywhere in the T&C restricting AI-assisted development.**

---

# SOURCE 3 — Decentraland Forum Announcement Thread

`forum.decentraland.org/t/friendzone-buildathon-news-updates-announcements/25353`
11 posts, Aug 10–21, mostly by **toxicwaifu** (organizer). *Retrieved via Discourse JSON API.*

### Post 1 — Aug 10 — Launch announcement
Established the theme, rewards, key dates, and that DoraHacks is "the central destination for all Buildathon information, resources and submissions."

### Post 2 — Aug 10 — Update #1: outreach
Organizer goal: "bring new builders into Decentraland." Asked the community for Discord servers, builder groups and X Spaces to promote in.

### Post 3 — Aug 12 — community reply (OnSr)
> "Finally a game jam/hackathon focused on multiplayer. I will try to create an experience which will be fun if played with more people."

### Post 4 — Aug 12 — community reply (MakeAnft)

### Post 5 — Aug 13 — Update #2: schedule live
AMA + Kickoff Friday Aug 14, 5PM UTC, Discord + In-World. Full workshop list published.

### Post 6 — Aug 15 — Update #3: kickoff recap ⭐
Key takeaways stated by organizers:
- **"Think mobile-first from the start"** — touch controls, small screens, performance and accessibility matter
- **"Make it social"** — projects should encourage interaction, cooperation, competition or shared participation
- **"Keep it persistent"** — "Submissions need to work as standalone experiences without a scheduled host or event during the whole judging period"
- **"Small and polished can beat big and complicated"**
- $8,000 MANA pool + merch + badges + potential featuring
- Seven judging criteria
- Support via workshops, Show & Tell, troubleshooting, and the Friendzone Buildathon Chat on Decentraland Discord

### Post 7 — Aug 16 — Workshop #1 recap: Creator Hub (with Nico E) ⭐
- **Getting started:** you mainly need Creator Hub, a code editor or AI tool, **a Decentraland NAME for publishing**, and a GitHub account
- Creator Hub supports: start from template, new scene, import existing project, or combine drag-and-drop with code
- **Preview directly on mobile** — desktop, web and mobile previews that update as you make changes
- **Measure while you build** — console, triangle and texture counters, asset bundle validation, FPS metrics
- **MCP Server** lets AI tools move through scenes, click objects, take screenshots and inspect performance
- **"Install the SDK Skills before vibe coding"** — gives AI tools Decentraland-specific context and helps avoid invalid code or parameters
- **"Build in small steps"** — create one feature, test it, improve it, continue, "instead of asking AI to build an entire game at once"
- Creator Hub now includes **analytics** for visitors, session length and retention

**Nico's top three tips for mobile-friendly scenes:**
1. **Keep it simple** — fewer mechanics, less happening on screen at once
2. **Design for short sessions** — "the first 30 seconds should give players a reason to stay"
3. **Respect the screen** — readable text, large touch targets, mobile-friendly UI instead of relying on precise 3D clicking

### Post 8 — Aug 17 — Update #5: Beyond The NFT appearance

### Post 9 — Aug 19 — Workshop #2 recap: Building for Mobile (Kuruk, Eibriel) ⭐
- **Design for two thumbs** — mouse and keyboard replaced by touch; interactions must stay simple and accessible
- **Screen space matters** — mobile UI competes with controls, notches and the player's thumbs; keep important elements in safe areas
- **Think in shorter sessions** — "social hangouts, casual minigames and short-round experiences are generally a better fit than complex or input-heavy concepts"
- **Scope small, polish hard** — "a focused experience that works well on mobile can be stronger than a large project that struggles with usability or performance"
- **Test on real hardware** — Creator Hub and CLI open the scene on your phone via QR with hot reload
- **Keep performance in mind** — tighter hardware and loading constraints

**Homework set:** run your project through Mobile Preview and share your top three issues in the Friendzone Discord.

### Post 10 — Aug 19 — Workshop #3 recap: Mobile UX & Controls (Lean, Didot, Eibriel, Seba) ⭐
- **Design around the usable screen** — covers Full Canvas, Screen Inset Area and Interactable Area, and when each applies
- **Build for thumbs, not cursors** — frequent actions in comfortable thumb zones; touch targets larger than desktop buttons
- **Controls are customizable** via `ScreenControlsComponent`:
  - Hide/show joystick, crosshair and individual action buttons
  - Replace button icons
  - Change what the main action button does
  - Create custom controls linked to scene actions
  - **Update controls dynamically while the scene is running**
- Also: **Input Modifier** to disable specific actions; **Avatar Locomotion Settings** to adjust movement speed
- **Camera design can simplify the whole experience:** Default (social spaces/hangouts) · Fixed (mini-games) · Orbital (galleries/shops) · Cinematic (intros/narrative). Camera changes can be made directly in Creator Hub.
- **Prepare UI assets for real devices** — export textures at **~2x resolution** for device pixel ratios; **preload UI images in a hidden UI element at scene start** to avoid a white flash
- **The first few seconds matter** — "think about what the player sees around second 3. A blank screen can easily feel broken rather than simply loading."

**Q&A highlights:**
- Mobile UI editing inside Creator Hub **not available yet** (in progress)
- **Portrait mode is not currently supported**
- **Explorer chat cannot currently be hidden through scene code**
- UI scaling differences between desktop and mobile → **update to SDK 7.27+**

### Post 11 — Aug 21 — Workshop #4 recap: Performance, Optimization & VFX (Manu, Kuruk) ⭐⭐
Walked an unoptimized **36-room dungeon** through optimization. **Everything tested on a real Motorola Edge 60 Pro, not an emulator.**

**Mobile performance has different limits:** phones share memory between CPU and GPU; unstable connections are common; **transparency is expensive**; **performance drops further as the device heats up.**

**Reduce assets and duplication:** first pass removed **136 duplicate materials and mesh copies** and compressed textures to a max of **1024×1024** — significantly reduced memory, geometry and texture counts.

**Simplify geometry and code:** the dungeon used ~**2,500 meshes** for walls/floors/ceilings; merging geometry per room dropped it to ~**70 meshes**. Also: removed unnecessary allocations inside loops; added **frame skipping** for systems that don't need per-frame updates; rendered only the current and nearby rooms.

**How you load matters:** optimized version loads only the **nine-room area around the player**; old sections unload and new ones stream in.

**Keep collisions simple:** complex mesh colliders "can destroy performance" — one tree with individual leaf colliders was enough to heavily impact the scene. Use simple **Box Primitives**; remove collision from decorative objects; keep visual and collision meshes separate.

**VFX need a budget:** lights, particles and transparency all cost. Use **material emission instead of extra lights** where possible; keep particle counts controlled; use animated particles for stronger effects with fewer particles; "only add effects when they actually improve the experience."

**Results after optimization on the test device:**
- **70%+ fewer triangles**
- **90%+ fewer entities**
- **FPS improved by more than 2x**

> "A strong reminder that performance often comes from architecture and loading strategy, not just prettier or smaller assets."

**Kuruk's three rules to remember:**
1. **Measure on a real device before trusting anything**
2. **Mobile budgets are limits, not suggestions**
3. **How you load your scene can matter more than how polished individual assets are**

**Homework set:** open your scene on mobile, check the **Stats Panel**, set the performance profile to **High** to see real rendering cost.

---

# SOURCE 4 — Decentraland Creator Docs

### 4a. Building for Mobile — Overview
`docs.decentraland.org/creator/build-for-mobile/mobile-client/overview`

- Available on iOS and Android; several desktop features unsupported (see Missing Features)
- **UI:** "All critical UI elements stay inside the mobile safe area"; sized appropriately for touch; account for notch/home indicator via the `screenInset` property
- **Input:** avoid binding essential actions to **`IA_ACTION_3`–`IA_ACTION_6`** (number keys 1–4) — not easily accessible via touch
- **Performance target:** scenes must maintain **"above 90% on the High Graphics Profile on a mid-range phone"**
- Use **`isMobile()`** for platform-specific logic and UI branches
- Preview on phones via Creator Hub or CLI before publishing
- Scenes can be featured in the mobile **Discover** section by meeting submission requirements; **iOS content undergoes additional curation review**

### 4b. Mobile Safe Areas
`docs.decentraland.org/creator/build-for-mobile/develop/safe-area`

Three `screenInset` modes:
```ts
// 1. Device Safe Area (default) — avoids notches, status bars, rounded corners
ReactEcsRenderer.setUiRenderer(uiComponent, { screenInset: 'device' })

// 2. Interactable Area (RECOMMENDED) — also clear of client controls
//    (joystick, chat, profile, camera). Requires mobile client 1.12.1+
ReactEcsRenderer.setUiRenderer(uiComponent, { screenInset: 'interactable' })

// 3. Full Canvas — you manage all margins manually
ReactEcsRenderer.setUiRenderer(uiComponent, { screenInset: 'none' })
```

Component-level, for partial protection without changing the renderer setting:
```tsx
import { ScreenInsetArea, InteractableArea } from '@dcl/sdk/react-ecs'

<ScreenInsetArea>
  <UiEntity uiTransform={{ width: '100%', height: '100%' }} />
</ScreenInsetArea>
```
These adapt to runtime changes (rotation, system bar visibility).

**Recommended UI zones:** center = interactive dialogs needing a response · top-center = notifications and status · center-bottom = context hints above action buttons · **avoid bottom-right** (competes with action buttons).

**Caveats:**
- `'interactable'` reserves **~25% of the desktop screen's left side** — branch with `isMobile()` if you want mobile-only spacing
- **Never hardcode inset values** — read at runtime; they vary by device and client version
- **Don't double-inset** — don't combine `screenInset: 'interactable'` with an `InteractableArea` wrapper
- "Always verify on a real device"

### 4c. Missing Features on Mobile ⚠️
`docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features`

**Not implemented / non-functional on mobile:**
- **Particle System** — not yet implemented
- **`PBPrimaryPointerInfo` (`worldRayDirection`)** — pointer data not populated
- **AssetLoad Component** — resource pre-loading unavailable
- **Scene Dynamic Lights** — `PBPointLight` protocol exists but **is not functional**
- **UI Background Nine-Slice Tiles** — only stretching supported
- **Audio Event Component** — not implemented
- **Audio Analysis Component** — not implemented
- Password Protected Worlds Modal — pre-load access unavailable
- Smart Items — support status unconfirmed

**Desktop-only features:**
- **Proximity Voice Chat**
- Community features, photo galleries, profile badges, daily quests, marketplace credits, chat reactions and auto-translation

**Cross-platform inconsistencies:** avatar rendering differences, collider shape inconsistencies, "UI/TextShape elements positioned at different heights on mobile vs Unity."

**Input limitations:** touch-only — no mouse hover states, no keyboard shortcuts, no right-click. **Gesture controls are not currently planned.**

### 4d. Preview on Mobile
`docs.decentraland.org/creator/build-for-mobile/develop/preview-on-mobile`

**Network:** phone and dev machine must be on the same Wi-Fi — "the preview is served from your computer; the QR code links to a LAN URL."

**Creator Hub:** open scene → dropdown next to Preview → "Show QR Code for Mobile" → scan with phone camera → opens in the mobile app.

**CLI:**
```bash
npm run start -- --mobile
```
Generates a QR in the terminal pointing at the local network URL.

> "When you pass `--mobile`, the desktop explorer is not also launched." Run two terminals to test both simultaneously.

**Hot reload:** mobile previews refresh automatically on file changes; no rescanning needed.

**Troubleshooting:** ensure the DCL app is installed and opened at least once; verify identical Wi-Fi (corporate networks may block); visual differences from desktop are expected — use them to validate safe areas, UI sizing and input bindings.

---

# SOURCE 5 — Eventbrite Listing

`eventbrite.com/e/decentraland-friendzone-mobile-buildathon-tickets-1997326657800`

- Dates: August 15 – September 4; listed time **4 AM–8 AM PDT / 11 AM–3 PM UTC**; online event; organizer listed as DoraHacks
- Confirms: teams allowed, "All projects must be open source," open to experienced and first-time builders
- No prize, judging or submission detail beyond a pointer to the DoraHacks campaign

---

# Links Collected

**Official**
- Campaign: https://dorahacks.io/hackathon/friendzone/detail
- Judging section anchor: https://dorahacks.io/hackathon/friendzone/detail#how-judging-works
- T&C: https://confirmed-copper-f3a.notion.site/Friendzone-Buildathon-Terms-Conditions-3b15f96e0b7080ec841ee9575b06c562
- Forum thread: https://forum.decentraland.org/t/friendzone-buildathon-news-updates-announcements/25353
- Friendzone Discord channel: https://discord.com/channels/417796904760639509/1537803999435038801
- Decentraland Discord: https://discord.gg/decentraland

**Workshop recordings**
- Kickoff AMA: https://www.youtube.com/watch?v=dWd_RGItkw0
- #1 Creator Hub: https://youtu.be/tK5-fyBVnK0
- #2 Building for Mobile: https://www.youtube.com/watch?v=FBr2gye3qh8
- #3 Mobile UX & Controls: https://youtu.be/5OmTTzpPdDc
- #4 Performance, Optimization & VFX: https://youtu.be/tc1PwYKW1Kc

**Docs**
- Mobile overview: https://docs.decentraland.org/creator/build-for-mobile/mobile-client/overview
- Missing features: https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features
- Safe areas: https://docs.decentraland.org/creator/build-for-mobile/develop/safe-area
- Preview on mobile: https://docs.decentraland.org/creator/build-for-mobile/develop/preview-on-mobile
- SDK 101: https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101
- Useful resources: https://docs.decentraland.org/creator/scenes-sdk7/getting-started/useful-resources

**Tooling**
- Creator Hub: https://decentraland.org/create/
- Buy a Decentraland NAME: https://decentraland.org/marketplace/names/claim

---

## Retrieval notes

- The DoraHacks page sits behind an **AWS WAF captcha**; a plain request returns a "Human Verification" challenge page. It loaded on a retry with a browser user-agent.
- The T&C Notion page is **client-rendered** — fetching the HTML returns only the word "Notion." Content was retrieved through Notion's internal `loadPageChunk` API (`POST /api/v3/loadPageChunk`) with the dashed page id, across two chunks; the prize section sits at the chunk boundary.
- The forum thread was read via Discourse's `.json` endpoint, which returns all 11 posts in full rather than a rendered summary.
- Two doc paths guessed from the workshop recap (`develop/screen-controls`, `mobile-client/performance`) **404** — `ScreenControlsComponent` details in these notes come from the Workshop #3 recap text, not from a docs page I read.
