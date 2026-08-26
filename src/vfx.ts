/**
 * M2 — VFX: pooled, particle-free feedback for taps, drawn lines, and solves.
 *
 * Mobile constraints (docs/Build_Contract.md): no PBPointLight, no particle
 * systems, and no `engine.addEntity()` after startup. Every effect below is a
 * fixed pool of geometry (billboarded glow planes + stretched boxes) created
 * once in `initVfx()`. Playing an effect means finding a free pooled slot,
 * repositioning it and rewriting its material, then handing it back to the
 * pool via `VisibilityComponent` when its timer runs out -- the entity count
 * never moves after startup, same discipline as stars.ts and lines.ts.
 *
 * Two performance rules drive most of the shape of this file:
 *  - `Material.setPbrMaterial` is the expensive call, not `Transform` writes.
 *    Every glow write goes through `writeSpriteGlow`/`writeSolidGlow`, which
 *    cache the last intensity + colour actually sent and skip the call when
 *    nothing visible has changed.
 *  - `updateVfx` must stay cheap when the player is idle. Meteors and the
 *    drifting motes are the "ambient layer" and always tick (they're small
 *    pools, and the motes are frame-skipped besides); the four
 *    interaction-triggered effects only run their loops while at least one
 *    instance is actually active, gated by a single counter.
 */
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  Material,
  Billboard,
  BillboardMode,
  VisibilityComponent,
  MaterialTransparencyMode
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { DOME_CENTER, DOME_RADIUS, STAR_TEXTURE } from './config'

/* ========================================================================== *
 * Tunables
 *
 * Entity budget for this module, fixed at initVfx() and never touched again:
 *   meteors     5 slots x 2 entities (glow head + tail box)   = 10
 *   ripples     6 slots x 1 entity  (glow billboard)          =  6
 *   sparks      8 slots x 2 entities (glow head + trail box)  = 16
 *   shockwaves  2 slots x 2 entities (twin rings, offset)     =  4
 *   bursts      4 slots x 8 motes   (glow billboards)         = 32
 *   ambient     12 drifting motes   (glow billboards)         = 12
 *                                                      total  = 80  (<= 90)
 * ========================================================================== */

const METEOR_POOL_SIZE = 5
const RIPPLE_POOL_SIZE = 6
const SPARK_POOL_SIZE = 8
const SHOCKWAVE_POOL_SIZE = 2
const BURST_SLOTS = 4
const BURST_MOTES_PER_SLOT = 8
const MOTE_COUNT = 12

/** Meteors: ambient shooting stars that arc across the upper dome shell. */
const METEOR_MIN_DURATION = 1.2
const METEOR_MAX_DURATION = 2.0
const METEOR_ELEVATION_MIN_DEG = 25
const METEOR_ELEVATION_MAX_DEG = 85
/** Slightly beyond the interactive stars, in among the background starfield. */
const METEOR_SHELL_RADIUS = DOME_RADIUS + 2
const METEOR_HEAD_SCALE = 0.5
const METEOR_HEAD_GLOW = 7.0
const METEOR_TAIL_LENGTH = 2.2
const METEOR_TAIL_THICKNESS = 0.08
const METEOR_TAIL_GLOW = 5.0
const METEOR_COLOR = Color3.create(0.85, 0.9, 1.0)
const DEFAULT_METEOR_RATE = 6 // per minute

/** Ripples: the tap acknowledgement. A billboard reads better than a ring
 * mesh on a dome (no ring texture exists, and the glow sprite already sells
 * "a soft pulse of light" without one), matching the technique stars.ts and
 * dome.ts already use for every other glow in the scene. */
const RIPPLE_DURATION = 0.6
const RIPPLE_START_SCALE = 0.3
const RIPPLE_END_SCALE = 2.4
const RIPPLE_GLOW = 6.0

/** Travel sparks: sell a line as being *drawn*, not appearing. */
const SPARK_DURATION = 0.35
const SPARK_HEAD_SCALE = 0.35
const SPARK_HEAD_GLOW = 8.0
const SPARK_TRAIL_GLOW = 5.0
const SPARK_TRAIL_THICKNESS = 0.07
/** How far behind the head the trail's tail end sits, in ease-out units. */
const SPARK_TRAIL_BACK = 0.14
/** Fraction of the flight spent brightening in / fading out at each end. */
const SPARK_FADE_FRACTION = 0.18

