export interface FunctionMetrics {
  name: string;
  file: string;
  line: number;
  cyclomaticComplexity: number;
  length: number;
  nesting: number;
}

export interface MetricsThresholds {
  complexityHigh: number; // default 15
  complexityMedium: number; // default 10
  lengthHigh: number; // default 80 lines
  lengthMedium: number; // default 50 lines
  nestingHigh: number; // default 5
  nestingMedium: number; // default 3
}

export const DEFAULT_THRESHOLDS: MetricsThresholds = {
  complexityHigh: 15,
  complexityMedium: 10,
  lengthHigh: 80,
  lengthMedium: 50,
  nestingHigh: 5,
  nestingMedium: 3,
};

/**
 * Duplication indicator: normalized hash of 6-line sliding windows.
 * Returns pairs of (lineA, lineB) that duplicate within the file.
 */
export function findDuplication(source: string, windowSize = 6, minRepeat = 2): Array<{ lines: [number, number]; snippet: string }> {
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const seen = new Map<string, number[]>();
  const results: Array<{ lines: [number, number]; snippet: string }> = [];
  const reported = new Set<number>();

  for (let i = 0; i + windowSize <= lines.length; i++) {
    const window = lines.slice(i, i + windowSize).join("\n");
    const key = normalizeForHash(window);
    const prev = seen.get(key);
    if (prev) {
      prev.push(i);
      if (prev.length >= minRepeat && !reported.has(i)) {
        results.push({ lines: [prev[0] + 1, i + 1], snippet: window.split("\n")[0] });
        reported.add(i);
      }
    } else {
      seen.set(key, [i]);
    }
  }
  return results;
}

function normalizeForHash(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Simple maintainability score 0-100 from aggregated metrics.
 * Deliberately transparent: documented formula, not a black box.
 */
export function maintainabilityScore(metrics: FunctionMetrics[]): number {
  if (metrics.length === 0) return 100;
  let penalty = 0;
  for (const m of metrics) {
    if (m.cyclomaticComplexity > DEFAULT_THRESHOLDS.complexityHigh) penalty += 10;
    else if (m.cyclomaticComplexity > DEFAULT_THRESHOLDS.complexityMedium) penalty += 5;
    if (m.length > DEFAULT_THRESHOLDS.lengthHigh) penalty += 8;
    else if (m.length > DEFAULT_THRESHOLDS.lengthMedium) penalty += 4;
    if (m.nesting > DEFAULT_THRESHOLDS.nestingHigh) penalty += 6;
    else if (m.nesting > DEFAULT_THRESHOLDS.nestingMedium) penalty += 3;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}
