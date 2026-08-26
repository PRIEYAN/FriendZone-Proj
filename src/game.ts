/**
 * Game orchestration: taps in, board state out.
 *
 * Selection is deliberately local. Which star *you* have picked up is your own
 * business; only the completed line is shared. That keeps the synced surface to
 * a single component and means two players can be mid-selection at once without
 * fighting over a shared cursor.
 */
import { engine, AudioSource } from '@dcl/sdk/ecs'
import {
  AUDIO_ENABLED,
  CHIME_AUDIO,
  HINT_IDLE_SECONDS,
  REVEAL_SECONDS
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
  setStarVisual,
  updateStarPulse
} from './stars'
import { createLines, invalidateLines, renderLines } from './lines'
import { clearHint, currentHint, forceHint, noteActivity, updateHint } from './hints'
import { createFigures, figureTitle, hideFigure, showFigure, updateFigureFade } from './figures'
import { updateBearing } from './wayfinding'

let selected: number | null = null
let lastConstellationIndex = -1
let lastSolved = false
let revealTimer = 0
let chimeEntity = engine.addEntity()

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
  }

  if (selected === null) {
    selected = index
    setStarVisual(index, 'selected')
    showToast(`${currentConstellation().stars[index].name} selected`)
    return
  }

  if (selected === index) {
    // Tapping the same star again cancels the selection. On a touch screen this
    // is the only way out of a mis-tap, so it must always work.
    setStarVisual(index, 'idle')
    selected = null
    showToast('Selection cleared')
    return
  }

  const from = selected
  selected = null
  setStarVisual(from, 'idle')

  const bit = pairIndex(from, index)
  if (bit < 0) return

  const wasDrawn = (state.drawnMask & (1 << bit)) !== 0
  togglePair(bit)
  showToast(wasDrawn ? 'Line erased' : 'Line drawn')
}

/** Called by the HUD's hint button. */
export function requestHint(): void {
  const state = readState()
  if (!state || state.solved) return
  const target = correctMask(currentConstellation())
  const star = forceHint(state.drawnMask, target)
  if (star !== null) {
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
    lastConstellationIndex = state.constellationIndex
    selected = null
    clearHint()
    clearStarPulse()
    hideFigure()
    runActive = false
    runMillis = 0
    beatRecord = false
    applyConstellation(constellation)
    invalidateLines()
    refreshStarVisuals()
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
  lastRunMillis = Math.round(runMillis)
  runActive = false
  beatRecord = recordSolveTime(lastRunMillis, currentConstellation().name)
  selected = null
  clearHint()
  clearStarPulse()
  refreshStarVisuals()

  // The lines flare first (handled by renderLines seeing solved=true), then the
  // outline blooms behind them. Staging it reads as an event rather than a flash.
  showFigure(currentConstellation())

  if (AUDIO_ENABLED) {
    AudioSource.createOrReplace(chimeEntity, {
      audioClipUrl: CHIME_AUDIO,
      playing: true,
      loop: false,
      volume: 0.7
    })
  }
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

/**
 * Called by the HUD's "Next sky" button. The concept doc wants the board to
 * advance "either automatically or via a 'Next' prompt" -- the auto-advance
 * stays as a fallback so a lone player is never stranded on the reveal.
 */
export function skipToNext(): void {
  const state = readState()
  if (state?.solved) advanceConstellation()
}
