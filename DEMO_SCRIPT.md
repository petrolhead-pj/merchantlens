# MerchantLens · stall pitch and jury playbook

Target 4:45. Paarth narrates, Shreyas operates, Anshul watches the clock and handles the pilot question. Suggested roles. Start with a reset, the main screen visible, and the poster beside the laptop.

| Clock | Action and spoken line |
|---|---|
| 0:00–0:25 | Point to the receipts. “Two customers pay ₹500 to the same verified bakery. What evidence would justify contacting the merchant about one checkout? We built MerchantLens to answer that analyst’s question.” |
| 0:25–0:55 | Show ML-2041 and the payment-only state. “We see a sixfold surge across 248 synthetic payments. That could be a festival. We can request mapped records. We cannot yet explain the purchases.” |
| 0:55–1:35 | Enable ORD-01 and FUL-01. Expand a record. Show its source, timestamps and IDs. Type “Independent order and fulfilment records match these 18 receipts.” Attest and clear. “Clearance applies only to these matched payments.” |
| 1:35–2:20 | Enable CKT-ALT-09. Open its observation. “A different source describes a checkout outside the bakery profile and maps it to these 18 payments. The earlier clearance has reopened. We can investigate the disagreement.” Enable the catering claim. “The merchant’s statement is recorded. This conflict needs independent reconciliation.” |
| 2:20–2:55 | Invite a judge to uncheck Payment mapping intact inside CKT-ALT-09. “The observation still exists. Its link to these receipts has gone. Which payment can we accuse? We withdraw the scoped escalation, ask for the identifiers and retain the earlier decision.” |
| 2:55–3:25 | Show downstream bank feed, then hide it. “₹36,000 has a flour invoice. R receives ₹18,000 and sends ₹15,000 to Z six minutes later. Timing cannot trace a particular customer’s ₹500 through a mixed balance. When this feed ends, the checkout evidence remains available.” |
| 3:25–4:00 | In the replay drawer, send payment, duplicate, late record. “These are local synthetic events. The duplicate adds zero exposure. The checkout observer arrives later. Inspect what the analyst knew at each time.” |
| 4:00–4:45 | Hold up the A4 sheet. “At four review slots, volume surfaced one of six planted mismatches. Evidence surfaced four. The two misses show exactly why timing and linkage matter. These were authored cases. Our next step is a permissioned shadow trial on one merchant segment, measuring verified findings and merchant contacts at equal analyst capacity.” Stop and invite questions. |

## Two-minute jury round

| Question | First answer |
|---|---|
| Is it scripted? | The records are fixtures. Toggle a mapping on the same case. The pure policy calculates the outcome, scoped IDs and reasons from the records available at the cutoff. |
| Is this proof of betting? | It supports a scoped business-purpose mismatch. Receiver identity and downstream purpose require independent verification. |
| Why trust a delivery record? | We require mapped order and fulfilment records from distinct named sources. Our fixtures model those sources. Production needs authenticated provenance and reconciliation. |
| Can PayU see R and Z? | Only a separately authorized source covering those transfers supplies these edges. Switching it off leaves the independent checkout review usable. |
| How does this help an honest bakery? | Order and delivery matches support scoped clearance through a festival surge. We can measure unnecessary merchant contacts and time to resolve a case in a shadow pilot. |
| What if evidence arrives late or a callback repeats? | Replay the same callback. Exposure stays fixed. Deliver the late observation and inspect both decision snapshots. |
| What does the score mean? | Queue points reflect a spike, ambiguous mappings and the extent of an independently linked mismatch. They are a transparent priority rule, not a probability. |
| Why a graph database? | The local graph explains relationships and time order. An indexed event store is enough for a pilot. Measure multi-hop query cost before choosing a production graph database. |
| Can you block or file automatically? | The system records an investigation and its scope. Provider-authorized risk and compliance teams own interventions and reporting. |
| What if behavior adapts? | Ordinary amounts can still have contradictory checkout evidence. A broken mapping or unavailable feed can hide activity. Our benchmark includes both failures. |
| Are the results independent? | Our team authored all 16 cases. The equal-budget replay checks controlled behavior. Production evaluation requires unseen merchants, later periods and independent labels. |
| What would make you stop? | Insufficient authorized mappings, additional harm to genuine merchants, or reviewer costs exceeding the measured value. |

## Stall recovery

Build on both laptops in advance. Start npm run stall, visit the loopback URL, disconnect external Wi-Fi and test from a fresh tab. Reset between visits. The default page and SVG compatibility graph use local assets. If the graph fails, use the records, transfer table and decision history. Keep the second laptop ready. Print the A3 at actual size and the results sheet on A4. Personalize the editable poster with your own team illustration before printing if desired.
