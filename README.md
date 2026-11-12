# MerchantLens

MerchantLens explores whether observed payment activity matches a merchant's declared business. The demonstration follows Sunrise Bakery through mixed-purpose collections, a legitimate Diwali surge and incomplete evidence.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Build with `npm run build`. Preview the production build with `npm run preview`.

## Implemented interactions

- Clickable transaction network with animated payment flows, pan, zoom and focus mode.
- React Three Fiber / Three.js WebGL renderer with automatic SVG compatibility fallback.
- Three deterministic synthetic scenarios.
- Entity inspection, evidence record modal and event timeline.
- Checkout-evidence and bank-coverage toggles.
- Searchable sample transaction ledger with navigation back to the graph.
- Checkout versus whole-merchant intervention comparison.
- Targeted clarification request and simulated merchant response.
- Reviewer reasoning, clear/escalate decisions and case-history export.
- Guided 120-second presentation mode with seven chapters and playback controls.
- Proposed AWS architecture view and implementation-boundary disclosure.

## Demonstration boundaries

All payments, identities, evidence and scores are synthetic fixtures. The UI does not connect to live payments, AWS, banks or merchant messaging. XGBoost and CatBoost scores are illustrative fixture values, not trained model inference. Review decisions live in React state and reset on reload. Export a case to retain its current record. Downstream transfers show observable sequence only, without proving allocation of commingled funds. No automatic payment restriction is executed.

## Technology

React, Vite, React Three Fiber, Three.js, Drei, Lucide icons and CSS. Optional Google Fonts fall back to local sans-serif fonts.

The architecture page describes a proposed production deployment using API Gateway, Lambda, EventBridge, Neptune, DynamoDB, S3 and EventBridge Scheduler. Production requires authorized evidence integrations, validated labels, model training and calibration, security controls, operations and scale testing.

## Recording

Use a 1920 × 1080 desktop viewport if possible. Open the app, select **Present demo**, and follow `DEMO_SCRIPT.md`. Pause or advance chapters as needed. Record the actual interactions and disclose synthetic data. No accuracy or selection guarantee is claimed.

## Authorship

Paarth Jain
