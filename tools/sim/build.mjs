/**
 * Bundles the scene for the simulator.
 *
 * Every `@dcl/sdk/*` import is redirected to tools/sim/mock-sdk.mjs and marked
 * external, so the emitted bundle imports the mock at runtime rather than
 * inlining a private copy of it. That matters: the test runner and the scene
 * have to observe the *same* entity store, and a second copy of the mock would
 * give them two.
 *
 * `@dcl/sdk/math` is the exception — it resolves to the real @dcl/ecs-math,
 * because the dome projection and the quaternion line rotations are exactly
 * the maths a fake would hide bugs in.
 */
import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const MOCK = join(HERE, 'mock-sdk.mjs')

/** Redirects the SDK to the mock, and keeps the mock out of the bundle. */
const sdkPlugin = {
  name: 'dcl-sdk-mock',
  setup(b) {
    b.onResolve({ filter: /^@dcl\/sdk(\/.*)?$/ }, (args) => {
      if (args.path === '@dcl/sdk/math') {
        return { path: resolve(ROOT, 'node_modules/@dcl/ecs-math/dist/index.js') }
      }
      return { path: MOCK, external: true }
    })
    b.onResolve({ filter: /^~system\// }, () => ({ path: MOCK, external: true }))
  }
}

export async function buildSim() {
  const outdir = join(HERE, '.out')
  mkdirSync(outdir, { recursive: true })

  // A synthetic entry point, so the runner can reach the scene's internals
  // (constellation data, game accessors, shared state) instead of only main().
  const entry = join(outdir, 'entry.ts')
  writeFileSync(
    entry,
    [
      `export { main } from ${JSON.stringify(join(ROOT, 'src/index'))}`,
      `export * as constellations from ${JSON.stringify(join(ROOT, 'src/constellations'))}`,
      `export * as game from ${JSON.stringify(join(ROOT, 'src/game'))}`,
      `export * as sharedState from ${JSON.stringify(join(ROOT, 'src/state'))}`,
      `export * as scoring from ${JSON.stringify(join(ROOT, 'src/scoring'))}`,
      `export * as stars from ${JSON.stringify(join(ROOT, 'src/stars'))}`,
      ''
    ].join('\n')
  )

  const outfile = join(outdir, 'scene.mjs')
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    tsconfig: join(ROOT, 'tsconfig.json'),
    jsxFactory: 'ReactEcs.createElement',
    jsxFragment: 'ReactEcs.Fragment',
    plugins: [sdkPlugin],
    logLevel: 'error'
  })
  return outfile
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSim().then((f) => console.log('built', f))
}
