# Build Contract — v2 "Full Game" pass

Every module below owns a fixed set of files. **No module may edit a file it does
not own.** Integration files (`config.ts`, `game.ts`, `index.ts`, `state.ts`) are
owned by the integrator only.

## Hard platform rules (mobile client)
- **No `PBPointLight`.** All glow is `emissiveColor` + `emissiveIntensity` on PBR materials.
- **No particle systems.** Every effect is pooled geometry (planes / boxes / cylinders).
- **No `AssetLoad`**, no Audio Event / Audio Analysis components.
- Nothing bound to `IA_ACTION_3`–`IA_ACTION_6`. Taps use `InputAction.IA_POINTER`.
- Nothing in the bottom-right of the HUD.
- Textures ≤ 1024².
- **Entity budget: 500 total, flat for the session.** Pool everything at startup;
  never `engine.addEntity()` after `main()` has run.
- Per-frame systems must frame-skip or early-out. Never allocate inside a hot loop
  when it can be avoided.

## Shared numeric constraint
`MAX_STARS` is derived from the largest constellation. It **must stay ≤ 8**, because
the synced `drawnMask` is a single `Schemas.Int` (32-bit) indexed by unordered star
pair: 8 stars → 28 pairs → bits 0..27. A 9-star constellation would overflow it.

## Module ownership

| Module | Owns | Public API |
|---|---|---|
| M1 Sky Atlas | `src/constellations.ts`, `src/figures.ts` | existing exports, unchanged shape |
| M2 VFX | `src/vfx.ts` (new) | see below |
| M3 Audio | `src/audio.ts` (new), `tools/generate_assets.py`, `assets/audio/*` | see below |
| M4 Motion | `src/lines.ts`, `src/stars.ts` | existing exports + `updateLines(dt)`, `popInStars()` |
| M5 Scoring | `src/scoring.ts` (new) | see below |
| M6 HUD | `src/ui.tsx` | `ui()` |
| M7 Scenery | `src/scenery.ts` (new) | see below |

### M2 `src/vfx.ts`
```ts
export function initVfx(): void
export function updateVfx(dt: number): void
export function spawnRipple(position: Vector3, color: Color3): void
export function spawnTravelSpark(a: Vector3, b: Vector3, color: Color3): void
export function spawnShockwave(center: Vector3, color: Color3): void
export function spawnBurst(position: Vector3, color: Color3): void
export function setMeteorRate(perMinute: number): void
export function vfxEntityCount(): number
```

### M3 `src/audio.ts`
```ts
export type SfxName =
  | 'select' | 'deselect' | 'draw' | 'erase' | 'wrong'
  | 'hint' | 'streak' | 'solve' | 'advance' | 'ui'
export function initAudio(): void
export function playSfx(name: SfxName, opts?: { volume?: number; pitchStep?: number }): void
export function startAmbience(): void
export function setAmbienceIntensity(v: number): void
export function audioEntityCount(): number
```

### M5 `src/scoring.ts`
```ts
export type BoardResult = {
  score: number; stars: 1 | 2 | 3; perfect: boolean
  maxStreak: number; accuracy: number; bonuses: string[]; elapsedMs: number
}
export function beginBoard(name: string, totalEdges: number): void
export function noteCorrectEdge(): number   // returns the new streak
export function noteWrongEdge(): void
export function noteErase(): void
export function noteHintUsed(): void
export function finishBoard(elapsedMs: number): BoardResult
export function currentStreak(): number
export function currentScore(): number
export function totalScore(): number
export function rank(): { name: string; level: number; progress: number }
export function lastResult(): BoardResult | null
export function boardHistory(): { name: string; stars: number; ms: number }[]
export function hintsUsed(): number
export function resetRun(): void
```

### M7 `src/scenery.ts`
```ts
export function createScenery(): void
export function updateScenery(dt: number): void
export function sceneryEntityCount(): number
```

## Verification every module must pass before reporting done
```bash
npx tsc --noEmit -p tsconfig.json
```
**Do not run `npm run build`** — it writes `bin/index.js`, which other modules may
be building concurrently.