/** Shockwaves: the solve moment. Same billboard-glow technique as ripples,
 * just scaled up -- this is the one place a bit of transparency cost is
 * clearly earning its place (docs/Build_Contract.md), and it only ever fires
 * once per board. */
const SHOCKWAVE_DURATION = 1.4
const SHOCKWAVE_RING2_DELAY = 0.25
const SHOCKWAVE_START_SCALE = 1.0
const SHOCKWAVE_END_SCALE = 14.0
const SHOCKWAVE_GLOW = 9.0

/** Bursts: motes fired outward when a correct edge completes. */
const BURST_DURATION = 0.7
const BURST_MIN_MOTES = 6
const BURST_MAX_MOTES = 8
const BURST_SPEED_MIN = 2.0
const BURST_SPEED_MAX = 3.6
/** A light downward droop over the flight, not real physics -- just enough
 * to keep the motes from looking like they're flying on rails. */
const BURST_GRAVITY = 3.0
const BURST_GLOW = 6.0
const BURST_MOTE_SCALE = 0.22

/** Ambient motes: faint depth cues drifting on independent sine paths so the
 * dome's interior never reads as frozen. Intensity is set once at init and
 * never rewritten -- only position moves, which keeps this layer's per-frame
 * cost to Transform writes alone. */
const MOTE_SCALE = 0.16
const MOTE_GLOW = 0.5
const MOTE_COLOR = Color3.create(0.6, 0.72, 1.0)
const MOTE_UPDATE_HZ = 15
const MOTE_UPDATE_INTERVAL = 1 / MOTE_UPDATE_HZ
const MOTE_AMP_MIN = 0.6
const MOTE_AMP_MAX = 2.0
const MOTE_FREQ_MIN = 0.15
const MOTE_FREQ_MAX = 0.4

/** Material writes are skipped below these deltas -- see writeSpriteGlow. */
const MAT_EPSILON = 0.05
const COLOR_EPSILON = 0.01

const WHITE = Color3.create(1, 1, 1)

/* ========================================================================== *
 * Entity accounting + small shared helpers
 * ========================================================================== */

let entityCount = 0

/** Every pooled entity in this module is created through here, so
 * vfxEntityCount() is always exactly right without a second bookkeeping pass. */
function newEntity(): Entity {
  entityCount++
  return engine.addEntity()
}

/** Tracks the last intensity + colour actually written to a slot's material,
 * so repeated calls with an unchanged (or near-unchanged) value are free. */
type GlowCache = { intensity: number; r: number; g: number; b: number }

function freshCache(): GlowCache {
  // -1 never matches a real value, so the first write always goes through.
  return { intensity: -1, r: -1, g: -1, b: -1 }
}

function colorChanged(cache: GlowCache, color: Color3): boolean {
  return (
    Math.abs(cache.r - color.r) >= COLOR_EPSILON ||
    Math.abs(cache.g - color.g) >= COLOR_EPSILON ||
    Math.abs(cache.b - color.b) >= COLOR_EPSILON
  )
}

/** Glow write for the textured, alpha-blended sprites (meteor heads, ripples,
 * spark heads, shockwave rings, burst + ambient motes) -- same recipe as
 * applyStarMaterial in stars.ts. */
function writeSpriteGlow(entity: Entity, cache: GlowCache, color: Color3, intensity: number): void {
  const clamped = Math.max(intensity, 0)
  if (Math.abs(cache.intensity - clamped) < MAT_EPSILON && !colorChanged(cache, color)) return

  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({ src: STAR_TEXTURE }),
    emissiveTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    alphaTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: color,
    emissiveIntensity: clamped,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1,
    metallic: 0
  })
  cache.intensity = clamped
  cache.r = color.r
  cache.g = color.g
  cache.b = color.b
}

