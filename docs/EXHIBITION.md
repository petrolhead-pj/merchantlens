# MerchantLens exhibition

Start on Node 22 or later with `npm run setup`, `npm test`, `npm run benchmark`, `npm run build` and `npm run stall`. Open http://127.0.0.1:4173 and open Demo Lab in a second window alongside the workbench. Local runs live in the loopback server's memory until it stops. Reset demo allocates another checkout reference. The seeded 248-payment review and its exports are available under Seeded replay.

## Three minutes at the stand

1. **0:00–0:55.** Select Cake sale, buy the chocolate cake and point to the ₹500 receipt for SRB-2041. The click observer captured the visible purchase action. The order is the merchant's own claim. Send simulated delivery, select the delivery link, and record the supported outcome.
2. **0:55–1:55.** Reset. Select Wallet top-up, set a five-second delay and top up the fictional wallet. Watch the same bakery receive a new payment. Explain this flag selects the wallet link. Compare checkout and payment references. Send duplicate confirmation and inspect history.
3. **1:55–2:30.** Reset and select Unverified. Buy the cake. This scenario withholds the observation. The merchant order can be displayed, but independent evidence is missing. Request evidence.
4. **2:30–3:00.** Reset and run Conflicting wallet credit. This time the captured button really does say cake. The separate simulated wallet ledger credits the same payment. Inspect the credit and compare the merchant's Chocolate cake record.

All payments, wallet credits and deliveries use simulated funds and records. A capture-phase listener in the controlled checkout records a trusted browser click, visible button text and checkout reference before the checkout handler runs. It shares the demo browser's trust boundary. The merchant registry is a fixture. No PayU credentials or real payment authorization are used.

## Cloud preview and operator settings

**Approved target and current status (21 November 2026).** Use AWS profile `merchantlens` in `ap-southeast-2`. The USD 10 alert budget is configured. The owner confirmed credit expiry and a separate USD 20 pre-tax project limit. Existing EC2 usage projects above that limit before deployment; see [inventory and cost assessment](EXHIBITION_RESULTS.md). Keep both limits and existing workloads intact unless the owner authorizes a specific change. The Sydney application stack has no resources to tear down. Repeat the read-only inventory with `python scripts/compute-inventory.py --profile merchantlens --region ap-southeast-2` and the rate check with `python scripts/compute-rates.py --profile merchantlens --region ap-southeast-2 t3.large t3.micro`.

For the 100-run monthly workload below, Sydney gross usage is estimated at **USD 2–4** before credits, taxes and account-wide free allowances. The public regional catalog reports USD 1.29/million HTTP requests (~0.12 for 90,000), USD 0.1425/million DynamoDB read units (~0.29 for 2 million), USD 0.71/million write units, USD 0.20/million Lambda requests and USD 0.0000166667 per GB-second. Three full-month metrics and two alarms cost USD 1.10; 1 GB log ingestion costs USD 0.67. The range includes allowances for small queue, storage and transfer traffic. Extra open tabs and accumulated case history increase usage. Reproduce rates with `python scripts/region-prices.py ap-southeast-2` using the [AWS Price List Bulk API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api.html).

Repeat account checks with `python scripts/cloud-preflight.py --profile merchantlens --region ap-southeast-2` in the validation environment. Recheck or create the budget with `python scripts/ensure-budget.py --profile merchantlens --account ACCOUNT_ID --email OWNER_EMAIL`. The verifier checks the account ID before using the Budgets API. Avoid creating a second budget CloudFormation stack for the same existing budget. If the owner later authorizes removing this budget, use Billing → Budgets → MerchantLens-Account-Monthly and verify the account before deletion.

The SAM template defines an IAM-authenticated HTTP API, intake, worker and review Lambdas, SQS with DLQ, on-demand DynamoDB, private S3 review exports and three-day logs. A fourth scheduled Lambda reads the oldest pending reference from a sparse index every 15 minutes. Queue-age and dead-letter alarms accompany processing and pending-age metrics. Stop or disable the schedule as well as closing workbench tabs when pausing. The loopback bridge signs requests with server-side AWS credentials. Grant its operator role execute-api:Invoke only on the four demo routes. Grant partner feed principals access only to their specific POST route. Keep the workstation under presenter control.

For 100 three-minute runs with one visible workbench, allow roughly 22,500 polls plus case writes, Lambda executions, queue requests, storage and logs. Additional pages per poll and concurrent workbenches multiply requests.

Review `cloud/budget.yaml` separately. It defines a $10 monthly account-wide cost budget excluding credits, with actual thresholds of $5/$8/$10 and forecast $10. Alerts can be delayed and do not cap charges. With budget authorization, first check existing budgets and the owner's address, then preview the template as a separate CloudFormation change set.

After the owner identifies the target, use the approved profile for every account command. Run `aws freetier get-account-plan-state --region us-east-1 --profile PROFILE` and compare the account ID to STS. Record plan status, remaining credits and plan expiration. Check individual credit expirations and eligible services in Billing → Credits. Inspect `aws budgets describe-budgets --account-id ACCOUNT_ID --profile PROFILE`, then verify notifications and subscribers for the matching budget. If creation is authorized and needed, preview `cloud/budget.yaml` with `aws cloudformation deploy --no-execute-changeset --stack-name merchantlens-exhibition-budget --template-file cloud/budget.yaml --parameter-overrides OwnerEmail=OWNER_EMAIL --region REGION --profile PROFILE`. Execute the approved budget change set and verify it before creating the app stack. Record any denied API or unavailable plan feature.

