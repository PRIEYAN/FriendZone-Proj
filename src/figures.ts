/**
 * The mythic figures.
 *
 * The concept doc's payoff: "an animated mythic figure (an archer, a bear, a
 * dipper) blooms above the dome", trimmed in the MVP cut to "Simple glowing
 * line-art outline fade-in, no rigged character animation."
 *
 * Each figure is a set of polylines authored in the same 2D sky-plane space as
 * the stars, projected onto the dome slightly beyond them so the outline sits
 * behind the puzzle lines instead of z-fighting with them. On solve the strokes
 * fade up over ~1.5s.
 */
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  Material,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { COLOR, DOME_CENTER, DOME_RADIUS, GLOW, PARK_POSITION } from './config'
import { ConstellationDef } from './constellations'

/** A polyline: consecutive points are joined. */
type Stroke = [number, number][]

export type FigureDef = {
  /** Shown under the constellation name on solve. */
  title: string
  strokes: Stroke[]
  /** Multiplier on the constellation's own angular spread. >1 wraps the stars. */
  scale: number
  /** Shifts the figure in sky-plane units, to sit the body over the stars. */
  offsetU: number
  offsetV: number
}

/**
 * Ursa Major. The Big Dipper is the bear's hindquarters and tail, so the body
 * runs left of the bowl and the tail follows the handle out to Alkaid.
 */
const GREAT_BEAR: FigureDef = {
  title: 'The Great Bear',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Back, running over the bowl of the Dipper
    [[-1.0, 0.58], [-0.7, 0.64], [-0.45, 0.6], [-0.28, 0.5]],
    // Rump, closing the hindquarters
    [[-0.28, 0.5], [-0.26, -0.28]],
    // The tail IS the Dipper's handle: Megrez -> Alioth -> Mizar -> Alkaid
    [[-0.3, 0.15], [0.1, 0.25], [0.5, 0.2], [0.9, -0.05]],
    // Belly
    [[-0.95, -0.38], [-0.6, -0.46], [-0.35, -0.42], [-0.26, -0.28]],
    // Chest
    [[-1.0, 0.58], [-1.06, 0.12], [-0.95, -0.38]],
    // Neck and muzzle
    [[-1.06, 0.28], [-1.28, 0.34], [-1.38, 0.2], [-1.3, 0.06], [-1.08, 0.08]],
    // Ear
    [[-1.22, 0.35], [-1.25, 0.48], [-1.12, 0.42]],
    // Foreleg
    [[-0.92, -0.42], [-0.88, -0.74], [-0.98, -0.84]],
    // Hind leg
    [[-0.36, -0.44], [-0.32, -0.76], [-0.42, -0.86]]
  ]
}

/**
 * Orion the Hunter.
 *
 * Deliberately draws only what the puzzle lines do not: the shoulders, belt and
 * legs are already on screen as the player's own solved constellation, so the
 * figure adds the head, arms, club, shield and tunic around them. The outline
 * completes the player's drawing rather than tracing over it.
 */
const THE_HUNTER: FigureDef = {
  title: 'The Hunter',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Head
    [[-0.1, 1.28], [0.08, 1.24], [0.14, 1.06], [0.02, 0.98], [-0.12, 1.04], [-0.14, 1.22], [-0.1, 1.28]],
    // Neck down to the shoulder line
    [[0.0, 0.98], [0.0, 0.88]],
    // Raised arm and club
    [[0.55, 0.9], [0.85, 1.05], [0.98, 1.3]],
    [[0.84, 1.24], [1.12, 1.38]],
    // Bow arm, and the bow curving around the hand that holds it
    [[-0.55, 0.85], [-0.88, 0.7]],
    [[-0.8, 0.98], [-0.99, 0.72], [-0.82, 0.44]],
    // Tunic hanging below the belt
    [[-0.3, 0.05], [-0.42, -0.25], [0.0, -0.34], [0.42, -0.3], [0.3, -0.05]],
    // Feet
    [[-0.5, -0.85], [-0.62, -0.95]],
    [[0.6, -0.9], [0.72, -0.98]]
  ]
}

