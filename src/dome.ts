/**
 * The observatory shell: the sky, the floor, the horizon edge, and the
 * scattered background starfield.
 *
 * Everything here is static geometry created once at scene start. Nothing in
 * this module runs per frame, which is what keeps the scene's frame cost flat
 * (Workshop #4: "how you load your scene can matter more than how polished
 * individual assets are").
 */
import {
  engine,
  Transform,
  MeshRenderer,
  Material,
  Billboard,
  BillboardMode,
  MaterialTransparencyMode
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import {
  BACKGROUND_STAR_COUNT,
  COLOR,
  DOME_CENTER,
  DOME_RADIUS,
  GLOW,
  SKY_COLOR,
  SKY_SHELL_RADIUS,
  STAR_TEXTURE
} from './config'

/** Deterministic PRNG so the starfield is identical on every client. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function createDome(): void {
  createSkyShell()
  createFloor()
  createHorizonRing()
  createBackgroundStars()
}

/**
 * The sky.
 *
 * Built from quads laid tangent to a sphere rather than from one big inverted
 * sphere mesh, for a boring reason: a sphere primitive's faces point outward,
 * so from inside it you are looking at its back faces and get nothing. Quads
 * can simply be turned to face the middle of the room.
 *
 * Segment counts thin out with elevation because the circumference of a band
 * shrinks with cos(elevation) — sixteen quads is right at the horizon and
 * wasteful near the zenith. Each quad is oversized by a quarter so neighbours
 * overlap: the shell is a single flat colour, so overlap is invisible, whereas
 * a gap is a bright hole in the night sky.
 *
 * 63 entities, no colliders, never touched again after this runs.
 */
function createSkyShell(): void {
  // Elevation band centres and how many quads each band is cut into.
  //
  // The lowest band cannot go below 12.3 degrees. A quad of height h tangent at
  // elevation E has its bottom edge at R*sin(E) - (h/2)*cos(E), and the scene
  // owns nothing below y=0 — at 13 degrees that edge lands at 0.19m, and any
  // lower puts the bottom of the sky outside the parcel where the client is
  // free to cull it. The 1.25 oversize means this band still covers down past
  // the horizon line; the floor and the horizon ridge close the last degree.
  const bands: { elevation: number; segments: number }[] = [
    { elevation: 13, segments: 16 },
    { elevation: 33, segments: 16 },
    { elevation: 53, segments: 12 },
    { elevation: 73, segments: 8 }
  ]
  const bandHeightDeg = 20
  const overlap = 1.25

  for (const band of bands) {
    const el = (band.elevation * Math.PI) / 180
    const ringRadius = Math.cos(el) * SKY_SHELL_RADIUS
    const width = ((2 * Math.PI * ringRadius) / band.segments) * overlap
    const height = SKY_SHELL_RADIUS * ((bandHeightDeg * Math.PI) / 180) * overlap

    for (let i = 0; i < band.segments; i++) {
      const az = (i / band.segments) * Math.PI * 2
      const position = Vector3.create(
        DOME_CENTER.x + ringRadius * Math.sin(az),
        DOME_CENTER.y + Math.sin(el) * SKY_SHELL_RADIUS,
        DOME_CENTER.z + ringRadius * Math.cos(az)
      )
      // Face the middle of the dome, which is where the player is.
      const toCentre = Vector3.normalize(
        Vector3.create(
          DOME_CENTER.x - position.x,
          DOME_CENTER.y + 1.6 - position.y,
          DOME_CENTER.z - position.z
        )
      )
      addSkyQuad(position, toCentre, width, height)
    }
  }

  // The zenith. One quad, laid flat, closing the hole the bands leave overhead.
  addSkyQuad(
    Vector3.create(DOME_CENTER.x, DOME_CENTER.y + SKY_SHELL_RADIUS, DOME_CENTER.z),
    Vector3.create(0, -1, 0),
    SKY_SHELL_RADIUS * 0.85,
    SKY_SHELL_RADIUS * 0.85
  )
}

function addSkyQuad(
  position: Vector3.MutableVector3,
  facing: Vector3.MutableVector3,
  width: number,
  height: number
): void {
  const quad = engine.addEntity()
  Transform.create(quad, {
    position,
    rotation: Quaternion.lookRotation(facing),
    scale: Vector3.create(width, height, 1)
  })
  MeshRenderer.setPlane(quad)
  // Lit entirely by its own emission. An albedo-only material would take
  // whatever light the client's sky happens to cast, which is exactly the
  // dependency this shell exists to remove — a daytime skybox would light it
  // to a pale grey and the stars would vanish into it.
  Material.setPbrMaterial(quad, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: SKY_COLOR,
    emissiveIntensity: 1,
    roughness: 1,
    metallic: 0
  })
}