/** Glow write for the solid, untextured boxes (meteor tails, spark trails) --
 * same recipe as the drawn lines in lines.ts. No alpha blending, so it costs
 * nothing extra on top of the geometry itself. */
function writeSolidGlow(entity: Entity, cache: GlowCache, color: Color3, intensity: number): void {
  const clamped = Math.max(intensity, 0)
  if (Math.abs(cache.intensity - clamped) < MAT_EPSILON && !colorChanged(cache, color)) return

  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: color,
    emissiveIntensity: clamped,
    roughness: 1
  })
  cache.intensity = clamped
  cache.r = color.r
  cache.g = color.g
  cache.b = color.b
}

/** A billboarded glow plane, hidden until an effect claims it. */
function newGlowBillboard(): Entity {
  const e = newEntity()
  Transform.create(e)
  MeshRenderer.setPlane(e)
  Billboard.create(e, { billboardMode: BillboardMode.BM_ALL })
  VisibilityComponent.create(e, { visible: false })
  return e
}

/** A solid stretched box, hidden until an effect claims it. */
function newGlowBox(): Entity {
  const e = newEntity()
  Transform.create(e)
  MeshRenderer.setBox(e)
  VisibilityComponent.create(e, { visible: false })
  return e
}

/** First free (inactive) slot in a pool, or undefined if every slot is busy.
 * Every spawn* function below treats "undefined" as "drop the request" --
 * cheap tapping or overlapping solves should never allocate, only degrade. */
function acquireFree<T extends { active: boolean }>(pool: T[]): T | undefined {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) return pool[i]
  }
  return undefined
}

function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/** Writes a unit direction vector from spherical angles into `out`, avoiding
 * a fresh Vector3 allocation for the common case of refreshing an existing
 * slot's direction. */
function setUnitDirFromSpherical(out: Vector3.MutableVector3, azimuth: number, elevation: number): void {
  const cosEl = Math.cos(elevation)
  out.x = Math.cos(azimuth) * cosEl
  out.y = Math.sin(elevation)
  out.z = Math.sin(azimuth) * cosEl
}

/* ========================================================================== *
 * Meteors (ambient)
 * ========================================================================== */

type MeteorSlot = {
  head: Entity
  tail: Entity
  headCache: GlowCache
  tailCache: GlowCache
  active: boolean
  t: number
  duration: number
  entryDir: Vector3.MutableVector3
  exitDir: Vector3.MutableVector3
  travelDir: Vector3.MutableVector3
}

const meteors: MeteorSlot[] = []
let meteorRate = DEFAULT_METEOR_RATE
let meteorTimer = 0

function createMeteorPool(): void {
  for (let i = 0; i < METEOR_POOL_SIZE; i++) {
    const head = newGlowBillboard()
    Transform.getMutable(head).scale = Vector3.scale(Vector3.One(), METEOR_HEAD_SCALE)
    const headCache = freshCache()
    writeSpriteGlow(head, headCache, METEOR_COLOR, 0)

    const tail = newGlowBox()
    const tailCache = freshCache()
    writeSolidGlow(tail, tailCache, METEOR_COLOR, 0)

    meteors.push({
      head,
      tail,
      headCache,
      tailCache,
      active: false,
      t: 0,
      duration: METEOR_MIN_DURATION,
      entryDir: Vector3.Zero(),
      exitDir: Vector3.Zero(),
      travelDir: Vector3.Up()
    })
  }
}

/** Average seconds between launches, jittered +/-40% so meteors never feel
 * metronomic. A non-positive rate is handled by the caller (updateMeteors). */
function nextMeteorInterval(): number {
  const average = 60 / meteorRate
  return average * (0.6 + Math.random() * 0.8)
}

