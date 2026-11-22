# PayU sandbox walkthrough

The betting page simulates a sportsbook deposit. PayU runs the test payment, and MerchantLens verifies it directly with PayU before showing a mismatch against the Sunrise Bakery test merchant. No funds move.

1. Get the test merchant key and salt from PayU Test Mode. In the repository root, create a local `.env.payu` file with these settings. Git ignores this file.

   ```dotenv
   PAYU_SANDBOX_KEY=your_test_key
   PAYU_SANDBOX_SALT=your_test_salt
   STALL_PORT=4187
   ```

2. Run `npm run setup` once, then `npm run build` and `node --env-file=.env.payu scripts/stall.mjs`. Use Node 22 or later.
3. Open [Test betting wallet](http://127.0.0.1:4187/betting-demo). Click **Deposit ₹500**, open the PayU test checkout, and use a [PayU test card](https://docs.payu.in/docs/test-cards-upi-id-and-wallets). Open **Watch this case in MerchantLens** in a separate tab.
4. After payment, select **Inspect matching evidence** in MerchantLens. The inspector shows the checkout reference, PayU transaction ID, and provider reference.

The browser return attempts to open the case immediately. The server also checks PayU directly for up to ten minutes, so the case can still appear if the checkout return does not reach loopback. If your sandbox checkout rejects the local return URL, use an HTTPS origin that routes to this demo server and set `PAYU_SANDBOX_RETURN_ORIGIN` to that origin. Keep the demo server running throughout the demo. Its checkout state and case feed are in memory.
