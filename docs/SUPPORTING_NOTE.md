# MerchantLens - Technical and Validation Note

The Bakery That Takes Bets | Follow The Money, IIM Bangalore
Team: Shreyas Naik, Paarth Jain, Anshul Vaibhav
Version: 12 November 2026

## Purpose
MerchantLens helps an analyst assess whether current payment activity matches a merchant's declared business. A valid bakery identity and a payment amount alone do not explain payment purpose. A transaction spike is a lead; a decision requires scoped checkout, order and fulfilment evidence. Receiver timing alone does not prove illicit activity or attribution of commingled funds.

## Implemented prototype
React/Vite frontend, Three.js/React Three Fiber graph with SVG fallback, three deterministic synthetic scenarios, searchable payment ledger, account-level money trail, event-time and recipient inspection, evidence coverage toggles, targeted clarification, simulated replies, local review history, JSON and printable HTML case exports. The printable HTML opens in a browser and can be saved as PDF. An optional read-only Node.js API exposes demo metadata; the frontend does not depend on it.

No live payment/bank/AWS integration, trained model inference, authenticated shared case store, signed evidence or automatic payment restriction is implemented.

## Three scenario outcomes
- Mixed purpose: 248 payments / INR 124,000. Fixture observation links 18 payments to an alternate checkout. Request clarification and escalate the checkout mismatch with reasons. A generic catering claim does not reconcile the observation. Clearance is deliberately unavailable in this deterministic demo.
- Diwali surge: 612 payments / INR 306,000. Fixture campaign, orders and deliveries support bakery activity. Review scope and attest to evidence, then clear with reasons. This is a controlled example, not a measured fraud classifier.
- Incomplete evidence: 96 payments / INR 48,000. Independent checkout purpose evidence is missing. Keep unresolved and request clarification. Escalation may request investigation; it is not a betting verdict.

## Added review controls
Clearance requires the seasonal scenario, available checkout evidence, explicit reviewer attestation and nonblank reasoning. Escalation requires reasoning. Changing scenarios or checkout coverage resets attestation. Saved clearance is only displayed/exported when the current policy permits it. Review history and case exports include only the selected scenario. Replies vary by scenario. An attestation records a local reviewer action; it does not authenticate a source or validate a document cryptographically.

## Case export contract
Schema version 2 records team, scenario, merchant SRB-2041, session PS-0921, synthetic scope, evidence ID and finding, coverage flags, attestation, clarification state, current applicable outcome, reasoning, next-step recommendation, scoped history and limitations. It explicitly records that no payment restriction was executed. Review and history remain editable local-storage data. HTML escapes analyst text before rendering. Exported records are unsigned and are not tamper-proof audit evidence.

## Money-trail interpretation
Sample bank movements: Sunrise Bakery -> flour supplier INR 36,000 at 10:10; Bakery -> Receiver R INR 18,000 at 10:18; Receiver R -> Account Z INR 15,000 at 10:24. The supplier invoice supports an operating expense. R and Z remain unresolved. The existing tracer follows nondecreasing event time, defaults to four hops and stops cycles. The UI filters observed transfers by time; it does not allocate a specific payer's money through a mixed account.

## Proposed deployment
Authorized provider payment/profile/checkout/bank feeds -> API Gateway/Lambda validation -> SQS buffering, idempotent event workers and dead-letter handling -> temporal/peer/typed-graph features -> explainable case assessment -> analyst workbench. Neptune stores observed graph edges; DynamoDB stores merchant and case state; S3 holds evidence and audit manifests. EventBridge Scheduler refreshes baselines and reconciles late events/replay. Access roles, KMS, tokenized identifiers, retention and signed manifests must be implemented and verified before a pilot. Monitoring is asynchronous alongside payment authorization. A risk score does not execute restrictions.

Start with transparent rules and robust baselines. XGBoost/CatBoost are candidate models to compare and calibrate when adjudicated labels permit; current UI scores are fixture values. Use only edges known at the scoring cutoff; split evaluation by merchant identity and later time. Unknown/missing evidence should trigger abstention or clarification. No measured accuracy, production throughput or savings are claimed.

## Executed validation
On 12 November 2026, npm test passed all 8 Node tests: forward trace/depth; cycle/earlier-edge/hop bounds; balance/no double counting; seasonal attestation/reason gates; missing/mixed evidence blocks clearance; stale outcome and scenario-history isolation; safe HTML escaping and boundary text; read-only API and fixture disclosure. npm run build passed. Vite reports a large JavaScript bundle; measure load performance on the recording device. A full browser interaction check could not run in the authoring environment because Chromium startup was blocked. Complete the manual walkthrough on the recording device before filming.

## Manual acceptance before recording
1. Mixed: enter reasoning, request evidence and load the response. Clear remains disabled; Escalate is available. Inspect the scenario-specific reply.
2. Seasonal: enter reasoning. Clear remains disabled until evidence attestation is checked, then permits clearance.
3. Turn checkout coverage off: attestation/outcome become invalid and Clear is disabled.
4. Unknown: attestation and Clear are disabled; missing purpose is explicit. No unrelated scenario history appears.
5. Export JSON and printable report. Check scope, outcome, synthetic label and escaped free text. Open HTML and Print / Save as PDF.
6. Reload: browser-local notes/history persist; attestation must be rechecked. Inspect money-trail time filtering, bank visibility and graph fallback on the recording device.

## Pilot and feasibility
Pilot buyer: payment-provider risk teams. Begin with authorized historical replay, then identity/time holdout evaluation, then an approved shadow pilot without automated intervention. Compare rules and candidate models at the same analyst queue budget. Measure verified mismatch recall/precision, unsupported intervention rate on genuine merchants, median analyst review time, evidence coverage/freshness, replay correctness, cost per reviewed merchant and retained legitimate activity. The deck's 20%/25%/5 pp values are evaluation goals, not results.

Data permissions, trustworthy checkout mapping, labels, analyst feedback and secured case storage are pilot prerequisites. Seasonal shifts, cold start and missing bank visibility require explicit coverage/uncertainty. Flood tolerance requires measured queue/idempotency/graph-budget tests. Evidence integrity requires provenance validation and tamper tests; printable export alone does not provide it. Shared IP or device links alone must not establish payment purpose. Intervention scope belongs to an authorized risk owner.

## Reproduce and record
Requires Node.js 22+. Run npm run setup, npm test, npm run dev. Build: npm run build; preview: npm run preview. Optional metadata API: npm run backend on 127.0.0.1:3001. Frontend normally starts on port 5173. The UI works without live services or model keys. If a restricted host cannot enumerate interfaces, run node node_modules/vite/bin/vite.js --host 127.0.0.1 from frontend/.

See DEMO_SCRIPT.md for a 110-second recording plan. The app remains untimed and does not navigate automatically. Export the technical note PDF alongside the presentation and the actual working-prototype video. The note is supporting material, not a replacement for the 8-slide presentation or 2-minute video.

Source: https://github.com/petrolhead-pj/merchantlens (reviewed base 6c4844d plus the supporting-documents update). Source files: frontend/src/main.jsx, frontend/src/review-policy.js, frontend/src/money-trail-data.js, backend/reviewPolicy.test.mjs and backend/server.mjs.
