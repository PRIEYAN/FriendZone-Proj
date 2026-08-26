/**
 * M3 Audio — sound effects and ambience for Celestial Cartography.
 *
 * Every clip here is synthesised offline by tools/generate_assets.py (see
 * that file's docstring for why: Buildathon T&C §8 requires the project to
 * hold rights to every shipped asset, so nothing is downloaded or sampled).
 *
 * Per the Build Contract, this module owns its own paths and tunables —
 * they live in the constants block below rather than in config.ts, so a
 * volume tweak here never touches a file this module doesn't own.
 */
import { engine, AudioSource, Entity } from '@dcl/sdk/ecs'

export type SfxName =
  | 'select'
  | 'deselect'
  | 'draw'
  | 'erase'
  | 'wrong'
  | 'hint'
  | 'streak'
  | 'solve'
  | 'advance'
  | 'ui'

/* --------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------ */

/** Master kill switch for this module, mirroring config.ts's AUDIO_ENABLED
 *  idea — kept local because this module may not always be wired to it. */
const ENABLED = true

const AUDIO_DIR = 'assets/audio'

/** Round-robin voice pool size. Overlapping SFX (e.g. two quick taps) each
 *  get their own entity instead of cutting each other off; 8 is generous
 *  for a puzzle with at most a couple of things happening per second. */
const VOICE_POOL_SIZE = 8

/** Sane pitch bounds so an extreme pitchStep can't produce something silent
 *  or ear-piercing. 2 octaves down / a little over 1 octave up. */
const MIN_PITCH = 0.5
const MAX_PITCH = 2.0

/** Ambience volume floor/ceiling for setAmbienceIntensity()'s 0..1 range.
 *  Ceiling matches the level index.ts's original inline ambience used. */
const AMBIENCE_VOLUME_FLOOR = 0.1
const AMBIENCE_VOLUME_CEILING = 0.35

type ClipConfig = { url: string; volume: number }

/**
 * One entry per SfxName, so playSfx() never has to branch on the name.
 * `solve` and `ui` are deliberate aliases onto existing clips (chime and a
 * quiet select) rather than separate assets — see the Build Contract API.
 */
const SFX: Record<SfxName, ClipConfig> = {
  select: { url: `${AUDIO_DIR}/select.mp3`, volume: 0.8 },
  deselect: { url: `${AUDIO_DIR}/deselect.mp3`, volume: 0.6 },
  draw: { url: `${AUDIO_DIR}/draw.mp3`, volume: 0.85 },
  erase: { url: `${AUDIO_DIR}/erase.mp3`, volume: 0.8 },
  wrong: { url: `${AUDIO_DIR}/wrong.mp3`, volume: 0.55 },
  hint: { url: `${AUDIO_DIR}/hint.mp3`, volume: 0.7 },
  streak: { url: `${AUDIO_DIR}/streak.mp3`, volume: 0.85 },
  advance: { url: `${AUDIO_DIR}/advance.mp3`, volume: 0.9 },
  solve: { url: `${AUDIO_DIR}/chime.mp3`, volume: 1.0 },
  ui: { url: `${AUDIO_DIR}/select.mp3`, volume: 0.35 }
}

const AMBIENT_CLIP = `${AUDIO_DIR}/ambient.mp3`

/* --------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------ */

const voicePool: Entity[] = []
let voiceCursor = 0
let ambienceEntity: Entity | null = null

/* --------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Creates the round-robin voice pool. Entities are allocated once, up
 * front, in line with the Build Contract's "pool everything at startup,
 * never addEntity after main() has run" rule — playSfx() only ever reuses
 * these, it never creates new ones.
 */
export function initAudio(): void {
  if (!ENABLED) return
  if (voicePool.length > 0) return // idempotent: initAudio() called twice is a no-op

  for (let i = 0; i < VOICE_POOL_SIZE; i++) {
    const entity = engine.addEntity()
    AudioSource.create(entity, {
      audioClipUrl: SFX.select.url,
      playing: false,
      loop: false,
      volume: 0,
      pitch: 1
    })
    voicePool.push(entity)
  }
}

/**
 * Plays a one-shot SFX on the next voice in the pool.
 *
 * Retrigger mechanism: AudioSource.playSound(entity, url, resetCursor) is
 * used instead of hand-toggling `playing`. Per its doc comment it always
 * issues a fresh CRDT PUT with `currentTime` reset to 0, which per
 * PBAudioSource's own contract ("if clip is stopped or current_time is
 * set, the clip is played from current_time") forces a restart even when
 * the entity is still mid-playback of the same clip. Toggling `playing`
 * false-then-true by hand does not reliably do this: both writes would
 * land within the same tick, only the final synced state is ever flushed,
 * and "still true" looks like no change to the renderer — so the clip
 * would just keep playing instead of restarting.
 */
export function playSfx(name: SfxName, opts?: { volume?: number; pitchStep?: number }): void {
  if (!ENABLED || voicePool.length === 0) return

  const cfg = SFX[name]
  const entity = voicePool[voiceCursor]
  voiceCursor = (voiceCursor + 1) % voicePool.length

  AudioSource.playSound(entity, cfg.url, true)

  const volume = clamp01((opts?.volume ?? 1) * cfg.volume)
  const pitch = clampPitch(Math.pow(2, (opts?.pitchStep ?? 0) / 12))
  const src = AudioSource.getMutable(entity)
  src.volume = volume
  src.pitch = pitch
  src.loop = false
}

/**
 * Creates the looping ambient bed on its own dedicated entity (outside the
 * voice pool, since it never round-robins — there is only ever one bed
 * playing). Safe to call once from wherever the scene wires up startup.
 */
export function startAmbience(): void {
  if (!ENABLED) return
  if (ambienceEntity !== null) return // idempotent: a second call is a no-op

  ambienceEntity = engine.addEntity()
  AudioSource.create(ambienceEntity, {
    audioClipUrl: AMBIENT_CLIP,
    playing: true,
    loop: true,
    volume: AMBIENCE_VOLUME_CEILING
  })
}

/**
 * Scales the ambience volume between its floor and ceiling. Intended for
 * ducking the bed during the solve reveal (v -> 0) and swelling it back
 * (v -> 1) once the dome advances.
 */
export function setAmbienceIntensity(v: number): void {
  if (!ENABLED || ambienceEntity === null) return
  const t = clamp01(v)
  AudioSource.getMutable(ambienceEntity).volume =
    AMBIENCE_VOLUME_FLOOR + t * (AMBIENCE_VOLUME_CEILING - AMBIENCE_VOLUME_FLOOR)
}

/** Total entities this module owns right now (voice pool + ambience, if started). */
export function audioEntityCount(): number {
  return voicePool.length + (ambienceEntity !== null ? 1 : 0)
}

/* --------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------ */

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function clampPitch(v: number): number {
  return Math.max(MIN_PITCH, Math.min(MAX_PITCH, v))
}
