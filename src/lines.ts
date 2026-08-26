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
import { COLOR, GLOW, LINE_THICKNESS } from './config'
import { ALL_PAIRS } from './constellations'
import { starPosition, isStarActive } from './stars'

const lines: Entity[] = []
let lastMask = -1
let lastSolved = false

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
    lines.push(e)
  }
}

/** Forces the next render to rebuild every line (used when the board changes). */
export function invalidateLines(): void {
  lastMask = -1
}

/**
 * Draws the line set described by `mask`.
 *
 * @param mask - bitmask over ALL_PAIRS of the lines currently drawn
 * @param target - bitmask of the correct edges for this constellation
 * @param solved - whether the constellation is complete, which brightens everything
 */
export function renderLines(mask: number, target: number, solved: boolean): void {
  if (mask === lastMask && solved === lastSolved) return
  lastMask = mask
  lastSolved = solved

  for (let i = 0; i < lines.length; i++) {
    const entity = lines[i]
    const drawn = (mask & (1 << i)) !== 0
    const [a, b] = ALL_PAIRS[i]

    if (!drawn || !isStarActive(a) || !isStarActive(b)) {
      VisibilityComponent.getMutable(entity).visible = false
      continue
    }

    const pa = starPosition(a)
    const pb = starPosition(b)
    const delta = Vector3.subtract(pb, pa)
    const length = Vector3.length(delta)

    const t = Transform.getMutable(entity)
    t.position = Vector3.lerp(pa, pb, 0.5)
    t.rotation = Quaternion.lookRotation(Vector3.normalize(delta))
    t.scale = Vector3.create(LINE_THICKNESS, LINE_THICKNESS, length)

    const isCorrect = (target & (1 << i)) !== 0
    const [color, glow] = solved
      ? [COLOR.lineSolved, GLOW.lineSolved]
      : isCorrect
        ? [COLOR.lineCorrect, GLOW.lineCorrect]
        : [COLOR.lineWrong, GLOW.lineWrong]

    Material.setPbrMaterial(entity, {
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: color,
      emissiveIntensity: glow,
      roughness: 1
    })
    VisibilityComponent.getMutable(entity).visible = true
  }
}
