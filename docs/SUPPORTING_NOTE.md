# MerchantLens technical and validation note

## Implemented locally today

Each source has an ID, source tier, named origin, observed and received times, merchant/session references, payment IDs, finding and link state. Only enabled, in-scope records observed and received by the case cutoff participate. Orders and fulfilments must originate from distinct named sources and cover the same payments. The displayed coverage is the fraction of distinct known payments with mapped independent checkout/fulfilment evidence.

A linked independent mismatch takes precedence and scopes escalation to the union of implicated IDs. Overlapping supporting records are disclosed. An ambiguous or severed checkout mapping keeps clearance unavailable pending clarification. Clearance applies only to the order/fulfilment intersection and requires reasoning and attestation. An analyst may request investigation of unresolved activity with reasons. A merchant claim cannot independently establish purpose. Each edit invalidates current attestation and disposition conservatively and saves the previous evidence, decision and reasoning. The case export includes only the current case and session. The queue index adds 10 points for a threefold spike, 15 for ambiguous mappings, 50 for a linked mismatch, and up to 25 proportional to the fraction implicated. These illustrative rules require partner validation.

The 18 mapped receipts in the 248-payment example are 7.3% of the set. The other 230 are outside that link and remain unverified. A ₹36,000 invoice-backed supplier transfer, ₹18,000 to Receiver R and ₹15,000 from R to Z six minutes later are account movements. A specific customer's ₹500 cannot be attributed through a mixed balance using timing. The tracer bounds hops and stops cyclic paths.

## Event transport and access

Synthetic payments use PayU-style txnid, mihpayid, amount, status and addedon. Merchant/session bindings, event_id, source_feed, timestamps and udf_checkout_ref are local envelope fields. Receipt time in this controlled replay comes from its synthetic clock. The API checks the supported successful-payment schema and deduplicates payment IDs within the process. It rejects contradictory reuse of identifiers. Late checkout observations come from a separate synthetic observer. Browser-only mode exercises the same logic. The drawer is an isolated one-payment case; it does not add a 249th receipt to the stall ledger.

[PayU payment webhooks](https://docs.payu.in/docs/webhook-events-and-sample-payloads) · [Separate payouts webhooks](https://docs.payu.in/docs/payouts-webhooks)

## Controlled benchmark

Run `npm run benchmark`. Sixteen authored synthetic variants include six planted mismatches and ten other cases. Both queues take four, with input order breaking ties. Volume ranks by the collection multiple; MerchantLens ranks by its rule index. Inspect scripts/benchmark.mjs for every input and label.

| Four reviews available | Mismatches surfaced | Genuine scenarios queued | Mismatches missed |
|---|---:|---:|---:|
| Volume queue | 1/6 | 3/4 reviews | 5/6 |
| Evidence queue | 4/6 | 0/4 reviews | 2/6 |

The two missed mismatches had a severed mapping or evidence received after the decision cutoff. Across all cases, three supported scoped clearance, four scoped escalation, seven clarification and two unresolved mapping conflicts. The same authors designed these cases and rules. These counts describe fixture behavior. Field accuracy, analyst-time savings and prevented losses remain unmeasured.

## Proposed production / shadow pilot

Begin with permissioned historical replay, later-time and unseen-merchant evaluation, then a shadow queue alongside existing monitoring. Measure recall including abstentions, review time, merchant contacts, mapping coverage and cost per verified finding. Payment-profile data alone supplies no downstream transfer access. Payout coverage must be authorized separately. Use least privilege, tokenized identifiers, signed source provenance, retention and auditable corrections. The provider owns operational interventions and applicable reporting. The current process is single station, in-memory and suitable only for a local demonstration.
