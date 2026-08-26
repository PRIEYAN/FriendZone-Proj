/**
 * Central tunables for Celestial Cartography.
 *
 * Mobile constraints baked in here (see docs/Buildathon_Requirements.md §7.2):
 *  - No point lights: the mobile client does not implement PBPointLight, so every
 *    glow in this scene comes from emissive PBR materials.
 *  - No particle systems: unimplemented on mobile, so effects are geometry-based.
 */
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

/** Scene is 2x2 parcels (32x32m); the dome is centred on it. */
export const DOME_CENTER = Vector3.create(16, 0, 16)
export const DOME_RADIUS = 15

/** Visual size of a star billboard, and the (larger) invisible tap target around it. */
export const STAR_VISUAL_SIZE = 0.55
export const STAR_HIT_SIZE = 2.6

/** Pointer reach. Stars sit on the dome shell, well beyond the default 10m. */
export const MAX_POINTER_DISTANCE = 40

/** Thickness of a drawn line, in metres. */
export const LINE_THICKNESS = 0.12

/** Seconds of inactivity before the hint system starts pulsing a useful star. */
export const HINT_IDLE_SECONDS = 12

/** How long the solve banner stays up before the dome advances. */
export const REVEAL_SECONDS = 7

/**
 * Audio ships with the scene. Both files are synthesised from scratch (see
 * tools/generate_assets.py), so we hold the rights outright -- which is what
 * Buildathon T&C §8 requires of every asset in a submission.
 */
export const AUDIO_ENABLED = true
export const AMBIENT_AUDIO = 'assets/audio/ambient.mp3'
export const CHIME_AUDIO = 'assets/audio/chime.mp3'

/** The star sprite. A soft radial glow reads as starlight; a flat plane reads as a square. */
export const STAR_TEXTURE = 'assets/textures/star_glow.png'

/** Pulse timing for the selected and hinted stars. */
export const PULSE = {
  selectedHz: 1.6,
  selectedDepth: 0.28,
  hintedHz: 0.9,
  hintedDepth: 0.35
} as const

/** How long the solve reveal takes to play out, in seconds. */
export const REVEAL = {
  flare: 0.5,
  figureFade: 1.5
} as const

/** Palette. Emissive colours are deliberately bright: they are the only light source. */
export const COLOR = {
  starIdle: Color3.create(0.62, 0.72, 1.0),
  starSelected: Color3.create(1.0, 0.85, 0.45),
  starHinted: Color3.create(0.55, 1.0, 0.85),
  starSolved: Color3.create(1.0, 0.93, 0.7),
  lineCorrect: Color3.create(0.75, 0.86, 1.0),
  lineWrong: Color3.create(0.45, 0.45, 0.6),
  lineSolved: Color3.create(1.0, 0.9, 0.6),
  domeInterior: Color4.create(0.02, 0.02, 0.06, 1.0),
  backgroundStar: Color3.create(0.5, 0.58, 0.85),
  figure: Color3.create(0.62, 0.84, 1.0)
} as const

/** Emissive intensities, tuned so idle stars read clearly without blowing out mobile displays. */
export const GLOW = {
  starIdle: 2.2,
  starSelected: 6.0,
  starHinted: 5.0,
  starSolved: 8.0,
  lineCorrect: 2.6,
  lineWrong: 0.8,
  lineSolved: 7.0,
  backgroundStar: 1.1,
  figure: 3.4
} as const

/** Decorative, non-interactive stars scattered across the dome for atmosphere. */
export const BACKGROUND_STAR_COUNT = 70
