/**
 * Constellation data.
 *
 * Stars are authored in a flat "sky plane" (u = right, v = up, both roughly -1..1)
 * and projected onto the dome shell at runtime. Authoring in 2D keeps the shapes
 * readable and editable; projection happens once, at scene start.
 */
import { Vector3 } from '@dcl/sdk/math'
import { DOME_CENTER, DOME_RADIUS } from './config'

export type StarDef = {
  /** Display name, shown when the star is selected. */
  name: string
  /** Horizontal position in the sky plane. */
  u: number
  /** Vertical position in the sky plane. */
  v: number
}

export type ConstellationDef = {
  name: string
  /** Short line shown under the title while the constellation is unsolved. */
  blurb: string
  stars: StarDef[]
  /** Correct connections, as index pairs into `stars`. Order within a pair is irrelevant. */
  edges: [number, number][]
  /** Where on the dome this constellation sits: azimuth (deg, 0 = +Z) and elevation (deg). */
  azimuth: number
  elevation: number
  /** Angular size on the dome, in degrees. */
  spreadAz: number
  spreadEl: number
}

export const CONSTELLATIONS: ConstellationDef[] = [
  {
    name: 'Cassiopeia',
    blurb: 'Five stars. Draw the zigzag — a crown, or a W.',
    azimuth: 288,
    elevation: 46,
    spreadAz: 36,
    spreadEl: 20,
    stars: [
      { name: 'Segin', u: -0.95, v: 0.25 },
      { name: 'Ruchbah', u: -0.45, v: -0.35 },
      { name: 'Gamma Cas', u: 0.0, v: 0.3 },
      { name: 'Schedar', u: 0.5, v: -0.3 },
      { name: 'Caph', u: 0.95, v: 0.35 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4]
    ]
  },
  {
    name: 'The Big Dipper',
    blurb: 'Four stars for the bowl, three for the handle.',
    azimuth: 0,
    elevation: 42,
    spreadAz: 46,
    spreadEl: 26,
    stars: [
      { name: 'Dubhe', u: -0.85, v: 0.45 },
      { name: 'Merak', u: -0.85, v: -0.15 },
      { name: 'Phecda', u: -0.4, v: -0.35 },
      { name: 'Megrez', u: -0.3, v: 0.15 },
      { name: 'Alioth', u: 0.1, v: 0.25 },
      { name: 'Mizar', u: 0.5, v: 0.2 },
      { name: 'Alkaid', u: 0.9, v: -0.05 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6]
    ]
  },
  {
    name: 'Orion',
    blurb: 'Two shoulders, three stars on the belt, two feet.',
    azimuth: 150,
    elevation: 40,
    spreadAz: 40,
    spreadEl: 34,
    stars: [
      { name: 'Betelgeuse', u: -0.55, v: 0.85 },
      { name: 'Bellatrix', u: 0.55, v: 0.9 },
      { name: 'Alnitak', u: -0.3, v: 0.05 },
      { name: 'Alnilam', u: 0.0, v: 0.0 },
      { name: 'Mintaka', u: 0.3, v: -0.05 },
      { name: 'Saiph', u: -0.5, v: -0.85 },
      { name: 'Rigel', u: 0.6, v: -0.9 }
    ],
    edges: [
      [0, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6]
    ]
  }
]

/** Largest star count across all constellations — sizes the reusable entity pools. */
export const MAX_STARS = CONSTELLATIONS.reduce((m, c) => Math.max(m, c.stars.length), 0)

/** Every unordered pair of star slots, which is the full space a drawn line can occupy. */
export const ALL_PAIRS: [number, number][] = (() => {
  const pairs: [number, number][] = []
  for (let a = 0; a < MAX_STARS; a++) {
    for (let b = a + 1; b < MAX_STARS; b++) pairs.push([a, b])
  }
  return pairs
})()

/** Stable index for an unordered pair, used as the bit position in the synced mask. */
export function pairIndex(a: number, b: number): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return ALL_PAIRS.findIndex((p) => p[0] === lo && p[1] === hi)
}

/** Bitmask of the correct edges for a constellation. */
export function correctMask(c: ConstellationDef): number {
  let mask = 0
  for (const [a, b] of c.edges) mask |= 1 << pairIndex(a, b)
  return mask
}

/** Projects an authored sky-plane star onto the dome shell as a world position. */
export function starWorldPosition(c: ConstellationDef, star: StarDef): Vector3.MutableVector3 {
  const azDeg = c.azimuth + star.u * (c.spreadAz / 2)
  const elDeg = c.elevation + star.v * (c.spreadEl / 2)
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  const horizontal = Math.cos(el) * DOME_RADIUS
  return Vector3.create(
    DOME_CENTER.x + horizontal * Math.sin(az),
    DOME_CENTER.y + Math.sin(el) * DOME_RADIUS,
    DOME_CENTER.z + horizontal * Math.cos(az)
  )
}
