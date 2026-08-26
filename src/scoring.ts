/**
 * Scoring & progression: turns a raw solve time into a game.
 *
 * This module is deliberately plain TypeScript with zero engine dependencies
 * (no `@dcl/sdk`, no ECS). Two reasons:
 *   1. It has to be unit-testable in plain Node, which the project's test
 *      harness relies on for a module this fiddly with arithmetic.
 *   2. Scoring rules should not need a running scene to reason about --
 *      keeping it pure means anyone can load this file and play the numbers
 *      by hand.
 *
 * The caller (game.ts, owned by the integrator) is responsible for wiring
 * `noteCorrectEdge` / `noteWrongEdge` / `noteErase` to `togglePair`'s outcome
 * and for calling `finishBoard` once a board's `solved` flag flips true.
 *
 * Every exported function is defensive: calling accessors before
 * `beginBoard()`, or calling `finishBoard()` more than once for the same
 * board, must never throw, never return NaN/undefined, and must never
 * corrupt `totalScore()`.
 */

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Points awarded for a single correct edge before any streak multiplier. */
const BASE_EDGE_SCORE = 100

/**
 * Streak multiplier ladder. `noteCorrectEdge()` looks up the highest step
 * whose `at` is <= the *new* streak length, so the boost applies to the edge
 * that just extended the streak, not the one after it -- the player feels
 * the payoff the instant they hit the milestone.
 *
 * Steps climb and then cap (2x): an uncapped multiplier would make one very
 * long board dominate `totalScore()` forever, which would make the rank
 * ladder meaningless for anyone who hasn't found that one board yet.
 */
const STREAK_STEPS: ReadonlyArray<{ at: number; mult: number }> = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.25 },
  { at: 5, mult: 1.5 },
  { at: 8, mult: 2 }
]

/**
 * A wrong edge costs zero points and does not touch the streak-safe erase
 * path -- it just resets the streak to 0. This is intentional, not an
 * oversight: the concept doc is explicit that this puzzle has no fail state
 * and mistakes must be free to make and free to fix. Punishing a wrong guess
 * with a point deduction would contradict that. Instead the "punishment" is
 * purely opportunity cost -- a reset streak means the *next* correct edges
 * score at a lower multiplier, so carelessness lowers your ceiling without
 * ever taking points away you've already earned.
 */

/**
 * Par-time model. The public API only gives `finishBoard` an elapsed time
 * and gave `beginBoard` a name + edge count -- no explicit difficulty number
 * flows in (that field lives on `ConstellationDef`, which is owned by M1 and
 * deliberately not imported here to keep this module dependency-free and
 * order-independent of that module's edits). Edge count is used as the
 * difficulty proxy instead, and it's a reasonable one: a board with more
 * edges also has more stars, which means a larger field of *wrong* candidate
 * pairs to sort through before finding each correct one. That search space
 * grows faster than the edge count itself, so par time is not simply
 * `edges * flat`; larger boards get an extra per-edge premium via
 * `PAR_TIER_FACTOR`.
 */
const PAR_BASE_MS = 4000 // fixed time to read the board and make the first tap
const PAR_PER_EDGE_MS = 5000 // baseline seconds-per-edge budget on an easy board

/**
 * Step-wise premium applied to the per-edge budget as the board gets bigger.
 * Boundaries are in edge count. This stands in for the 1/2/3 difficulty
 * rating mentioned in the design doc without requiring this module to know
 * that type exists.
 */
const PAR_TIERS: ReadonlyArray<{ minEdges: number; factor: number }> = [
  { minEdges: 0, factor: 1.0 },
  { minEdges: 5, factor: 1.2 },
  { minEdges: 8, factor: 1.45 }
]

/**
 * Time bonus: up to this many points per edge, scaled by how far under par
 * the solve came in. Finishing exactly at par earns a quarter of the max
 * (par is "fine", not "impressive"); finishing in half of par time or less
 * earns the full bonus. Slower than par tapers smoothly to zero rather than
 * cutting off, so there's no cliff that makes a near-miss feel unfair.
 */
const TIME_BONUS_MAX_PER_EDGE = 40

