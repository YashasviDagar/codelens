// Documented severity policy.
// The rule engine and aggregation layer must follow this; the AI provider
// may propose severities but they are clamped/validated against this policy.

export const SEVERITY_POLICY: Record<string, { label: string; definition: string }> = {
  CRITICAL: {
    label: "Critical",
    definition:
      "Likely to cause severe functional, security, or data-integrity consequences (e.g. SQL injection, unauthenticated access, secrets committed).",
  },
  HIGH: {
    label: "High",
    definition:
      "Likely to cause significant bugs, crashes, data loss, or reliability problems (e.g. unhandled promise rejection in payment flow, resource leak).",
  },
  MEDIUM: {
    label: "Medium",
    definition:
      "Meaningful quality, performance, or maintainability issue (e.g. N+1 query, high complexity, duplicated logic).",
  },
  LOW: {
    label: "Low",
    definition: "Minor improvement: clarity, naming, small refactors, slightly better patterns.",
  },
  INFO: {
    label: "Info",
    definition: "Suggestion or observation; no action required.",
  },
};

export const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
export const SEVERITY_EMOJI: Record<string, string> = {
  INFO: "⚪",
  LOW: "🔵",
  MEDIUM: "🟡",
  HIGH: "🟠",
  CRITICAL: "🔴",
};

// AI-suggested severities are capped: AI findings cannot be claimed above
// MEDIUM unless corroborating static evidence exists (see aggregation).
export const MAX_AI_SEVERITY_WITHOUT_EVIDENCE = "MEDIUM" as const;
