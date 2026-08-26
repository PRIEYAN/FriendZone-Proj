/**
 * Shared game state.
 *
 * The whole multiplayer surface of this scene is one synced component on one
 * entity. Every client renders lines from this state, so a line drawn on any
 * device appears on all of them. Keeping the synced surface to a single
 * component is deliberate: it is small enough to reason about, and there is
 * exactly one source of truth to debug when sync misbehaves.
 *
 * Known limitation: syncEntity is last-write-wins. If two players complete
 * their second tap inside the same sync window, one of the two lines can be
 * lost and has to be re-tapped. There is no penalty for this in the puzzle.
 */
import { engine, Schemas } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { CONSTELLATIONS, correctMask } from './constellations'

export const GameState = engine.defineComponent('celestial::game-state', {
  /** Index into CONSTELLATIONS. */
  constellationIndex: Schemas.Int,
  /** Bitmask over ALL_PAIRS of every line currently drawn. */
  drawnMask: Schemas.Int,
  /** True once the current constellation's correct edges are all present. */
  solved: Schemas.Boolean,
  /** How many constellations this dome has completed since it came up. */
  totalSolved: Schemas.Int,
  /**
   * Fastest solve this dome has seen, in milliseconds, 0 for "none yet".
   * Shared, so the record belongs to the room rather than to one player -- beating
   * it is a group achievement and a reason to run the board again.
   */
  bestMillis: Schemas.Int,
  /** Which constellation set that record, so the HUD can name it. */
  bestName: Schemas.String
})

/** Fixed sync id. Every client addresses the same logical entity. */
const STATE_SYNC_ID = 1

export let stateEntity = engine.addEntity()

export function initState(): void {
  GameState.createOrReplace(stateEntity, {
    constellationIndex: 0,
    drawnMask: 0,
    solved: false,
    totalSolved: 0,
    bestMillis: 0,
    bestName: ''
  })
  syncEntity(stateEntity, [GameState.componentId], STATE_SYNC_ID)
}

export function readState() {
  return GameState.getOrNull(stateEntity)
}

export function currentConstellation() {
  const s = readState()
  const i = s ? s.constellationIndex % CONSTELLATIONS.length : 0
  return CONSTELLATIONS[i]
}

/**
 * Records a solve time if it beats the dome's record.
 * Called by the solver's own client; last-write-wins is fine because a slower
 * time can only lose to a faster one on the next comparison anyway.
 */
export function recordSolveTime(millis: number, name: string): boolean {
  const s = GameState.getMutableOrNull(stateEntity)
  if (!s || millis <= 0) return false
  if (s.bestMillis !== 0 && millis >= s.bestMillis) return false
  s.bestMillis = millis
  s.bestName = name
  return true
}

/** Toggles one line on or off, then re-evaluates whether the shape is complete. */
export function togglePair(bit: number): void {
  const s = GameState.getMutableOrNull(stateEntity)
  if (!s || s.solved) return

  const mask = s.drawnMask ^ (1 << bit)
  s.drawnMask = mask

  const target = correctMask(CONSTELLATIONS[s.constellationIndex % CONSTELLATIONS.length])
  // Solved when every correct edge is present. Extra wrong lines are tolerated:
  // the puzzle has no fail state, so they simply do not block completion.
  if ((mask & target) === target) {
    s.solved = true
    s.totalSolved = s.totalSolved + 1
  }
}

/**
 * Advances to the next constellation and clears the board.
 *
 * The next index is derived from `totalSolved` rather than incremented from the
 * current one. Every client runs its own reveal timer and so several of them
 * will call this at almost the same moment; deriving the index means those
 * concurrent writes all compute the same value and converge, instead of racing
 * the board forward by one constellation per player.
 */
export function advanceConstellation(): void {
  const s = GameState.getMutableOrNull(stateEntity)
  if (!s || !s.solved) return
  s.constellationIndex = s.totalSolved % CONSTELLATIONS.length
  s.drawnMask = 0
  s.solved = false
}
