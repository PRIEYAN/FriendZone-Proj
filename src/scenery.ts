/**
 * Observatory dressing: telescope, floor compass rose, horizon silhouette,
 * moon, and seating.
 *
 * dome.ts already lays down the floor and a faint horizon ring; this module
 * only builds on top of that so the room reads as a place someone furnished,
 * not just a dark cylinder with a starfield over it (concept goal: "the first
 * three seconds read as 'somewhere' rather than 'a void with dots'").
 *
 * Everything below is created once in createScenery() and never removed or
 * recreated afterwards (Build_Contract.md: "Entity budget... flat for the
 * session... never engine.addEntity() after main() has run"). The only things
 * that move after that are a couple of very slow, heavily-throttled animations
 * driven by updateScenery(): a rotating decorative ring on the compass rose
 * and a breathing glow on the telescope's rim. No point lights and no particle
 * systems are used anywhere here -- every glow is emissiveColor/emissiveIntensity
 * on a PBR material, per the mobile platform constraints.
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
  ColliderLayer,
  MaterialTransparencyMode
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { COLOR, DOME_CENTER, DOME_RADIUS, STAR_TEXTURE } from './config'

const DEG2RAD = Math.PI / 180

// ---------------------------------------------------------------------------
// Tunables. Everything this module needs lives here so the geometry functions
// below read as pure layout code. Nothing here is imported by, or written to,
// config.ts -- this module owns its own constants per the Build Contract.
// ---------------------------------------------------------------------------

const TELESCOPE = {
  /**
   * A few metres off dome centre so it never sits on the spawn's forward+up
   * sightline (spawn is ~(16, 0.2, 16) facing +Z and looking up). Offsetting
   * into the -Z/+X quadrant puts it behind-and-beside that view instead of
   * blocking it.
   */
  offset: Vector3.create(3.2, 0, -2.4),
  plinthSize: Vector3.create(1.3, 0.9, 1.3),
  plinthColor: Color4.create(0.05, 0.05, 0.07, 1),
  barrelRadius: 0.22,
  barrelLength: 2.6,
  barrelPitchDeg: 58,
  /**
   * The barrel's compass heading: the same one the moon sits on, so the prop
   * reads as aimed at something rather than at an arbitrary angle. The pitch
   * above is chosen for silhouette instead — steep enough to be unmistakably a
   * telescope from across the room, which matters more than sighting any one
   * object the player cannot look through it at anyway.
   */
  barrelAzimuthDeg: 311,
  barrelColor: Color4.create(0.045, 0.045, 0.05, 1),
  rimRadius: 0.34,
  rimHeight: 0.06,
  rimColor: Color3.create(0.9, 0.78, 0.5),
  rimGlow: 2.0,
  stripeThickness: 0.05,
  stripeColor: Color3.create(0.85, 0.72, 0.48),
  stripeGlow: 1.1
} as const

const COMPASS = {
  hubRadius: 1.0,
  midRadius: 3.5,
  outerRadius: 6.5,
  ringHeight: 0.02,
  ringColor: COLOR.backgroundStar,
  hubGlow: 0.9,
  midGlow: 0.7,
  outerGlow: 0.55,
  spokeCount: 8,
  spokeInnerRadius: 1.1,
  spokeOuterRadius: 6.3,
  spokeWidth: 0.12,
  spokeThickness: 0.015,
  spokeGlow: 0.5,
  cardinalRadius: 6.9,
  cardinalSize: Vector3.create(0.6, 0.02, 0.3),
  cardinalGlow: 1.7,
  cardinalColor: Color3.create(1.0, 0.9, 0.65),
  rotatingTickCount: 8,
  rotatingTickRadius: 7.2,
  rotatingTickSize: Vector3.create(0.32, 0.015, 0.1),
  rotatingTickGlow: 0.6
} as const

