# Evaluation Methodology

## Dataset
`tests/evaluation/dataset.test.ts` holds samples with ground-truth labels:
each sample declares expected rule IDs (issues present) and optionally
forbidden rule IDs (things a correct system must not report).

## Metrics
- **Precision** = TP / (TP + FP): reported findings that are real.
- **Recall** = TP / (TP + FN): real issues that were detected.
- **False-positive rate** = FP / (TP + FP).
- **Processing time**: `review.durationMs` (webhook -> completed).
- **AI cost**: tokens used per review (from provider usage fields).

## Comparisons to run
Run the same dataset through three configurations:
1. Static/rules only (AI disabled).
2. AI only (rules disabled).
3. Hybrid (default).

Record precision/recall/FP-rate per configuration in a table for the report.
The harness is deterministic for (1); for AI runs, fix temperature=0.1 and
report mean over 3 runs.

## CI gate
`vitest run` enforces precision >= 0.8, recall >= 0.8, FP-rate <= 0.2 for the
built-in rule set on the seed dataset. Extend the dataset as rules grow.
