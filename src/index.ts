/**
 * Celestial Cartography — a cooperative constellation-drawing dome.
 *
 * Entry point. Order matters: shared state has to exist before anything reads
 * it, and the star pool has to exist before the first constellation is applied.
 */
import { engine, AudioSource } from '@dcl/sdk/ecs'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'
import { AMBIENT_AUDIO, AUDIO_ENABLED } from './config'
import { initState } from './state'
import { createDome } from './dome'
import { initPresence } from './presence'
import { initGame } from './game'
import { ui } from './ui'

export function main(): void {
  initState()
  createDome()
  initPresence()
  initGame()
  startAmbience()

  ReactEcsRenderer.setUiRenderer(ui, {
    // 'interactable' keeps the HUD clear of the joystick, chat and camera
    // controls. On desktop the same inset reserves roughly a quarter of the
    // screen's left side, which is wasted space there, so desktop falls back to
    // the plain device safe area.
    screenInset: isMobile() ? 'interactable' : 'device'
  })
}

function startAmbience(): void {
  if (!AUDIO_ENABLED) return
  const ambience = engine.addEntity()
  AudioSource.create(ambience, {
    audioClipUrl: AMBIENT_AUDIO,
    playing: true,
    loop: true,
    volume: 0.35
  })
}
