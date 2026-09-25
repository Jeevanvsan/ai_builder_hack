# Shared incident client

This is the write side of the incident pipeline (Epic 3). The QuickBite app calls these functions during a session, and the Monitoring Dashboard picks up every write within about a second through its Firestore listeners. `types.ts` is the single definition of an incident document, shared by both apps.

Every function takes your app's Firestore instance, `getFirestore(app)`, as its first argument.

```ts
import {
  startIncident, updateLiveFields, recordVoiceStress, confirmAddress,
  recordLeakageCheck, consolidateIncident, endIncident,
} from '../../shared/incidents/client.ts'

// 1. The moment a session starts, before anything is known. The dashboard alerts immediately.
const { id } = await startIncident(db, { channel: 'live-call' })   // or 'silent-tap'
// A rough location attaches itself: GPS if it answers within 5s, otherwise IP-based, upgraded to GPS if it arrives later.

// 2. Each Gemini Live function call with partial extraction results
await updateLiveFields(db, id, { peopleCount: 2 })
await updateLiveFields(db, id, { dangerIndicators: ['weapon mentioned'], urgency: 'high' })

// 3. Each voice-stress reading (0-100)
await recordVoiceStress(db, id, 78)

// 4. When the persona's "delivery address" question gets an answer
await confirmAddress(db, id, '12th Main Road, HSR Layout, Bengaluru')

// 5. Once the call ends, two short Gemini text passes over the transcript (order doesn't matter, run them together)
await recordLeakageCheck(db, id, [])   // flags any uninvolved third party mentioned without consent
await consolidateIncident(db, id, { consolidatedSummary: '...', fieldConfidence: { peopleCount: 'confirmed' } })

// 6. Call over, or the zero-trace exit gesture
await endIncident(db, id)
```

- **Severity** is computed for you from urgency, danger indicators and voice stress (`severity.ts`). It never drops during a live call.
- **Address to coordinates** uses Google Geocoding if you pass `{ googleMapsKey }` to `confirmAddress`, and free OpenStreetMap Nominatim otherwise. If geocoding fails, the spoken address is still saved and marked `uncertain`.
- **Leakage check and consolidation** (`recordLeakageCheck`, `consolidateIncident`) only write the result — the Gemini calls that produce it run in the QuickBite app itself (`web/src/lib/gemini/leakageCheck.ts` and `consolidate.ts`), client-side, no backend needed.

To try it without the QuickBite app, run `npm run simulate-call` from `covert_call/dashboard/`. It plays a scripted call through these exact functions.