/**
 * The horizon ridge.
 *
 * Height is not a taste decision, it is a constraint. The ridge sits at radius
 * ~14 and the stars sit on the shell at radius 15, so from the middle of the
 * room a piece of height h hides everything below atan(h / 14). The lowest
 * interactive star in the whole game is Scorpius at 15 degrees of elevation,
 * and 14 * tan(15) is 3.75m -- so the original 5.6m ridge was quietly eating
 * the bottom of a constellation the player is asked to solve.
 *
 * 2.2m caps the ridge at about 9 degrees from the centre of the dome, which
 * clears every star and the moon with room to spare. Raise this and you will
 * bury Scorpius.
 */
const HORIZON = {
  pieceCount: 26,
  radiusBase: 14.0,
  radiusJitter: 0.8,
  heightMin: 0.8,
  heightMax: 2.2,
  widthMin: 1.6,
  widthMax: 3.4,
  depth: 0.6,
  azJitterDeg: 4,
  albedo: Color4.create(0.015, 0.015, 0.02, 1),
  seed: 20260826
} as const

const MOON = {
  /**
   * Parked in a genuine hole in the sky.
   *
   * The ten constellations occupy these azimuth bands (centre +- spreadAz/2):
   * Big Dipper 337-23, Crux 32-48, Aquila 57-79, Scorpius 87-121, Orion
   * 130-170, Corvus 179-197, Lyra 205-223, Cygnus 232-262, Cassiopeia 270-306,
   * Triangulum 316-328. The widest gap between neighbours is 306-316, so 311
   * is the one azimuth with clearance on both sides.
   *
   * Elevation 20 keeps it low in the sky without putting it behind the
   * horizon ridge, which caps out around 9 degrees (see HORIZON above).
   */
  azimuthDeg: 311,
  elevationDeg: 20,
  diameter: 2.0,
  color: Color3.create(0.85, 0.83, 0.78),
  glow: 3.2,
  haloScale: 5.5,
  haloColor: Color3.create(0.8, 0.82, 0.9),
  haloGlow: 1.3
} as const

const BENCH = {
  azimuthsDeg: [70, 190, 320] as const,
  radius: 8.5,
  seatSize: Vector3.create(1.6, 0.45, 0.6),
  seatColor: Color4.create(0.05, 0.05, 0.08, 1),
  stripSize: Vector3.create(1.5, 0.03, 0.08),
  stripColor: COLOR.backgroundStar,
  stripGlow: 1.2
} as const

const ANIMATION = {
  /** ~10Hz cap on the whole module's per-frame work, per the perf budget. */
  tickSeconds: 0.1,
  /** Full turn every five minutes -- background motion, never distracting. */
  compassDegPerSec: 1.2,
  /** One breath roughly every 7 seconds. */
  breathHz: 0.15,
  breathDepth: 0.35
} as const

// ---------------------------------------------------------------------------
// Small geometry helpers shared by every prop below.
// ---------------------------------------------------------------------------

/** Deterministic PRNG (same technique as dome.ts) so the horizon is identical on every client. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Unit horizontal direction for a compass azimuth (0 = +Z, matching constellations.ts). */
function radialDir(azimuthDeg: number): Vector3.MutableVector3 {
  const az = azimuthDeg * DEG2RAD
  return Vector3.create(Math.sin(az), 0, Math.cos(az))
}

/** Unit horizontal direction tangential to radialDir(azimuthDeg) -- perpendicular, still flat. */
function tangentDir(azimuthDeg: number): Vector3.MutableVector3 {
  const az = azimuthDeg * DEG2RAD
  return Vector3.create(Math.cos(az), 0, -Math.sin(az))
}

/**
 * Rotation that carries a primitive's local +Y axis (the long axis of our
 * cylinders, and the axis we treat as "length" for oriented boxes) onto `dir`.
 * Used instead of hand-picked Euler angles so position and orientation are
 * always derived from the same direction vector and can't drift apart.
 */
function alignUpTo(dir: Vector3.ReadonlyVector3): Quaternion.MutableQuaternion {
  return Quaternion.fromToRotation(Vector3.Up(), dir)
}

/** Same idea, but for boxes whose length runs along local +X (spokes, ticks, horizon slabs). */
function alignRightTo(dir: Vector3.ReadonlyVector3): Quaternion.MutableQuaternion {
  return Quaternion.fromToRotation(Vector3.Right(), dir)
}

