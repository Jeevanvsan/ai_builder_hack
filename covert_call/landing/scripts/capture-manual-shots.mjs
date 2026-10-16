// Takes the screenshots used by the user manual (/manual) and checks, against the LIVE app, that what the manual
// says still holds (labels, coded-item meanings, what reaches the dashboard). Run from covert_call/landing:
//
//   QB_DASH_EMAIL=<responder email> QB_DASH_PASSWORD=<password> npm run shots -- [step …] [--with-incidents]
//
// Safe steps (the default): phone, codes, mic, dashboard. They only read.
// Steps that create REAL incidents on production need --with-incidents: order, plain, silent, sos, demo, call,
// ai-covert, ai-chase. Their incident ids are remembered; `cleanup` resolves exactly those (nothing is deleted).
// Images go to public/shots/manual/*.webp (live-call frames to the scratch folder printed at the end).
// Needs Chrome for Testing 153 (the puppeteer cache path below) or CHROME_PATH.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { ALL_CODES } from '../../shared/codes.ts'

// QB_WEB_URL points the phone steps at another build (e.g. a local preview of a fix that isn't deployed yet).
const WEB = process.env.QB_WEB_URL || 'https://quickbite-5cde0.web.app'
const DASH = 'https://quickbite-5cde0-dashboard.web.app'
const OUT = fileURLToPath(new URL('../public/shots/manual/', import.meta.url))
const SCRATCH = join(tmpdir(), 'quickbite-manual-shots')
const RUN_FILE = join(SCRATCH, 'incidents.json')
const CHROME = process.env.CHROME_PATH || join(homedir(), '.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome')
// Alappuzha, where the recorded calls happened; phone GPS-grade accuracy.
const GEO = { latitude: 9.4981, longitude: 76.3388, accuracy: 15 }
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'
const SHOWCASE = ['INC-MUZNKM7N', 'INC-MUZKKVL1'] // linked from the deck and README: never resolve or alter