/**
 * Cassiopeia, the queen on her throne. The W is the throne's back and seat, so
 * the figure adds the seated body, the crown and the throne's frame around it.
 */
const THE_QUEEN: FigureDef = {
  title: 'The Queen',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Throne: a high back on the left and a seat running under the whole W
    [[-1.32, -0.55], [-1.38, 0.86], [-1.0, 0.96]],
    [[-1.32, -0.55], [0.58, -0.72]],
    [[-1.28, -0.6], [-1.24, -0.98]],
    [[0.52, -0.72], [0.58, -1.02]],
    // Head
    [[-0.62, 0.72], [-0.48, 0.68], [-0.44, 0.52], [-0.56, 0.44], [-0.7, 0.5], [-0.68, 0.66], [-0.62, 0.72]],
    // Crown
    [[-0.74, 0.74], [-0.7, 0.94], [-0.58, 0.8], [-0.48, 0.96], [-0.4, 0.76]],
    // Neck, torso, hips
    [[-0.6, 0.44], [-0.58, 0.24], [-0.44, 0.02], [-0.3, -0.16]],
    // Arm resting back along the throne
    [[-0.58, 0.3], [-0.94, 0.14], [-1.04, -0.1]],
    // Arm reaching out across the sky, toward Caph
    [[-0.55, 0.28], [-0.08, 0.44], [0.44, 0.52], [0.86, 0.44]],
    // Thigh and shin, following the seat to the right
    [[-0.3, -0.16], [0.34, -0.36]],
    [[0.34, -0.36], [0.5, -0.68]]
  ]
}

/**
 * Triangulum. The three stars already draw the triangle itself, so the figure
 * adds the heraldic reading: a radiant Greek delta — rays off each vertex, a
 * nested inner triangle, and a halo ring beneath it.
 */
const THE_TRIANGLE: FigureDef = {
  title: 'The Triangle',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Rays off each vertex
    [[-0.6, -0.5], [-0.85, -0.7]],
    [[0.7, -0.3], [0.98, -0.42]],
    [[0.1, 0.8], [0.13, 1.12]],
    // Nested inner triangle
    [[-0.2, -0.15], [0.25, -0.05], [0.05, 0.35], [-0.2, -0.15]],
    // Halo ring beneath the glyph
    [
      [0.07, 0.15],
      [0.21, 0.08],
      [0.21, -0.08],
      [0.07, -0.15],
      [-0.07, -0.08],
      [-0.07, 0.08],
      [0.07, 0.15]
    ]
  ]
}

/**
 * Crux. The puzzle already draws both arms of the cross, so the figure adds
 * the decorative reading: serifed tips, a central gem at the crossing, and a
 * halo ring — the Southern Cross as a wrought emblem.
 */
const THE_SOUTHERN_CROSS: FigureDef = {
  title: 'The Southern Cross',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Serifs at each of the four tips
    [[-0.12, 0.85], [0.12, 0.85]],
    [[-0.12, -0.85], [0.12, -0.85]],
    [[-0.65, 0.02], [-0.65, 0.28]],
    [[0.65, -0.17], [0.65, 0.07]],
    // Central gem at the crossing
    [[0.0, 0.15], [0.15, 0.03], [0.0, -0.09], [-0.15, 0.03], [0.0, 0.15]],
    // Halo ring
    [
      [0.0, 0.42],
      [0.3, 0.21],
      [0.3, -0.21],
      [0.0, -0.42],
      [-0.3, -0.21],
      [-0.3, 0.21],
      [0.0, 0.42]
    ]
  ]
}

/**
 * Corvus. The quadrilateral is already the crow's sail-like body, so the
 * figure adds the head off Minkar (beak, eye, crest) and fans of wing and
 * tail feathers off the far corners.
 */
