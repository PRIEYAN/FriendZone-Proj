/**
 * The passive hint.
 *
 * The puzzle has no fail state and no timer, so the only way a group gets stuck
 * is ambiguity about which star comes next. After a stretch of inactivity one
 * star belonging to a missing edge starts glowing. It never draws the line for
 * the player — it only narrows the search.
 */
import { ALL_PAIRS } from './constellations'
import { isStarActive } from './stars'

let idleSeconds = 0
let hintedStar: number | null = null

export function noteActivity(): void {
  idleSeconds = 0
  hintedStar = null
}

export function currentHint(): number | null {
  return hintedStar
}

/** Immediately reveals a hint, for the on-screen hint button. */
export function forceHint(mask: number, target: number): number | null {
  hintedStar = pickHint(mask, target)
  idleSeconds = 0
  return hintedStar
}

export function clearHint(): void {
  hintedStar = null
}

/**
 * @param dt - frame delta in seconds
 * @param idleLimit - seconds of inactivity before a hint appears
 * @returns true when the hint changed and the visuals need refreshing
 */
export function updateHint(
  dt: number,
  idleLimit: number,
  mask: number,
  target: number,
  solved: boolean
): boolean {
  if (solved) {
    if (hintedStar === null) return false
    hintedStar = null
    return true
  }

  idleSeconds += dt
  if (idleSeconds < idleLimit || hintedStar !== null) return false

  hintedStar = pickHint(mask, target)
  return hintedStar !== null
}

/** Picks a star that belongs to a correct edge which has not been drawn yet. */
function pickHint(mask: number, target: number): number | null {
  const missing = target & ~mask
  if (missing === 0) return null

  for (let i = 0; i < ALL_PAIRS.length; i++) {
    if ((missing & (1 << i)) === 0) continue
    const [a, b] = ALL_PAIRS[i]
    if (isStarActive(a)) return a
    if (isStarActive(b)) return b
  }
  return null
}