function launchMeteor(): void {
  const slot = acquireFree(meteors)
  if (!slot) return

  slot.active = true
  slot.t = 0
  slot.duration = METEOR_MIN_DURATION + Math.random() * (METEOR_MAX_DURATION - METEOR_MIN_DURATION)

  const entryEl = degToRad(METEOR_ELEVATION_MIN_DEG + Math.random() * (METEOR_ELEVATION_MAX_DEG - METEOR_ELEVATION_MIN_DEG))
  const exitEl = degToRad(METEOR_ELEVATION_MIN_DEG + Math.random() * (METEOR_ELEVATION_MAX_DEG - METEOR_ELEVATION_MIN_DEG))
  setUnitDirFromSpherical(slot.entryDir, Math.random() * Math.PI * 2, entryEl)
  setUnitDirFromSpherical(slot.exitDir, Math.random() * Math.PI * 2, exitEl)

  // The tail's facing uses the entry->exit chord rather than the true local
  // tangent of the arc: the flight is under two seconds, so a fixed
  // orientation is visually indistinguishable and costs nothing per frame.
  const chord = Vector3.subtract(slot.exitDir, slot.entryDir)
  slot.travelDir = Vector3.length(chord) > 0.001 ? Vector3.normalize(chord) : Vector3.Up()

  VisibilityComponent.getMutable(slot.head).visible = true
  VisibilityComponent.getMutable(slot.tail).visible = true
}

function updateMeteors(dt: number): void {
  if (meteorRate > 0) {
    meteorTimer -= dt
    if (meteorTimer <= 0) {
      launchMeteor()
      meteorTimer = nextMeteorInterval()
    }
  }

  for (let i = 0; i < meteors.length; i++) {
    const m = meteors[i]
    if (!m.active) continue

    m.t += dt / m.duration
    if (m.t >= 1) {
      VisibilityComponent.getMutable(m.head).visible = false
      VisibilityComponent.getMutable(m.tail).visible = false
      m.active = false
      continue
    }

    // normalize(lerp(unit dirs)) approximates a great-circle arc cheaply --
    // no trig needed per frame, just a lerp + normalize.
    const dir = Vector3.normalize(Vector3.lerp(m.entryDir, m.exitDir, m.t))
    const pos = Vector3.add(Vector3.scale(dir, METEOR_SHELL_RADIUS), DOME_CENTER)

    // sin(pi * t): 0 at launch, 1 at the midpoint, 0 at arrival -- brightens
    // in and fades out so the meteor never pops.
    const envelope = Math.sin(Math.PI * m.t)

    Transform.getMutable(m.head).position = pos
    writeSpriteGlow(m.head, m.headCache, METEOR_COLOR, METEOR_HEAD_GLOW * envelope)

    const tailOffset = METEOR_TAIL_LENGTH * 0.5 + METEOR_HEAD_SCALE * 0.4
    const tailPos = Vector3.subtract(pos, Vector3.scale(m.travelDir, tailOffset))
    const tailT = Transform.getMutable(m.tail)
    tailT.position = tailPos
    tailT.rotation = Quaternion.lookRotation(m.travelDir)
    tailT.scale = Vector3.create(METEOR_TAIL_THICKNESS, METEOR_TAIL_THICKNESS, METEOR_TAIL_LENGTH)
    writeSolidGlow(m.tail, m.tailCache, METEOR_COLOR, METEOR_TAIL_GLOW * envelope)
  }
}

/** Sets the average meteor launch rate. 0 (or negative) parks the timer --
 * any meteor already in flight still plays out. */
export function setMeteorRate(perMinute: number): void {
  meteorRate = Math.max(0, perMinute)
}

/* ========================================================================== *
 * Ripples (tap ack)
 * ========================================================================== */

type RippleSlot = {
  entity: Entity
  cache: GlowCache
  active: boolean
  t: number
  color: Color3
}

const ripples: RippleSlot[] = []
let activeCount = 0 // ripples + sparks + shockwaves + bursts currently playing

function createRipplePool(): void {
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const entity = newGlowBillboard()
    Transform.getMutable(entity).scale = Vector3.scale(Vector3.One(), RIPPLE_START_SCALE)
    const cache = freshCache()
    writeSpriteGlow(entity, cache, WHITE, 0)
    ripples.push({ entity, cache, active: false, t: 0, color: WHITE })
  }
}

