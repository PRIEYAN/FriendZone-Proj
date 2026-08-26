/**
 * Who else is in the dome.
 *
 * This exists for a specific reason. The Buildathon rules require the scene to
 * work as a standalone experience for one visitor (T&C §6) while also excluding
 * "single-player experiences without a meaningful social component" (T&C §7).
 * A judge testing alone therefore has to be able to *see* that this is a shared
 * space, even with nobody else present — so the HUD always states that lines are
 * shared, and names the people who are here when anyone is.
 */
import { onEnterScene, onLeaveScene } from '@dcl/sdk/players'

const present = new Map<string, string>()

export function initPresence(): void {
  onEnterScene((player) => {
    if (player?.userId) present.set(player.userId, player.name || 'Stargazer')
  })
  onLeaveScene((userId) => {
    present.delete(userId)
  })
}

/** Everyone currently in the scene, the local player included. */
export function stargazerCount(): number {
  return Math.max(1, present.size)
}

export function otherStargazerNames(): string[] {
  return Array.from(present.values())
}
