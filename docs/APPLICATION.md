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

## Live graph and admin alert rehearsal

### Two phones and the analyst laptop

1. Connect the laptop and both phones to the same private Wi-Fi or hotspot. Start the app with `PRODUCT_DEMO_HOST=<laptop-private-IPv4> npm start`. Open the analyst page on the laptop at `http://127.0.0.1:4180/analyst` and sign in as `reviewer`.
2. For a local simulated run, open **Demo payment QR codes** in the analyst workbench. Choose **Generate cake QR** for User A and **Generate wallet QR** for User B. The phone links open one checkout each, with no customer sign-in. When using PayU or the full customer screens, sign in as `buyer` or `second-buyer` and click **Show payment QR** from the checkout. The workbench also has **Customer sign-in QR codes** for opening full accounts. Payment codes expire after 10 minutes or on server restart.
3. Scan the payment QR and check the payee and amount. Tap the ₹500 purchase button on the phone to confirm the demo payment. The server commits the payment and pushes a change event to the analyst laptop, which fetches the updated case data. A three-second background refresh also catches changes during a reconnect.
4. The customer-only Wi-Fi listener exposes the simulated storefront and customer API. Merchant and analyst pages remain on the laptop's loopback address. Use separate browser profiles on the laptop for the same rehearsal if the venue network isolates devices.

### AWS checkout over mobile data

For a new private EC2 host with CloudFront and optional Neptune, use the [CloudFormation deployment guide](AWS_CHECKOUT.md).

Run the Node application with SQLite on an approved EC2 host for the simulated two-QR demo. Use CloudFront with the EC2 host as a VPC origin and use the distribution's HTTPS hostname in the QR codes. The existing exhibition API and DynamoDB deployment do not serve phone checkouts. [CloudFront VPC origins](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html)

```dotenv
PRODUCT_PUBLIC_ORIGIN=https://your-distribution.cloudfront.net
PRODUCT_PUBLIC_PORT=4185
MERCHANTLENS_WHATSAPP=preview
```

On EC2, forward CloudFront requests through a reverse proxy to `127.0.0.1:4185`. Preserve the public `Host`, the request `Origin`, cookies and query strings. Allow POST and use CloudFront's **CachingDisabled** policy for checkout and API requests. Verify that the public hostname serves `/phone` and returns 404 for `/analyst`, `/merchant`, and their API routes. [CloudFront cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)

Connect the presenter laptop to port 4180 using an authenticated Systems Manager port-forwarding session. Open the analyst and merchant screens at the forwarded loopback address. Generate both payment QR codes there and rehearse with Wi-Fi off on the phones. Both checkouts write to the same application process and update the open workbench. [Systems Manager port forwarding](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html)

### PayU Hosted Checkout

