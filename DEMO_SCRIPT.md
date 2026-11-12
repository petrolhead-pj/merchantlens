# MerchantLens — two-minute recording

Author: Paarth Jain

Use the Present demo button. The seven chapters advance automatically. Pause the chapter timer when rehearsing. The product does not record video or audio itself.

| Time | Screen and action | Narration |
| --- | --- | --- |
| 0:00–0:16 | Investigation overview | A bakery receives two payments of five hundred rupees. One buys a cake. The other funds a bet. The registration is genuine and both amounts look ordinary. MerchantLens investigates whether actual activity matches the declared business. |
| 0:16–0:35 | Betting checkout selected. Open evidence record briefly, then close it. | We connect payments, checkout sessions, merchant accounts and business evidence in a temporal graph. Here, a checkout observation links betting activity to the bakery's payment session. Every finding shows its source and timestamp. This demonstration uses synthetic records. |
| 0:35–0:54 | Impact preview. Switch from Linked checkout to Entire merchant, then back. | The case covers eighteen linked payments. A merchant-wide restriction would also affect two hundred and thirty payments outside that checkout. Our impact preview helps a reviewer choose a proportionate response, subject to the provider's ability to isolate the channel. |
| 0:54–1:13 | Diwali scenario, orders selected | Now consider a genuine Diwali surge. Volume increases, but order and delivery evidence support the activity. The graph gives context for the change, helping protect legitimate merchants from unnecessary disruption. |
| 1:13–1:31 | Incomplete-evidence scenario. Click Request clarification. | When checkout evidence is missing, the purpose remains unresolved. The system requests the specific evidence needed. Optional bank feeds extend the visible trail. When coverage ends, the system shows that limit. |
| 1:31–1:48 | Human review. Load demo response, enter a short reason and escalate for verification. | A merchant can provide an explanation. The reviewer checks it, records reasoning and clears or escalates the case. Requests and decisions appear in the case history. A document upload alone does not establish legitimacy. |
| 1:48–2:00 | Architecture | Our proposed AWS pipeline combines Neptune, event-driven processing, scheduled checks and an XGBoost–CatBoost ensemble. The current prototype demonstrates the investigation workflow. Production integration and model validation are the next steps. |

Recording notes: avoid presenting fixture scores as model results. The graph remains interactive with SVG when WebGL is unavailable. The application is a functional frontend prototype, not a deployed fraud detector.
