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

Cloud validation was limited to source packaging and YAML parsing. Installation of the full CloudFormation validator ran out of disk space. SAM transform, IAM behavior, Lambda execution, AWS latency, account eligibility, available credits and budget notifications remain unverified. No infrastructure or budget was provisioned. The browser-observation instrumentation runs inside the controlled exhibition page; partner-grade independent collection, PayU sandbox callbacks, Neptune and ML remain outside this demonstration.