let entityCount = 0

/** engine.addEntity() wrapper that keeps sceneryEntityCount() accurate without a second pass. */
function newEntity(): Entity {
  entityCount++
  return engine.addEntity()
}

function darkMaterial(entity: Entity, albedo: Color4): void {
  Material.setPbrMaterial(entity, {
    albedoColor: albedo,
    emissiveColor: Color3.Black(),
    emissiveIntensity: 0,
    roughness: 1,
    metallic: 0
  })
}

function glowMaterial(entity: Entity, color: Color3, intensity: number, albedo?: Color4): void {
  Material.setPbrMaterial(entity, {
    albedoColor: albedo ?? Color4.create(0.03, 0.03, 0.04, 1),
    emissiveColor: color,
    emissiveIntensity: intensity,
    roughness: 1,
    metallic: 0
  })
}

/** Alpha-blended glow sprite, same texture and blend mode as the interactive stars. */
function glowSpriteMaterial(entity: Entity, color: Color3, intensity: number): void {
  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({ src: STAR_TEXTURE }),
    emissiveTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    alphaTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: color,
    emissiveIntensity: intensity,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1,
    metallic: 0
  })
}

// ---------------------------------------------------------------------------
// Mutable animation state, filled in by createScenery().
// ---------------------------------------------------------------------------

let telescopeRim: Entity | null = null
let compassRotatingRoot: Entity | null = null
let updateAccumulator = 0
let compassAngleDeg = 0
let breathClock = 0

export function createScenery(): void {
  createTelescope()
  createCompassRose()
  createHorizonSilhouette()
  createMoon()
  createBenches()
}

export function sceneryEntityCount(): number {
  return entityCount
}

// ---------------------------------------------------------------------------
// The telescope: a plinth (the only collider in this whole module), a barrel
// aimed at the moon's patch of sky, and two thin glow accents. Built entirely
// from two boxes and two cylinders, per the module's "keep it cheap" brief.
// ---------------------------------------------------------------------------

function createTelescope(): void {
  const base = Vector3.create(
    DOME_CENTER.x + TELESCOPE.offset.x,
    0,
    DOME_CENTER.z + TELESCOPE.offset.z
  )

  const plinth = newEntity()
  Transform.create(plinth, {
    position: Vector3.create(base.x, TELESCOPE.plinthSize.y / 2, base.z),
    scale: TELESCOPE.plinthSize
  })
  MeshRenderer.setBox(plinth)
  // The only collider this module places near the room's centre. Slim and on
  // the base only, so players read the telescope as solid without it boxing
  // anyone in -- the barrel above head height is walk-under-able in practice.
  MeshCollider.setBox(plinth, ColliderLayer.CL_PHYSICS)
  darkMaterial(plinth, TELESCOPE.plinthColor)

  const mountPos = Vector3.create(base.x, TELESCOPE.plinthSize.y, base.z)
  const dir = Vector3.normalize(
    Vector3.create(
      Math.sin(TELESCOPE.barrelAzimuthDeg * DEG2RAD) * Math.cos(TELESCOPE.barrelPitchDeg * DEG2RAD),
      Math.sin(TELESCOPE.barrelPitchDeg * DEG2RAD),
      Math.cos(TELESCOPE.barrelAzimuthDeg * DEG2RAD) * Math.cos(TELESCOPE.barrelPitchDeg * DEG2RAD)
    )
  )
  const rotation = alignUpTo(dir)
  const barrelCenter = Vector3.add(mountPos, Vector3.scale(dir, TELESCOPE.barrelLength / 2))

  const barrel = newEntity()
  Transform.create(barrel, {
    position: barrelCenter,
    rotation,
    scale: Vector3.create(TELESCOPE.barrelRadius * 2, TELESCOPE.barrelLength, TELESCOPE.barrelRadius * 2)
  })
  MeshRenderer.setCylinder(barrel, 1, 1)
  darkMaterial(barrel, TELESCOPE.barrelColor)

  // A faint emissive rim at the sky end (the "eyepiece" bezel, decoratively
  // placed at whichever end reads best -- this is a prop, not an instrument).
  const rimPos = Vector3.add(mountPos, Vector3.scale(dir, TELESCOPE.barrelLength))
  const rim = newEntity()
  Transform.create(rim, {
    position: rimPos,
    rotation,
    scale: Vector3.create(TELESCOPE.rimRadius * 2, TELESCOPE.rimHeight, TELESCOPE.rimRadius * 2)
  })
  MeshRenderer.setCylinder(rim, 1, 1)
  glowMaterial(rim, TELESCOPE.rimColor, TELESCOPE.rimGlow)
  telescopeRim = rim

  // A thin glowing stripe along the barrel's side -- "a faint emissive rim...
  // along the barrel". Offset perpendicular to the barrel's own axis so it
  // sits on the tube's surface instead of buried inside it.
  const perp = Vector3.normalize(Vector3.cross(dir, Vector3.Up()))
  const stripePos = Vector3.add(barrelCenter, Vector3.scale(perp, TELESCOPE.barrelRadius + 0.03))
  const stripe = newEntity()
  Transform.create(stripe, {
    position: stripePos,
    rotation,
    scale: Vector3.create(
      TELESCOPE.stripeThickness,
      TELESCOPE.barrelLength * 0.85,
      TELESCOPE.stripeThickness
    )
  })
  MeshRenderer.setBox(stripe)
  glowMaterial(stripe, TELESCOPE.stripeColor, TELESCOPE.stripeGlow)
}

