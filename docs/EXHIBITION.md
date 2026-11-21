# MerchantLens exhibition

Start on Node 22 or later with `npm run setup`, `npm test`, `npm run benchmark`, `npm run build` and `npm run stall`. Open http://127.0.0.1:4173 and open Demo Lab in a second window alongside the workbench. Local runs live in the loopback server's memory until it stops. Reset demo allocates another checkout reference. The seeded 248-payment review and its exports are available under Seeded replay.

## Three minutes at the stand

1. **0:00–0:55.** Select Cake sale, buy the chocolate cake and point to the ₹500 receipt for SRB-2041. The click observer captured the visible purchase action. The order is the merchant's own claim. Send simulated delivery, select the delivery link, and record the supported outcome.
2. **0:55–1:55.** Reset. Select Wallet top-up, set a five-second delay and top up the fictional wallet. Watch the same bakery receive a new payment. Explain this flag selects the wallet link. Compare checkout and payment references. Send duplicate confirmation and inspect history.
3. **1:55–2:30.** Reset and select Unverified. Buy the cake. This scenario withholds the observation. The merchant order can be displayed, but independent evidence is missing. Request evidence.
4. **2:30–3:00.** Reset and run Conflicting wallet credit. This time the captured button really does say cake. The separate simulated wallet ledger credits the same payment. Inspect the credit and compare the merchant's Chocolate cake record.

All payments, wallet credits and deliveries use simulated funds and records. A capture-phase listener in the controlled checkout records a trusted browser click, visible button text and checkout reference before the checkout handler runs. It shares the demo browser's trust boundary. The merchant registry is a fixture. No PayU credentials or real payment authorization are used.

## Cloud preview and operator settings

The SAM template defines an IAM-authenticated HTTP API, intake, worker and review Lambdas, SQS with DLQ, on-demand DynamoDB, private S3 review exports and three-day logs. A fourth scheduled Lambda reads the oldest pending reference from a sparse index every 15 minutes. Queue-age and dead-letter alarms accompany processing and pending-age metrics. Stop or disable the schedule as well as closing workbench tabs when pausing. The loopback bridge signs requests with server-side AWS credentials. Grant its operator role execute-api:Invoke only on the four demo routes. Grant partner feed principals access only to their specific POST route. Keep the workstation under presenter control.

Before deployment, the owner must identify the account, approved AWS profile and region, check plan, service quotas, billing permissions, remaining credits and expiry in Billing. Verify the account with `aws sts get-caller-identity --profile PROFILE`. For 100 three-minute runs with a single visible workbench, budget for roughly 22,500 polls plus case writes, Lambda executions, queue requests, storage and logs. More open workbenches multiply polling costs. Price these quantities in the approved region before provisioning. No account-specific estimate or credit balance was verified.

Review `cloud/budget.yaml` separately. It defines a $10 monthly account-wide cost budget excluding credits, with actual thresholds of $5/$8/$10 and forecast $10. Alerts can be delayed and do not cap charges. With budget authorization, first check existing budgets and the owner's address, then preview the template as a separate CloudFormation change set.

Prepare locally:

    node scripts/package-cloud.mjs
    sam validate --lint --template-file cloud/template.yaml
    sam build --template-file cloud/template.yaml

After profile, budget, artifact bucket and region approval, prepare a change set:

    sam deploy --no-execute-changeset --stack-name merchantlens-exhibition --s3-bucket APPROVED_ARTIFACT_BUCKET --capabilities CAPABILITY_IAM --profile PROFILE --region REGION --tags Project=MerchantLens Environment=exhibition

Review IAM, changes and charges before executing. Configure the local workstation with the actual stack endpoint and rebuild:

    npm install --prefix .demo-tools @aws-sdk/signature-v4 @aws-sdk/credential-providers @aws-crypto/sha256-js
    $env:AWS_PROFILE='APPROVED_PROFILE'
    $env:AWS_REGION='APPROVED_REGION'
    $env:MERCHANTLENS_API='https://API_ID.execute-api.REGION.amazonaws.com/api/cases'
    $env:VITE_CASE_API='/api/cloud'
    npm run build
    npm run stall

Use `?offline` to enter the separate local rehearsal. Stop the launcher and close the tabs to stop polling. To tear down, verify the account and stack name, export needed cases, empty the stack's artifact bucket if populated, and run `sam delete --stack-name merchantlens-exhibition --profile PROFILE --region REGION`. Check for artifacts left in the packaging bucket. Review the separate budget with the owner.

## Verification

Baseline 8c6f040, Node 22.16.0. All 14 original tests passed; benchmark reviewed 4/16 synthetic cases, detecting 4 planted mismatches versus 1 by volume. Initial build attempted during dependency installation could not find Vite. Post-install production build passed with the existing large graph chunk warning. The added regression test covers evidence-first, duplicate payment, late conflict, reopening, historical decisions, stale version and mismatched references.

Install the optional browser runner with `npm install --prefix .demo-tools playwright-core`. With Edge installed, run `node scripts/rehearse.mjs` following the production build and with port 4173 free. The runner uses two pages, denies external browser requests, exercises all four scenarios, checks duplicate totals and captures screenshots at 1440×900, 1280×720 and 390×844. AWS deployment, budget creation, real provider callbacks and cloud latency have not been exercised.
