# AI models: which model does which task

QuickBite uses the **smallest model that does each job well**, instead of one model for everything. Spreading the
work also gives each task its own free-tier quota (free limits are per model), so a busy task can't starve the
others. The mapping lives in one file, [`shared/aiModels.ts`](../shared/aiModels.ts), used by the web app, the
dashboard, the native app and the test harness.

## Mapping

| Task | Where | Model | Why this model |
|---|---|---|---|
| Live disguised call with Mia (voice, camera, tools) | web + native call | `gemini-3.8-live` | Only the Live API does real-time voice + vision + function calling. |
| Silent SOS observer (heart double-tap) | web + native SOS | `gemini-3.8-live` | Same: continuous mic + camera, reports through tools, never speaks. |
| Post-call case summary + dispatch bulletin + third-party redactions | web + native, after hang-up | `gemini-3.5-flash-lite` | The write-up a responder reads first; needs the best judgement of the Lite models. |
| Photo vision (weapon, injury, plate from a silent-tap photo) | web + native | `gemini-3.1-flash-lite` | Multimodal and accurate enough; cheaper than 3.5. |
| Smart search ("woman attacked near Vazhichery") | dashboard | `gemini-3.1-flash-lite` | Ranks short incident digests; mid-size task. |
| Case linking (same person / vehicle across incidents) | web + native, after hang-up | `gemini-3.1-flash-lite` | Small structured yes/no-style matching. |
| Caller credibility check | dashboard (Check button) | `gemini-3.1-flash-lite` | Short structured score + reasons. |
| AI Insights (analytics actions) | dashboard (Refresh button) | `gemini-3.1-flash-lite` | Short summary from pre-computed aggregates. |
| Grounded weather/road context | web + native, after hang-up | `gemini-3.5-flash-lite` + Google Search | **Paused** (`shared/aiFeatures.ts`). |
| Simulated caller (tests only) | `eval/` | `gemini-3.1-flash-lite` | Many short natural lines per test call; fast. Gemma as fallback. |
| Semantic judge (tests only) | `eval/` | `gemma-4-31b-it` | Rare yes/no checks; free, speed doesn't matter. |

## Prices (paid tier, USD per 1M tokens, input / output, Oct 2026)

| Model | Price | Notes |
|---|---|---|
| `gemini-3.8-live` | text 0.75 · audio 3.00 / text 4.50 · audio 12.00 | The main cost of a call. |
| `gemini-3.5-flash-lite` | 0.30 / 2.50 | |
| `gemini-3.1-flash-lite` | 0.25 / 1.50 | Default for small tasks. |
| `gemma-4-31b-it` | free | Slow (minutes per reply under load), weak at strict JSON. |
| `gemini-2.5-flash-lite` | 0.10 / 0.40 | Not available to new projects, so not used. |

## Keys

Every request uses the **free-tier key first** and falls back to the **paid (credits) key** for that model when the
free quota runs out (`shared/gemini/keyPool.ts`). Staging builds and the test harness use the free key only.