// ---------------------------------------------------------------------------
// Floor compass rose. Stacked flat discs (same "reveal an edge" trick dome.ts
// uses for its horizon ring) give the concentric rings, thin boxes give the
// spokes and cardinal ticks. The cardinal ticks are static on purpose --
// they are what the wayfinding HUD's "turn left" actually refers to, so
// they must never move. Only a separate, purely decorative ring of dashes
// rotates (see updateScenery).
// ---------------------------------------------------------------------------

function createCompassRose(): void {
  const outer = newEntity()
  Transform.create(outer, {
    position: Vector3.create(DOME_CENTER.x, 0.082, DOME_CENTER.z),
    scale: Vector3.create(COMPASS.outerRadius * 2, COMPASS.ringHeight, COMPASS.outerRadius * 2)
  })
  MeshRenderer.setCylinder(outer, 1, 1)
  glowMaterial(outer, COMPASS.ringColor, COMPASS.outerGlow)

  const mid = newEntity()
  Transform.create(mid, {
    position: Vector3.create(DOME_CENTER.x, 0.1, DOME_CENTER.z),
    scale: Vector3.create(COMPASS.midRadius * 2, COMPASS.ringHeight, COMPASS.midRadius * 2)
  })
  MeshRenderer.setCylinder(mid, 1, 1)
  glowMaterial(mid, COMPASS.ringColor, COMPASS.midGlow)

  const hub = newEntity()
  Transform.create(hub, {
    position: Vector3.create(DOME_CENTER.x, 0.115, DOME_CENTER.z),
    scale: Vector3.create(COMPASS.hubRadius * 2, COMPASS.ringHeight, COMPASS.hubRadius * 2)
  })
  MeshRenderer.setCylinder(hub, 1, 1)
  glowMaterial(hub, COMPASS.ringColor, COMPASS.hubGlow)

  const spokeMidRadius = (COMPASS.spokeInnerRadius + COMPASS.spokeOuterRadius) / 2
  const spokeLength = COMPASS.spokeOuterRadius - COMPASS.spokeInnerRadius
  for (let i = 0; i < COMPASS.spokeCount; i++) {
    const az = (360 / COMPASS.spokeCount) * i
    const dir = radialDir(az)
    const spoke = newEntity()
    Transform.create(spoke, {
      position: Vector3.add(DOME_CENTER, Vector3.scale(dir, spokeMidRadius)),
      rotation: alignRightTo(dir),
      position2: undefined
    } as any)
    Transform.getMutable(spoke).position = Vector3.create(
      DOME_CENTER.x + dir.x * spokeMidRadius,
      0.13,
      DOME_CENTER.z + dir.z * spokeMidRadius
    )
    MeshRenderer.setBox(spoke)
    glowMaterial(spoke, COMPASS.ringColor, COMPASS.spokeGlow)
  }

  // Cardinal ticks: brighter, larger, sitting just outside the outer ring.
  for (const az of [0, 90, 180, 270]) {
    const dir = radialDir(az)
    const tick = newEntity()
    Transform.create(tick, {
      position: Vector3.create(
        DOME_CENTER.x + dir.x * COMPASS.cardinalRadius,
        0.13,
        DOME_CENTER.z + dir.z * COMPASS.cardinalRadius
      ),
      rotation: alignRightTo(dir),
      scale: COMPASS.cardinalSize
    })
    MeshRenderer.setBox(tick)
    glowMaterial(tick, COMPASS.cardinalColor, COMPASS.cardinalGlow)
  }

  // Purely decorative rotating dashes, parented so a single Transform write
  // in updateScenery spins the whole group.
  const root = newEntity()
  Transform.create(root, {
    position: Vector3.create(DOME_CENTER.x, 0.14, DOME_CENTER.z),
    rotation: Quaternion.Identity()
  })
  compassRotatingRoot = root

  for (let i = 0; i < COMPASS.rotatingTickCount; i++) {
    const az = (360 / COMPASS.rotatingTickCount) * i
    const dir = radialDir(az)
    const dash = newEntity()
    Transform.create(dash, {
      parent: root,
      position: Vector3.create(dir.x * COMPASS.rotatingTickRadius, 0, dir.z * COMPASS.rotatingTickRadius),
      rotation: alignRightTo(dir),
      scale: COMPASS.rotatingTickSize
    })
    MeshRenderer.setBox(dash)
    glowMaterial(dash, COMPASS.ringColor, COMPASS.rotatingTickGlow)
  }
}

