// Optional AI requests, paused for the prototype (each one is an extra Gemini call per call / page view, and none of
// them is needed for the core flow). Flip to true to bring one back. Listed in docs/future_features.md.
// Used by web, dashboard and native.
export const AI_FEATURES = {
  // Post-call Google-Search-grounded weather/road context for the confirmed address (unreliable today).
  groundedContext: false,
  // Nudging Mia mid-call to report the caller's age group and gender (she can still report it on her own).
  callerEstimateNudge: false,
  // Dashboard: run the AI credibility check automatically when a call ends (the "Check" button still works).
  credibilityAutoRun: false,
  // Dashboard: regenerate AI Insights automatically once a day on page load (the "Refresh" button still works).
  insightsAutoRefresh: false,
  // Live call: report_* tools NON_BLOCKING with SILENT responses (no re-read of the session after each one).
  // OFF: passed the text A/B test, but on a real voice call (INC-MUVGI8K0) Mia spoke her own reasoning aloud
  // ("The user is silent… I will continue to take the order") and stopped answering. Text tests don't catch this.
  nonBlockingTools: false,
} as const