/** An expanding ring (billboarded glow) at a star's position, for tap feedback. */
export function spawnRipple(position: Vector3, color: Color3): void {
  const slot = acquireFree(ripples)
  if (!slot) return

  slot.active = true
  slot.t = 0
  slot.color = color
  Transform.getMutable(slot.entity).position = Vector3.create(position.x, position.y, position.z)
  Transform.getMutable(slot.entity).scale = Vector3.scale(Vector3.One(), RIPPLE_START_SCALE)
  VisibilityComponent.getMutable(slot.entity).visible = true
  activeCount++
}

function updateRipples(dt: number): void {
  for (let i = 0; i < ripples.length; i++) {
    const r = ripples[i]
    if (!r.active) continue

    r.t += dt / RIPPLE_DURATION
    if (r.t >= 1) {
      VisibilityComponent.getMutable(r.entity).visible = false
      r.active = false
      activeCount--
      continue
    }

    const ease = 1 - (1 - r.t) * (1 - r.t) // ease-out: grows fast, settles
    const scale = RIPPLE_START_SCALE + (RIPPLE_END_SCALE - RIPPLE_START_SCALE) * ease
    Transform.getMutable(r.entity).scale = Vector3.create(scale, scale, scale)
    writeSpriteGlow(r.entity, r.cache, r.color, RIPPLE_GLOW * (1 - r.t))
  }
}

/* ========================================================================== *
 * Travel sparks (line being drawn)
 * ========================================================================== */

type SparkSlot = {
  head: Entity
  trail: Entity
  headCache: GlowCache
  trailCache: GlowCache
  active: boolean
  t: number
  a: Vector3.MutableVector3
  b: Vector3.MutableVector3
  color: Color3
}

const sparks: SparkSlot[] = []

function createSparkPool(): void {
  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const head = newGlowBillboard()
    Transform.getMutable(head).scale = Vector3.scale(Vector3.One(), SPARK_HEAD_SCALE)
    const headCache = freshCache()
    writeSpriteGlow(head, headCache, WHITE, 0)

    const trail = newGlowBox()
    const trailCache = freshCache()
    writeSolidGlow(trail, trailCache, WHITE, 0)

    sparks.push({
      head,
      trail,
      headCache,
      trailCache,
      active: false,
      t: 0,
      a: Vector3.Zero(),
      b: Vector3.Zero(),
      color: WHITE
    })
  }
}

/** A bright mote flying a -> b with a brightening trail, so a drawn line
 * reads as being drawn rather than just appearing. */
export function spawnTravelSpark(a: Vector3, b: Vector3, color: Color3): void {
  const slot = acquireFree(sparks)
  if (!slot) return

  slot.active = true
  slot.t = 0
  slot.color = color
  // `a`/`b` are typically a star's live (mutable) position, which keeps
  // changing after this call returns -- copy the values, not the reference.
  slot.a.x = a.x
  slot.a.y = a.y
  slot.a.z = a.z
  slot.b.x = b.x
  slot.b.y = b.y
  slot.b.z = b.z

  VisibilityComponent.getMutable(slot.head).visible = true
  VisibilityComponent.getMutable(slot.trail).visible = true
  activeCount++
}

function updateSparks(dt: number): void {
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i]
    if (!s.active) continue

    s.t += dt / SPARK_DURATION
    if (s.t >= 1) {
      VisibilityComponent.getMutable(s.head).visible = false
      VisibilityComponent.getMutable(s.trail).visible = false
      s.active = false
      activeCount--
      continue
    }

    // Trapezoid envelope: brighten in, hold, fade out -- never pops either end.
    const envelope =
      s.t < SPARK_FADE_FRACTION
        ? s.t / SPARK_FADE_FRACTION
        : s.t > 1 - SPARK_FADE_FRACTION
          ? (1 - s.t) / SPARK_FADE_FRACTION
          : 1

    const eased = 1 - (1 - s.t) * (1 - s.t) * (1 - s.t) // ease-out cubic
    const headPos = Vector3.lerp(s.a, s.b, eased)
    Transform.getMutable(s.head).position = headPos
    writeSpriteGlow(s.head, s.headCache, s.color, SPARK_HEAD_GLOW * envelope)

    const trailEased = Math.max(0, eased - SPARK_TRAIL_BACK)
    const trailPos = Vector3.lerp(s.a, s.b, trailEased)
    const delta = Vector3.subtract(headPos, trailPos)
    const length = Vector3.length(delta)

    const trailT = Transform.getMutable(s.trail)
    trailT.position = Vector3.lerp(trailPos, headPos, 0.5)
    if (length > 0.001) trailT.rotation = Quaternion.lookRotation(Vector3.normalize(delta))
    trailT.scale = Vector3.create(SPARK_TRAIL_THICKNESS, SPARK_TRAIL_THICKNESS, length)
    writeSolidGlow(s.trail, s.trailCache, s.color, SPARK_TRAIL_GLOW * envelope)
  }
}

