/**
 * The observatory: floor, horizon ring, and the scattered background starfield.
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
  createFloor()
  createBackgroundStars()
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
    albedoColor: Color4.create(0.04, 0.04, 0.09, 1),
    roughness: 1,
    metallic: 0
  })

  // A faint emissive ring at the horizon. It gives the dome a readable edge on a
  // small screen without adding a light source (point lights do not work on mobile).
  const ring = engine.addEntity()
  Transform.create(ring, {
    position: Vector3.create(DOME_CENTER.x, 0.06, DOME_CENTER.z),
    scale: Vector3.create(26, 0.02, 26)
  })
  MeshRenderer.setCylinder(ring, 1, 1)
  Material.setPbrMaterial(ring, {
    albedoColor: Color4.create(0.05, 0.07, 0.16, 1),
    emissiveColor: COLOR.backgroundStar,
    emissiveIntensity: 0.35,
    roughness: 1
  })
}

function createBackgroundStars(): void {
  const rand = seeded(20260904)

  for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
    // Bias towards the upper dome so the field sits overhead rather than underfoot.
    const elevation = (12 + rand() * 76) * (Math.PI / 180)
    const azimuth = rand() * Math.PI * 2
    const radius = DOME_RADIUS + 1.5 + rand() * 3
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
      scale: Vector3.scale(Vector3.One(), 0.12 + rand() * 0.22),
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
