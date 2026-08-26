/**
 * Chrome smoke test.
 *
 * Boots the SDK preview server, opens the Bevy web explorer on the discrete
 * GPU, and answers three questions that the offline simulator cannot:
 *
 *   - does the scene bundle the CLI produced actually load in a real client?
 *   - is the page on the hardware GPU path, or has it quietly fallen back?
 *   - does anything throw once the runtime starts executing the scene?
 *
 * It is deliberately tolerant about the explorer itself. decentraland.org is a
 * third-party page behind a network fetch and an auth screen; if it fails to
 * come up that is not this scene's bug, so the runner reports SKIP rather than
 * FAIL and leans on tools/sim for correctness.
 *
 *   node tools/browser-test.mjs [--port 8010] [--seconds 90] [--keep]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { CHROME, chromeArgs, gpuEnv } from './chrome-flags.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const PORT = Number(arg('port', '8010'))
const SECONDS = Number(arg('seconds', '90'))
const KEEP = argv.includes('--keep')
const SHOTS = join(process.cwd(), 'docs', 'shots')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[browser-test]', ...a)

let server
let browser

async function startServer() {
  log(`starting preview server on :${PORT}`)
  server = spawn(
    'npx',
    ['sdk-commands', 'start', '--web', '--no-browser', '--port', String(PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let out = ''
  server.stdout.on('data', (d) => { out += d.toString() })
  server.stderr.on('data', (d) => { out += d.toString() })

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (out.includes('Preview server is now running')) return
    if (server.exitCode !== null) throw new Error(`server exited early:\n${out}`)
    await sleep(1000)
  }
  throw new Error(`server never came up:\n${out}`)
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  await startServer()

  browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    args: chromeArgs(),
    env: gpuEnv(),
    defaultViewport: { width: 1600, height: 900 }
  })

  const page = await browser.newPage()
  const consoleErrors = []
  const sceneLogs = []
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error') consoleErrors.push(t)
    if (t.includes('CELESTIAL')) sceneLogs.push(t)
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  // 1. GPU path. Checked on a blank page first: if the explorer never loads we
  //    still want a trustworthy answer about the graphics stack.
  await page.goto('data:text/html,<canvas id=c></canvas>', { waitUntil: 'load' })
  const gpu = await page.evaluate(() => {
    const gl = document.getElementById('c').getContext('webgl2')
    if (!gl) return { webgl2: false }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      webgl2: true,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
    }
  })

  const software = !gpu.webgl2 || /swiftshader|llvmpipe|software/i.test(gpu.renderer || '')
  log('GPU:', gpu.renderer || 'none')
  if (software) log('!! WARNING: software rasteriser — these numbers mean nothing')

  // 2. The scene's own bundle, fetched straight from the preview server. This
  //    is the part that is genuinely ours, so it is checked unconditionally.
  const bundle = await page.evaluate(async (port) => {
    const r = await fetch(`http://127.0.0.1:${port}/content/contents/bin/index.js`).catch(() => null)
    if (!r || !r.ok) {
      const about = await fetch(`http://127.0.0.1:${port}/about`).catch(() => null)
      return { ok: false, about: about ? about.status : null }
    }
    const text = await r.text()
    return { ok: true, bytes: text.length, hasMain: /\bmain\b/.test(text) }
  }, PORT)
  log('scene bundle:', JSON.stringify(bundle))

  // 3. The real client.
  const url = `https://decentraland.org/bevy-web/?preview=true&realm=http://127.0.0.1:${PORT}&position=0,0`
  let explorer = 'SKIP'
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    for (let elapsed = 0; elapsed < SECONDS; elapsed += 10) {
      await sleep(10_000)
      const shot = join(SHOTS, `explorer-${String(elapsed + 10).padStart(3, '0')}s.png`)
      await page.screenshot({ path: shot })
      const state = await page.evaluate(() => {
        const c = document.querySelector('canvas')
        return {
          canvas: !!c,
          w: c ? c.width : 0,
          h: c ? c.height : 0,
          text: document.body.innerText.slice(0, 200)
        }
      })
      log(`t+${elapsed + 10}s canvas=${state.canvas} ${state.w}x${state.h}`)
      if (state.canvas && state.w > 100) explorer = 'LOADED'
    }
  } catch (e) {
    log('explorer did not come up:', e.message)
  }

  const report = {
    gpu,
    softwareFallback: software,
    bundle,
    explorer,
    sceneLogs,
    consoleErrors: consoleErrors.slice(0, 40)
  }
  writeFileSync(join(SHOTS, 'browser-report.json'), JSON.stringify(report, null, 2))

  console.log('\n──────── browser test ────────')
  console.log(`GPU              ${software ? 'FAIL (software)' : 'PASS'}  ${gpu.renderer || ''}`)
  console.log(`scene bundle     ${bundle.ok ? 'PASS' : 'FAIL'}  ${bundle.bytes ?? ''} bytes`)
  console.log(`explorer canvas  ${explorer}`)
  console.log(`console errors   ${consoleErrors.length}`)
  console.log(`screenshots      docs/shots/`)

  if (!KEEP) {
    await browser.close()
    server.kill('SIGINT')
  }
  // Only our own bundle is allowed to fail the run.
  process.exit(bundle.ok && !software ? 0 : 1)
}

main().catch(async (e) => {
  console.error('[browser-test] fatal:', e)
  try { await browser?.close() } catch {}
  server?.kill('SIGINT')
  process.exit(1)
})
