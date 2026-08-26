/**
 * Game orchestration: taps in, board state out.
 *
 * Selection is deliberately local. Which star *you* have picked up is your own
 * business; only the completed line is shared. That keeps the synced surface to
 * a single component and means two players can be mid-selection at once without
 * fighting over a shared cursor.
 *
 * This module is also where feel gets assembled. Sound, VFX and scoring are all
 * separate modules with no knowledge of each other; the tap handler and the
 * solve handler are the two places that decide what a moment should look and
 * sound like, so the choreography lives here rather than being smeared across
 * four files.
 */
import { engine } from '@dcl/sdk/ecs'
import { Color3, Vector3 } from '@dcl/sdk/math'
import {
  COLOR,
  HINT_IDLE_SECONDS,
  REVEAL_SECONDS,
  STREAK_MILESTONE,
  REVEAL
} from './config'
import { CONSTELLATIONS, correctMask, pairIndex } from './constellations'
import {
  advanceConstellation,
  currentConstellation,
  readState,
  recordSolveTime,
  togglePair
} from './state'
import {
  applyConstellation,
  clearStarPulse,
  createStars,
  isStarActive,
  popInStars,
  setStarVisual,
  starPosition,
  updateStarPulse
} from './stars'
import { createLines, invalidateLines, renderLines, updateLines } from './lines'
import { clearHint, currentHint, forceHint, noteActivity, updateHint } from './hints'
import { createFigures, figureTitle, hideFigure, showFigure, updateFigureFade } from './figures'
import { updateBearing } from './wayfinding'
import { playSfx, setAmbienceIntensity } from './audio'
import { spawnBurst, spawnRipple, spawnShockwave, spawnTravelSpark, updateVfx } from './vfx'
import {
  BoardResult,
  beginBoard,
  finishBoard,
  noteCorrectEdge,
  noteErase,
  noteHintUsed,
  noteWrongEdge
} from './scoring'

let selected: number | null = null
let lastConstellationIndex = -1
let lastSolved = false
let revealTimer = 0

/** Transient line of feedback shown in the HUD, e.g. "Betelgeuse selected". */
let toast = ''
let toastTimer = 0

/** Run timer. Starts on the first tap of a board, stops on solve. */
let runMillis = 0
let runActive = false
let lastRunMillis = 0
let beatRecord = false

/** Bearing is recomputed a few times a second rather than every frame. */
let bearingClock = 0

/** True until the player's first ever tap, so onboarding can step aside. */
let awaitingFirstTap = true

/** The last completed board's scorecard, for the reveal banner. */
let result: BoardResult | null = null

/**
 * How far through the reveal we are, 0..1. The HUD reads it to stage the
 * banner behind the flare, and the ambience is ducked against it so the chime
 * has room before the drone swells back.
 */
let revealProgress = 0

export function initGame(): void {
  createStars(handleStarTap)
  createLines()
  createFigures()
  engine.addSystem(gameSystem)
}

