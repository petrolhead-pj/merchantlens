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

## Authorized AWS preflight · 21 November 2026

STS resolved profile `merchantlens` to Blank Canvas, ending in 3867, using AccountFullAccessRole. Free Tier reported an active PAID plan and USD 138.074979 remaining. The owner confirmed in Billing that all three active credits expire on 20 November 2027 at 15:55 UTC.

AWS Budgets verified MerchantLens-Account-Monthly, a USD 10 monthly account-wide COST budget excluding credits, and returned the specified EMAIL subscriber for all four absolute-value thresholds: actual 5, 8 and 10, forecast 10. This verifies configuration; notification delivery depends on AWS evaluating a threshold.

In ap-southeast-2, CloudFormation validated the application template and reported no existing merchantlens-exhibition stack. Read checks succeeded for Lambda (400 concurrent executions), API Gateway v2, SQS, DynamoDB, S3, Scheduler, CloudWatch, Logs and IAM. These checks establish regional service access; resource creation and role passing remain to be tested by deployment.

The latency tables above are local results. All payment confirmations, courier deliveries and wallet postings use simulated funds. Browser observations come from visible, trusted clicks in the controlled lab. See [commands, Sydney estimate and teardown](EXHIBITION.md).

The owner reported a USD 20 project limit and USD 2.72 spent (EC2 2.60, VPC 0.12, S3 0.00). In Sydney the running Linux t3.large costs USD 0.1056/hour; its automatically assigned public IPv4 costs 0.005/hour. The stopped Linux t3.micro has no current compute or IPv4 cost. Each instance retains one 8 GiB gp3 root disk at USD 0.096/GiB-month (0.768 per disk per month). Both disks use baseline IOPS and throughput. The running server averaged approximately 0.14% CPU over 24 hourly samples and exchanged traffic; its other users or dependencies have not been established. No Auto Scaling membership was found.

The observed bill is consistent with about a day of running the large instance and its address plus disk and possible earlier micro usage. Cost Explorer returned no service line items through November 20 and insufficient history for a forecast, so individual historical charges cannot be allocated exactly. Sydney inventory returned no Elastic IP allocations, NAT gateways, VPC endpoints, VPN connections, transit attachments, load balancers or owned EBS snapshots. Reads in the 16 other enabled regions were denied. The SAM application has no dependency on either instance, their volumes or their VPC.

At roughly USD 2.70/day including storage, continuing for the remaining nine-plus days would put November spend at about USD 27–28 before adding MerchantLens. The current configuration fails the USD 20 deployment condition. A stop of the large instance would release the automatic public address and save USD 2.65/day, leaving both volumes at USD 1.54/month combined. Stopping or removing resources requires separate owner approval.

**Owner-approved stop.** EC2 subsequently confirmed that My Web Server reached `stopped` with no public IPv4 address. The micro also remained stopped. Both original 8 GiB root volumes remained attached to their respective instances. With those states maintained, the November planning total is about USD 7.20 based on the owner-reported spend, remaining storage and the full USD 4 demo allowance, before any unrelated or delayed charges. The USD 20 project limit was retained.

## Sydney deployment attempt · 22 November 2026 local time

SAM uploaded the verified package and template under the `merchantlens-exhibition/` prefix of its regional packaging bucket. CloudFormation accepted the 27-addition change set. Stack creation failed on `DeadLetters`: SQS returned HTTP 403 for `sqs:CreateQueue` with an explicit organization SCP deny, policy ID `p-uvptrwi3`, request ID `af9e1786-2734-59d7-b3e0-74fdc1d41f9e`. The project role also received AccessDeniedException from Organizations DescribePolicy. The exact policy condition is unavailable to this role. The published AWS project spend-limit policy includes this action.

Verified final state: application stack `ROLLBACK_COMPLETE`, cancelled artifact bucket and case table deleted by CloudFormation, zero exhibition queues, and no application endpoint. The SAM packaging stack is `CREATE_COMPLETE` with 3,976,717 bytes staged under the exhibition prefix. The four cloud checkout rehearsals and receipt-to-render measurements are pending an executable deployment.

Repeat offline checks passed on a separate loopback port: 16/16 tests; cake 560 ms, wallet 458 ms, unverified 374 ms, conflicting wallet credit 76 ms. The browser check confirmed a prior supported decision survived reopening and rejection of a stale write. Feed interruption preserved selection and recovered on reconnect. Port 4173 remained available.