const args = process.argv.slice(2)
const withIncidents = args.includes('--with-incidents')
const SAFE = ['phone', 'codes', 'mic', 'dashboard']
const RISKY = ['order', 'plain', 'silent', 'sos', 'demo', 'call', 'ai-covert', 'ai-chase']
const picked = args.filter((a) => !a.startsWith('--'))
const steps = picked.length ? picked : SAFE

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(ok, what, detail = '') {
  results.push({ ok: !!ok, what, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${what}${detail ? ` — ${detail}` : ''}`)
}
const created = existsSync(RUN_FILE) ? JSON.parse(readFileSync(RUN_FILE, 'utf8')) : []
function remember(id, note) {
  if (!id || SHOWCASE.includes(id) || created.some((c) => c.id === id)) return
  created.push({ id, note, at: new Date().toISOString() })
  writeFileSync(RUN_FILE, JSON.stringify(created, null, 2))
}

mkdirSync(OUT, { recursive: true })
mkdirSync(SCRATCH, { recursive: true })

async function launch({ fakeMediaUi = true } = {}) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream',
      ...(fakeMediaUi ? ['--use-fake-ui-for-media-stream'] : []),
      '--autoplay-policy=no-user-gesture-required',
      '--lang=en-IN',
    ],
  })
}

// A fresh phone (incognito context, so the cart, demo limit and AI-caller flags never leak between flows).
async function phone(browser, path = '/', { grant = true } = {}) {
  const ctx = await browser.createBrowserContext()
  if (grant) await ctx.overridePermissions(WEB, ['geolocation', 'microphone', 'camera'])
  const page = await ctx.newPage()
  await page.setUserAgent(ANDROID_UA)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  if (grant) await page.setGeolocation(GEO)
  page.on('pageerror', (e) => console.log('    [phone error]', String(e).slice(0, 160)))
  // The incident ids this phone writes, read from its own Firestore requests (doesn't depend on the queue).
  page.incidentIds = new Set()
  page.on('request', (r) => { for (const m of (r.postData() ?? '').matchAll(/incidents(?:%2F|\/)(INC-[A-Za-z0-9-]+)/g)) page.incidentIds.add(m[1]) })
  await page.goto(WEB + path, { waitUntil: 'networkidle2', timeout: 60_000 })
  return page
}

const text = (page) => page.evaluate(() => document.body.innerText)
async function waitText(page, needle, timeout = 20_000) {
  try {
    await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout, polling: 250 }, needle)
    return true
  } catch {
    return false
  }
}
// Clicks the first element matching `selector` whose text contains `label`.
async function clickText(page, selector, label) {
  const ok = await page.evaluate((sel, l) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(l))
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }, selector, label)
  if (!ok) throw new Error(`no ${selector} with "${label}"`)
}
// Press and hold (pointer events, like a finger): `whileHeld` runs before the finger lifts.
async function hold(page, selector, ms, whileHeld) {
  const el = await page.waitForSelector(selector, { visible: true })
  const box = await el.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await sleep(ms)
  if (whileHeld) await whileHeld()
  await page.mouse.up()
}
async function shot(page, name, opts = {}) {
  // captureBeyondViewport off: re-laying out the page for the capture would cancel a press that is being held.
  await page.screenshot({ path: join(OUT, `${name}.webp`), type: 'webp', quality: 82, captureBeyondViewport: false, ...opts })
  console.log(`  📷 ${name}.webp`)
}
async function shotEl(page, selector, name) {
  const el = await page.waitForSelector(selector, { visible: true })
  await el.screenshot({ path: join(OUT, `${name}.webp`), type: 'webp', quality: 85 })
  console.log(`  📷 ${name}.webp`)
}

// Numbered badges drawn into the page right before a screenshot, so they line up exactly with what they point
// at. The manual repeats each number with its label as text under the image.
// Marks without `n` are numbered in order, skipping targets that aren't on screen; returns "n label" lines for
// the manual's legend.
async function badges(page, marks) {
  return page.evaluate((list) => {
    document.querySelectorAll('.qb-manual-badge').forEach((b) => b.remove())
    const legend = []
    let next = 1
    for (const m of list) {
      const el = m.text
        ? [...document.querySelectorAll(m.sel)].find((e) => e.textContent.includes(m.text))
        : document.querySelector(m.sel)
      if (!el) continue
      const n = m.n ?? next
      next = n + 1
      legend.push(`${n} ${m.label ?? m.text ?? m.sel}`)
      const r = el.getBoundingClientRect()
      const b = document.createElement('div')
      b.className = 'qb-manual-badge'
      b.textContent = String(n)
      const size = m.size ?? 26
      // left/right: on the target's top corner; after: just past its right edge; center: on top of it.
      const x = m.at === 'right' ? r.right - size * 0.6 : m.at === 'after' ? r.right + 4 : m.at === 'center' ? r.left + r.width / 2 - size / 2 : r.left - size * 0.4
      const y = m.at === 'center' || m.at === 'after' ? r.top + r.height / 2 - size / 2 : r.top - size * 0.4
      Object.assign(b.style, {
        position: 'fixed', left: `${Math.max(2, x)}px`, top: `${Math.max(2, y)}px`, width: `${size}px`, height: `${size}px`,
        borderRadius: '50%', background: '#e8590c', color: '#fff', font: `700 ${Math.round(size * 0.55)}px/1 system-ui, sans-serif`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
        boxShadow: '0 2px 6px rgba(0,0,0,.35)', zIndex: 2147483647, pointerEvents: 'none',
      })
      document.body.appendChild(b)
    }
    return legend
  }, marks)
}
const clearBadges = (page) => page.evaluate(() => document.querySelectorAll('.qb-manual-badge').forEach((b) => b.remove()))

// ---------------------------------------------------------------- dashboard helpers
let dashBrowser = null
let dashPage = null
async function dashboard() {
  if (dashPage) return dashPage
  const email = process.env.QB_DASH_EMAIL
  const password = process.env.QB_DASH_PASSWORD
  if (!email || !password) throw new Error('Set QB_DASH_EMAIL and QB_DASH_PASSWORD for the dashboard steps')
  dashBrowser = await launch()
  dashPage = await dashBrowser.newPage()
  await dashPage.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.25 })
  dashPage.on('pageerror', (e) => console.log('    [dashboard error]', String(e).slice(0, 160)))
  await dashPage.goto(DASH + '/', { waitUntil: 'networkidle2', timeout: 60_000 })
  await dashPage.waitForSelector('#signin-email', { timeout: 30_000 })
  await dashPage.type('#signin-email', email)
  await dashPage.type('#signin-password', password)
  await dashPage.click('button[type=submit]')
  check(await waitText(dashPage, 'Live queue', 30_000), 'dashboard sign-in works for the test account')
  await quiet(dashPage)
  return dashPage
}
// Removes the overlays a screenshot shouldn't show: the "Sound is off" banner, toasts, the critical pop-up.
async function quiet(page) {
  await page.evaluate(() => {
    document.querySelector('.sound-banner')?.click()
    for (const b of document.querySelectorAll('button')) if (/^(Dismiss|×)$/.test(b.textContent.trim())) b.click()
  })
  await sleep(400)
}
async function queueIds(page) {
  await page.goto(DASH + '/', { waitUntil: 'networkidle2' })
  await sleep(2500)
  return page.evaluate(() => [...document.querySelectorAll('.incident-card .incident-card-id')].map((a) => a.textContent.trim()))
}
// Waits for an incident that wasn't in `before` to show up in the Live queue; returns its id and row text.
async function newIncident(page, before, label, timeout = 45_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.incident-card')].map((r) => ({ id: r.querySelector('.incident-card-id')?.textContent.trim(), text: r.innerText })),
    )
    const hit = rows.find((r) => r.id && !before.includes(r.id) && (!label || r.text.toLowerCase().includes(label.toLowerCase())))
    if (hit) return hit
    await sleep(1000)
  }
  return null
}
async function openIncident(page, id) {
  await page.goto(`${DASH}/incident/${id}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.case-board', { timeout: 30_000 })
  await sleep(4000) // tiles spring in and their text "decodes"
  await quiet(page)
}
async function respond(page, id, action) {
  await openIncident(page, id)
  const label = { acknowledge: 'Acknowledge', start: 'Start response', resolve: 'Resolve' }[action]
  const available = await page.$eval('.case-actions', (e, l) => [...e.querySelectorAll('button')].some((b) => b.textContent.trim() === l), label)
  if (!available) { console.log(`    (no "${label}" button on ${id}: ${(await page.$eval('.case-actions', (e) => e.innerText)).replace(/\s+/g, ' ')})`); return }
  await clickText(page, '.case-actions button', label)
  if (action === 'resolve') {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Resolve incident'), { timeout: 10_000 })
    await clickText(page, 'button', 'Resolve incident')
  }
  await sleep(2500)
}
const tileText = (page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.evidence-tile')].map((t) => [t.querySelector('.evidence-label')?.textContent.trim(), t.innerText])))
// Warns about anything that looks like personal data before a dashboard image is published.
async function privacyScan(page, name) {
  const found = await page.evaluate(() => {
    const t = document.body.innerText
    return [...new Set([...(t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []), ...(t.match(/(\+?\d[\d -]{8,}\d)/g) ?? [])])]
  })
  const flagged = found.filter((x) => !/judge@quickbite\.com|yopmail\.com/.test(x))
  if (flagged.length) console.log(`  ⚠ ${name}: check before publishing → ${flagged.join(', ')}`)
}

// ---------------------------------------------------------------- phone (QuickBite) helpers
async function openItem(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await clickText(page, '.chip', 'All')
  await sleep(300)
  await clickText(page, '.item-card', name)
  await page.waitForSelector('.sheet .sheet-img', { visible: true })
  await sleep(700) // let the sheet finish sliding in, or the hold is cancelled
}
async function closeSheet(page) {
  await page.keyboard.press('Escape')
  await sleep(400)
}
async function addViaSheet(page, name, qty = 1) {
  await openItem(page, name)
  for (let i = 1; i < qty; i++) await page.click('.sheet-footer [aria-label="Increase quantity"]')
  await clickText(page, '.sheet-footer .primary-btn', 'Add item')
  await sleep(500)
}

// ---------------------------------------------------------------- steps
const STEPS = {
  async phone(browser) {
    const page = await phone(browser)
    await page.waitForSelector('.call-cta')
    const bar = await page.$eval('.bottom-bar', (e) => e.innerText)
    check(bar.includes('Ordering as guest') && bar.includes('Delivery instructions') && bar.includes('Call to order'), 'empty cart: bottom bar shows Ordering as guest / Delivery instructions / Call to order')
    await badges(page, [
      { n: 1, sel: '[aria-label="Favourites"]', at: 'left' },
      { n: 2, sel: '[aria-label="Account"]', at: 'right' },
      { n: 3, sel: '.chips', at: 'left' },
      { n: 4, sel: '.guest-subtle-link', at: 'after' },
      { n: 5, sel: '.call-cta', at: 'left' },
    ])
    await shot(page, 'qb-home')
    await clearBadges(page)

    await clickText(page, '.chip', 'Add-ons')
    await sleep(600)
    await shot(page, 'qb-addons')
    check((await text(page)).includes('Extra Pepperoni'), 'Add-ons chip lists the coded add-ons')

    await openItem(page, 'Cheesy Garlic Bread')
    await hold(page, '.sheet-img', 800)
    const reveal = await page.$eval('.code-reveal', (e) => e.textContent.trim()).catch(() => null)
    check(reveal === 'someone is following or chasing you', 'holding the Cheesy Garlic Bread picture reveals its meaning', reveal ?? 'nothing shown')
    await badges(page, [
      { n: 1, sel: '.sheet-img', at: 'center', size: 30 },
      { n: 2, sel: '.code-reveal', at: 'left' },
      { n: 3, sel: '.sheet-footer .stepper', at: 'left' },
      { n: 4, sel: '.sheet-footer .primary-btn', at: 'right' },
    ])
    await shot(page, 'qb-item-meaning')
    await clearBadges(page)
    for (let i = 1; i < 2; i++) await page.click('.sheet-footer [aria-label="Increase quantity"]')
    await clickText(page, '.sheet-footer .primary-btn', 'Add item')
    await sleep(500)
    await addViaSheet(page, 'Extra Pepperoni')
    const cartBar = await page.$eval('.bottom-bar', (e) => e.innerText)
    check(cartBar.includes('3 items') && cartBar.includes('View cart') && !cartBar.includes('Call to order'), 'cart with items: bar shows "3 items · View cart" and hides Call to order', cartBar.replace(/\s+/g, ' '))

    await page.click('.cart-bar')
    await page.waitForSelector('.checkout-bar')
    await page.click('.checkout-bar')
    await waitText(page, 'Delivery time')
    const checkout = await text(page)
    check(['Standard', 'Priority', 'As soon as possible', 'Place order'].every((l) => checkout.includes(l)), 'checkout shows Delivery time: Standard / Priority / As soon as possible + Place order')
    await clickText(page, '.pay-option', 'As soon as possible')
    await page.evaluate(() => [...document.querySelectorAll('.card-title')].find((h) => h.textContent === 'Delivery time')?.scrollIntoView({ block: 'center' }))
    await sleep(400)
    await shot(page, 'qb-checkout')
    await page.browserContext().close()
  },

  async codes(browser) {
    const page = await phone(browser)
    await page.waitForSelector('.call-cta')
    for (const c of ALL_CODES) {
      await openItem(page, c.menuLabel)
      await hold(page, '.sheet-img', 700)
      const got = await page.$eval('.code-reveal', (e) => e.textContent.trim()).catch(() => null)
      check(got === c.meaning, `hold reveals the meaning of ${c.menuLabel}`, got === c.meaning ? '' : `got "${got}"`)
      await closeSheet(page)
    }
    for (const name of ['Extra Hot Sauce', 'Cheese Dip', 'Margherita Pizza']) {
      await openItem(page, name)
      await hold(page, '.sheet-img', 700)
      check(!(await page.$('.code-reveal')), `${name} (ordinary) reveals nothing`)
      await closeSheet(page)
    }
    await page.browserContext().close()
  },

  async mic() {
    // A browser that never grants the mic: the call screen must explain how to allow it, without creating an incident.
    const browser = await launch({ fakeMediaUi: false })
    const page = await phone(browser, '/', { grant: false })
    const cdp = await browser.target().createCDPSession()
    await cdp.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: WEB, browserContextId: page.browserContext().id })
    await page.click('.call-cta')
    const ok = await waitText(page, 'Allow the microphone', 20_000)
    check(ok, 'mic refused: call screen shows "Allow the microphone" with steps', ok ? '' : (await text(page)).slice(0, 120))
    await shot(page, 'qb-mic-help')
    await browser.close()
  },

  async dashboard() {
    const page = await dashboard()
    for (const id of SHOWCASE) {
      await openIncident(page, id)
      check(await page.$('.case-board'), `recorded incident ${id} opens by URL after sign-in`)
    }
    await openIncident(page, SHOWCASE[0])
    console.log('    tiles:', JSON.stringify(await tileText(page)).slice(0, 400))
    await privacyScan(page, 'dash-board')
    const legend = await badges(page, [
      { sel: '.case-status', at: 'left', label: 'header: id, severity, status, channel' },
      { sel: '.case-recommendation', at: 'left', label: 'AI recommends' },
      { sel: '.case-actions', at: 'left', label: 'response buttons' },
      { sel: '.slot-hub', at: 'left', label: 'map hub' },
      ...['Threat', 'Vehicle', 'Subjects', 'Location', 'Voice stress', 'Seen & heard', 'Nearby help', 'Route to safety', 'Linked cases'].map((t) => ({ sel: '.evidence-tile', text: t, at: 'left' })),
      { sel: '.panel-tabs', at: 'left', label: 'side panel tabs' },
      { sel: '.timeline-rail', at: 'left', label: 'timeline' },
    ])
    console.log('    dash-board legend:', legend.join(' | '))
    await shot(page, 'dash-board')
    await clearBadges(page)
    // Conversation: the first coded answer, where the food word is struck through with its meaning.
    await clickText(page, '.panel-tabs button', 'Conversation')
    await sleep(2500)
    await page.evaluate(() => document.querySelector('.bubble-caller .bubble-coded')?.closest('.bubble')?.scrollIntoView({ block: 'center' }))
    await sleep(800)
    await privacyScan(page, 'dash-conversation')
    await shotEl(page, '.side-panel', 'dash-conversation')
    // Case file, from the dispatch bulletin down: recordings and the replay slider.
    await clickText(page, '.panel-tabs button', 'Case file')
    await sleep(2500)
    await page.evaluate(() => [...document.querySelectorAll('.side-panel *')].find((e) => e.children.length === 0 && /^dispatch bulletin$/i.test(e.textContent.trim()))?.scrollIntoView({ block: 'start' }))
    await sleep(800)
    await shotEl(page, '.side-panel', 'dash-casefile')
    await clickText(page, '.panel-tabs button', 'Scene')
    await sleep(2500)
    await shotEl(page, '.side-panel', 'dash-scene')
    await openIncident(page, SHOWCASE[1])
    check(Object.keys(await tileText(page)).includes('Route to safety'), 'chase recording shows the Route to safety tile')
    // The Scene tab, so the case file's report email isn't in the picture.
    await clickText(page, '.panel-tabs button', 'Scene')
    await sleep(2500)
    await privacyScan(page, 'dash-route')
    await shot(page, 'dash-route')
    await page.goto(DASH + '/analytics', { waitUntil: 'networkidle2' })
    await sleep(6000)
    await quiet(page)
    await privacyScan(page, 'dash-analytics')
    await shot(page, 'dash-analytics')
  },

  async order(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    await page.waitForSelector('.call-cta')
    await addViaSheet(page, 'Cheesy Garlic Bread', 2)
    await addViaSheet(page, 'Extra Pepperoni')
    await page.click('.cart-bar')
    await page.waitForSelector('.checkout-bar')
    await page.click('.checkout-bar')
    await waitText(page, 'Delivery time')
    await clickText(page, '.pay-option', 'As soon as possible')
    await clickText(page, '.checkout-bar', 'Place order')
    check(await waitText(page, 'Order placed!', 30_000), 'Place order lands on "Order placed!"')
    await shot(page, 'qb-order-placed')

    const row = await newIncident(dash, before, 'Coded order')
    check(row, 'coded order appears in the Live queue as "Coded order"', row?.id ?? 'not found')
    if (!row) return
    remember(row.id, 'coded order')
    check(/being followed or chased/i.test(row.text) && /HIGH/i.test(row.text), 'queue row: followed tag + HIGH', row.text.replace(/\s+/g, ' ').slice(0, 160))
    await quiet(dash)
    await badges(dash, [
      { n: 1, sel: '.stats', at: 'left' },
      { n: 2, sel: '.incident-card', at: 'left' },
      { n: 3, sel: 'input[placeholder^="Describe"]', at: 'left' },
      { n: 4, sel: 'select', at: 'left' },
    ])
    await privacyScan(dash, 'dash-queue')
    await shot(dash, 'dash-queue')
    await clearBadges(dash)

    await openIncident(dash, row.id)
    const tiles = await tileText(dash)
    console.log('    tiles:', JSON.stringify(tiles))
    check(/weapon present/i.test(JSON.stringify(tiles)) && /2 people/i.test(JSON.stringify(tiles)), 'board: weapon present + 2 people')
    await shot(dash, 'dash-coded-order')

    await respond(dash, row.id, 'acknowledge')
    check(await waitText(page, 'Rider assigned', 15_000), 'phone order status follows Acknowledge')
    await respond(dash, row.id, 'start')
    await sleep(2000)
    const onTheWay = await page.evaluate(() => [...document.querySelectorAll('.order-steps li')].map((l) => l.innerText).join(' | '))
    console.log('    order steps:', onTheWay)
    await page.evaluate(() => document.querySelector('.order-steps')?.scrollIntoView({ block: 'center' }))
    await shot(page, 'qb-order-on-the-way')
    await respond(dash, row.id, 'resolve')
    await sleep(2500)
    const delivered = await page.evaluate(() => document.querySelector('.order-steps')?.innerText ?? '')
    console.log('    after resolve:', delivered.replace(/\s+/g, ' '))
    await page.browserContext().close()
  },

  async plain(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    await page.waitForSelector('.call-cta')
    await addViaSheet(page, 'Margherita Pizza')
    await page.click('.cart-bar')
    await page.waitForSelector('.checkout-bar')
    await page.click('.checkout-bar')
    await waitText(page, 'Delivery time')
    await clickText(page, '.checkout-bar', 'Place order')
    check(await waitText(page, 'Order placed!', 30_000), 'ordinary order also shows "Order placed!"')
    const row = await newIncident(dash, before, null, 12_000)
    check(!row, 'an ordinary order raises no incident', row?.id ?? '')
    if (row) remember(row.id, 'unexpected incident from an ordinary order')
    await page.browserContext().close()
  },

  async silent(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    await page.waitForSelector('.guest-subtle-link')
    await page.click('.guest-subtle-link')
    await page.waitForFunction(() => !document.querySelector('.checkout-bar')?.disabled, { timeout: 30_000 })
    const row = await newIncident(dash, before, 'Silent tap')
    check(row, 'opening Delivery instructions starts a "Silent tap" incident at once', row?.id ?? 'not found')
    if (row) remember(row.id, 'silent tap')
    // Held with a pointer event inside the page: a real mouse held during the capture loses the hover and the
    // option hides its meaning again before the image is taken.
    const option = '.tap-option:nth-child(5)'
    await page.$eval(option, (el) => { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    await sleep(800)
    const held = await page.$eval(`${option} .tap-option-meaning`, (e) => e.textContent).catch(() => null)
    check(held === 'A weapon is present — send help urgently', 'holding "Don\'t ring, leave silently" shows its meaning', held ?? 'nothing')
    await shot(page, 'qb-instructions-hold')
    await page.$eval(option, (el) => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })))
    await clickText(page, '.tap-option', "Don't ring, leave silently")
    await clickText(page, '.tap-option', 'Call on arrival')
    await page.type('input[placeholder="Confirm your address"]', 'Convent Square, Alappuzha')
    await page.type('textarea', 'Man with a knife at the gate')
    await sleep(1500)
    if (row) {
      await openIncident(dash, row.id)
      const tiles = JSON.stringify(await tileText(dash))
      check(/weapon mentioned/i.test(tiles) && /aggressor present/i.test(tiles), 'each tap reached the dashboard before Save', tiles.slice(0, 200))
    }
    await clickText(page, '.checkout-bar', 'Save instructions')
    const home = await page.waitForFunction(() => location.pathname === '/', { timeout: 60_000 }).then(() => true, () => false)
    check(home, 'Save instructions returns to the home screen', home ? '' : page.url())
    await page.goBack().catch(() => {})
    await sleep(800)
    check(!page.url().includes('delivery-instructions'), 'Back does not return to the report screen', page.url())
    if (row) {
      await sleep(4000)
      await openIncident(dash, row.id)
      await shot(dash, 'dash-silent-tap')
    }
    await page.browserContext().close()
  },

  async sos(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    const heart = await page.waitForSelector('[aria-label="Favourites"]')
    await heart.click()
    await sleep(120)
    await heart.click()
    await page.waitForSelector('.sos-blackout', { timeout: 15_000 })
    check(page.url().endsWith('/sos'), 'double-tapping the heart opens the black SOS screen')
    const row = await newIncident(dash, before, 'Silent SOS')
    const sosId = row?.id ?? [...page.incidentIds][0]
    check(row && /SOS/.test(row.text), 'SOS appears as "Silent SOS" with the SOS badge', row?.id ?? `not in the queue; phone wrote ${sosId ?? 'nothing'}`)
    if (sosId) remember(sosId, 'silent SOS')
    await sleep(15_000)
    for (let i = 0; i < 3; i++) { await page.mouse.click(195, 420); await sleep(250) }
    try {
      await page.waitForFunction(() => location.pathname === '/', { timeout: 30_000 })
      check(true, 'three quick taps end the SOS and return home')
    } catch {
      check(false, 'three quick taps end the SOS and return home', page.url())
    }
    await page.browserContext().close()
  },

  async demo(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    await hold(page, '.brand', 2300)
    await page.waitForFunction(() => location.search.includes('demo=1'), { timeout: 10_000 }).catch(() => {})
    check(page.url().includes('/call?demo=1'), 'holding the logo for 2 s opens a demo call')
    const badge = await page.$eval('.demo-badge', (e) => e.textContent).catch(() => null)
    check(badge, 'demo call shows its label', badge ?? 'none')
    await waitText(page, ':', 20_000)
    await sleep(12_000)
    await page.click('[aria-label="End call"]')
    check(await waitText(page, 'What the responder would see', 40_000), 'demo call ends on "What the responder would see"')
    await sleep(3000)
    await shot(page, 'qb-demo-result')
    const row = await newIncident(dash, before, 'DEMO', 20_000)
    check(row, 'demo call is listed on the dashboard with a DEMO tag', row?.id ?? 'not found')
    if (row) remember(row.id, 'demo call')
    await page.browserContext().close()
  },

  async call(browser) {
    const dash = await dashboard()
    const before = await queueIds(dash)
    const page = await phone(browser)
    await page.click('.call-cta')
    check(await waitText(page, 'QuickBite Order Desk', 20_000), 'call screen reads "QuickBite Order Desk"')
    await page.waitForFunction(() => /\d\d:\d\d/.test(document.querySelector('.call-status')?.textContent ?? ''), { timeout: 30_000 }).catch(() => {})
    await sleep(6000)
    await shot(page, 'qb-call')
    const row = await newIncident(dash, before, 'Voice call', 20_000)
    if (row) remember(row.id, 'short call for the screenshot')
    await page.click('[aria-label="End call"]')
    await page.waitForFunction(() => location.pathname === '/', { timeout: 30_000 }).catch(() => {})
    check(page.url().endsWith('/'), 'red button ends the call on the home screen')
    await page.goBack().catch(() => {})
    await sleep(800)
    check(!page.url().includes('/call'), 'Back does not return to the call', page.url())
    await page.browserContext().close()
  },

  'ai-covert': (browser) => aiCall(browser, '/?aiCaller=domestic', 'covert'),
  // Real (emulated) GPS, not ?gpsSim: on the live app a call with simulated GPS stays on "Connecting…".
  'ai-chase': (browser) => aiCall(browser, '/?aiCaller=1', 'chase'),

  async cleanup() {
    const dash = await dashboard()
    for (const c of created) {
      if (SHOWCASE.includes(c.id)) continue
      await openIncident(dash, c.id)
      const actions = await dash.$eval('.case-actions', (e) => e.innerText)
      if (actions.includes('Resolved')) { console.log(`    ${c.id} already resolved`); continue }
      if (actions.includes('Acknowledge')) await respond(dash, c.id, 'acknowledge')
      await respond(dash, c.id, 'resolve')
      console.log(`    resolved ${c.id} (${c.note})`)
    }
  },
}