/* ========================================================================== *
 * Shockwaves (solve moment)
 * ========================================================================== */

type ShockwaveSlot = {
  ring1: Entity
  ring2: Entity
  cache1: GlowCache
  cache2: GlowCache
  active: boolean
  t: number
  ring2Started: boolean
  center: Vector3.MutableVector3
  color: Color3
}

const shockwaves: ShockwaveSlot[] = []

function createShockwavePool(): void {
  for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
    const ring1 = newGlowBillboard()
    const cache1 = freshCache()
    writeSpriteGlow(ring1, cache1, WHITE, 0)

    const ring2 = newGlowBillboard()
    const cache2 = freshCache()
    writeSpriteGlow(ring2, cache2, WHITE, 0)

    shockwaves.push({
      ring1,
      ring2,
      cache1,
      cache2,
      active: false,
      t: 0,
      ring2Started: false,
      center: Vector3.Zero(),
      color: WHITE
    })
  }
}

/** The clip-worthy beat: a big ring expanding from ~1m to ~14m, with a second
 * ring 0.25s behind it for depth. */
export function spawnShockwave(center: Vector3, color: Color3): void {
  const slot = acquireFree(shockwaves)
  if (!slot) return

  slot.active = true
  slot.t = 0
  slot.ring2Started = false
  slot.color = color
  slot.center.x = center.x
  slot.center.y = center.y
  slot.center.z = center.z

  const pos = Vector3.create(center.x, center.y, center.z)
  Transform.getMutable(slot.ring1).position = pos
  Transform.getMutable(slot.ring1).scale = Vector3.scale(Vector3.One(), SHOCKWAVE_START_SCALE)
  Transform.getMutable(slot.ring2).position = Vector3.create(center.x, center.y, center.z)
  VisibilityComponent.getMutable(slot.ring1).visible = true
  // ring2 stays hidden until its delayed start, in updateShockwaves.
  activeCount++
}

function updateShockwaveRing(entity: Entity, cache: GlowCache, progress: number, color: Color3): void {
  const clamped = Math.min(progress, 1)
  const ease = 1 - (1 - clamped) * (1 - clamped)
  const scale = SHOCKWAVE_START_SCALE + (SHOCKWAVE_END_SCALE - SHOCKWAVE_START_SCALE) * ease
  Transform.getMutable(entity).scale = Vector3.create(scale, scale, scale)
  writeSpriteGlow(entity, cache, color, SHOCKWAVE_GLOW * (1 - clamped))
}

function updateShockwaves(dt: number): void {
  for (let i = 0; i < shockwaves.length; i++) {
    const s = shockwaves[i]
    if (!s.active) continue

    s.t += dt / SHOCKWAVE_DURATION
    if (s.t >= 1) {
      VisibilityComponent.getMutable(s.ring1).visible = false
      VisibilityComponent.getMutable(s.ring2).visible = false
      s.active = false
      activeCount--
      continue
    }

    updateShockwaveRing(s.ring1, s.cache1, s.t, s.color)

    const ring2Progress = s.t - SHOCKWAVE_RING2_DELAY / SHOCKWAVE_DURATION
    if (ring2Progress >= 0) {
      if (!s.ring2Started) {
        VisibilityComponent.getMutable(s.ring2).visible = true
        s.ring2Started = true
      }
      updateShockwaveRing(s.ring2, s.cache2, ring2Progress, s.color)
    }
  }
}

