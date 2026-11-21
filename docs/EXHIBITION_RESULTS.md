# Exhibition verification

Tested on Windows with Node 22.16.0. The clean starting commit was `8c6f040d381809dc47b78adcaad945e1df40ea16` on the team's `finale/evidence-led-review` branch.

| Check | Observed result |
| --- | --- |
| Original tests and benchmark | 14/14 passed. The benchmark found 4 of 6 planted mismatches at capacity 4. Volume alone found 1. |
| Original production build | Passed on an isolated archive of the baseline after installing the locked dependencies. The large Three.js chunk warning predates this branch. |
| Exhibition tests and production build | 15/15 passed. Vite built the exhibition and separate seeded entry points. |
| Two-window checkout rehearsal | All four variants passed with non-loopback browser requests denied. Each confirmed payment remained unique after resending the confirmation. |
| Desktop and narrow layouts | Captured 1440×900, 1280×720 and 390×844. No horizontal document overflow. The seeded replay's global stylesheet was isolated after the first visual inspection. |

One local rehearsal measured the interval from the last record's server-side receipt to the matching case version appearing in the inspector DOM. The evidence delay control was set to one second; that deliberate delay precedes receipt.

| Run | Result | Receipt to inspector |
| --- | --- | ---: |
| Cake purchase plus simulated courier delivery | Cake sale supported | 696 ms |
| Observed wallet top-up | Purpose mismatch — review | 455 ms |
| Withheld observation, merchant order only | Purpose unverified | 548 ms |
| Observed cake purchase plus independent simulated wallet ledger | Purpose mismatch — review | 828 ms |

The automated rule test also submitted evidence before confirmation, rejected incorrect merchant/payment references, rejected a stale review version and reopened the supported case after a late wallet credit while preserving its earlier decision.

At commit `96976c8`, cloud validation covered source packaging and YAML parsing. The following verification supersedes that initial check.

## Follow-up verification

The checkout was clean on `feature/exhibition-checkout` at `96976c8`. The stall health endpoint on port 4173 responded before testing. A separate production build and test server on port 4174 kept that process and its cases available throughout the rehearsal.

| Check | Result |
| --- | --- |
| `npm test` | 16/16 passed. The new HTTP regression submitted delivery, checkout and order before confirmation, then posted concurrent duplicates. It checked full case equality after duplicate delivery, refund/event ID collision, payment reference reuse, wrong merchant and stale review. Late wallet credit reopened the case and preserved the prior history prefix. |
| `npm run benchmark` | Four of six planted mismatches found at capacity four. Volume found one. |
| Production frontend | Vite built both entry points under `.demo-tools/rehearsal-dist`. The large seeded graph chunk warning remains. |
| Two-page Edge rehearsal | All four variants passed with external browser requests denied. The driver recorded a supported decision, added a late wallet credit to that same payment, selected Explain this flag and saw the wallet credit. A subsequent stale review returned HTTP 409. |
| Feed interruption | Blocking case reads displayed Feed stale, preserved the selected case and recovered to Connected after reads resumed. Desktop and mobile viewport overflow assertions passed. |
| Infrastructure validation | Isolated cfn-lint 1.58.0 passed both templates. SAM CLI 1.174.0 validated the application template with lint enabled. Building exposed a missing package version; importing the artifact exposed a missing transitive shared-rules module. Both were corrected. |
| Packaged application | Final `sam build` succeeded. `node scripts/check-cloud-build.mjs` loaded all four handlers and their SDKs directly from `.aws-sam/build` on Node 22. Each packaged rules module matched evidence received before confirmation. The worker smoke test injected one transaction collision and one malformed SQS record using a stubbed DynamoDB client; the valid record retried successfully and only the malformed record appeared in the partial-batch failure response. |

Final local receipt-to-inspector times on this run were **529 ms** for the delivered cake, **479 ms** for the observed wallet top-up, **140 ms** for the withheld observation and **826 ms** for the conflicting wallet credit. The earlier 455–828 ms range above is a separate local rehearsal. No cloud timing has been measured.

The account-specific deployment preview, budget and cloud rehearsal await an approved profile, region, budget recipient and owner authorization. Account eligibility, credits, expiry, permissions and billing delivery remain unverified. All payment confirmations, courier deliveries and wallet postings are simulated. Browser observations come from visible, trusted clicks captured in the controlled lab. PayU sandbox callbacks, Neptune and ML remain outside this demonstration. See [commands, cost assumptions and teardown](EXHIBITION.md).
