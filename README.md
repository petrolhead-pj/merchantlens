# MerchantLens

MerchantLens explores whether observed payment activity matches a merchant's declared business. The demonstration follows Sunrise Bakery through mixed-purpose collections, a legitimate Diwali surge and incomplete evidence.

## Run locally

Requires Node.js 22 or newer.

```bash
npm run setup
npm run dev
```

Build with `npm run build`. Preview the production build with `npm run preview`.

## Project layout

- `frontend/` — React, Vite and the 3D investigation interface.
- `backend/` — tested read-only Node.js demo API scaffold.
- Run `npm run backend` separately for API metadata on port 3001. The frontend remains self-contained; no live integrations are enabled.
- Run `npm test` to validate the demo API.

## Implemented interactions

- Perspective 3D transaction network with dimensional nodes, orbital rings, curved animated payment paths, star field and ground grid.
- Drag to orbit, right-drag to pan, scroll to zoom; select nodes to inspect evidence.
- Neon-blue investigation workspace with a larger graph viewport and focus mode.
- React Three Fiber / Three.js WebGL renderer with automatic SVG compatibility fallback.
- Three deterministic synthetic scenarios.
- Entity inspection, evidence record modal and event timeline.
- Checkout-evidence and bank-coverage toggles.
- Searchable sample transaction ledger with navigation back to the graph.
- Checkout versus whole-merchant intervention comparison.
- Targeted clarification request and simulated merchant response.
- Reviewer reasoning, clear/escalate decisions and case-history export.
- Untimed money trail with account selection, event-time filtering, recipient inspection, search and JSON export.
- Per-scenario review notes and decisions retained in browser local storage.
- Proposed AWS architecture view and implementation-boundary disclosure.

## Demonstration boundaries

All payments, identities, evidence and scores are synthetic fixtures. The UI does not connect to live payments, AWS, banks or merchant messaging. XGBoost and CatBoost scores are illustrative fixture values, not trained model inference. Review decisions and history are saved in this browser’s local storage. They are not synced across devices or secured by backend authentication. Export a case for a portable record. Downstream transfers show observable sequence only, without proving allocation of commingled funds. No automatic payment restriction is executed.

## Technology

React, Vite, React Three Fiber, Three.js, Drei, Lucide icons and CSS. Optional Google Fonts fall back to local sans-serif fonts.

The architecture page describes a proposed production deployment using API Gateway, Lambda, EventBridge, Neptune, DynamoDB, S3 and EventBridge Scheduler. Production requires authorized evidence integrations, validated labels, model training and calibration, security controls, operations and scale testing.

## Recording

Use a 1920 × 1080 desktop viewport if possible. Use the money trail and graph at your own pace. `DEMO_SCRIPT.md` contains an untimed walkthrough; no countdown or automatic navigation runs. Record the actual interactions and disclose synthetic data. No accuracy or selection guarantee is claimed.

## Authorship

Paarth Jain