/* ========================================================================== *
 * Bursts (correct edge completes)
 * ========================================================================== */

type BurstMote = {
  entity: Entity
  cache: GlowCache
  dirX: number
  dirY: number
  dirZ: number
  speed: number
}

type BurstSlot = {
  motes: BurstMote[]
  active: boolean
  t: number
  activeMotes: number
  center: Vector3.MutableVector3
  color: Color3
}

const bursts: BurstSlot[] = []

function createBurstPool(): void {
  for (let i = 0; i < BURST_SLOTS; i++) {
    const motes: BurstMote[] = []
    for (let j = 0; j < BURST_MOTES_PER_SLOT; j++) {
      const entity = newGlowBillboard()
      Transform.getMutable(entity).scale = Vector3.scale(Vector3.One(), BURST_MOTE_SCALE)
      const cache = freshCache()
      writeSpriteGlow(entity, cache, WHITE, 0)
      motes.push({ entity, cache, dirX: 0, dirY: 0, dirZ: 0, speed: 0 })
    }
    bursts.push({ motes, active: false, t: 0, activeMotes: 0, center: Vector3.Zero(), color: WHITE })
  }
}

/** 6-8 small motes fired radially outward from a point, with a light droop
 * and a fade. If every burst slot is busy the request is dropped silently --
 * per the Build_Contract, this pool never allocates. */
export function spawnBurst(position: Vector3, color: Color3): void {
  const slot = acquireFree(bursts)
  if (!slot) return

  slot.active = true
  slot.t = 0
  slot.color = color
  slot.center.x = position.x
  slot.center.y = position.y
  slot.center.z = position.z
  slot.activeMotes = BURST_MIN_MOTES + Math.floor(Math.random() * (BURST_MAX_MOTES - BURST_MIN_MOTES + 1))

  for (let i = 0; i < slot.motes.length; i++) {
    const mote = slot.motes[i]
    const isActive = i < slot.activeMotes
    VisibilityComponent.getMutable(mote.entity).visible = isActive
    if (!isActive) continue

    // Uniform-ish random direction on the unit sphere -- cheap, no rejection
    // sampling needed for a handful of short-lived motes.
    const azimuth = Math.random() * Math.PI * 2
    const elevation = (Math.random() - 0.5) * Math.PI
    const cosEl = Math.cos(elevation)
    mote.dirX = Math.cos(azimuth) * cosEl
    mote.dirY = Math.sin(elevation)
    mote.dirZ = Math.sin(azimuth) * cosEl
    mote.speed = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN)
    Transform.getMutable(mote.entity).position = Vector3.create(position.x, position.y, position.z)
  }
  activeCount++
}

function updateBursts(dt: number): void {
  for (let i = 0; i < bursts.length; i++) {
    const b = bursts[i]
    if (!b.active) continue

    b.t += dt / BURST_DURATION
    if (b.t >= 1) {
      for (let j = 0; j < b.activeMotes; j++) {
        VisibilityComponent.getMutable(b.motes[j].entity).visible = false
      }
      b.active = false
      activeCount--
      continue
    }

    const fade = 1 - b.t
    const droop = BURST_GRAVITY * b.t * b.t
    for (let j = 0; j < b.activeMotes; j++) {
      const mote = b.motes[j]
      const dist = mote.speed * b.t
      // Scalar arithmetic instead of chained Vector3 ops -- this loop runs
      // for every active mote in every active burst, so it's worth avoiding
      // the extra temporaries add/scale would otherwise allocate.
      const x = b.center.x + mote.dirX * dist
      const y = b.center.y + mote.dirY * dist - droop
      const z = b.center.z + mote.dirZ * dist
      Transform.getMutable(mote.entity).position = Vector3.create(x, y, z)
      writeSpriteGlow(mote.entity, mote.cache, b.color, BURST_GLOW * fade)
    }
  }
}

/* ========================================================================== *
 * Ambient drifting motes
 * ========================================================================== */

type AmbientMote = {
  entity: Entity
  baseX: number
  baseY: number
  baseZ: number
  ampX: number
  ampY: number
  ampZ: number
  freqX: number
  freqY: number
  freqZ: number
  phaseX: number
  phaseY: number
  phaseZ: number
}