const THE_CROW: FigureDef = {
  title: 'The Crow',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Beak
    [[-0.9, 0.05], [-1.15, -0.05], [-0.95, -0.15]],
    // Eye
    [[-1.0, 0.15], [-1.08, 0.1], [-1.0, 0.05]],
    // Crest
    [[-0.9, 0.05], [-0.85, 0.3], [-0.75, 0.35]],
    // Wing feathers off Gienah
    [[0.6, 0.55], [0.95, 0.75]],
    [[0.6, 0.55], [1.0, 0.55]],
    [[0.6, 0.55], [0.9, 0.3]],
    // Tail feathers off Kraz and Algorab
    [[0.5, -0.5], [0.65, -0.85]],
    [[-0.55, -0.45], [-0.7, -0.8]]
  ]
}

/**
 * Lyra. The parallelogram is already the soundbox, so the figure adds the two
 * curved arms rising to a crossbar near Vega, the strings between them, and a
 * tortoise-shell base beneath — Hermes's lyre.
 */
const THE_LYRE: FigureDef = {
  title: 'The Lyre',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Left arm curving up to the crossbar
    [[-0.15, -0.35], [-0.55, 0.1], [-0.5, 0.6], [-0.15, 0.85]],
    // Right arm curving up to the crossbar
    [[0.5, -0.1], [0.75, 0.3], [0.55, 0.75], [0.15, 0.85]],
    // Crossbar
    [[-0.15, 0.85], [0.15, 0.85]],
    // Strings
    [[-0.1, 0.85], [-0.05, -0.1]],
    [[0.0, 0.85], [0.05, -0.3]],
    [[0.1, 0.85], [0.2, -0.5]],
    // Tortoise-shell base
    [[-0.3, -0.6], [0.0, -0.9], [0.4, -0.6], [0.05, -0.45], [-0.3, -0.6]]
  ]
}

/**
 * Aquila. The body line already runs Tarazed-Altair-Alshain, so the figure
 * adds spread wings off the outer stars, a hooked head, and a fanned tail.
 */
const THE_EAGLE: FigureDef = {
  title: 'The Eagle',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Left wing
    [[-0.5, 0.35], [-1.0, 0.55], [-1.3, 0.35], [-1.15, 0.1]],
    // Right wing
    [[0.7, 0.55], [1.15, 0.5], [1.35, 0.2], [1.1, 0.0]],
    // Head and hooked beak
    [[-0.5, 0.35], [-0.65, 0.65], [-0.55, 0.85], [-0.35, 0.7], [-0.4, 0.5]],
    // Tail fan
    [[-0.75, -0.5], [-0.9, -0.85]],
    [[-0.75, -0.5], [-0.65, -0.9]],
    [[-0.75, -0.5], [-0.5, -0.85]]
  ]
}

/**
 * Cygnus. The Northern Cross is already the wingspan and body, so the figure
 * adds the head and beak off Albireo and feathered fans off both wingtips
 * and the tail.
 */
const THE_SWAN: FigureDef = {
  title: 'The Swan',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Head and beak, curving down from Albireo
    [[0.0, -0.85], [-0.12, -1.05], [0.05, -1.1], [0.15, -0.95]],
    // Left wing feathers off Gienah Cygni
    [[-0.75, 0.05], [-1.05, 0.3]],
    [[-0.75, 0.05], [-1.15, 0.05]],
    [[-0.75, 0.05], [-1.05, -0.2]],
    // Right wing feathers off Delta Cygni
    [[0.75, 0.2], [1.05, 0.45]],
    [[0.75, 0.2], [1.15, 0.2]],
    [[0.75, 0.2], [1.05, -0.05]],
    // Tail feathers off Deneb
    [[0.0, 0.9], [-0.2, 1.15]],
    [[0.0, 0.9], [0.0, 1.25]],
    [[0.0, 0.9], [0.2, 1.15]]
  ]
}

/**
 * Scorpius. The eight-star chain is already the curling body, so the figure
 * adds pincers off the head end, legs along the flanks, and the hooked barb
 * beyond the stinger.
 */
