/**
 * Celestial Cartography — a cooperative constellation-drawing dome.
 *
 * Entry point. Order matters, and not only for tidiness: shared state has to
 * exist before anything reads it, the star pool has to exist before the first
 * constellation is applied to it, and every pool has to be allocated here,
 * during load, because nothing in this scene is allowed to create an entity
 * once play has started. A flat entity count is what keeps the frame time flat.
 */
import { engine } from '@dcl/sdk/ecs'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'
import { AUDIO_ENABLED, METEORS_PER_MINUTE } from './config'
import { initState } from './state'
import { createDome } from './dome'
import { createScenery, updateScenery } from './scenery'
import { initVfx, setMeteorRate } from './vfx'
import { initAudio, startAmbience } from './audio'
import { initPresence } from './presence'
import { initGame } from './game'
import { ui } from './ui'

export function main(): void {
  initState()

  // World first, then effects, then the game on top of them. initGame ends by
  // registering the only system that drives play, so anything it calls into
  // has to already have its pools.
  createDome()
  createScenery()
  initVfx()
  setMeteorRate(METEORS_PER_MINUTE)
  initAudio()
  initPresence()
  initGame()

  if (AUDIO_ENABLED) startAmbience()

  // Scenery breathes on its own schedule and knows nothing about the game, so
  // it gets its own system rather than a call inside the game loop.
  engine.addSystem(updateScenery)

  ReactEcsRenderer.setUiRenderer(ui, {
    // 'interactable' keeps the HUD clear of the joystick, chat and camera
    // controls. On desktop the same inset reserves roughly a quarter of the
    // screen's left side, which is wasted space there, so desktop falls back to
    // the plain device safe area.
    screenInset: isMobile() ? 'interactable' : 'device'
  })
}