function handleStarTap(index: number): void {
  const state = readState()
  if (!state || state.solved || !isStarActive(index)) return

  noteActivity()
  awaitingFirstTap = false
  if (!runActive) {
    runActive = true
    runMillis = 0
    beginBoard(currentConstellation().name, currentConstellation().edges.length)
  }

  // A ripple under the thumb on every tap. On a phone the finger covers the
  // star it just hit, so the confirmation has to be bigger than the target.
  spawnRipple(starPosition(index), COLOR.starSelected)

  if (selected === null) {
    selected = index
    setStarVisual(index, 'selected')
    // Pitched by slot, so tracing a shape plays a little rising figure rather
    // than the same blip eight times.
    playSfx('select', { pitchStep: index * 2 - 4 })
    showToast(`${currentConstellation().stars[index].name} selected`)
    return
  }

  if (selected === index) {
    // Tapping the same star again cancels the selection. On a touch screen this
    // is the only way out of a mis-tap, so it must always work.
    setStarVisual(index, 'idle')
    selected = null
    playSfx('deselect')
    showToast('Selection cleared')
    return
  }

  const from = selected
  selected = null
  setStarVisual(from, 'idle')

  const bit = pairIndex(from, index)
  if (bit < 0) return

  const target = correctMask(currentConstellation())
  const isCorrect = (target & (1 << bit)) !== 0
  const wasDrawn = (state.drawnMask & (1 << bit)) !== 0

  togglePair(bit)

  const a = starPosition(from)
  const b = starPosition(index)

  if (wasDrawn) {
    // Erasing is not a mistake and is never treated as one.
    noteErase()
    playSfx('erase')
    spawnTravelSpark(b, a, COLOR.lineWrong)
    showToast('Line erased')
    return
  }

  spawnTravelSpark(a, b, isCorrect ? COLOR.lineCorrect : COLOR.lineWrong)

  if (isCorrect) {
    const streak = noteCorrectEdge()
    spawnBurst(Vector3.lerp(a, b, 0.5), COLOR.lineCorrect)
    if (streak > 0 && streak % STREAK_MILESTONE === 0) {
      // Each milestone lands a step higher, so a long run audibly climbs.
      playSfx('streak', { pitchStep: Math.min(12, (streak / STREAK_MILESTONE) * 2) })
      showToast(`${streak} in a row`)
    } else {
      playSfx('draw', { pitchStep: Math.min(7, streak) })
      showToast('Line drawn')
    }
  } else {
    noteWrongEdge()
    // Deliberately soft. There is no fail state here, so this says "not that
    // one", never "you lost something".
    playSfx('wrong')
    showToast('Not part of this shape — tap again to erase')
  }
}

/** Called by the HUD's hint button. */
export function requestHint(): void {
  const state = readState()
  if (!state || state.solved) return
  const target = correctMask(currentConstellation())
  const star = forceHint(state.drawnMask, target)
  if (star !== null) {
    noteHintUsed()
    playSfx('hint')
    spawnRipple(starPosition(star), COLOR.starHinted)
    refreshStarVisuals()
    showToast('A star is waiting for you')
  }
}

function showToast(text: string): void {
  toast = text
  toastTimer = 2.5
}

export function currentToast(): string {
  return toastTimer > 0 ? toast : ''
}

function gameSystem(dt: number): void {
  const state = readState()
  if (!state) return

  // Effects run regardless of board state -- meteors and motes are the reason
  // the dome never looks frozen, including during the reveal.
  updateVfx(dt)
  updateLines(dt)

  if (toastTimer > 0) toastTimer -= dt
  if (runActive && !state.solved) runMillis += dt * 1000

  // Wayfinding: only useful while unsolved, and cheap enough at 5Hz.
  bearingClock += dt
  if (bearingClock > 0.2) {
    bearingClock = 0
    if (!state.solved) updateBearing(currentConstellation())
  }

  const constellation = CONSTELLATIONS[state.constellationIndex % CONSTELLATIONS.length]
  const target = correctMask(constellation)

  // Board changed under us (either locally or from another player's client).
  if (state.constellationIndex !== lastConstellationIndex) {
    const isFirstBoard = lastConstellationIndex === -1
    lastConstellationIndex = state.constellationIndex
    selected = null
    clearHint()
    clearStarPulse()
    hideFigure()
    runActive = false
    runMillis = 0
    beatRecord = false
    revealProgress = 0
    applyConstellation(constellation)
    invalidateLines()
    refreshStarVisuals()
    // The new sky arrives rather than snapping in: stars scale up in a
    // staggered wave, with a low swell under it.
    popInStars()
    setAmbienceIntensity(1)
    if (!isFirstBoard) playSfx('advance')
  }

  renderLines(state.drawnMask, target, state.solved)

  if (state.solved !== lastSolved) {
    lastSolved = state.solved
    if (state.solved) {
      onSolved()
    } else {
      hideFigure()
      refreshStarVisuals()
    }
  }

  if (state.solved) {
    updateFigureFade(dt)
    revealTimer -= dt
    // Duck the drone under the chime, then bring it back as the figure settles.
    revealProgress = Math.min(1, revealProgress + dt / (REVEAL.flare + REVEAL.figureFade))
    setAmbienceIntensity(0.35 + 0.65 * revealProgress)
    if (revealTimer <= 0) advanceConstellation()
    return
  }

  updateStarPulse(dt)

  if (updateHint(dt, HINT_IDLE_SECONDS, state.drawnMask, target, state.solved)) {
    refreshStarVisuals()
  }
}

