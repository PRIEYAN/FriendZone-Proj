/**
 * Pointing the player at the sky that matters.
 *
 * The constellations sit at different azimuths around the dome, so a player who
 * spawns facing the wrong way sees an empty sky and reasonably concludes the
 * scene is broken. Workshop #3 was explicit about this: "think about what the
 * player sees around second 3. A blank screen can easily feel broken rather than
 * simply loading."
 *
 * This computes whether the active constellation is in front of the camera, and
 * if not, which way to turn.
 */
import { engine, Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { DOME_CENTER, DOME_RADIUS } from './config'
import { ConstellationDef } from './constellations'

export type Bearing = 'in-view' | 'left' | 'right' | 'behind' | 'up'

let bearing: Bearing = 'in-view'

export function currentBearing(): Bearing {
  return bearing
}

/** World position at the centre of a constellation's patch of sky. */
function constellationCenter(c: ConstellationDef): Vector3.MutableVector3 {
  const az = (c.azimuth * Math.PI) / 180
  const el = (c.elevation * Math.PI) / 180
  const horizontal = Math.cos(el) * DOME_RADIUS
  return Vector3.create(
    DOME_CENTER.x + horizontal * Math.sin(az),
    DOME_CENTER.y + Math.sin(el) * DOME_RADIUS,
    DOME_CENTER.z + horizontal * Math.cos(az)
  )
}

/**
 * Recomputes the bearing. Cheap, but there is no reason to run it every frame —
 * `game.ts` throttles it to a few times a second.
 */
export function updateBearing(c: ConstellationDef): void {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (!cam) {
    bearing = 'in-view'
    return
  }

  const target = Vector3.subtract(constellationCenter(c), cam.position)
  const forward = Vector3.rotate(Vector3.Forward(), cam.rotation)

  // Flatten both to the horizontal plane: turning left/right is what the player
  // can actually act on, and pitch is handled separately below.
  const flatTarget = Vector3.normalize(Vector3.create(target.x, 0, target.z))
  const flatForward = Vector3.normalize(Vector3.create(forward.x, 0, forward.z))

  const dot = Vector3.dot(flatForward, flatTarget)
  const yaw = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI)

  if (yaw > 130) {
    bearing = 'behind'
    return
  }
  if (yaw > 32) {
    // Cross product's Y component gives the turn direction.
    const cross = flatForward.x * flatTarget.z - flatForward.z * flatTarget.x
    bearing = cross > 0 ? 'right' : 'left'
    return
  }

  // Facing the right way but looking at the floor: the stars are overhead.
  const targetPitch = Math.asin(Vector3.normalize(target).y) * (180 / Math.PI)
  const camPitch = Math.asin(forward.y) * (180 / Math.PI)
  bearing = targetPitch - camPitch > 26 ? 'up' : 'in-view'
}

/** Short instruction for the HUD, or empty when the sky is already in view. */
export function bearingHint(): string {
  switch (bearing) {
    case 'left':
      return 'Turn left to find the stars'
    case 'right':
      return 'Turn right to find the stars'
    case 'behind':
      return 'The stars are behind you'
    case 'up':
      return 'Look up'
    default:
      return ''
  }
}
