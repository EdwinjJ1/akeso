# Energy score offline evaluation

Run `npm run energy:eval` from the repository root.

The command evaluates the version-controlled fictional calibration fixtures
against the deterministic Domain engine and prints:

- mean absolute error against later 1–5 user calibration;
- rate within 10 score points;
- band accuracy;
- mean confidence.

The fixture set covers normal input, poor sleep, low hydration, a long gap
since eating, conflicting signals, and insufficient data. Algorithm and
fixture changes are code-reviewed together, so tuning comparisons remain
reproducible. No production health data is read.