The **cake checkout** can use PayU's sandbox or production environment over an approved public HTTPS origin. The PayU form redirects to the provider. MerchantLens verifies the callback signature and checks the payment with PayU's Verify Payment API before recording a successful capture and publishing the graph update. The graph shows both PayU identifiers. The wallet scenario continues to use simulated funds. [PayU Hosted Checkout integration](https://docs.payu.in/docs/prebuilt-checkout-page-integration) · [PayU test mode](https://docs.payu.in/docs/test-integration)

Set the following in a private environment file and launch with `node --env-file=/path/to/private-demo.env scripts/product.mjs`:

```dotenv
PAYU_MODE=sandbox
PAYU_MERCHANT_KEY=your-test-merchant-key
PAYU_MERCHANT_SALT=your-test-merchant-salt
PAYU_CALLBACK_ORIGIN=https://your-approved-checkout-domain
PAYU_PUBLIC_PORT=4185
```

Point the HTTPS reverse proxy at `127.0.0.1:4185` and preserve the public `Host` header. This listener serves customer checkout and PayU returns. The analyst and merchant screens continue to use `127.0.0.1:4180`. In PayU's dashboard register the successful payment webhook at `/api/payu/webhook` on that same HTTPS origin. The QR codes switch to the configured HTTPS hostname. Open a new cake checkout after changing modes.

Rehearse an authorized cake order in `sandbox` and confirm the case shows a PayU receipt. If returning from PayU leaves a pending checkout, use **Check PayU status** on that checkout. The buyer can reopen the same transaction if necessary. Only a captured payment updates the graph. For production, set `PAYU_MODE=live` with the approved merchant's production key and salt. The on-screen bakery name is the scenario alias. The PayU payment screen identifies the approved merchant receiving the payment. Standard PayU test mode excludes in-app UPI and UPI Intent.

### Follow the payments

1. In separate browser profiles, sign in at `/customer` as `buyer` (User A) and `second-buyer` (User B). Open `/analyst` as `reviewer`. Open `/merchant` as `bakery` to complete fulfilment.
2. In User A's window, buy the ₹500 cake with checkout evidence sharing enabled. Mark the order delivered or collected in the merchant window. The analyst graph adds User A's payment as soon as it's confirmed and shows the supported outcome once fulfilment is recorded.
3. In User B's window, top up the ₹500 simulated wallet. The live payment graph adds a separate path through the same merchant. Select it to inspect the linked wallet credit. Use the **Payer** filter to isolate either customer's activity, or **Follow latest** to return to new payments as they arrive.
4. The first linked purpose mismatch on a case creates a critical WhatsApp report. The analyst's **Admin WhatsApp alert** panel shows its status and the case, payment and evidence IDs. Cake and unverified cases do not trigger it. A report is a request for human review.

### Deliver to the admin's phone

The default mode previews the report in the analyst workbench. To send live, configure these settings in a private environment file outside version control. Use the [Meta Cloud API quickstart](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) to register an opted-in admin test recipient, obtain a sender phone number ID and an access token, and copy the Graph API version shown by Meta.

```dotenv
MERCHANTLENS_WHATSAPP=live
WHATSAPP_TOKEN=your-private-access-token
WHATSAPP_PHONE_NUMBER_ID=your-meta-sender-phone-number-id
WHATSAPP_ADMIN=+91XXXXXXXXXX
WHATSAPP_GRAPH_VERSION=version-shown-in-meta-dashboard
```

Launch the application with `node --env-file=/path/to/private-demo.env scripts/product.mjs`. Create a fresh wallet case on this process. Preview reports from earlier runs never send. For free-form test alerts, reply once to the Meta test sender from the admin phone within 24 hours of the demo. To send outside that window, configure `WHATSAPP_TEMPLATE` and `WHATSAPP_TEMPLATE_LANGUAGE` for an approved template with five positional body variables, in order: case ID, merchant ID, payment ID, evidence ID, and reason.

Pending alerts are stored with the payment and retry after confirmed connection failures. If an interrupted request may have reached Meta, the case shows an unconfirmed result for the reviewer to check. **Accepted by WhatsApp** confirms API acceptance. Confirm arrival on the admin phone for the live demo.

## Evidence boundaries

- A server-issued checkout intent binds the customer, product, payment reference, amount and fulfilment choice. In local demo mode, confirmation simulates a provider response. PayU mode uses verified provider capture for the cake checkout. The wallet always uses simulated funds.
- With sharing enabled, the in-page observer captures a trusted browser click on the visible checkout button and its references. The authenticated browser submits this report. It is client-controlled instrumentation, with no independent attestation. Turning sharing off sends no observation.
- The merchant order stores its item, quantity, amount, payment ID and fulfilment events. Delivery and collection are merchant attestations. The ledger entry is stored by the wallet operation and supplies the wallet evidence ID. A profile snapshot supplies the registry record ID.
- The versioned commerce/1 projection applies the shared checkout evidence rules. The paid transaction with insufficient evidence remains unverified. A matching completed cake order plus observed cake action supports the sale. A linked wallet posting or wallet action yields a mismatch. An unresolved valid browser record is retained separately and creates no graph relationship. Later contradictions reopen the case and preserve all prior decisions.
- Checkout routes create business operations. The finding reads stored record kinds. PayU confirmation establishes payment status. The browser observation, order and fulfilment records supply separate evidence of purchase purpose.

## Verification

Run `npm test`, `npm run benchmark` and `npm run build`. For browser verification install the existing workstation runner (`npm install --prefix .demo-tools playwright-core`) and use Edge, or set `BROWSER_CHANNEL=chrome` to use Chrome. Run `node scripts/verify-product.mjs` once locally and once with the AWS variables above. Set VERIFY_PORT to a free loopback port if necessary. The runner starts its own server, signs into distinct browser contexts, exercises normal screens, and restarts that server before checking the records. It leaves newly created checkout records available for inspection.

The integration runner alone invokes a controlled contradictory wallet posting against a fulfilled, previously reviewed cake payment. It uses the same wallet posting operation and optimistic concurrency as the normal wallet checkout. There is no customer, merchant, or analyst HTTP route for injecting this fault. Legacy reset, duplicates, fixtures and timed events remain on the separate exhibition server (`npm run stall`).
