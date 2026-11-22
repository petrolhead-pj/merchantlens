import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { createServer } from "./server.mjs";

test("sandbox reports a betting mismatch only after PayU verification", async t => {
  const key = "test-key", salt = "test-salt";
  let status = "Not Found";
  let checks = 0;
  let txnid, ref;
  const server = createServer({ payuOptions: {
    key, salt, pollMs: 60_000,
    fetcher: async (url, { body }) => {
      checks += 1;
      assert.equal(new URL(url).hostname, "test.payu.in");
      assert.equal(body.get("var1"), txnid);
      assert.equal(body.get("hash"), createHash("sha512").update([key, "verify_payment", txnid, salt].join("|")).digest("hex"));
      return Response.json({ transaction_details: { [txnid]: {
        txnid, status, unmappedstatus: "captured", transaction_amount: "500.00",
        mihpayid: "123456789", udf1: ref,
      } } });
    },
  } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(origin + "/api/payu-sandbox/start", { method: "POST" });
  assert.equal(start.status, 200);
  const form = await start.text();
  assert.match(form, /action="https:\/\/test\.payu\.in\/_payment"/);
  assert.ok(!form.includes(salt));
  txnid = form.match(/name="txnid" value="([a-f0-9]{24})"/)[1];
  ref = form.match(/name="udf1" value="([a-f0-9-]+)"/)[1];
  const readCases = async () => (await fetch(origin + "/api/cases")).json();
  const callback = () => fetch(origin + "/api/payu-sandbox/return", {
    method: "POST", redirect: "manual", body: new URLSearchParams({ txnid, status: "success" }),
  });
  const unverified = await callback();
  assert.equal(unverified.status, 303);
  assert.deepEqual(await readCases(), []);
  const synthetic = await fetch(origin + "/api/cases/provider", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, id: randomUUID(), payment: randomUUID(), kind: "payment",
      merchant: "SRB-2041", amount: 50000, currency: "INR", time: new Date().toISOString() }),
  });
  assert.equal(synthetic.status, 409);
  status = "success";
  assert.equal((await callback()).headers.get("location"), "/exhibition?payu=1&case=" + ref);
  await callback();
  const [entry, extra] = await readCases();
  assert.equal(extra, undefined);
  assert.equal(entry.status, "Purpose mismatch — review");
  assert.deepEqual(entry.records.map(item => item.source), ["Test betting page", "PayU sandbox verification"]);
  assert.deepEqual(entry.sandbox, { txnid, providerId: "123456789" });
  assert.equal(checks, 2);
});