// A full call played by the app's own AI caller (Gemini plays the person on the phone), watched live on the
// dashboard: frames go to the scratch folder, the conversation and tiles are logged so the manual's script can
// be checked against what Mia really said.
async function aiCall(browser, path, tag) {
  const dash = await dashboard()
  const before = await queueIds(dash)
  const page = await phone(browser, path)
  page.on('console', (m) => { const t = m.text(); if (/QuickBite|AI caller|route/i.test(t)) console.log('    [phone]', t.slice(0, 160)) })
  await page.waitForSelector('.call-cta')
  await page.click('.call-cta')
  const row = await newIncident(dash, before, 'Voice call', 45_000)
  const id = row?.id ?? [...page.incidentIds][0]
  check(row, `${tag}: call appears in the Live queue as "Voice call"`, row?.id ?? `not in the queue; phone wrote ${id ?? 'nothing'}`)
  if (!id) { console.log('    phone screen:', (await text(page)).replace(/\s+/g, ' ').slice(0, 200)); return }
  remember(id, `AI-caller ${tag} call`)
  await openIncident(dash, id)
  let messaged = false
  const started = Date.now()
  for (let i = 0; Date.now() - started < 6 * 60_000; i++) {
    await quiet(dash)
    await dash.screenshot({ path: join(SCRATCH, `${tag}-live-${String(i).padStart(2, '0')}.webp`), type: 'webp', quality: 80 })
    const live = await dash.evaluate(() => !!document.querySelector('.case-page.is-live'))
    if (!messaged && Date.now() - started > 70_000 && live) {
      await clickText(dash, '.panel-tabs button', 'Message caller').catch(() => {})
      await sleep(800)
      await clickText(dash, '.mc-chip', 'Help is about 5 minutes away').catch(() => {})
      messaged = true
      await sleep(1500)
      await clickText(dash, '.panel-tabs button', 'Conversation').catch(() => {})
    }
    if (!live && page.url().endsWith('/')) break
    await sleep(15_000)
  }
  console.log(`    ${tag}: call ended after ${Math.round((Date.now() - started) / 1000)} s; waiting for the case summary`)
  await sleep(60_000)
  await openIncident(dash, id)
  await clickText(dash, '.panel-tabs button', 'Conversation')
  await sleep(1500)
  const convo = await dash.$eval('.side-panel', (e) => e.innerText).catch(() => '')
  writeFileSync(join(SCRATCH, `${tag}-conversation.txt`), convo)
  const tiles = await tileText(dash)
  writeFileSync(join(SCRATCH, `${tag}-tiles.json`), JSON.stringify(tiles, null, 2))
  await dash.screenshot({ path: join(SCRATCH, `${tag}-final-board.webp`), type: 'webp', quality: 80 })
  await clickText(dash, '.panel-tabs button', 'Message caller').catch(() => {})
  await sleep(1000)
  const msg = await dash.$eval('.side-panel', (e) => e.innerText).catch(() => '')
  check(!messaged || /Delivered/.test(msg), `${tag}: responder message relayed by Mia`, msg.split('\n').find((l) => /Delivered|Waiting|Not delivered/.test(l)) ?? '')
  await clickText(dash, '.panel-tabs button', 'Case file')
  await sleep(1500)
  const caseFile = await dash.$eval('.side-panel', (e) => e.innerText).catch(() => '')
  writeFileSync(join(SCRATCH, `${tag}-casefile.txt`), caseFile)
  await dash.screenshot({ path: join(SCRATCH, `${tag}-final-casefile.webp`), type: 'webp', quality: 80 })
  console.log(`    ${tag}: tiles ${JSON.stringify(Object.keys(tiles))}`)
  await page.browserContext().close()
}

// ---------------------------------------------------------------- main
const browser = await launch()
try {
  for (const s of steps) {
    if (!STEPS[s]) { console.log(`Unknown step "${s}". Steps: ${[...SAFE, ...RISKY, 'cleanup'].join(', ')}`); continue }
    if (RISKY.includes(s) && !withIncidents) { console.log(`Skipping "${s}": it creates a real incident; add --with-incidents`); continue }
    console.log(`\n▶ ${s}`)
    try {
      await STEPS[s](browser)
    } catch (e) {
      check(false, `step "${s}" crashed`, String(e?.message ?? e).slice(0, 200))
    }
  }
} finally {
  await browser.close()
  await dashBrowser?.close()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${created.length ? ` Incidents made by this script: ${created.map((c) => c.id).join(', ')} (resolve with the "cleanup" step).` : ''}`)
console.log(`Scratch output: ${SCRATCH}`)
process.exit(failed.length ? 1 : 0)