function createFloor(): void {
  // A single flat cylinder. Dark and matte so it never competes with the stars.
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(DOME_CENTER.x, 0.02, DOME_CENTER.z),
    scale: Vector3.create(30, 0.04, 30)
  })
  MeshRenderer.setCylinder(floor, 1, 1)
  Material.setPbrMaterial(floor, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: COLOR.domeFloor,
    emissiveIntensity: 1,
    roughness: 1,
    metallic: 0
  })
}

/**
 * A faint glowing edge where the floor meets the sky.
 *
 * This used to be a second cylinder scaled to 26m, which is a filled disc, not
 * a ring — so the "faint edge" was actually a 26-metre emissive plate covering
 * the entire floor, and under a bright sky it read as a sheet of white. It is
 * now what it always claimed to be: short segments laid end to end around a
 * circle.
 */
function createHorizonRing(): void {
  const segments = 48
  const radius = 13.6
  const chord = ((2 * Math.PI * radius) / segments) * 1.15

  for (let i = 0; i < segments; i++) {
    const az = (i / segments) * Math.PI * 2
    const e = engine.addEntity()
    Transform.create(e, {
      position: Vector3.create(
        DOME_CENTER.x + Math.sin(az) * radius,
        0.05,
        DOME_CENTER.z + Math.cos(az) * radius
      ),
      // Turned to lie along the circle rather than across it.
      rotation: Quaternion.fromEulerDegrees(0, (az * 180) / Math.PI, 0),
      scale: Vector3.create(0.09, 0.02, chord)
    })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: COLOR.backgroundStar,
      emissiveIntensity: 1.4,
      roughness: 1,
      metallic: 0
    })
  }
}

function createBackgroundStars(): void {
  const rand = seeded(20260904)

  for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
    // Bias towards the upper dome so the field sits overhead rather than
    // underfoot, and keep it between the interactive stars and the sky shell.
    const elevation = (12 + rand() * 76) * (Math.PI / 180)
    const azimuth = rand() * Math.PI * 2
    const radius = DOME_RADIUS + 1.0 + rand() * 1.8
    const horizontal = Math.cos(elevation) * radius

    const star = engine.addEntity()
    Transform.create(star, {
      position: Vector3.create(
        DOME_CENTER.x + horizontal * Math.sin(azimuth),
        DOME_CENTER.y + Math.sin(elevation) * radius,
        DOME_CENTER.z + horizontal * Math.cos(azimuth)
      ),
      // Two triangles each. A sphere here would cost far more for no visual gain
      // at this distance.
      scale: Vector3.scale(Vector3.One(), 0.1 + rand() * 0.18),
      rotation: Quaternion.Identity()
    })
    MeshRenderer.setPlane(star)
    Billboard.create(star, { billboardMode: BillboardMode.BM_ALL })
    // Same glow sprite as the interactive stars, dimmer and alpha-blended so the
    // field reads as depth rather than a wall of white squares.
    Material.setPbrMaterial(star, {
      texture: Material.Texture.Common({ src: STAR_TEXTURE }),
      emissiveTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
      alphaTexture: Material.Texture.Common({ src: STAR_TEXTURE }),
      albedoColor: Color4.create(0, 0, 0, 1),
      emissiveColor: COLOR.backgroundStar,
      emissiveIntensity: GLOW.backgroundStar * (0.5 + rand()),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      roughness: 1,
      metallic: 0
    })
  }
}
