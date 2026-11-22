# Persistent MerchantLens application

The customer buys a chocolate cake for delivery or pickup, or adds simulated funds to a fictional wallet. Both checkouts pay Sunrise Bakery, account SRB-2041. The merchant signs in independently to accept the order, start preparation, mark it ready and confirm delivery or collection. The analyst can inspect evidence, see the applied rule, review a case and read its decision history.

| Workstation mode | Customer | Merchant | Analyst |
| --- | --- | --- | --- |
| SQLite | http://127.0.0.1:4180/customer | http://127.0.0.1:4180/merchant | http://127.0.0.1:4180/analyst |
| Sydney DynamoDB | http://127.0.0.1:4181/customer | http://127.0.0.1:4181/merchant | http://127.0.0.1:4181/analyst |

## Workstation setup

Use Node 22.16+ with node:sqlite. Run the following from the repository root.

    npm ci
    npm run setup
    npm run build
    npm run accounts
    npm start

Account setup uses exclusive creation. It creates independent random passwords and salted scrypt hashes under the local, ignored `.demo-tools/product` directory. Open `initial-logins.txt` privately on the workstation. The four rows correspond to buyer, second-buyer, bakery and reviewer. Give each operator only their own login. Keep the directory private to the OS account. Move the initial handoff into the operator's password manager after rehearsals. The browser integration test needs the handoff in place. No account password is bundled into the UI or committed.

Set `MERCHANTLENS_DATA` to a private directory before setup and launch to select another data location. Local mode uses commerce.sqlite with SQLite WAL and synchronous commits. Stop the process before copying the whole data directory for a backup. Restart using the same directory. Sessions expire after eight hours and restart requires sign-in. Business records survive both. Each role has a separate HttpOnly, SameSite session cookie scoped to its API path. The HTTP server binds to loopback for workstation use.

For the deployed table, use a separate PowerShell terminal with the approved profile and region:

    $env:AWS_PROFILE='merchantlens'
    $env:AWS_REGION='ap-southeast-2'
    $env:MERCHANTLENS_TABLE='merchantlens-exhibition-Store-1MBI58DO2LV0H'
    $env:PRODUCT_PORT='4181'
    npm start

The product service uses the AWS SDK server-side and requires GetItem, PutItem and Query on the existing table. It keeps one payment aggregate per sort key under PRODUCT#SRB-2041. The original exhibition uses separate keys and its queued intake. Product writes go directly from the trusted workstation service to DynamoDB. The transaction, ledger posting, evidence, materialized case and history commit in one version-conditional write. A competing writer rereads before retrying. This atomic projection replaces a separately delivered outbox message. Each confirmed wallet posting belongs to one payment. The displayed balance sums posted minor-unit amounts for the authenticated wallet owner.

This is a single-merchant workstation application. The tenant query is paginated internally and scoped by the authenticated account. Case history must fit within one DynamoDB item. A portfolio-scale deployment would need separate history items and customer-specific read indexes. Stop the product process to end polling; existing records remain. Stack teardown and retained resources are described in EXHIBITION.md.

## Evidence boundaries

- A server-issued checkout intent binds the customer, product, payment reference, amount and fulfilment choice. Confirming it simulates a successful provider response. Funds, provider settlement and wallet currency are simulated.
- With sharing enabled, the in-page observer captures a trusted browser click on the visible checkout button and its references. The authenticated browser submits this report. It is client-controlled instrumentation, with no independent attestation. Turning sharing off sends no observation.
- The merchant order stores its item, quantity, amount, payment ID and fulfilment events. Delivery and collection are merchant attestations. The ledger entry is stored by the wallet operation and supplies the wallet evidence ID. A profile snapshot supplies the registry record ID.
- The versioned commerce/1 projection applies the shared checkout evidence rules. The paid transaction with insufficient evidence remains unverified. A matching completed cake order plus observed cake action supports the sale. A linked wallet posting or wallet action yields a mismatch. An unresolved valid browser record is retained separately and creates no graph relationship. Later contradictions reopen the case and preserve all prior decisions.
- Checkout routes create business operations. The finding reads stored record kinds. No trained model, live payment gateway, external courier or independent browser extension participates.

## Verification

Run `npm test`, `npm run benchmark` and `npm run build`. For browser verification install the existing workstation runner (`npm install --prefix .demo-tools playwright-core`) and use Edge. Run `node scripts/verify-product.mjs` once locally and once with the AWS variables above. Set VERIFY_PORT to a free loopback port if necessary. The runner starts its own server, signs into distinct browser contexts, exercises normal screens, and restarts that server before checking the records. It leaves newly created checkout records available for inspection.

The integration runner alone invokes a controlled contradictory wallet posting against a fulfilled, previously reviewed cake payment. It uses the same wallet posting operation and optimistic concurrency as the normal wallet checkout. There is no customer, merchant, or analyst HTTP route for injecting this fault. Legacy reset, duplicates, fixtures and timed events remain on the separate exhibition server (`npm run stall`).