// ---------------------------------------------------------------------------
// Horizon silhouette: a ring of dark, angular slabs just inside the dome
// shell, committing to a "low-poly mountain range" read. Plain boxes rather
// than billboarded planes so there is no risk of a wrong-facing normal ever
// making a piece invisible from inside the dome -- boxes render from every
// angle for free.
// ---------------------------------------------------------------------------

function createHorizonSilhouette(): void {
  const rand = seeded(HORIZON.seed)

  for (let i = 0; i < HORIZON.pieceCount; i++) {
    const az = (360 / HORIZON.pieceCount) * i + (rand() * 2 - 1) * HORIZON.azJitterDeg
    const radius = HORIZON.radiusBase + rand() * HORIZON.radiusJitter
    const height = HORIZON.heightMin + rand() * (HORIZON.heightMax - HORIZON.heightMin)
    const width = HORIZON.widthMin + rand() * (HORIZON.widthMax - HORIZON.widthMin)
    const dir = radialDir(az)
    const tangent = tangentDir(az)

    const piece = newEntity()
    Transform.create(piece, {
      position: Vector3.create(
        DOME_CENTER.x + dir.x * radius,
        height / 2,
        DOME_CENTER.z + dir.z * radius
      ),
      rotation: alignRightTo(tangent),
      scale: Vector3.create(width, height, HORIZON.depth)
    })
    MeshRenderer.setBox(piece)
    // No collider at all: this is pure background silhouette, well outside
    // where a player would ever walk (compass rose and benches sit well
    // inside HORIZON.radiusBase).
    darkMaterial(piece, HORIZON.albedo)
  }
}

// ---------------------------------------------------------------------------
// The moon: one emissive sphere plus a soft alpha-blended glow halo behind
// it, sitting in the sky gap documented in the MOON tunables above.
// ---------------------------------------------------------------------------