function onSolved(): void {
  revealTimer = REVEAL_SECONDS
  revealProgress = 0
  lastRunMillis = Math.round(runMillis)
  runActive = false
  beatRecord = recordSolveTime(lastRunMillis, currentConstellation().name)
  result = finishBoard(lastRunMillis)
  selected = null
  clearHint()
  clearStarPulse()
  refreshStarVisuals()

  // The lines flare first (handled by renderLines seeing solved=true), then the
  // outline blooms behind them. Staging it reads as an event rather than a flash.
  showFigure(currentConstellation())
  spawnShockwave(constellationAnchor(), COLOR.lineSolved)
  setAmbienceIntensity(0.35)
  playSfx('solve')
}

/** The middle of the solved shape, where the shockwave is centred. */
function constellationAnchor(): Vector3.MutableVector3 {
  const c = currentConstellation()
  const sum = Vector3.create(0, 0, 0)
  let n = 0
  for (let i = 0; i < c.stars.length; i++) {
    if (!isStarActive(i)) continue
    const p = starPosition(i)
    sum.x += p.x
    sum.y += p.y
    sum.z += p.z
    n++
  }
  if (n === 0) return Vector3.create(16, 12, 16)
  return Vector3.create(sum.x / n, sum.y / n, sum.z / n)
}

/** Re-applies every star's visual state. Called on change, never per frame. */
function refreshStarVisuals(): void {
  const state = readState()
  if (!state) return
  const hint = currentHint()

  for (let i = 0; i < currentConstellation().stars.length; i++) {
    if (state.solved) setStarVisual(i, 'solved')
    else if (i === selected) setStarVisual(i, 'selected')
    else if (i === hint) setStarVisual(i, 'hinted')
    else setStarVisual(i, 'idle')
  }
}

/** Progress for the HUD: how many of the correct edges are on the board. */
export function progress(): { drawn: number; total: number } {
  const state = readState()
  const constellation = currentConstellation()
  const target = correctMask(constellation)
  if (!state) return { drawn: 0, total: constellation.edges.length }

  let drawn = 0
  for (let i = 0; i < 32; i++) {
    if ((target & (1 << i)) !== 0 && (state.drawnMask & (1 << i)) !== 0) drawn++
  }
  return { drawn, total: constellation.edges.length }
}

/** Lines on the board that are not part of the shape. */
export function strayLineCount(): number {
  const state = readState()
  if (!state) return 0
  const target = correctMask(currentConstellation())
  const stray = state.drawnMask & ~target
  let n = 0
  for (let i = 0; i < 32; i++) if ((stray & (1 << i)) !== 0) n++
  return n
}

export function selectedStarName(): string | null {
  return selected === null ? null : currentConstellation().stars[selected].name
}

/** Elapsed time on the current board, in seconds. */
export function runSeconds(): number {
  return runMillis / 1000
}

/** The time that solved the last board, in seconds. */
export function lastRunSeconds(): number {
  return lastRunMillis / 1000
}

/** Whether the last solve set a new dome record. */
export function didBeatRecord(): boolean {
  return beatRecord
}

/** True before the player's first ever tap. */
export function isAwaitingFirstTap(): boolean {
  return awaitingFirstTap
}

/** The mythic name revealed on solve, e.g. "The Great Bear". */
export function revealedFigureTitle(): string {
  return figureTitle(currentConstellation())
}

/** The last board's scorecard, or null before the first solve. */
export function lastBoardResult(): BoardResult | null {
  return result
}

/** 0..1 through the reveal, for staging the banner behind the flare. */
export function revealFraction(): number {
  return revealProgress
}

/**
 * Called by the HUD's "Next sky" button. The concept doc wants the board to
 * advance "either automatically or via a 'Next' prompt" -- the auto-advance
 * stays as a fallback so a lone player is never stranded on the reveal.
 */
export function skipToNext(): void {
  const state = readState()
  if (state?.solved) advanceConstellation()
}
