# MerchantLens investigation walkthrough

Author: Paarth Jain

There is no timer or automatic navigation. Work through the case at your own pace.

1. Read the opening balance, collections, outflows and resulting balance in **Where did the money go?** All data is synthetic.
2. Move the event-time slider before 10:10, then past 10:18 and 10:24. Watch transfers appear and the visible balance update.
3. Inspect the flour supplier. Its invoice supports an operating expense.
4. Select Receiver R in **Trace from**. See its onward transfer to Account Z and the six-minute interval after receipt.
5. Select Account Z. The trail ends because no onward transfers are available. Unknown purpose is not proof of wrongdoing.
6. Search a transfer ID, export the visible trail, or click **Inspect recipient** to focus the graph and evidence panel.
7. Disable bank coverage to see the explicit visibility boundary.
8. Open case review, enter your reasoning, and record a decision. Notes and history remain in this browser after refresh. Export the case for a portable copy.

Account-level sequence does not establish which exact incoming payment funded an outgoing transfer. Funds mix with the opening balance. The backend is still a read-only demo scaffold; no live payment controls or trained model inference are connected.
