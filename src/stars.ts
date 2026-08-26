/**
 * The interactive stars.
 *
 * A fixed pool of star slots is created once and repositioned when the dome
 * moves to a new constellation, so entity count stays constant for the whole
 * session rather than churning on every solve.
 *
 * Each slot is three entities:
 *   root   - position anchor
 *   hit    - an oversized invisible pointer collider (mobile taps are imprecise)
 *   visual - a billboarded emissive plane (two triangles, no point light)
 */
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  Billboard,
  BillboardMode,
  VisibilityComponent,
  ColliderLayer,
  InputAction,
  MaterialTransparencyMode,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import {
  COLOR,
  GLOW,
  MAX_POINTER_DISTANCE,
  PULSE,
  STAR_HIT_SIZE,
  STAR_TEXTURE,
  STAR_VISUAL_SIZE
} from './config'
import { ConstellationDef, MAX_STARS, starWorldPosition } from './constellations'

export type StarVisualState = 'idle' | 'selected' | 'hinted' | 'solved'

type StarSlot = {
  root: Entity
  hit: Entity
  visual: Entity
  position: Vector3.MutableVector3
  active: boolean
}

const slots: StarSlot[] = []

/** Which slot is pulsing, and why. Only ever one or two at a time. */
let pulseSelected: number | null = null
let pulseHinted: number | null = null
let pulseClock = 0

/**
 * The star sprite: a glow texture, alpha-blended, lit purely by emission.
 * `alphaTest` is left off so the soft edges stay soft rather than clipping.
 */
function applyStarMaterial(
  entity: Entity,
  color: typeof COLOR.starIdle,
  glow: number
): void {
  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({ src: STAR_TEXTURE }),
    emissiveTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    alphaTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: color,
    emissiveIntensity: glow,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1,
    metallic: 0
  })
}

/** Builds the pool. Call once, before the first constellation is applied. */
export function createStars(onTap: (index: number) => void): void {
  for (let i = 0; i < MAX_STARS; i++) {
    const root = engine.addEntity()
    Transform.create(root, { position: Vector3.Zero() })

    const visual = engine.addEntity()
    Transform.create(visual, {
      parent: root,
      scale: Vector3.scale(Vector3.One(), STAR_VISUAL_SIZE),
      rotation: Quaternion.Identity()
    })
    MeshRenderer.setPlane(visual)
    Billboard.create(visual, { billboardMode: BillboardMode.BM_ALL })
    applyStarMaterial(visual, COLOR.starIdle, GLOW.starIdle)

    const hit = engine.addEntity()
    Transform.create(hit, {
      parent: root,
      scale: Vector3.scale(Vector3.One(), STAR_HIT_SIZE)
    })
    // Pointer layer only: these boxes must never block player movement.
    MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)

    const index = i
    pointerEventsSystem.onPointerDown(
      {
        entity: hit,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: 'Connect',
          maxDistance: MAX_POINTER_DISTANCE,
          showFeedback: true
        }
      },
      () => onTap(index)
    )

    slots.push({ root, hit, visual, position: Vector3.Zero(), active: false })
  }
}

/** Moves the pool onto a constellation and hides any unused slots. */
export function applyConstellation(c: ConstellationDef): void {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const def = c.stars[i]
    slot.active = def !== undefined

    VisibilityComponent.createOrReplace(slot.visual, { visible: slot.active })

    if (!slot.active) {
      // Park the collider out of reach so a hidden slot cannot be tapped.
      MeshCollider.deleteFrom(slot.hit)
      continue
    }

    const pos = starWorldPosition(c, def)
    slot.position = pos
    Transform.getMutable(slot.root).position = pos

    if (!MeshCollider.getOrNull(slot.hit)) {
      MeshCollider.setBox(slot.hit, ColliderLayer.CL_POINTER)
    }
  }
}

export function starPosition(index: number): Vector3.MutableVector3 {
  return slots[index].position
}

export function isStarActive(index: number): boolean {
  return slots[index]?.active === true
}

export function activeStarCount(): number {
  return slots.filter((s) => s.active).length
}

/** Applies a visual state to one star. Called on change only, never per frame. */
export function setStarVisual(index: number, state: StarVisualState): void {
  const slot = slots[index]
  if (!slot || !slot.active) return

  const [color, glow, scale] =
    state === 'selected'
      ? [COLOR.starSelected, GLOW.starSelected, 1.45]
      : state === 'hinted'
        ? [COLOR.starHinted, GLOW.starHinted, 1.3]
        : state === 'solved'
          ? [COLOR.starSolved, GLOW.starSolved, 1.25]
          : [COLOR.starIdle, GLOW.starIdle, 1.0]

  applyStarMaterial(slot.visual, color, glow)
  Transform.getMutable(slot.visual).scale = Vector3.scale(
    Vector3.One(),
    STAR_VISUAL_SIZE * scale
  )

  // Record what should pulse. The concept doc is specific that a selected star
  // must pulse, so the player gets confirmation before committing the second tap.
  if (state === 'selected') pulseSelected = index
  else if (pulseSelected === index) pulseSelected = null
  if (state === 'hinted') pulseHinted = index
  else if (pulseHinted === index) pulseHinted = null
}

/**
 * Drives the pulse on the selected and hinted stars.
 *
 * This is the only per-frame work in the scene and it touches at most two
 * entities, which keeps the mobile frame budget flat.
 */
export function updateStarPulse(dt: number): void {
  if (pulseSelected === null && pulseHinted === null) return
  pulseClock += dt

  if (pulseSelected !== null) {
    pulse(pulseSelected, COLOR.starSelected, GLOW.starSelected, 1.45,
      PULSE.selectedHz, PULSE.selectedDepth)
  }
  if (pulseHinted !== null && pulseHinted !== pulseSelected) {
    pulse(pulseHinted, COLOR.starHinted, GLOW.starHinted, 1.3,
      PULSE.hintedHz, PULSE.hintedDepth)
  }
}

function pulse(
  index: number,
  color: typeof COLOR.starIdle,
  glow: number,
  baseScale: number,
  hz: number,
  depth: number
): void {
  const slot = slots[index]
  if (!slot || !slot.active) return
  const wave = Math.sin(pulseClock * hz * Math.PI * 2)
  applyStarMaterial(slot.visual, color, glow * (1 + wave * depth))
  Transform.getMutable(slot.visual).scale = Vector3.scale(
    Vector3.One(),
    STAR_VISUAL_SIZE * baseScale * (1 + wave * depth * 0.4)
  )
}

/** Clears every pulse, e.g. when the board resets. */
export function clearStarPulse(): void {
  pulseSelected = null
  pulseHinted = null
}