function createMoon(): void {
  const az = MOON.azimuthDeg * DEG2RAD
  const el = MOON.elevationDeg * DEG2RAD
  const horizontal = Math.cos(el) * DOME_RADIUS
  const pos = Vector3.create(
    DOME_CENTER.x + horizontal * Math.sin(az),
    DOME_CENTER.y + Math.sin(el) * DOME_RADIUS,
    DOME_CENTER.z + horizontal * Math.cos(az)
  )

  const moon = newEntity()
  Transform.create(moon, {
    position: pos,
    scale: Vector3.create(MOON.diameter, MOON.diameter, MOON.diameter)
  })
  MeshRenderer.setSphere(moon)
  glowMaterial(moon, MOON.color, MOON.glow, Color4.create(0, 0, 0, 1))

  // Halo sits a touch further out on the same ray, so it never z-fights with
  // the sphere and reads as glow sitting behind it.
  const haloHorizontal = Math.cos(el) * (DOME_RADIUS + 0.3)
  const haloPos = Vector3.create(
    DOME_CENTER.x + haloHorizontal * Math.sin(az),
    DOME_CENTER.y + Math.sin(el) * (DOME_RADIUS + 0.3),
    DOME_CENTER.z + haloHorizontal * Math.cos(az)
  )
  const halo = newEntity()
  Transform.create(halo, {
    position: haloPos,
    scale: Vector3.create(MOON.haloScale, MOON.haloScale, MOON.haloScale),
    rotation: Quaternion.Identity()
  })
  MeshRenderer.setPlane(halo)
  Billboard.create(halo, { billboardMode: BillboardMode.BM_ALL })
  glowSpriteMaterial(halo, MOON.haloColor, MOON.haloGlow)
}

// ---------------------------------------------------------------------------
// Benches: human scale, somewhere to stand together. Box colliders are fine
// here -- unlike the telescope, these are meant to read as obstacles you
// walk around.
// ---------------------------------------------------------------------------

function createBenches(): void {
  for (const az of BENCH.azimuthsDeg) {
    const dir = radialDir(az)
    const tangent = tangentDir(az)
    const pos = Vector3.create(
      DOME_CENTER.x + dir.x * BENCH.radius,
      0,
      DOME_CENTER.z + dir.z * BENCH.radius
    )
    const rotation = alignRightTo(tangent)

    const seat = newEntity()
    Transform.create(seat, {
      position: Vector3.create(pos.x, BENCH.seatSize.y / 2, pos.z),
      rotation,
      scale: BENCH.seatSize
    })
    MeshRenderer.setBox(seat)
    MeshCollider.setBox(seat, ColliderLayer.CL_PHYSICS)
    darkMaterial(seat, BENCH.seatColor)

    const strip = newEntity()
    Transform.create(strip, {
      position: Vector3.create(pos.x, BENCH.seatSize.y + BENCH.stripSize.y / 2, pos.z),
      rotation,
      scale: BENCH.stripSize
    })
    MeshRenderer.setBox(strip)
    glowMaterial(strip, BENCH.stripColor, BENCH.stripGlow)
  }
}

// ---------------------------------------------------------------------------
// Animation. Throttled to ~10Hz total and touching exactly two entities per
// tick: the compass rose's decorative outer ring (a Transform rotation, no
// material write) and the telescope's rim (one Material.setPbrMaterial call).
// That keeps this module's material-write rate at ~10/sec, at the ceiling the
// perf budget allows, and every one of those writes changes what's on screen.
// ---------------------------------------------------------------------------

export function updateScenery(dt: number): void {
  updateAccumulator += dt
  if (updateAccumulator < ANIMATION.tickSeconds) return
  const step = updateAccumulator
  updateAccumulator = 0

  if (compassRotatingRoot !== null) {
    compassAngleDeg = (compassAngleDeg + ANIMATION.compassDegPerSec * step) % 360
    Transform.getMutable(compassRotatingRoot).rotation = Quaternion.fromEulerDegrees(0, compassAngleDeg, 0)
  }

  if (telescopeRim !== null) {
    breathClock += step
    const wave = Math.sin(breathClock * ANIMATION.breathHz * Math.PI * 2)
    glowMaterial(telescopeRim, TELESCOPE.rimColor, TELESCOPE.rimGlow * (1 + wave * ANIMATION.breathDepth))
  }
}
