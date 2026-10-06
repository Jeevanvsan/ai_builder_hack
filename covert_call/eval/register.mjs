// Preloaded with `node --import ./register.mjs` before any test module, because ES modules evaluate their imports
// first: the web app's firebase.ts would otherwise initialise before the env files are read.
import { existsSync } from 'node:fs'
import { register } from 'node:module'

// eval/.env.local first (test Gemini key), then the apps' env files for the Firebase web config.
for (const f of ['./.env.local', '../web/.env.local', '../dashboard/.env.local']) {
  const u = new URL(f, import.meta.url)
  if (existsSync(u)) process.loadEnvFile(u)
}
// Tests use the FREE-tier key ONLY (GEMINI_API_KEY_FREE). Any other key in the environment is ignored, so a test
// run can never spend the paid credits.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY_FREE ?? ''
delete process.env.GEMINI_API_KEY_FREE
// web/ and dashboard/ .env.local are read only for the Firebase config; drop the Gemini keys they carry (paid).
for (const k of Object.keys(process.env)) if (/^(VITE|EXPO_PUBLIC)_GEMINI_.*KEY/.test(k)) delete process.env[k]
if (!process.env.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY_FREE (free-tier key) in eval/.env.local.')
// The web app's helpers (post-call summary, case linking) get the same free key, and no paid key at all.
process.env.VITE_GEMINI_LIVE_API_KEY = process.env.GEMINI_API_KEY
process.env.VITE_GEMINI_LIVE_API_KEY_FREE = process.env.GEMINI_API_KEY
process.env.VITE_USE_AI_LOGIC = 'false'
process.env.VITE_USE_EMULATOR = 'false'

// A/B switch for the tool test: VITE_NONBLOCKING_TOOLS=true npm run test:ai -- …
if (process.env.VITE_NONBLOCKING_TOOLS) globalThis.QB_NONBLOCKING_TOOLS = process.env.VITE_NONBLOCKING_TOOLS === 'true'

register('./env-hooks.mjs', import.meta.url)