/**
 * Flat-ish bonuses, both scaled a little by board size so a big constellation's
 * perfect clear isn't worth the same as a three-star triangle's. Both can
 * stack (a perfect board with zero hints gets both), but the bonus *label*
 * list collapses them into a single 'Perfect trace' entry so the HUD doesn't
 * show two lines that are really the same achievement.
 */
const PERFECT_BONUS_BASE = 100
const PERFECT_BONUS_PER_EDGE = 15
const NO_HINT_BONUS_BASE = 40
const NO_HINT_BONUS_PER_EDGE = 5

/** A solve at or under this fraction of par earns the 'Swift' bonus label. */
const SWIFT_PAR_FRACTION = 0.7

/** Minimum streak length worth calling out as a bonus label on the board result. */
const STREAK_LABEL_MIN = 3

/**
 * Star thresholds, expressed as a fraction of a *theoretical* max score for
 * that board (see `maxPossibleScore`). Fractions rather than flat numbers is
 * what lets the same two constants work for a 3-edge triangle and an 8-edge
 * Scorpius -- both get scored against their own ceiling.
 *
 * This is a no-fail game: finishing a board at all is always worth at least
 * one star, no matter how low the ratio comes in (a very slow, sloppy,
 * hint-heavy clear still solved the puzzle). 2 and 3 stars are graded on
 * elegance, not survival.
 */
const STAR_3_RATIO = 0.72
const STAR_2_RATIO = 0.4

/**
 * Rank ladder. Thresholds are cumulative totalScore. Astronomer-themed names,
 * climbing from "just started looking up" to "drew the whole sky". Roughly
 * tuned so a careful player crosses one rank every couple of boards early on
 * and the run of 10 constellations can plausibly reach the middle ranks.
 */
const RANKS: ReadonlyArray<{ name: string; threshold: number }> = [
  { name: 'Stargazer', threshold: 0 },
  { name: 'Skywatcher', threshold: 600 },
  { name: 'Navigator', threshold: 1600 },
  { name: 'Cartographer', threshold: 3200 },
  { name: 'Astronomer', threshold: 5800 },
  { name: 'Celestial Cartographer', threshold: 9500 }
]

// ---------------------------------------------------------------------------
// Mutable module state
// ---------------------------------------------------------------------------

/** Name of the board currently in progress (or last begun). Empty until the first `beginBoard`. */
let boardName = ''
/** Total correct edges the current constellation needs, i.e. its edge count. */
let totalEdges = 0

let correctCount = 0
let wrongCount = 0
let eraseCount = 0
let hintCount = 0

let streak = 0
let maxStreak = 0

/** Running score for the board in progress, built up edge by edge as it's drawn. */
let liveScore = 0

/**
 * Guards against double-counting if `finishBoard` is called twice for the
 * same board (e.g. a defensive re-check racing the reveal timer). The first
 * call computes and banks the result; a repeat call before the next
 * `beginBoard()` just replays the cached result untouched.
 */
let boardFinished = false

