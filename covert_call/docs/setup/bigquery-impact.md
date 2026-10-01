# Impact analytics: BigQuery sandbox + Looker Studio (Epic 26)

A public, **anonymised** report of incident patterns and response times. Free: the BigQuery sandbox needs no billing account.

## 1. Export (each time you want fresh numbers)
```bash
cd covert_call
npm run export:bq -w dashboard
```
This writes `dashboard/exports/incidents_anonymised.ndjson` (the folder is gitignored).

**What each row contains:**
- date, hour (IST) and weekday
- channel, whether it was an SOS, severity and status
- a **~1 km grid cell**
- people count and voice stress
- broad danger categories
- call length, time to acknowledge and time to resolve

**What is never exported:** names, notes, transcripts, addresses, exact pins, plates, recordings, demo calls.

## 2. Load into the BigQuery sandbox (first time)
1. Open https://console.cloud.google.com/bigquery in the `quickbite-5cde0` project. The sandbox banner means no billing is needed.
2. Create a dataset `impact`, with location `asia-south1` to match Firestore.
3. Create a table: **Upload** → choose the `.ndjson` file → format **JSONL** → table `incidents` → **Auto-detect** schema → Create.

To refresh later, create the table again with **Overwrite table** under Advanced options.

## 3. Looker Studio report
1. Go to https://lookerstudio.google.com → Blank report → **BigQuery** → `quickbite-5cde0` › `impact` › `incidents`.
2. Suggested charts:
   - **Incidents by area:** a geo or bubble map on `cell_lat` / `cell_lng`.
   - **When incidents happen:** a heatmap of `weekday` × `hour_ist`.
   - **Response time trend:** average `minutes_to_acknowledge` by `started_date`.
   - **Channel mix:** a donut on `channel`.
   - **Severity mix** and the **top danger categories** (unnest `categories`).
3. Share → "Anyone with the link can view". Put the link on the landing page and in the deck.

Sandbox tables expire after 60 days unless billing is enabled, so re-upload before the demo.