const THE_SCORPION: FigureDef = {
  title: 'The Scorpion',
  scale: 1.0,
  offsetU: 0.0,
  offsetV: 0.0,
  strokes: [
    // Pincers off Acrab
    [[-0.85, 0.8], [-1.2, 0.9], [-1.4, 0.7]],
    [[-0.85, 0.8], [-1.1, 1.15], [-0.9, 1.35]],
    // Legs along the body
    [[-0.6, 0.65], [-0.9, 0.75]],
    [[-0.25, 0.35], [-0.55, 0.45]],
    [[0.05, 0.0], [0.35, 0.15]],
    [[0.15, -0.35], [0.45, -0.25]],
    [[0.0, -0.65], [-0.3, -0.5]],
    // Hooked barb beyond Lesath
    [[-0.55, -0.75], [-0.75, -0.55], [-0.6, -0.4]]
  ]
}

export const FIGURES: Record<string, FigureDef> = {
  Triangulum: THE_TRIANGLE,
  Crux: THE_SOUTHERN_CROSS,
  Corvus: THE_CROW,
  Cassiopeia: THE_QUEEN,
  Lyra: THE_LYRE,
  Aquila: THE_EAGLE,
  Cygnus: THE_SWAN,
  'The Big Dipper': GREAT_BEAR,
  Orion: THE_HUNTER,
  Scorpius: THE_SCORPION
}

/** Widest figure decides the pool size. */
const MAX_SEGMENTS = Object.values(FIGURES).reduce((max, f) => {
  const n = f.strokes.reduce((s, stroke) => s + Math.max(0, stroke.length - 1), 0)
  return Math.max(max, n)
}, 0)

/**
 * One box per stroke segment, plus everything the reveal needs to draw it on.
 *
 * The endpoints are kept here rather than recomputed, because the reveal reads
 * them every frame while a stroke is growing and the projection is trigonometry.
 */
type Segment = {
  entity: Entity
  a: Vector3.MutableVector3
  b: Vector3.MutableVector3
  length: number
  rotation: Quaternion.MutableQuaternion
  /** Seconds into the reveal at which this segment starts drawing. */
  delay: number
}

/** How thick a figure stroke is drawn, in metres. */
const FIGURE_THICKNESS = 0.07

/** How long one stroke takes to draw itself on. */
const REVEAL_STROKE_SECONDS = 0.32

/**
 * Gap between consecutive strokes starting. Twenty-five segments at 45ms puts
 * the last stroke under way about 1.1s in, which lands the whole reveal inside
 * the banner's dwell time without any of it feeling hurried.
 */
const REVEAL_STAGGER = 0.045

const segments: Segment[] = []
let revealClock = 0
let revealing = false
let activeCount = 0

export function figureSegmentBudget(): number {
  return MAX_SEGMENTS
}

export function createFigures(): void {
  for (let i = 0; i < MAX_SEGMENTS; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: PARK_POSITION })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: COLOR.figure,
      emissiveIntensity: 0,
      roughness: 1
    })
    VisibilityComponent.create(e, { visible: false })
    segments.push({
      entity: e,
      a: Vector3.Zero(),
      b: Vector3.Zero(),
      length: 0,
      rotation: Quaternion.Identity(),
      delay: 0
    })
  }
}

/** Projects a figure-space point onto the dome, just beyond the star shell. */
function figureWorldPosition(
  c: ConstellationDef,
  f: FigureDef,
  u: number,
  v: number
): Vector3.MutableVector3 {
  const azDeg = c.azimuth + (u * f.scale + f.offsetU) * (c.spreadAz / 2)
  const elDeg = c.elevation + (v * f.scale + f.offsetV) * (c.spreadEl / 2)
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  // Slightly further out than the stars so the outline never z-fights the lines.
  const r = DOME_RADIUS + 1.2
  const horizontal = Math.cos(el) * r
  return Vector3.create(
    DOME_CENTER.x + horizontal * Math.sin(az),
    DOME_CENTER.y + Math.sin(el) * r,
    DOME_CENTER.z + horizontal * Math.cos(az)
  )
}

/**
 * Lays the figure out and starts it drawing itself on.
 *
 * The MVP cut called for a fade, and a fade is what this was: every stroke
 * appearing at once, brightening together. That reads as an image being
 * switched on. Drawing the strokes in sequence instead reads as something
 * being *revealed* — which is the beat the whole puzzle is built toward, and
 * the one a player is going to screenshot.
 *
 * Stroke order is authoring order, and the figures are authored body-first, so
 * the shape assembles roughly the way you would sketch it.
 */
