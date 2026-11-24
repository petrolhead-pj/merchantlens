import { createHash, timingSafeEqual } from "node:crypto";
import { fail, price } from "./product.mjs";

const amount = (price / 100).toFixed(2);
const sha512 = (fields) => createHash("sha512").update(fields.join("|")).digest("hex");
const blanks = Array(5).fill("");
const identity = ["key", "txnid", "amount", "productinfo", "firstname", "email"];
const userFields = ["udf1", "udf2", "udf3", "udf4", "udf5"];
const terminalFailure = new Set(["failed", "usercancelled", "bounced", "autorefund"]);

export function configuredPayU(env, fetchVerify = fetch) {
  const { PAYU_MODE: mode, PAYU_MERCHANT_KEY: key, PAYU_MERCHANT_SALT: salt, PAYU_CALLBACK_ORIGIN } = env;
  if (!mode) return null;
  if (!["sandbox", "live"].includes(mode) || !key || !salt || !PAYU_CALLBACK_ORIGIN)
    throw Error("Set PAYU_MODE, PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT and PAYU_CALLBACK_ORIGIN.");
  const callback = new URL(PAYU_CALLBACK_ORIGIN);
  if (callback.protocol !== "https:" || callback.href !== callback.origin + "/")
    throw Error("PAYU_CALLBACK_ORIGIN must be an HTTPS origin.");
  const hostedUrl = mode === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";
  const verifyUrl = mode === "live" ? "https://info.payu.in/merchant/postservice.php?form=2" : "https://test.payu.in/merchant/postservice.php?form=2";

  return {
    mode,
    publicOrigin: callback.origin,
    checkout(txnid, payer, phoneCheckout = false) {
      const returnURL = callback.origin + "/api/payu/return" + (phoneCheckout ? "?phone=1" : "");
      const fields = { key, txnid, amount, productinfo: "Chocolate cake", ...payer,
        surl: returnURL, furl: returnURL };
      fields.hash = sha512([...identity.map((name) => fields[name]), ...userFields.map(() => ""), ...blanks, salt]);
      return { url: hostedUrl, fields };
    },
    signedEvent(fields) {
      const txnid = fields.get("txnid");
      const hash = fields.get("hash");
      if (!/^[a-f0-9]{24}$/.test(txnid ?? "") || !/^[a-f0-9]{128}$/i.test(hash ?? "") || fields.get("key") !== key)
        fail(400, "Invalid PayU callback");
      const extra = fields.get("additionalCharges") ?? fields.get("additional_charges");
      const splitInfo = fields.get("splitInfo");
      const status = fields.get("status") ?? "";
      const expected = sha512([
        ...(extra === null ? [] : [extra]), salt, status,
        ...(splitInfo === null ? [] : [splitInfo]), ...blanks,
        ...userFields.toReversed().map((name) => fields.get(name) ?? ""),
        ...identity.toReversed().map((name) => fields.get(name) ?? ""),
      ]);
      if (!timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex")))
        fail(400, "Invalid PayU callback signature");
      return { txnid, status: status.toLowerCase() };
    },
    async paymentState(txnid) {
      const command = "verify_payment";
      let result;
      try {
        const response = await fetchVerify(verifyUrl, {
          method: "POST",
          body: new URLSearchParams({ key, command, var1: txnid, hash: sha512([key, command, txnid, salt]) }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (!response.ok) fail(502, "Unable to verify PayU payment");
        result = JSON.parse(await response.text(), (name, value, context) =>
          name === "mihpayid" && typeof value === "number" ? context.source : value);
      } catch {
        fail(502, "Unable to verify PayU payment");
      }
      const details = result?.transaction_details?.[txnid];
      const status = String(details?.status ?? "").toLowerCase();
      const stage = String(details?.unmappedstatus ?? "").toLowerCase();
      if (status === "failure" && String(details.txnid) === txnid && terminalFailure.has(stage))
        return { status: "failed" };
      if (status !== "success" || stage !== "captured") return { status: "pending" };
      if (String(details.txnid) !== txnid || Number(details.transaction_amount) !== Number(amount) ||
          !/^\d{1,30}$/.test(details.mihpayid ?? "")) fail(502, "PayU verification did not match the checkout");
      return { status: "captured", paymentId: details.mihpayid };
    },
  };
}

export async function reconcilePayU(payu, service, row, onChange) {
  if (row.confirmed) return { status: "captured" };
  const result = await payu.paymentState(row.gateway.txnid);
  if (result.status === "captured") {
    await service.confirmPayU(row, result.paymentId);
    onChange(row.merchant);
  }
  return { status: result.status };
}

export function payuCallback(payu, service, merchant, onChange) {
  return async (req, res) => {
    const phoneReturn = req.url === "/api/payu/return?phone=1";
    const isReturn = phoneReturn || req.url === "/api/payu/return";
    if (req.method !== "POST" || (!isReturn && req.url !== "/api/payu/webhook")) {
      res.writeHead(404).end();
      return;
    }
    try {
      if (!req.headers["content-type"]?.toLowerCase().startsWith("application/x-www-form-urlencoded"))
        fail(415, "Expected a PayU form callback");
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 20000) fail(413, "PayU callback too large");
      }
      const { txnid, status: reportedStatus } = payu.signedEvent(new URLSearchParams(body));
      const row = await service.payuCheckout(merchant, txnid, payu.mode);
      const { status } = await reconcilePayU(payu, service, row, onChange);
      res.setHeader("Cache-Control", "no-store");
      if (isReturn) {
        const heading = { captured: "Payment confirmed", failed: "Payment failed", pending: "Payment not yet confirmed" }[status];
        const guidance = {
          captured: "MerchantLens recorded your PayU receipt.",
          failed: "Return to the checkout to check the status and start again.",
          pending: "Return to the checkout and use Check PayU status before trying again.",
        }[status];
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>MerchantLens payment</title><h1>${heading}</h1><p>${guidance}</p><p><a href="${phoneReturn ? "/phone" : "/customer?checkout=cake"}">Return to MerchantLens</a></p></html>`);
      } else {
        if (reportedStatus === "success" && status === "pending")
          fail(503, "Payment capture verification pending");
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("OK");
      }
    } catch (error) {
      res.writeHead(error.status || 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.status ? error.message : "Payment verification unavailable");
    }
  };
}
