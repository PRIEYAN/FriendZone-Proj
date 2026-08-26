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
  /** 1 = easy/few stars, 3 = hard. Also drives the ramp order in CONSTELLATIONS. */
  difficulty: 1 | 2 | 3
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

/**
 * Ordered easiest-first (by `difficulty`, then roughly by star count) so the
 * game ramps. Azimuths are laid out around the full 0-360 circle with at least
 * 8 degrees of gap between any two constellations' angular footprints
 * (azimuth +/- spreadAz/2), so no two puzzles' stars can ever appear mixed
 * together on the dome regardless of elevation.
 */
export const CONSTELLATIONS: ConstellationDef[] = [
  {
    name: 'Triangulum',
    blurb: 'Three stars, one thin triangle in the north.',
    difficulty: 1,
    azimuth: 322,
    elevation: 52,
    spreadAz: 12,
    spreadEl: 12,
    stars: [
      { name: 'Mothallah', u: -0.6, v: -0.5 },
      { name: 'Beta Trianguli', u: 0.7, v: -0.3 },
      { name: 'Gamma Trianguli', u: 0.1, v: 0.8 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0]
    ]
  },
  {
    name: 'Crux',
    blurb: 'Four stars, a cross pointing south.',
    difficulty: 1,
    azimuth: 40,
    elevation: 32,
    spreadAz: 16,
    spreadEl: 20,
    stars: [
      { name: 'Acrux', u: 0.0, v: -0.9 },
      { name: 'Gacrux', u: 0.0, v: 0.9 },
      { name: 'Mimosa', u: -0.7, v: 0.15 },
      { name: 'Delta Crucis', u: 0.7, v: -0.05 }
    ],
    edges: [
      [0, 1],
      [2, 3]
    ]
  },
  {
    name: 'Corvus',
    blurb: "Five stars, a crow's lopsided sail.",
    difficulty: 1,
    azimuth: 188,
    elevation: 36,
    spreadAz: 18,
    spreadEl: 16,
    stars: [
      { name: 'Alchiba', u: -0.6, v: 0.5 },
      { name: 'Gienah', u: 0.6, v: 0.55 },
      { name: 'Kraz', u: 0.5, v: -0.5 },
      { name: 'Algorab', u: -0.55, v: -0.45 },
      { name: 'Minkar', u: -0.9, v: 0.05 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4]
    ]
  },
  {
    name: 'Cassiopeia',
    blurb: 'Five stars. Draw the zigzag — a crown, or a W.',
    difficulty: 1,
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
    name: 'Lyra',
    blurb: 'Five stars, a tiny harp beside bright Vega.',
    difficulty: 2,
    azimuth: 214,
    elevation: 58,
    spreadAz: 18,
    spreadEl: 20,
    stars: [
      { name: 'Vega', u: 0.0, v: 0.9 },
      { name: 'Zeta Lyrae', u: 0.15, v: 0.3 },
      { name: 'Sheliak', u: 0.5, v: -0.1 },
      { name: 'Sulafat', u: 0.35, v: -0.7 },
      { name: 'Delta Lyrae', u: -0.15, v: -0.35 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1]
    ]
  },
  {
    name: 'Aquila',
    blurb: 'Five stars, an eagle diving down the sky.',
    difficulty: 2,
    azimuth: 68,
    elevation: 44,
    spreadAz: 22,
    spreadEl: 22,
    stars: [
      { name: 'Tarazed', u: -0.5, v: 0.35 },
      { name: 'Altair', u: 0.0, v: 0.0 },
      { name: 'Alshain', u: 0.4, v: -0.25 },
      { name: 'Deneb el Okab', u: 0.7, v: 0.55 },
      { name: 'Zeta Aquilae', u: -0.75, v: -0.5 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [0, 3],
      [2, 4]
    ]
  },
  {
    name: 'Cygnus',
    blurb: 'Six stars, a swan flying the Northern Cross.',
    difficulty: 2,
    azimuth: 247,
    elevation: 50,
    spreadAz: 30,
    spreadEl: 26,
    stars: [
      { name: 'Deneb', u: 0.0, v: 0.9 },
      { name: 'Sadr', u: 0.0, v: 0.15 },
      { name: 'Eta Cygni', u: 0.0, v: -0.35 },
      { name: 'Albireo', u: 0.0, v: -0.85 },
      { name: 'Gienah Cygni', u: -0.75, v: 0.05 },
      { name: 'Delta Cygni', u: 0.75, v: 0.2 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [1, 5]
    ]
  },
  {
    name: 'The Big Dipper',
    blurb: 'Four stars for the bowl, three for the handle.',
    difficulty: 2,
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
    difficulty: 3,
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
  },
  {
    name: 'Scorpius',
    blurb: 'Eight stars curling to a venomous stinger.',
    difficulty: 3,
    azimuth: 104,
    elevation: 30,
    spreadAz: 34,
    spreadEl: 30,
    stars: [
      { name: 'Acrab', u: -0.85, v: 0.8 },
      { name: 'Dschubba', u: -0.6, v: 0.65 },
      { name: 'Antares', u: -0.25, v: 0.35 },
      { name: 'Tau Scorpii', u: 0.05, v: 0.0 },
      { name: 'Epsilon Scorpii', u: 0.15, v: -0.35 },
      { name: 'Sargas', u: 0.0, v: -0.65 },
      { name: 'Shaula', u: -0.35, v: -0.9 },
      { name: 'Lesath', u: -0.55, v: -0.75 }
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7]
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

/**
 * Precomputed lookup for `pairIndex`, built once at module load. Indexed
 * [lo][hi] since the pair is unordered; -1 where no such pair exists in
 * ALL_PAIRS (e.g. a === b, or either index out of range).
 */
const PAIR_INDEX_TABLE: number[][] = (() => {
  const table: number[][] = []
  for (let a = 0; a < MAX_STARS; a++) {
    table.push(new Array(MAX_STARS).fill(-1))
  }
  for (let i = 0; i < ALL_PAIRS.length; i++) {
    const [lo, hi] = ALL_PAIRS[i]
    table[lo][hi] = i
    table[hi][lo] = i
  }
  return table
})()

/** Stable index for an unordered pair, used as the bit position in the synced mask. */
export function pairIndex(a: number, b: number): number {
  if (a < 0 || b < 0 || a >= MAX_STARS || b >= MAX_STARS) return -1
  return PAIR_INDEX_TABLE[a][b]
}

/** Bitmask of the correct edges for a constellation. */
export function correctMask(c: ConstellationDef): number {
  let mask = 0
  for (const [a, b] of c.edges) mask |= 1 << pairIndex(a, b)
  return mask
}

/** Looks up a constellation by its exact display name. */
export function constellationByName(name: string): ConstellationDef | undefined {
  return CONSTELLATIONS.find((c) => c.name === name)
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
