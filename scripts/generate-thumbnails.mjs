#!/usr/bin/env node
/**
 * Renders flower thumbnails headlessly using system Chrome and saves PNGs to
 * public/thumbnails/. Run once before build: npm run generate-thumbnails
 */
import { createServer } from 'node:http'
import { createReadStream, mkdirSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'thumbnails')

const MIME = {
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.html': 'text/html',
  '.glb':  'application/octet-stream',
}

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
]

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  for (const p of CHROME_CANDIDATES) {
    try { statSync(p); return p } catch { /* not found, try next */ }
  }
  throw new Error(
    'Chrome not found. Install Chrome or set CHROME_PATH env var.\n' +
    `Tried: ${CHROME_CANDIDATES.join(', ')}`
  )
}

function startServer(port) {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const filePath = join(ROOT, decodeURIComponent(req.url.split('?')[0]))
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream')
      res.setHeader('Cache-Control', 'no-store')
      createReadStream(filePath)
        .on('error', () => { res.statusCode = 404; res.end() })
        .pipe(res)
    })
    server.listen(port, () => resolve(server))
  })
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const PORT = 7432
  const server = await startServer(PORT)
  console.log(`Static server → http://localhost:${PORT}`)

  const chromePath = findChrome()
  console.log(`Using Chrome: ${chromePath}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 800, height: 600 })

    console.log('Loading thumbnail renderer...')
    await page.goto(`http://localhost:${PORT}/scripts/thumbnail-renderer.html`, {
      waitUntil: 'networkidle0',
      timeout: 90_000,
    })

    console.log('Waiting for all renders to complete...')
    await page.waitForFunction(
      '!!window.__thumbnails && window.__thumbnails.length === 4',
      { timeout: 90_000 },
    )

    const thumbnails = await page.evaluate(() => window.__thumbnails)
    for (const { type, dataUrl } of thumbnails) {
      const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
      await writeFile(join(OUT_DIR, `${type}.png`), buf)
      console.log(`  ✓ ${type}.png  (${(buf.length / 1024).toFixed(1)} KB)`)
    }
    console.log('\nThumbnails saved to public/thumbnails/')
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