let runTotal = 0
const history: { name: string; stars: number; ms: number }[] = []
let last: BoardResult | null = null

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardResult = {
  score: number
  stars: 1 | 2 | 3
  perfect: boolean
  maxStreak: number
  accuracy: number // 0..1, correct edges / total lines drawn
  bonuses: string[] // short human-readable labels, e.g. 'Perfect trace', '5x streak'
  elapsedMs: number
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Highest streak-step multiplier unlocked at this streak length. */
function streakMultiplier(atStreak: number): number {
  let mult = STREAK_STEPS[0].mult
  for (const step of STREAK_STEPS) {
    if (atStreak >= step.at) mult = step.mult
  }
  return mult
}

/** Per-edge time premium for a board of this size (see PAR_TIERS comment above). */
function parTierFactor(edges: number): number {
  let factor = PAR_TIERS[0].factor
  for (const tier of PAR_TIERS) {
    if (edges >= tier.minEdges) factor = tier.factor
  }
  return factor
}

/** Par time in ms for a board with this many correct edges. Always > 0. */
function parTimeMs(edges: number): number {
  const safeEdges = Math.max(edges, 1)
  return PAR_BASE_MS + safeEdges * PAR_PER_EDGE_MS * parTierFactor(safeEdges)
}

/**
 * Time bonus for finishing `elapsedMs` against `par`. 0..1 "speed" reaches
 * 1.0 at half of par or faster, 0.25 at exactly par, and tapers to 0 well
 * past par -- see TIME_BONUS_MAX_PER_EDGE for why a quarter, not zero, is the
 * baseline for an on-par finish.
 */
function timeBonusScore(elapsedMs: number, par: number, edges: number): number {
  const safeEdges = Math.max(edges, 0)
  if (safeEdges <= 0) return 0
  const safeElapsed = Math.max(elapsedMs, 1)
  // ratio > 1 means faster than par. Map [0 .. 2x-par-speed] to [0 .. 1] speed,
  // then apply a curve so par itself (ratio 1) lands at 0.25, not 0.5 -- par is
  // "acceptable", not "halfway to a bonus".
  const ratio = clamp(par / safeElapsed, 0, 2)
  const speed = Math.pow(ratio / 2, 1.6)
  return Math.round(TIME_BONUS_MAX_PER_EDGE * safeEdges * speed)
}

/**
 * Best-case edge score for a board of this size: a flawless run where every
 * single line is a correct edge, so the streak climbs 1, 2, 3, ... all the
 * way to `edges` without ever resetting. This is deliberately NOT
 * a flat `edges * BASE_EDGE_SCORE * (streak ladder's cap)` -- a 3-edge board can
 * never sustain the streak ladder's 2x cap (that needs a streak of 8), so
 * grading it against an unreachable ceiling would make small constellations
 * mathematically incapable of ever earning 3 stars. Walking the real streak
 * progression keeps the ceiling reachable for every board size.
 */
function maxEdgeScore(edges: number): number {
  let total = 0
  for (let s = 1; s <= edges; s++) total += BASE_EDGE_SCORE * streakMultiplier(s)
  return total
}

/**
 * Theoretical ceiling for a board of this size: a flawless streak (see
 * `maxEdgeScore`), the maximum possible time bonus, and both the perfect and
 * no-hint bonuses. Scales with board size the same way a real score does, so
 * the star ratio is comparable across constellations of any size.
 */
function maxPossibleScore(edges: number): number {
  const safeEdges = Math.max(edges, 1)
  const maxEdge = maxEdgeScore(safeEdges)
  const maxTimeBonus = TIME_BONUS_MAX_PER_EDGE * safeEdges
  const maxExtra =
    PERFECT_BONUS_BASE +
    PERFECT_BONUS_PER_EDGE * safeEdges +
    NO_HINT_BONUS_BASE +
    NO_HINT_BONUS_PER_EDGE * safeEdges
  return maxEdge + maxTimeBonus + maxExtra
}

function starsFor(score: number, edges: number): 1 | 2 | 3 {
  const max = maxPossibleScore(edges)
  const ratio = max > 0 ? score / max : 1
  if (ratio >= STAR_3_RATIO) return 3
  if (ratio >= STAR_2_RATIO) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Starts tracking a new board. Resets every per-board counter. */
export function beginBoard(name: string, edges: number): void {
  boardName = name
  totalEdges = Math.max(0, Math.floor(edges) || 0)
  correctCount = 0
  wrongCount = 0
  eraseCount = 0
  hintCount = 0
  streak = 0
  maxStreak = 0
  liveScore = 0
  boardFinished = false
}

/**
 * Call when a newly-drawn line is a correct edge. Returns the new streak
 * length so the caller can fire a milestone sound/VFX without this module
 * needing to know anything about audio or visuals.
 */
export function noteCorrectEdge(): number {
  streak += 1
  if (streak > maxStreak) maxStreak = streak
  correctCount += 1
  liveScore += Math.round(BASE_EDGE_SCORE * streakMultiplier(streak))
  return streak
}

/** Call when a newly-drawn line is not a correct edge. Costs no points, resets the streak. */
export function noteWrongEdge(): void {
  wrongCount += 1
  streak = 0
}

/**
 * Call when the player erases an existing line. Deliberately does NOT touch
 * the streak: undoing a mistake is good play, and this is a no-fail game
 * where mistakes must never be punished, including retroactively via a
 * broken streak.
 */
export function noteErase(): void {
  eraseCount += 1
}

/** Call when the hint system reveals a star. Costs no points directly, but forfeits 'perfect'. */
export function noteHintUsed(): void {
  hintCount += 1
}

/**
 * Finalises the board in progress: computes score, star rating and bonus
 * labels, banks the score into the run total, and appends to history.
 *
 * Safe to call more than once for the same board -- only the first call
 * counts; later calls replay the cached result so `totalScore()` never
 * double-counts a board that got finished twice by an overeager caller.
 */
export function finishBoard(elapsedMs: number): BoardResult {
  if (boardFinished && last) return last

  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 0
  const par = parTimeMs(totalEdges)
  const tBonus = timeBonusScore(safeElapsed, par, totalEdges)

  const perfect = wrongCount === 0 && hintCount === 0 && correctCount > 0
  const noHints = hintCount === 0

  let score = liveScore + tBonus
  if (perfect) score += PERFECT_BONUS_BASE + PERFECT_BONUS_PER_EDGE * totalEdges
  if (noHints) score += NO_HINT_BONUS_BASE + NO_HINT_BONUS_PER_EDGE * totalEdges

  const drawn = correctCount + wrongCount
  const accuracy = drawn > 0 ? clamp(correctCount / drawn, 0, 1) : 1

  const stars = starsFor(score, totalEdges)

  const bonuses: string[] = []
  if (perfect) bonuses.push('Perfect trace')
  else if (noHints) bonuses.push('No hints')
  if (safeElapsed <= par * SWIFT_PAR_FRACTION) bonuses.push('Swift')
  if (maxStreak >= STREAK_LABEL_MIN) bonuses.push(`${maxStreak}x streak`)

  const result: BoardResult = {
    score,
    stars,
    perfect,
    maxStreak,
    accuracy,
    bonuses,
    elapsedMs: safeElapsed
  }

  boardFinished = true
  last = result
  runTotal += score
  history.push({ name: boardName, stars, ms: safeElapsed })

  return result
}

/** Current streak length. 0 before any board has started. */
export function currentStreak(): number {
  return streak
}

/** Live score accrued so far on the in-progress board (edge score only, pre-bonuses). */
export function currentScore(): number {
  return liveScore
}

/** Cumulative score banked across every finished board this run. */
export function totalScore(): number {
  return runTotal
}

/**
 * Rank derived from `totalScore()`. `progress` is 0..1 toward the next rank;
 * the top rank always reports progress 1 (there is nothing further to climb
 * toward). Every boundary is guarded so this never divides by zero or reads
 * past the end of the ladder.
 */
export function rank(): { name: string; level: number; progress: number } {
  const score = Math.max(0, runTotal)
  let level = 0
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= RANKS[i].threshold) level = i
  }

  const current = RANKS[level]
  const next = RANKS[level + 1]
  if (!next) {
    return { name: current.name, level, progress: 1 }
  }

  const span = next.threshold - current.threshold
  const progress = span > 0 ? clamp((score - current.threshold) / span, 0, 1) : 1
  return { name: current.name, level, progress }
}

/** The result of the most recently finished board, or null if none has finished yet. */
export function lastResult(): BoardResult | null {
  return last
}

/** Every finished board this run, in solve order. */
export function boardHistory(): { name: string; stars: number; ms: number }[] {
  return history.slice()
}

/** Hints used on the board currently in progress. */
export function hintsUsed(): number {
  return hintCount
}

/** Clears the whole run: score, rank progress and history all go back to zero. */
export function resetRun(): void {
  boardName = ''
  totalEdges = 0
  correctCount = 0
  wrongCount = 0
  eraseCount = 0
  hintCount = 0
  streak = 0
  maxStreak = 0
  liveScore = 0
  boardFinished = false
  runTotal = 0
  history.length = 0
  last = null
}
