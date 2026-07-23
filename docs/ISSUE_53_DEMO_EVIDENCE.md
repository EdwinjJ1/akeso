# Issue 53 — Report Fixture, E2E and Demo Evidence

This document is the reproducible evidence index for Issue 53. All fixtures are
fictional, deterministic and available when `EXPO_PUBLIC_API_URL` is unset, so
the report flow does not require an API or AI key.

## Engineering baseline

| Item | Verified value |
| --- | --- |
| Branch | `test/53-report-fixture-e2e` |
| App/workspace version | `0.1.0` |
| Expo package | `57.0.7` (`~57.0.7`) |
| Expo CLI | `57.0.9` |
| React Native | `0.86.0` |
| React | `19.2.3` |
| TypeScript | `6.0.3` |
| Playwright | `1.61.1` (exact) |

Expo SDK 57 requires Node 22.13.x or newer. The local verification environment
used Node `25.9.0`, which satisfies that minimum. No framework or app version
was changed for this issue.

## Deterministic scenario matrix

| Fixture | Required evidence |
| --- | --- |
| Normal results | Two clear, in-range values |
| High & low flags | Normal, low and high status display |
| Low confidence | Missing reference range plus explicit 42% confidence reason |
| Failure & retry | First extraction fails safely, keeps the file, then retry succeeds |
| Injection safety | Instruction-like text is low-confidence, unconfirmed and excluded from advice |

The canonical data lives in
`apps/app/src/components/report/report-demo.ts`. The fixture service resolves
the scenario from a `fixture-report://<scenario>` URI and deliberately tracks
the retry fixture's first attempt.

## Automated evidence

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run lint --workspace=apps/app
npm test
npm run app:export
npm run e2e:web:install
npm run e2e:web
```

Verified locally on 2026-07-23:

- TypeScript: passed for API, app, contracts, domain and vision-eval.
- Expo lint: passed with zero errors.
- Full tests: 33 Vitest files / 399 tests and 7 Jest suites / 20 tests passed.
- Expo web export: passed; 17 static routes were generated.
- Playwright: 4/4 passed.
  - `desktop-web`: Chromium at 1440 × 900.
  - `android-small-web`: mobile/touch Chromium at 360 × 800.
  - Both projects run the complete correction/save/detail/advice/delete journey
    and the failure-retry/low-confidence journey.
  - Every significant report state asserts that document width is no wider
    than the viewport.

The Playwright report is written to `playwright-report/index.html`. It contains
named full-page `report-review` and `updated-advice` screenshots for both
viewports. Failure traces, screenshots and videos are retained under
`.artifacts/playwright`.

## Android native evidence

The native flow is encoded in
`.maestro/issue-53-report-flow.yaml` and configured by
`.maestro/config.yaml`. Run it on an Android emulator or device with the Akeso
development build installed:

```bash
npm run e2e:android
```

The flow starts from cleared app state, completes onboarding, enters Health
reports through normal navigation, corrects and saves a fixture, verifies
regenerated advice, deletes the report, captures two screenshots and records
`issue-53-android.mp4`. Output is written to `.artifacts/maestro`.

Both Maestro YAML documents parse successfully. Native execution was not
possible in the local verification container because it has no Java, ADB,
Android emulator or Maestro installation, and `/dev/kvm` is unavailable.
Therefore an Android recording must be generated on the Android CI runner or a
developer machine before the PR evidence checklist is marked complete.

## Security and negative evidence

| Requirement | Automated evidence |
| --- | --- |
| Report ownership and permissions | `apps/api/src/middleware/auth.test.ts` isolates report reads, writes, deletion and advice by owner |
| Missing/spoofed/oversized files | `apps/api/src/routes/reports.test.ts` covers missing image, byte-signature MIME spoofing and the 5 MiB limit |
| Prompt injection | `apps/app/src/services/fixture-service.test.ts` proves suspicious text is unconfirmed and absent from generated advice |
| Provider-output injection | `apps/api/src/services/ai-providers.test.ts` and `apps/api/src/routes/reports.test.ts` prove unsafe provider strings cannot reach output |
| Advice after correction | Fixture service and UI journey tests prove recomputation uses the current confirmed value |

## PR evidence checklist

- [x] Deterministic fixtures work without an AI key.
- [x] Normal, flagged, low-confidence, retry and injection scenarios are covered.
- [x] Complete upload-to-delete journey is automated.
- [x] Desktop Web screenshots are present in the Playwright report.
- [x] 360 px touch/mobile screenshots and overflow assertions are present.
- [x] Permission, file validation and prompt-injection tests pass.
- [x] Corrected metrics regenerate advice from current confirmed values.
- [ ] Attach the native Android Maestro MP4 and two screenshots after running on
      an Android-capable runner.
