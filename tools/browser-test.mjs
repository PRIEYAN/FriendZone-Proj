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
const SECONDS = Number(arg('seconds', '120'))
const KEEP = argv.includes('--keep')
/** How long to wait for the client to offer its guest control. */
const GUEST_TIMEOUT = Number(arg('guest-timeout', '150'))
const SHOTS = join(process.cwd(), 'docs', 'shots')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[browser-test]', ...a)

let server
let browser

async function startServer() {
  log(`starting preview server on :${PORT}`)
  server = spawn(
    'npx',
    [
      'sdk-commands', 'start',
      '--web',
      '--no-browser',
      // An unattended run has nobody to click through the wallet screen.
      '--skip-auth-screen', 'true',
      '--port', String(PORT)
    ],
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

  // 2. The scene as the client will actually receive it: resolve the deployed
  //    entity for the base parcel, find the hash the manifest gives for
  //    scene.json's `main`, and pull that file. This is the part that is
  //    genuinely ours, so it is checked unconditionally -- and going through the
  //    manifest rather than a guessed path also proves the manifest is sane.
  const bundle = await page.evaluate(async (port) => {
    const base = `http://127.0.0.1:${port}`
    const res = await fetch(`${base}/content/entities/active`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pointers: ['0,0'] })
    }).catch(() => null)
    if (!res || !res.ok) return { ok: false, stage: 'entities', status: res ? res.status : null }

    const list = await res.json()
    const entity = list[0]
    if (!entity) return { ok: false, stage: 'no entity for 0,0' }

    const mainFile = entity.metadata && entity.metadata.main
    const entry = (entity.content || []).find((c) => c.file === mainFile)
    if (!entry) return { ok: false, stage: 'manifest has no ' + mainFile }

    const js = await fetch(`${base}/content/contents/${entry.hash}`).catch(() => null)
    if (!js || !js.ok) return { ok: false, stage: 'contents', status: js ? js.status : null }

    const text = await js.text()
    return {
      ok: true,
      main: mainFile,
      bytes: text.length,
      files: entity.content.length,
      title: entity.metadata.display ? entity.metadata.display.title : null,
      exportsMain: /\bmain\b/.test(text)
    }
  }, PORT)
  log('scene bundle:', JSON.stringify(bundle))

  // 3. The real client.
  const url =
    `https://decentraland.org/bevy-web/?preview=true` +
    `&realm=http://127.0.0.1:${PORT}` +
    `&position=0,0&skip-auth-screen=true`
  let explorer = 'SKIP'
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // The explorer opens on its own sign-in wall, and the guest control does
    // not exist yet when the page first paints -- the client downloads its
    // engine first and only offers "explore as guest" once that finishes. So
    // this polls rather than clicking once and giving up, and clicks through
    // the mouse rather than calling el.click(), because the button listens for
    // real pointer events.
    let enteredAsGuest = null
    for (let waited = 0; waited < GUEST_TIMEOUT && !enteredAsGuest; waited += 3) {
      await sleep(3000)
      const box = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect()
          return r.width > 20 && r.height > 10
        }
        for (const el of document.querySelectorAll('button, a, [role="button"], div, span')) {
          const text = (el.textContent || '').trim()
          if (text.length > 40 || !/guest/i.test(text)) continue
          if (el.querySelector('button, a, [role="button"]')) continue // outer wrapper
          if (!visible(el)) continue
          const r = el.getBoundingClientRect()
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, text }
        }
        return null
      })
      if (box) {
        await page.mouse.click(box.x, box.y)
        enteredAsGuest = box.text
      } else if (waited % 15 === 0) {
        const progress = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\s+/g, ' '))
        log(`waiting for the client (${waited}s): ${progress}`)
      }
    }
    log('guest entry:', enteredAsGuest || `not offered within ${GUEST_TIMEOUT}s`)

    for (let elapsed = 0; elapsed < SECONDS; elapsed += 15) {
      await sleep(15_000)
      const shot = join(SHOTS, `explorer-${String(elapsed + 15).padStart(3, '0')}s.png`)
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
      log(`t+${elapsed + 15}s canvas=${state.canvas} ${state.w}x${state.h}  ${state.text.replace(/\s+/g, ' ').slice(0, 70)}`)
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
  console.log(`scene bundle     ${bundle.ok ? 'PASS' : 'FAIL'}  ${bundle.ok ? bundle.bytes + ' bytes, ' + bundle.files + ' files' : bundle.stage}`)
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
