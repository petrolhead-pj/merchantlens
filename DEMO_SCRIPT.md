# MerchantLens recording plan (target 110 seconds)

Use the actual running prototype, preferably a 1920 x 1080 desktop. Record microphone and the selected application window. All data is synthetic. The app has no countdown or automatic navigation; these times are editing targets only.

| Time | Show | Suggested narration |
|---|---|---|
| 0-12s | Mixed-purpose scenario / graph | “MerchantLens checks whether a merchant's payments match its business. A verified bakery can still collect payments for another purpose. This is a working prototype using synthetic data.” |
| 12-32s | Checkout/evidence inspection | “Two payments can have the same amount and merchant, but different purposes. We inspect checkout evidence tied to the session, rather than treating a spike as proof.” |
| 32-49s | Money trail / receiver inspection | “This supplier payment has an invoice. Receiver R and Account Z need more evidence. Later transfers show a sequence, not proof that a particular customer's money funded them.” |
| 49-72s | Review queue; reason; request; response; escalate | “The merchant's generic catering reply does not reconcile this checkout mismatch. The analyst records a reason and escalates the flagged checkout. The prototype never blocks a payment.” |
| 72-94s | Diwali scenario; Review queue; reason; attestation; Clear | “A genuine seasonal surge has matching order and delivery evidence. Clearance requires a review of the merchant, session, interval and source records. That protects legitimate trade.” |
| 94-110s | Incomplete evidence; printable report | “When purpose evidence is missing, the case stays unresolved. We export the scoped evidence, reasoning and history. Cloud integrations and trained models are the next pilot stage.” |

Before filming: run npm test and npm run build; follow docs/SUPPORTING_NOTE.md manual checks. Rehearse navigation and trim pauses. The printable report downloads as HTML: open it and choose Print / Save as PDF. No production claims, measured accuracy or cloud connectivity should be implied.