const motes: AmbientMote[] = []
let moteClock = 0
let moteAccum = 0

function createAmbientMotes(): void {
  for (let i = 0; i < MOTE_COUNT; i++) {
    const entity = newGlowBillboard()
    Transform.getMutable(entity).scale = Vector3.scale(Vector3.One(), MOTE_SCALE)
    VisibilityComponent.getMutable(entity).visible = true
    const cache = freshCache()
    writeSpriteGlow(entity, cache, MOTE_COLOR, MOTE_GLOW)

    // Scattered through the dome's interior volume (not just the shell), at a
    // height comfortably above the floor.
    const azimuth = Math.random() * Math.PI * 2
    const horizontalRadius = 3 + Math.random() * (DOME_RADIUS * 0.7)
    const height = 1.5 + Math.random() * (DOME_RADIUS * 0.65)

    motes.push({
      entity,
      baseX: DOME_CENTER.x + Math.cos(azimuth) * horizontalRadius,
      baseY: DOME_CENTER.y + height,
      baseZ: DOME_CENTER.z + Math.sin(azimuth) * horizontalRadius,
      ampX: MOTE_AMP_MIN + Math.random() * (MOTE_AMP_MAX - MOTE_AMP_MIN),
      ampY: MOTE_AMP_MIN + Math.random() * (MOTE_AMP_MAX - MOTE_AMP_MIN),
      ampZ: MOTE_AMP_MIN + Math.random() * (MOTE_AMP_MAX - MOTE_AMP_MIN),
      freqX: MOTE_FREQ_MIN + Math.random() * (MOTE_FREQ_MAX - MOTE_FREQ_MIN),
      freqY: MOTE_FREQ_MIN + Math.random() * (MOTE_FREQ_MAX - MOTE_FREQ_MIN),
      freqZ: MOTE_FREQ_MIN + Math.random() * (MOTE_FREQ_MAX - MOTE_FREQ_MIN),
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2
    })
  }
}

/** Advances the ambient drift. The sine clock always ticks with real time so
 * motion speed stays correct, but the Transform writes themselves are
 * throttled to ~MOTE_UPDATE_HZ -- nobody can tell 12 faint background motes
 * apart from a full-framerate version of themselves. */
function updateAmbientMotes(dt: number): void {
  moteClock += dt
  moteAccum += dt
  if (moteAccum < MOTE_UPDATE_INTERVAL) return
  moteAccum = 0

  for (let i = 0; i < motes.length; i++) {
    const m = motes[i]
    const x = m.baseX + Math.sin(moteClock * m.freqX + m.phaseX) * m.ampX
    const y = m.baseY + Math.sin(moteClock * m.freqY + m.phaseY) * m.ampY
    const z = m.baseZ + Math.sin(moteClock * m.freqZ + m.phaseZ) * m.ampZ
    Transform.getMutable(m.entity).position = Vector3.create(x, y, z)
  }
}

/* ========================================================================== *
 * Public API
 * ========================================================================== */

/** Builds every pool. Call once, before the first effect can be spawned. */
export function initVfx(): void {
  createMeteorPool()
  createRipplePool()
  createSparkPool()
  createShockwavePool()
  createBurstPool()
  createAmbientMotes()
  meteorTimer = nextMeteorInterval()
}

/**
 * Drives every effect. Meteors and the ambient motes are cheap enough to
 * tick unconditionally (a 5-slot pool and a frame-skipped 12-mote pool); the
 * four interaction-triggered effects share `activeCount` and are skipped
 * entirely -- one comparison -- whenever none of them are playing.
 */
export function updateVfx(dt: number): void {
  updateMeteors(dt)
  updateAmbientMotes(dt)

  if (activeCount === 0) return

  updateRipples(dt)
  updateSparks(dt)
  updateShockwaves(dt)
  updateBursts(dt)
}

/** Total pooled entity count, fixed after initVfx() -- see the budget table
 * in the tunables block above. */
export function vfxEntityCount(): number {
  return entityCount
}