Prepare locally:

    uv venv .demo-tools/validation
    uv pip install --python .demo-tools/validation/Scripts/python.exe aws-sam-cli==1.174.0 cfn-lint==1.58.0
    $env:Path = (Resolve-Path .demo-tools/validation/Scripts).Path + ';' + $env:Path
    $env:SAM_CLI_TELEMETRY='0'
    node scripts/package-cloud.mjs
    cfn-lint cloud/template.yaml cloud/budget.yaml
    sam validate --lint --region us-east-1 --template-file cloud/template.yaml
    sam build --region us-east-1 --template-file cloud/template.yaml
    node scripts/check-cloud-build.mjs

The region in these local validation commands selects schemas. The deployment region comes from the owner. A planning estimate for **us-east-1** is **roughly USD 2–4 per month before credits** for 100 three-minute runs, a single visible workbench, at most 100 small cases, and no other traffic. It assumes up to four pages per poll (90,000 HTTP calls), 256 MB functions averaging 200 ms per call, under 2 million DynamoDB read units, under 1 GB of logs, and up to 10 GB of outgoing case data. Three continuously published custom metrics and two alarms allow about $1.10, HTTP API calls about $0.09, DynamoDB reads about $0.25, Lambda requests and compute about $0.10, and log ingestion up to $0.50. The range allows for transfers, SQS polling, private exports, packaging storage and scheduling. This is incremental demo usage; regional prices, portfolio size, retries and keeping tabs open affect the bill. Reprice for the authorized region and verify the account's credit treatment before deployment. [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/), [HTTP API](https://aws.amazon.com/api-gateway/pricing/), [DynamoDB](https://aws.amazon.com/dynamodb/pricing/), [Lambda](https://aws.amazon.com/lambda/pricing/).

After profile, budget, artifact bucket and region approval, prepare a change set:

    sam deploy --no-execute-changeset --stack-name merchantlens-exhibition --s3-bucket APPROVED_ARTIFACT_BUCKET --capabilities CAPABILITY_IAM --profile PROFILE --region REGION --tags Project=MerchantLens Environment=exhibition

For a new stack, the expected changes are one HTTP API and stage with four IAM-protected routes, four 256 MB Lambda functions and execution roles, one SQS mapping capped at two concurrent batches, two queues, one DynamoDB table with the sparse pending-age index, one private S3 bucket, four three-day log groups, two alarms and one schedule with its invocation permissions. The application template excludes the budget. Inspect the generated change set for replacements, deletions, IAM grants, resource names and region before execution. The control-plane change set can only be produced in the approved account.

Review IAM, changes and charges before executing. Configure the local workstation with the actual stack endpoint and rebuild:

    npm install --prefix .demo-tools @aws-sdk/signature-v4 @aws-sdk/credential-providers @aws-crypto/sha256-js
    $env:AWS_PROFILE='APPROVED_PROFILE'
    $env:AWS_REGION='APPROVED_REGION'
    $env:MERCHANTLENS_API='https://API_ID.execute-api.REGION.amazonaws.com/api/cases'
    $env:VITE_CASE_API='/api/cloud'
    npm --prefix frontend run build -- --outDir ../.demo-tools/cloud-dist
    $env:STALL_DIST=(Resolve-Path .demo-tools/cloud-dist).Path
    $env:REHEARSAL_API='/api/cloud'
    node scripts/rehearse.mjs

Use `?offline` to enter the separate local rehearsal. Stop the launcher and close the tabs to stop polling. To tear down, verify the account and stack name, export needed cases, empty the stack's artifact bucket if populated, and run `sam delete --stack-name merchantlens-exhibition --profile PROFILE --region REGION`. Check for artifacts left in the packaging bucket. Review the separate budget with the owner.

To pause a deployed stack, stop demo intake, wait for SQS visible and in-flight counts to reach zero, then disable the reconciliation schedule in EventBridge Scheduler. Find the worker mapping UUID with `aws lambda list-event-source-mappings --function-name WORKER_PHYSICAL_NAME --region REGION --profile PROFILE` and disable it with `aws lambda update-event-source-mapping --uuid UUID --no-enabled --region REGION --profile PROFILE`. Re-enable the mapping and schedule before rehearsing again. Alarms and stored data can still incur charges while paused. Verify stack deletion and remaining S3 objects for a full teardown. Keep the account-wide budget unless the owner requests its removal. [AWS budget notification timing](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

## Verification

Baseline 8c6f040, Node 22.16.0. All 14 original tests passed; benchmark reviewed 4/16 synthetic cases, detecting 4 planted mismatches versus 1 by volume. Initial build attempted during dependency installation could not find Vite. Post-install production build passed with the existing large graph chunk warning. The added regression test covers evidence-first, duplicate payment, late conflict, reopening, historical decisions, stale version and mismatched references.

Install the optional browser runner with `npm install --prefix .demo-tools playwright-core`. For an offline rerun use a fresh shell with the default local API, run `npm --prefix frontend run build -- --outDir ../.demo-tools/rehearsal-dist`, set `$env:STALL_DIST=(Resolve-Path .demo-tools/rehearsal-dist).Path`, then run `node scripts/rehearse.mjs`. It launches a separate test server on 4174, drives two browser pages, denies external browser requests, measures each case by checkout reference and version, and verifies disconnect/reconnect and viewport overflow. The running stall on 4173 retains its original in-memory cases. For an interactive cloud rehearsal, use the cloud build settings above, set `$env:STALL_PORT='4175'` and run `npm run stall`. The deployed backend and its latency require separate verification. [Observed results](EXHIBITION_RESULTS.md)
