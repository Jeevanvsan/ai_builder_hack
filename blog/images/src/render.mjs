// Renders the designed blog figures in this folder (*.html) to ../NN-name.png at 2x with headless Chrome.
// Usage (from the repo root, after `npm install` in covert_call/):
//   node blog/images/src/render.mjs                 # all figures
//   node blog/images/src/render.mjs 01-cover        # one figure
// Chrome: set CHROME_PATH, or it uses Chrome for Testing 153 from the puppeteer cache (same as the landing
// page's screenshot script).
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import os from 'node:os'

const SRC = dirname(fileURLToPath(import.meta.url))
const OUT = join(SRC, '..')
const puppeteer = createRequire(join(SRC, '../../../covert_call/package.json'))('puppeteer-core')
const CHROME = process.env.CHROME_PATH || join(os.homedir(), '.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome')
const ALL = ['01-cover', '02-four-ways-in', '03-one-meaning-many-covers', '05-architecture', '06-one-answer']
const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] })
try {
  for (const name of names) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1700, height: 1300, deviceScaleFactor: 2 })
    await page.goto(pathToFileURL(join(SRC, `${name}.html`)).href, { waitUntil: 'networkidle0', timeout: 60_000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
    })
    await (await page.$('#fig')).screenshot({ path: join(OUT, `${name}.png`), type: 'png' })
    console.log('rendered', `${name}.png`)
    await page.close()
  }
} finally {
  await browser.close()
}
