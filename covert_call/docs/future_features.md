# Future features (paused for the prototype)

These AI requests are **built but switched off** for the hackathon prototype, to keep Gemini usage (and cost) to
what the core flow needs. Each is one flag in [`shared/aiFeatures.ts`](../shared/aiFeatures.ts); flip it to `true`
to bring the feature back. Nothing was removed.

| Feature | Flag | What it does | Why paused |
|---|---|---|---|
| Grounded location context | `groundedContext` | After a call, a Google-Search-grounded Gemini request adds weather / road conditions for the confirmed address to the case record. | Unreliable results today; one extra request (plus grounding) per call. |
| Caller age/gender nudge | `callerEstimateNudge` | Mid-call system note asking Mia to estimate the caller's age group and gender. | Not needed to dispatch help; Mia can still report it on her own. |
| Automatic credibility check | `credibilityAutoRun` | Dashboard runs the AI credibility check as soon as a call ends (once per viewer). | One extra request per case view; the **Check** button still runs it on demand. |
| Daily AI Insights auto-refresh | `insightsAutoRefresh` | Analytics page regenerates AI Insights once a day on load. | The **Refresh** button still generates them on demand. |
| Non-blocking report tools | `nonBlockingTools` | `report_*` tools answered silently, so a tool call doesn't make Gemini re-read the whole session. | Saves tokens on every call, but being A/B tested first: must not change how Mia behaves. |

## Also on the roadmap (not built)
- **Trimmed persona**: the system instruction is ~47k characters (~11.5k tokens) and is re-read on every reply;
  a shorter version keeping every rule would roughly halve per-minute token use.
- **Cloud Run backend**: move the Gemini key server-side and run post-call steps (summary, case linking) there.
- **Google Geocoding / Places**: precise Indian flat and landmark addresses (the free OpenStreetMap geocoders are
  area-level at best and rate-limited).
- **TURN relay** for live video on strict networks.
- **Native app**: demo-feed injection, two-key fallback in EAS env.
