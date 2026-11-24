# MerchantLens · stall pitch and jury playbook

Target 4:45. Paarth narrates, Shreyas operates, Anshul watches the clock and handles the pilot question. Suggested roles. Start with a reset, the main screen visible, and the poster beside the laptop.

## Live two-phone pitch

Before the jury arrives, sign in to the analyst and merchant screens. Connect both phones to the laptop's Wi-Fi or hotspot, then generate both codes under **Demo payment QR codes**. The codes expire after ten minutes.

| Clock | Show |
|---|---|
| 0:00–0:40 | Introduce Sunrise Bakery. Both phone checkouts show the same payee and ₹500. Ask what would establish the purpose of each payment. |
| 0:40–1:45 | User A scans the cake QR and confirms. Show the new payment in the analyst workbench. Advance the order through delivery in Merchant operations and show the 3D graph update to **Cake sale supported**. |
| 1:45–2:55 | User B scans the wallet QR and confirms. Show the second payment, then click **Explain this flag**. Point to the paid reference and the wallet credit that conflicts with the declared bakery business. |
| 2:55–3:40 | Open **View critical report** and show the case, payment and evidence IDs. Identify the delivery status shown on screen. Explain that the report asks an analyst to investigate a purpose mismatch. |
| 3:40–4:45 | Compare the two paths using the payer filter. Explain which records would require independent sources in a PayU pilot, then use the A4 sheet to discuss the controlled evaluation. |

## Seeded replay pitch

| Clock | Action and spoken line |
|---|---|
| 0:00–0:25 | Point to the receipts. “Two customers pay ₹500 to the same verified bakery. What evidence would justify contacting the merchant about one checkout? We built MerchantLens to answer that analyst’s question.” |
| 0:25–0:55 | Show ML-2041 and the payment-only state. “We see a sixfold surge across 248 synthetic payments. That could be a festival. We can request mapped records. We cannot yet explain the purchases.” |
| 0:55–1:35 | Enable ORD-01 and FUL-01. Expand a record. Show its source, timestamps and IDs. Type “Independent order and fulfilment records match these 18 receipts.” Attest and clear. “Clearance applies only to these matched payments.” |
| 1:35–2:20 | Enable CKT-ALT-09. Open its observation. “A different source describes a checkout outside the bakery profile and maps it to these 18 payments. The earlier clearance has reopened. We can investigate the disagreement.” Enable the catering claim. “The merchant’s statement is recorded. This conflict needs independent reconciliation.” |
| 2:20–2:55 | Frame the large “Sever CKT-ALT-09 payment mapping” button. Say “Click here to remove the link for those same 18 receipts.” If the judge pauses for two seconds, say “Let me click it so you can watch the scope change,” and click. “The observation still exists. Its link to these receipts has gone. Which payment can we accuse? We withdraw the scoped escalation, ask for the identifiers and retain the earlier decision.” |
| 2:55–3:25 | Show downstream bank feed, then hide it. “₹36,000 has a flour invoice. R receives ₹18,000 and sends ₹15,000 to Z six minutes later. Timing cannot trace a particular customer’s ₹500 through a mixed balance. When this feed ends, the checkout evidence remains available.” |
| 3:25–4:00 | In the replay drawer, send payment, duplicate, late record. “These are local synthetic events. The duplicate adds zero exposure. The checkout observer arrives later. Inspect what the analyst knew at each time.” |
| 4:00–4:45 | Hold up the A4 sheet. Anshul gives a quiet cue at 4:15. “At four review slots, volume surfaced one of six planted mismatches. Evidence surfaced four. The two misses show exactly why timing and linkage matter. These were authored cases. Our next step is a permissioned shadow trial on one merchant segment, measuring verified findings and merchant contacts at equal analyst capacity.” Stop and invite questions. |

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
| How do you account for all 16? | Six planted mismatches, ten other cases. Four is the queue capacity. Across all sixteen there are four escalations, three clearable scopes, seven clarifications and two unresolved mappings. |
| Who reports and protects identifiers? | The RBI PA directions call for merchant-profile monitoring. Applicable FIU-IND reporting belongs to the regulated entity. Proposed DPDP safeguards include tokenized identifiers with controlled re-identification. |
| How would you price a pilot? | Multiply monthly cases by minutes saved, divide by 60, multiply by loaded hourly cost, then subtract processing and evidence costs. Exclude unverified prevented losses. |

**Does clarification hide false-positive friction?** “Yes, clarification costs time. Six of ten cases without a planted mismatch prompted clarification.” These authored stress cases emphasize missing evidence. A clarification prompts evidence gathering; escalation routes a case to a risk reviewer. Neither action in this prototype interrupts payments. Count actual unnecessary merchant contacts, repeat requests and analyst minutes per case alongside missed mismatches at equal review capacity. Agree on limits with the partner before the pilot and stop if exceeded.

## Stall recovery

Keep the loaded tab open if Node stops. Avoid refreshing during the pitch. If the interface freezes, play the pre-opened 34-second local clip immediately. Before merging, each teammate should read the A4 table and run the 2:20 handoff once.

Build on all three laptops in advance. Start npm run stall, visit the loopback URL, disconnect external Wi-Fi and test from a fresh tab. Reset between visits. The default page and SVG compatibility graph use local assets. If the graph fails, use the records, transfer table and decision history. Keep the second laptop ready. Print the A3 at actual size and the results sheet on A4. Personalize the editable poster with your own team illustration before printing if desired.

### November 21–26

| Date | Team check |
|---|---|
| Sat 21 | Review the PR together. Read the six/ten truth breakdown aloud, perform the clearance reversal, then make the merge decision. |
| Sun 22 | Run 3–5 timed classmate reviews. Record start, finish, task and errors. Test all three laptops in airplane mode. Keep the demonstrated pilot savings unquantified until measured. |
| Mon 23–Tue 24 | Print the 297 × 420 mm poster on matte stock (300 GSM is the team's preference) and 3–5 A4 handouts. Check the actual poster from four feet away. Rehearse standing three times with a hard stop at 4:45. Save the 34-second [offline backup clip](docs/stall/MerchantLens-backup.mp4) on each laptop. |
| Wed 25 | Cold-start every machine, charge batteries, pack each member's ID and charger, and confirm transport. Campus parking is unavailable. |
| Thu 26 | Arrive by 8:30 AM; pre-warm before the 9:30 AM bootcamp. Ask which authorized checkout identifiers can be reliably joined to payment records. At the 11 AM exhibition use only the answer actually given and distinguish it from the synthetic example. |
