/**
 * The drawn lines.
 *
 * One entity per possible star pair, created up front and toggled with
 * VisibilityComponent. Pre-allocating means drawing a line never spawns an
 * entity mid-session — the cost is paid once at load, and the entity count
 * never moves after that.
 *
 * A line is a stretched box rather than a real line primitive: cheap to build,
 * cheap to render, and it reads well against a dark sky on a small screen.
 *
 * Lines animate rather than appear. A new line grows from the star that was
 * tapped first toward the second over LINE_DRAW_SECONDS; an erased line
 * retracts the same way instead of blinking out. That is the difference
 * between the board reacting to you and the board just changing.
 */
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  Material,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { COLOR, GLOW, LINE_DRAW_SECONDS, LINE_THICKNESS } from './config'
import { ALL_PAIRS } from './constellations'
import { starPosition, isStarActive } from './stars'

/** What a line slot is doing right now. */
type Phase = 'off' | 'growing' | 'on' | 'retracting'

type LineSlot = {
  entity: Entity
  phase: Phase
  /** 0..1 along the segment. Drives both scale and midpoint while animating. */
  t: number
  /** Cached endpoints, so the per-frame update never re-reads star state. */
  a: Vector3.MutableVector3
  b: Vector3.MutableVector3
  color: Color3
  glow: number
  /** Extra brightness on top of `glow`, decaying — used for the solve flare. */
  flare: number
  /** Seconds still to wait before this slot starts its solve flare. */
  flareDelay: number
}

const slots: LineSlot[] = []
let lastMask = -1
let lastSolved = false
/** Non-zero while anything is animating, so updateLines can early-out. */
let animating = 0

export function createLines(): void {
  for (let i = 0; i < ALL_PAIRS.length; i++) {
    const e = engine.addEntity()
    Transform.create(e)
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: COLOR.lineCorrect,
      emissiveIntensity: GLOW.lineCorrect,
      roughness: 1
    })
    VisibilityComponent.create(e, { visible: false })
    slots.push({
      entity: e,
      phase: 'off',
      t: 0,
      a: Vector3.Zero(),
      b: Vector3.Zero(),
      color: COLOR.lineCorrect,
      glow: GLOW.lineCorrect,
      flare: 0,
      flareDelay: 0
    })
  }
}

/** Forces the next render to rebuild every line (used when the board changes). */
export function invalidateLines(): void {
  lastMask = -1
  for (const slot of slots) {
    slot.phase = 'off'
    slot.t = 0
    slot.flare = 0
    slot.flareDelay = 0
    VisibilityComponent.getMutable(slot.entity).visible = false
  }
  animating = 0
}

/**
 * Reconciles the board against `mask`.
 *
 * Only diffs — a slot already showing the line it should show is left entirely
 * alone, including its material. This runs every frame, so the cheap path has
 * to be the common one.
 *
 * @param mask - bitmask over ALL_PAIRS of the lines currently drawn
 * @param target - bitmask of the correct edges for this constellation
 * @param solved - whether the constellation is complete, which brightens everything
 */
export function renderLines(mask: number, target: number, solved: boolean): void {
  if (mask === lastMask && solved === lastSolved) return
  const solveJustHappened = solved && !lastSolved
  lastMask = mask
  lastSolved = solved

  let flareOrder = 0

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const [a, b] = ALL_PAIRS[i]
    const wanted = (mask & (1 << i)) !== 0 && isStarActive(a) && isStarActive(b)

    if (!wanted) {
      if (slot.phase === 'growing' || slot.phase === 'on') {
        slot.phase = 'retracting'
        animating++
      }
      continue
    }

    const isCorrect = (target & (1 << i)) !== 0
    const [color, glow] = solved
      ? [COLOR.lineSolved, GLOW.lineSolved]
      : isCorrect
        ? [COLOR.lineCorrect, GLOW.lineCorrect]
        : [COLOR.lineWrong, GLOW.lineWrong]

    const appearing = slot.phase === 'off' || slot.phase === 'retracting'
    if (appearing) {
      // Endpoints are captured once, here. starPosition hands back the slot's
      // own live vector, so it has to be copied or the line would follow the
      // star pool onto the next constellation.
      const pa = starPosition(a)
      const pb = starPosition(b)
      slot.a = Vector3.create(pa.x, pa.y, pa.z)
      slot.b = Vector3.create(pb.x, pb.y, pb.z)
      if (slot.phase === 'off') slot.t = 0
      slot.phase = 'growing'
      animating++
      VisibilityComponent.getMutable(slot.entity).visible = true
    }

    if (solveJustHappened) {
      // Flare the shape in sequence rather than all at once, so the eye is led
      // along the constellation instead of being flashed at.
      slot.flare = 1
      slot.flareDelay = flareOrder * 0.06
      flareOrder++
      animating++
    }

    if (slot.color !== color || slot.glow !== glow) {
      slot.color = color
      slot.glow = glow
      writeMaterial(slot)
    }
    if (!appearing) writeTransform(slot)
  }

  if (animating > 0) updateLines(0)
}

/**
 * Drives every animating line.
 *
 * Early-outs on a single counter when the board is static, which it is for
 * most of any given second — the whole point of tracking `animating` is that
 * this function costs nothing while nobody is drawing.
 */
export function updateLines(dt: number): void {
  if (animating === 0) return

  let stillAnimating = 0

  for (const slot of slots) {
    let busy = false

    if (slot.phase === 'growing') {
      slot.t = Math.min(1, slot.t + dt / LINE_DRAW_SECONDS)
      writeTransform(slot)
      if (slot.t >= 1) slot.phase = 'on'
      else busy = true
    } else if (slot.phase === 'retracting') {
      slot.t = Math.max(0, slot.t - dt / LINE_DRAW_SECONDS)
      writeTransform(slot)
      if (slot.t <= 0) {
        slot.phase = 'off'
        slot.flare = 0
        VisibilityComponent.getMutable(slot.entity).visible = false
      } else {
        busy = true
      }
    }

    if (slot.flare > 0) {
      if (slot.flareDelay > 0) {
        slot.flareDelay -= dt
      } else {
        slot.flare = Math.max(0, slot.flare - dt / 0.9)
        writeMaterial(slot)
      }
      busy = true
    }

    if (busy) stillAnimating++
  }

  animating = stillAnimating
}

/**
 * Positions the box for the slot's current `t`.
 *
 * The segment always starts at `a` and grows toward `b`, so the midpoint moves
 * with it — a line that scaled about its centre would appear to sprout from the
 * middle of empty sky rather than from the star the player tapped.
 */
function writeTransform(slot: LineSlot): void {
  const delta = Vector3.subtract(slot.b, slot.a)
  const full = Vector3.length(delta)
  if (full < 0.0001) return

  // Ease-out: fast off the mark, settling into place.
  const eased = slot.phase === 'on' ? 1 : 1 - Math.pow(1 - slot.t, 2.2)
  const length = Math.max(0.001, full * eased)

  const t = Transform.getMutable(slot.entity)
  t.position = Vector3.lerp(slot.a, slot.b, (eased * 0.5))
  t.rotation = Quaternion.lookRotation(Vector3.normalize(delta))
  t.scale = Vector3.create(LINE_THICKNESS, LINE_THICKNESS, length)
}

function writeMaterial(slot: LineSlot): void {
  // Flare decays on a curve so the peak is brief and the tail is long.
  const boost = 1 + slot.flare * slot.flare * 2.2
  Material.setPbrMaterial(slot.entity, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: slot.color,
    emissiveIntensity: slot.glow * boost,
    roughness: 1
  })
}
