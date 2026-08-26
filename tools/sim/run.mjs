/**
 * The offline playthrough.
 *
 * This is the scene's primary correctness test. It bundles the real source
 * against a mock runtime (tools/sim/mock-sdk.mjs), calls `main()`, then plays
 * the game the way a player does: it reads the HUD, presses the HUD's own
 * buttons, and taps stars through the pointer callbacks the scene registered —
 * never by reaching into game logic directly. So a HUD button wired to nothing,
 * a tap target on the wrong entity, or a board that fails to advance all fail
 * here, and none of them need an Explorer to catch.
 *
 *   node tools/sim/run.mjs [--mobile] [--verbose]
 */
import { buildSim } from './build.mjs'

const VERBOSE = process.argv.includes('--verbose')
const DT = 1 / 30

let failures = 0
let checks = 0
function check(condition, message, detail) {
  checks++
  if (condition) {
    if (VERBOSE) console.log(`  pass  ${message}`)
  } else {
    failures++
    console.log(`  FAIL  ${message}${detail ? `\n        ${detail}` : ''}`)
  }
}
function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`)
}

const mock = await import('./mock-sdk.mjs')
const { world, engine } = mock

const scenePath = await buildSim()
world.mobile = process.argv.includes('--mobile')
const scene = await import(scenePath)

// ── helpers ────────────────────────────────────────────────────────────────
function frames(n) {
  for (let i = 0; i < n; i++) {
    try {
      engine.update(DT)
    } catch (e) {
      world.errors.push(`system threw on frame ${i}: ${e.stack || e}`)
      throw e
    }
  }
}

function renderUi() {
  if (!world.uiRenderer) return null
  return world.uiRenderer()
}

/** Every string a Label is currently showing, flattened. */
function uiLabels(node = renderUi(), out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'Label' && typeof node.props?.value === 'string') out.push(node.props.value)
  if (node.type === 'Button' && typeof node.props?.value === 'string') out.push(`[${node.props.value}]`)
  for (const c of node.children ?? []) uiLabels(c, out)
  return out
}

/** Buttons in the HUD, so the simulator can press what a player presses. */
function uiButtons(node = renderUi(), out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'Button') {
    out.push({ label: node.props?.value, press: node.props?.onMouseDown })
  }
  for (const c of node.children ?? []) uiButtons(c, out)
  return out
}

function pressButton(label) {
  const b = uiButtons().find((x) => String(x.label).includes(label))
  if (!b || typeof b.press !== 'function') return false
  b.press()
  return true
}

const state = () => scene.sharedState.readState()
const C = scene.constellations

/**
 * The star tap handlers, in slot order.
 *
 * createStars registers one per slot, in order, and it is the only thing in the
 * scene that registers pointer handlers — so the first MAX_STARS entries are
 * the stars. Captured after main() rather than before, since nothing has
 * registered anything until the scene has actually built itself.
 */
let starTaps = []
function captureStarTaps() {
  starTaps = world.pointerHandlers.slice(0, C.MAX_STARS)
}

function tapStar(i) {
  const h = starTaps[i]
  if (!h) throw new Error(`no tap handler for star slot ${i} (have ${starTaps.length})`)
  h.callback()
  frames(2)
}

function drawEdge(a, b) {
  tapStar(a)
  tapStar(b)
}

function liveEntities() {
  return world.entities.size
}

// ── 1. startup ─────────────────────────────────────────────────────────────
section('startup')
scene.main()
frames(3)
captureStarTaps()

check(world.errors.length === 0, 'main() runs without throwing', world.errors[0])
const bootEntities = liveEntities()
console.log(`  scene built ${bootEntities} entities`)
check(bootEntities > 0 && bootEntities <= 500, `entity count within the 500 budget (${bootEntities})`)
check(world.systems.length > 0, `systems registered (${world.systems.length})`)
check(world.uiRenderer !== null, 'a UI renderer was installed')
check(world.syncedEntities.length === 1, `exactly one synced entity (${world.syncedEntities.length})`)
check(starTaps.length === C.MAX_STARS, `every star slot has a tap target (${starTaps.length}/${C.MAX_STARS})`)
check(state() !== null, 'shared game state exists')

const bootLabels = uiLabels()
check(bootLabels.length > 0, 'the HUD renders text on frame 1', JSON.stringify(bootLabels))
if (VERBOSE) console.log('  HUD:', bootLabels)

// ── 2. selection, erasing, and the no-fail rule ────────────────────────────
section('tap handling')
const first = C.CONSTELLATIONS[state().constellationIndex % C.CONSTELLATIONS.length]
check(first !== undefined, 'the board opens on a real constellation')
console.log(`  board: ${first.name} (${first.stars.length} stars, ${first.edges.length} edges)`)

tapStar(0)
check(
  uiLabels().some((l) => l.includes(first.stars[0].name)),
  'selecting a star names it in the HUD',
  JSON.stringify(uiLabels())
)

tapStar(0)
check(state().drawnMask === 0, 'tapping the same star twice cancels rather than drawing')

// A deliberately wrong line, then erase it. Neither may block the puzzle.
const target = C.correctMask(first)
let wrongPair = null
for (const [a, b] of C.ALL_PAIRS) {
  if (a >= first.stars.length || b >= first.stars.length) continue
  if ((target & (1 << C.pairIndex(a, b))) === 0) { wrongPair = [a, b]; break }
}
if (wrongPair) {
  drawEdge(wrongPair[0], wrongPair[1])
  check(state().drawnMask !== 0, 'a wrong line is allowed onto the board')
  check(state().solved === false, 'a wrong line does not solve anything')
  drawEdge(wrongPair[0], wrongPair[1])
  check(state().drawnMask === 0, 're-tapping the same pair erases the line')
} else {
  console.log('  (this board has no wrong pair available — skipped)')
}

// ── 3. the hint button ─────────────────────────────────────────────────────
section('hint button')
const hintPressed = pressButton('?')
check(hintPressed, 'the HUD exposes a pressable hint button')
frames(2)
check(world.errors.length === 0, 'pressing hint does not throw', world.errors[0])

// ── 4. a full ten-board playthrough ────────────────────────────────────────
section('full playthrough')
const solvedOrder = []
const startEntities = liveEntities()

for (let board = 0; board < C.CONSTELLATIONS.length; board++) {
  const s = state()
  const c = C.CONSTELLATIONS[s.constellationIndex % C.CONSTELLATIONS.length]
  const beforeSolved = s.totalSolved

  for (const [a, b] of c.edges) drawEdge(a, b)
  frames(2)

  const after = state()
  check(after.solved === true, `${c.name}: solves once every correct edge is drawn`)
  check(
    after.totalSolved === beforeSolved + 1,
    `${c.name}: totalSolved advances (${beforeSolved} -> ${after.totalSolved})`
  )

  const banner = uiLabels()
  check(
    banner.some((l) => l.includes(c.name)),
    `${c.name}: the reveal banner names the constellation`,
    JSON.stringify(banner)
  )
  solvedOrder.push(c.name)

  // Play the reveal out, then take the HUD's own "next" affordance.
  frames(60)
  if (state().solved) {
    const advanced = pressButton('Next')
    if (!advanced) frames(300) // fall back to the auto-advance timer
  }
  frames(5)
  check(state().solved === false, `${c.name}: the board clears for the next sky`)
  check(state().drawnMask === 0, `${c.name}: the next board starts empty`)
}

check(new Set(solvedOrder).size === C.CONSTELLATIONS.length,
  `all ${C.CONSTELLATIONS.length} constellations were reached`,
  solvedOrder.join(' -> '))

// ── 5. budgets and stability ───────────────────────────────────────────────
section('budgets')
check(liveEntities() === startEntities,
  `entity count is flat across the whole run (${startEntities} -> ${liveEntities()})`)
check(world.errors.length === 0, 'nothing threw during the playthrough', world.errors[0])

frames(600) // twenty idle seconds: hints, meteors, motes, ambient systems
check(world.errors.length === 0, 'twenty idle seconds throw nothing', world.errors[0])
check(liveEntities() === startEntities, 'idling allocates no entities')

// ── material write budget ──────────────────────────────────────────────────
//
// A material write is a CRDT message plus a shader-parameter update on the real
// client, and it is the cheapest way for a scene full of "animations" to become
// unaffordable on a phone without anything looking obviously wrong. So the
// simulator measures the rate rather than trusting that the frame-skips work.
section('material write budget')
{
  world.materialWrites = 0
  frames(300) // ten seconds of an idle dome: meteors, motes, twinkle, scenery
  const idlePerSecond = world.materialWrites / 10
  console.log(`  idle: ${idlePerSecond.toFixed(0)} material writes/second`)
  check(idlePerSecond < 400, `idle write rate under 400/s (${idlePerSecond.toFixed(0)})`)

  world.materialWrites = 0
  const busy = C.CONSTELLATIONS[state().constellationIndex % C.CONSTELLATIONS.length]
  for (const [a, b] of busy.edges) drawEdge(a, b)
  frames(120)
  const busyWrites = world.materialWrites
  console.log(`  solving a board: ${busyWrites} material writes total`)
  check(busyWrites < 6000, `a whole solve stays under 6000 writes (${busyWrites})`)

  // Put the board back for anything after this point.
  frames(60)
  if (state().solved) { if (!pressButton('Next')) frames(300) }
  frames(5)
}

// ── 6. audio actually fired ────────────────────────────────────────────────
section('audio')
const urls = new Set(world.audioEvents.map((a) => a.url))
console.log(`  ${world.audioEvents.length} playbacks, ${urls.size} distinct clips`)
check(urls.size >= 2, `more than one clip was triggered (${[...urls].join(', ')})`)
check([...urls].some((u) => u.includes('ambient')), 'the ambient loop started')
const pitches = new Set(world.audioEvents.map((a) => Number(a.pitch ?? 1).toFixed(3)))
if (VERBOSE) console.log('  pitches:', [...pitches].join(' '))

// ── 7. scoring ─────────────────────────────────────────────────────────────
section('scoring')
if (scene.scoring) {
  const total = scene.scoring.totalScore()
  const r = scene.scoring.rank()
  const history = scene.scoring.boardHistory()
  console.log(`  total ${total}, rank ${r.name} (lvl ${r.level}, ${(r.progress * 100).toFixed(0)}%)`)
  check(Number.isFinite(total), 'total score is a finite number')
  check(typeof r.name === 'string' && r.name.length > 0, 'rank has a name')
  check(r.progress >= 0 && r.progress <= 1, `rank progress in 0..1 (${r.progress})`)
  check(history.length > 0, `boards recorded in history (${history.length})`)
  check(history.every((h) => h.stars >= 1 && h.stars <= 3), 'every solved board scored 1-3 stars')
}

// ── result ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(62)}`)
console.log(failures === 0
  ? `SIMULATION PASSED — ${checks} checks, ${bootEntities} entities`
  : `SIMULATION FAILED — ${failures} of ${checks} checks`)
process.exit(failures === 0 ? 0 : 1)
