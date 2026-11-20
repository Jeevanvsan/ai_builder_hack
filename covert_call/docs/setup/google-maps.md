# Google Maps Platform (Epic 34)

With a key, the apps use Google Maps Platform for every map and location lookup. Without a key, they use the free
OpenStreetMap services, exactly as before:

- **Dashboard.** The case board map (route, trail, live caller, accuracy ring) gets a **Map / Satellite / 3D**
  switch, and the side panel gets a **Street view** tab facing the caller.
- **Caller app (web, Android) and the eval.** Spoken addresses and landmarks go through **Places Text Search**.
  Nearby police, fire and hospitals, with phone numbers, come from **Places Nearby Search** (the best-known of each
  kind, nearest first). Walking, two-wheeler or car routes come from the **Routes API**. The Geocoding API is not
  used: Google refuses it for website-restricted keys, and Places covers addresses.

Code: `shared/google/maps.ts` (web services, set once per app with `setGoogleMaps`), `dashboard/src/components/`
`GoogleIncidentMap.tsx`, `GoogleIncident3D.tsx` and `board/StreetViewPanel.tsx`.

## 1. Project and billing
Use a Google Cloud project with a **billing account** attached. The project with the paid Gemini key works, and
the Maps keys don't need to live in the Firebase project. Every API below has a monthly free allowance, and a
prototype stays inside it, but Google requires billing to be enabled anyway.

Don't attach billing to the Firebase project (`quickbite-5cde0`) itself: that would move Firebase onto the
pay-as-you-go Blaze plan. If you have no billed project, create a new one under your own account. Google's
onboarding may also create an unrestricted "Maps Platform API Key"; delete it, or restrict it as in step 3.

1. **Billing → Budgets & alerts:** add a budget of about $10 a month, with alerts at 50% and 90%.
2. **APIs & Services → Library:** enable **Maps JavaScript API**, **Places API (New)** and **Routes API**. The
   Maps JavaScript API covers Street View and 3D Maps.
3. **Optional per-API quotas:** under each API's **Quotas** tab, cap the requests per day, e.g. Places at 300 and
   Routes at 500.

## 2. Map ID (the muted board look)
**Google Maps Platform → Map management → Create map ID:** pick JavaScript and **Vector**. Then:
1. Under **Map styles**, create a light, low-saturation style.
2. Attach the style to the Map ID.
3. Put the ID in `VITE_GOOGLE_MAP_ID` (dashboard).

Without it, Google's demo ID shows the default colourful style. The OSM board greys its tiles with CSS, but that
can't be done on a vector map without also greying the route.

## 3. Keys
Every key ends up public: it ships in a bundle or an app. So restrict each one by **API** (only the APIs listed
for it) and by **origin**. Create them under **Google Maps Platform → Keys & Credentials**.

| Key | Application restriction | APIs | Goes in |
|---|---|---|---|
| Dashboard | Websites: `https://quickbite-5cde0-dashboard.web.app/*`, `http://localhost:5174/*` | Maps JavaScript, Places (New), Routes | `dashboard/.env.local`: `VITE_GOOGLE_MAPS_API_KEY` |
| Caller web app | Websites: `https://quickbite-5cde0.web.app/*`, `https://quickbite-5cde0-staging.web.app/*`, `http://localhost/*`, `http://localhost:5173/*` | Places (New), Routes | `web/.env.local` and `eval/.env.local`: `VITE_GOOGLE_MAPS_API_KEY` |
| Android app | Android apps: package `com.quickbite.app` + the build's SHA-1 | Places (New), Routes | `native/.env.local` and EAS: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_ANDROID_CERT_SHA1` |

Notes:

- **Preview channels.** Hosting preview channels (`…--<channel>-<hash>.web.app`) have their own host names. Add
  each channel's exact URL to its key once the channel exists; the URL stays the same while the channel lives.
  Never allow `*.web.app`, which would let any Firebase site use the key.
- **The eval** (`eval/run.ts`) uses the caller web key and sends `Referer: http://localhost/`, which the
  `http://localhost/*` entry accepts. Put the key in `eval/.env.local` as well: the eval reads its own file
  first, and Node keeps the first value it reads, even an empty one. `GOOGLE_MAPS=off` runs it on OpenStreetMap,
  for an A/B comparison.
- **Android.** An app-restricted key used for direct web requests needs two headers, `X-Android-Package` and
  `X-Android-Cert`. The app sends them when `EXPO_PUBLIC_ANDROID_CERT_SHA1` is set (`native/src/lib/config.ts`).
- **Add the new names to the `.env.example` templates** (web, dashboard, native). They weren't added with the code.

## 4. Check it
1. **Dashboard.** Run it locally and open a case with a route, e.g. INC-MUZKKVL1. Check:
   - the Google map shows the same route, trail, live marker, next turn and destination as the OSM map;
   - Satellite and 3D switch;
   - the Street view tab opens facing the caller, or says there's no imagery nearby (common in Kerala).
2. **Caller app.** Make a call and give an address. The console should show no `[maps] … 403` lines.
3. **Usage.** Open **Google Maps Platform → Metrics**: requests should appear per API.
4. **Restrictions.** Call the key from an origin it doesn't list. It must fail.

## What it costs
2026 prices, per month, from Google's [pricing page](https://developers.google.com/maps/billing-and-pricing/pricing):

| Used for | SKU | Free per month | Then, per 1,000 |
|---|---|---|---|
| Dashboard map (Map, Satellite) | Dynamic Maps | 10,000 loads | $7 |
| Street view tab | Dynamic Street View | 5,000 | $14 |
| Street view "is there imagery here?" check | Street View metadata | unlimited | free |
| Addresses and landmarks | Places Text Search (Pro) | 5,000 | $32 |
| Nearby stations with phone numbers | Places Nearby Search (Enterprise) | 1,000 | $35 |
| Landmark at a turn | Places Nearby Search (Pro) | 5,000 | $32 |
| Routes | Routes: Compute Routes (Essentials) | 10,000 | $5 |

Station lookups are cached for 5 minutes per area. The panorama loads only while the Street view tab is open, and
only again after the caller has moved 75 m.