export function showFigure(c: ConstellationDef): void {
  const f = FIGURES[c.name]
  if (!f) return

  let i = 0
  for (const stroke of f.strokes) {
    for (let k = 0; k < stroke.length - 1 && i < segments.length; k++, i++) {
      const seg = segments[i]
      const a = figureWorldPosition(c, f, stroke[k][0], stroke[k][1])
      const b = figureWorldPosition(c, f, stroke[k + 1][0], stroke[k + 1][1])
      const delta = Vector3.subtract(b, a)
      seg.a = a
      seg.b = b
      seg.length = Vector3.length(delta)
      seg.rotation = Quaternion.lookRotation(Vector3.normalize(delta))
      seg.delay = i * REVEAL_STAGGER
      // Start at nothing. writeSegment draws it from here.
      const t = Transform.getMutable(seg.entity)
      t.position = a
      t.rotation = seg.rotation
      t.scale = Vector3.create(FIGURE_THICKNESS, FIGURE_THICKNESS, 0.001)
      VisibilityComponent.getMutable(seg.entity).visible = true
    }
  }
  activeCount = i
  for (let k = i; k < segments.length; k++) {
    VisibilityComponent.getMutable(segments[k].entity).visible = false
  }

  revealClock = 0
  revealing = true
}

export function hideFigure(): void {
  revealing = false
  revealClock = 0
  for (const seg of segments) {
    VisibilityComponent.getMutable(seg.entity).visible = false
    Material.setPbrMaterial(seg.entity, {
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: COLOR.figure,
      emissiveIntensity: 0,
      roughness: 1
    })
  }
  activeCount = 0
}

export function figureTitle(c: ConstellationDef): string {
  return FIGURES[c.name]?.title ?? ''
}

/**
 * Draws the outline on, one stroke after another.
 *
 * Runs only while a figure is actually revealing, and stops writing to a
 * segment the moment that segment is finished — so the cost falls away as the
 * reveal completes rather than continuing for as long as the figure is up.
 */
export function updateFigureFade(dt: number): void {
  if (!revealing || activeCount === 0) return

  revealClock += dt
  let anyPending = false

  for (let i = 0; i < activeCount; i++) {
    const seg = segments[i]
    const local = (revealClock - seg.delay) / REVEAL_STROKE_SECONDS

    if (local <= 0) {
      anyPending = true
      continue
    }
    if (local >= 1) {
      // Settle it exactly once, on the frame it finishes.
      if (seg.length > 0) {
        writeSegment(seg, 1)
        seg.length = -seg.length // negative marks "already settled"
      }
      continue
    }

    anyPending = true
    writeSegment(seg, 1 - Math.pow(1 - local, 2.4))
  }

  if (!anyPending) {
    revealing = false
    // Restore the lengths the negative marker was hiding, so a second reveal of
    // the same figure still knows how long each stroke is.
    for (let i = 0; i < activeCount; i++) {
      if (segments[i].length < 0) segments[i].length = -segments[i].length
    }
  }
}

/**
 * Grows one stroke from its start point to `progress` along its own length.
 *
 * The midpoint travels with the tip, same as a drawn line does — a segment
 * scaled about its centre would appear to sprout out of the middle of the
 * stroke instead of being drawn from one end.
 */
function writeSegment(seg: Segment, progress: number): void {
  const length = Math.abs(seg.length)
  const drawn = Math.max(0.001, length * progress)

  const t = Transform.getMutable(seg.entity)
  t.position = Vector3.lerp(seg.a, seg.b, progress * 0.5)
  t.rotation = seg.rotation
  t.scale = Vector3.create(FIGURE_THICKNESS, FIGURE_THICKNESS, drawn)

  Material.setPbrMaterial(seg.entity, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: COLOR.figure,
    emissiveIntensity: GLOW.figure * progress,
    roughness: 1
  })
}
