// Firebase for the AI test in Node: reuses the web app's own Firebase app (env is loaded by register.mjs), so there
// is a single [DEFAULT] app, and test calls go to demoIncidents.
import { setDemoMode } from '../shared/incidents/client.ts'

export const apiKey = process.env.GEMINI_API_KEY!
export { db } from '../web/src/lib/firebase.ts'
export const setDemo = () => setDemoMode(true)
