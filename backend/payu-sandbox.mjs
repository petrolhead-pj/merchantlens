import { createHash, randomBytes, randomUUID } from "node:crypto";

const checkoutUrl = "https://test.payu.in/_payment";
const verifyUrl = "https://test.payu.in/merchant/postservice.php?form=2";
const amount = "500.00";
const digest = parts => createHash("sha512").update(parts.join("|")).digest("hex");
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dashboard = ref => "/exhibition?payu=1&case=" + ref;

function html(res, status, title, content) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://test.payu.in; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)} · Betting Demo</title>
    <style>
      *{box-sizing:border-box} body{margin:0;background:#0a131f;color:#f2f7fa;font:16px/1.5 system-ui}
      main{max-width:580px;margin:10vh auto;padding:28px} section{background:#122239;border:1px solid #2e465f;border-radius:16px;padding:26px}
      h1{font-size:clamp(26px,6vw,36px);line-height:1.12} p{color:#bed0df} .tag{color:#82e5c4;font-size:14px}
      a{color:#82e5c4} button{cursor:pointer;background:#82e5c4;color:#0a221e;font:inherit;font-weight:750;border:0;border-radius:8px;padding:10px 18px}
      input{display:none} form{margin:20px 0}
    </style><main><section><strong class="tag">DEMO SPORTSBOOK · TEST FUNDS</strong><h1>${escape(title)}</h1>${content}</section></main></html>`);
}

export function createPayuSandbox({
  key = process.env.PAYU_SANDBOX_KEY,
  salt = process.env.PAYU_SANDBOX_SALT,
  returnOrigin = process.env.PAYU_SANDBOX_RETURN_ORIGIN,
  fetcher = fetch,
  pollMs = 5000,
  record,
} = {}) {
  const attempts = new Map();
  const lifetime = 10 * 60 * 1000;
  const ready = Boolean(key && salt);
  const configuredOrigin = returnOrigin && new URL(returnOrigin).origin;

  async function reconcile(attempt) {
    if (attempt.state !== "pending" || attempt.checking) return;
    attempt.checking = true;
    try {
      const command = "verify_payment";
      const response = await fetcher(verifyUrl, {
        method: "POST",
        redirect: "error",
        body: new URLSearchParams({
          key, command, var1: attempt.txnid,
          hash: digest([key, command, attempt.txnid, salt]),
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const result = (await response.json()).transaction_details?.[attempt.txnid];
      if (!result) return;
      if (result.status === "failure") {
        attempt.state = "failed";
        return;
      }
      if (result.status !== "success" || result.unmappedstatus !== "captured" ||
        result.txnid !== attempt.txnid || !/^500(?:\.0{1,2})?$/.test(String(result.transaction_amount ?? result.amt)) ||
        !/^\d+$/.test(String(result.mihpayid)) || (result.udf1 && result.udf1 !== attempt.deposit.ref)) return;
      record({
        deposit: attempt.deposit,
        payment: { ...attempt.deposit, kind: "payment", label: undefined, id: randomUUID(), time: new Date().toISOString() },
        txnid: attempt.txnid, providerId: String(result.mihpayid),
      });
      attempt.state = "confirmed";
    } catch {
      // Verification can be retried while the test checkout is pending.
    } finally {
      attempt.checking = false;
    }
  }

  function poll(attempt) {
    const timer = setTimeout(async () => {
      if (Date.now() >= attempt.expires) {
        if (attempt.state === "pending") attempt.state = "expired";
        return;
      }
      await reconcile(attempt);
      if (attempt.state === "pending") poll(attempt);
    }, pollMs);
    timer.unref();
  }

  return {
    owns: ref => [...attempts.values()].some(attempt => attempt.deposit.ref === ref),
    async handle(req, res) {
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/betting-demo" && req.method === "GET") {
        html(res, 200, "Test betting wallet", ready
          ? '<p>Deposit ₹500 in test funds to show how MerchantLens investigates the payment recipient.</p><form method="post" action="/api/payu-sandbox/start"><button>Deposit ₹500</button></form>'
          : '<p>PayU sandbox setup is required. Configure the test merchant key and salt on the MerchantLens server, then reload this page.</p>');
        return;
      }
      if (path === "/api/payu-sandbox/start" && req.method === "POST") {
        if (!ready) return html(res, 503, "PayU sandbox setup required", '<p><a href="/betting-demo">Return to the test betting wallet</a></p>');
        if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin")
          return html(res, 403, "Open checkout from the test betting wallet", '<p><a href="/betting-demo">Open the wallet</a></p>');
        for (const [id, attempt] of attempts) if (Date.now() >= attempt.expires) attempts.delete(id);
        if (attempts.size >= 25) return html(res, 429, "Too many recent test checkouts", "<p>Wait for an earlier checkout to expire.</p>");
        const txnid = randomBytes(12).toString("hex");
        const deposit = {
          ref: randomUUID(), id: randomUUID(), payment: randomUUID(), kind: "topup",
          amount: 50000, currency: "INR", merchant: "SRB-2041",
          label: "Deposit ₹500", time: new Date().toISOString(),
        };
        const origin = configuredOrigin || `http://127.0.0.1:${req.socket.localPort}`;
        const callback = origin + "/api/payu-sandbox/return";
        const fields = {
          key, txnid, amount, productinfo: "MerchantLens sandbox checkout", firstname: "Demo",
          email: "checkout@example.com", phone: "9999999999", udf1: deposit.ref,
          surl: callback, furl: callback,
        };
        fields.hash = digest([
          key, txnid, amount, fields.productinfo, fields.firstname,
          fields.email, fields.udf1, ...Array(9).fill(""), salt,
        ]);
        const attempt = { txnid, deposit, expires: Date.now() + lifetime, state: "pending" };
        attempts.set(txnid, attempt);
        poll(attempt);
        const inputs = Object.entries(fields).map(([name, value]) =>
          `<input type="hidden" name="${name}" value="${escape(value)}">`).join("");
        html(res, 200, "Confirm ₹500 test deposit", `<p>Continue to PayU in a new tab. Use a PayU test card.</p>
          <form method="post" action="${checkoutUrl}" target="_blank" rel="noopener">${inputs}<button>Open PayU test checkout</button></form>
          <a href="${dashboard(deposit.ref)}" target="_blank" rel="noopener">Watch this case in MerchantLens</a>`);
        return;
      }
      if (path === "/api/payu-sandbox/return" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16_384) return html(res, 413, "Checkout response is too large", "");
        }
        const attempt = attempts.get(new URLSearchParams(body).get("txnid"));
        if (!attempt || Date.now() >= attempt.expires) return html(res, 404, "Test checkout expired", '<p><a href="/betting-demo">Start another checkout</a></p>');
        await reconcile(attempt);
        if (attempt.state === "failed") return html(res, 200, "Test payment did not succeed", '<p><a href="/betting-demo">Try another checkout</a></p>');
        res.writeHead(303, { Location: dashboard(attempt.deposit.ref) });
        res.end();
        return;
      }
      html(res, 404, "Test checkout page unavailable", '<p><a href="/betting-demo">Open the test betting wallet</a></p>');
    },
  };
}
