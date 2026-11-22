# MerchantLens

MerchantLens has separate authenticated customer, merchant-operations and analyst screens. A confirmed simulated payment creates a real order or wallet posting. Merchant fulfilment advances the order, and stored evidence drives the analyst finding.

Use Node 22.16 or later. Run `npm ci`, `npm run setup`, `npm run build`, then `npm run accounts` once and `npm start`. Open [the customer application](http://127.0.0.1:4180/customer). See [application setup, sign-in, storage and verification](docs/APPLICATION.md) for merchant and analyst access and the AWS-backed mode.

The exhibition fixture server is a separate development tool. Its timed scenarios and seeded replay are described in the [rehearsal guide](docs/EXHIBITION.md).

An analyst workspace for **The Bakery That Takes Bets**, IIM Bangalore. Follow two ₹500 payments into the same merchant and inspect what the available evidence supports.

## Run the separate exhibition fixture

Use Node 22 or newer. Run these commands in the repository root. Setup requires internet once.

    npm run setup
    npm test
    npm run benchmark
    npm run build
    npm run stall

Open **http://127.0.0.1:4173**. After building, the stall command serves the local assets and API with Node alone. Keep the process running. For development, run `npm run dev` and optionally `npm run backend` in another terminal. Without the backend, the interface selects browser replay. For a fresh visit, click **Reset Stall Demo State**. Use a dedicated browser profile on each laptop.

## Seeded exhibition replay

Case ML-2041, merchant SRB-2041, session PS-0921. A synthetic ledger holds 248 payments. Source toggles, payment link controls, received-time filtering and rule-based triage drive a typed temporal transaction & evidence graph. The analyst records the final disposition. JSON and printable HTML carry the active records, scope and dated history. Browser history is editable and unsigned. Refresh requires fresh attestation.

The separate synthetic webhook drawer starts with zero payments. Send one payment, repeat it, then add late checkout evidence. Inspect the earlier and revised recommendations. The single-station Node process keeps replay state in memory. Browser fallback lasts until reload. A separate authorized bank fixture illustrates three movements. No payment restriction is executed.

## Proposed production / shadow pilot

The workstation application uses versioned evidence rules and has been verified against Sydney DynamoDB. A real-money pilot would require provider-issued confirmations, authorized evidence feeds, operational access controls and a retention policy. Trained inference would require a documented dataset, evaluation and inference implementation.

## Finale materials

- [Evidence logic, limitations and benchmark](docs/SUPPORTING_NOTE.md)
- [4:45 pitch and jury answers](DEMO_SCRIPT.md)
- [Printable A3 poster draft](docs/stall/MerchantLens-A3.pdf)
- [A4 controlled results sheet](docs/stall/MerchantLens-results.pdf)
- [Editable print layouts](docs/stall/)
- [Local replay API](backend/README.md)

Team SAPQuests · Shreyas Naik, Paarth Jain and Anshul Vaibhav
