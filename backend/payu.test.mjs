import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { configuredPayU, payuCallback } from "./payu.mjs";
import { commerce, merchantId } from "./product.mjs";
import { passwordHash, productApi } from "./product-http.mjs";
import { sqliteStore } from "./product-store.mjs";

const hash = (value) => createHash("sha512").update(value).digest("hex");
const env = { PAYU_MODE: "sandbox", PAYU_MERCHANT_KEY: "merchant-key", PAYU_MERCHANT_SALT: "merchant-salt",
  PAYU_CALLBACK_ORIGIN: "https://checkout.example.com" };

test("the production checkout issues a hosted form on the configured HTTPS customer origin", async (t) => {
  const store = sqliteStore(":memory:");
  let verifyStatus = "pending";
  const payu = configuredPayU({ ...env, PAYU_MODE: "live" }, async (url, options) => {
    assert.equal(url, "https://info.payu.in/merchant/postservice.php?form=2");
    const txnid = options.body.get("var1");
    return Response.json({ transaction_details: { [txnid]: {
      txnid, transaction_amount: "500.00", status: { captured: "success", failed: "failure", pending: "pending" }[verifyStatus],
      unmappedstatus: verifyStatus, mihpayid: "123456789123456789",
    } } });
  });
  const account = { merchant: merchantId, user: "buyer", role: "customer", salt: "test-salt",
    hash: passwordHash("test-password", "test-salt") };
  const api = productApi(store, [account, { ...account, user: "second-buyer" }], { payu, demoOrigin: payu.publicOrigin });
  const server = createServer((req, res) => api(req, res, payu.publicOrigin));
  t.after(() => { server.closeAllConnections(); server.close(); store.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/app/customer/`;
  const post = (route, body, cookie = "") => fetch(base + route, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: payu.publicOrigin, Cookie: cookie },
    body: JSON.stringify(body),
  });
  const login = await post("login", { user: "buyer", password: "test-password" });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /; Secure$/);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const intent = await (await post("checkout", { kind: "cake" }, cookie)).json();
  assert.equal(intent.payuMode, "live");
  const checkout = await post("payu", { ref: intent.ref, firstname: "Test", email: "test@example.com", phone: "9876543210" }, cookie);
  assert.equal(checkout.status, 200);
  const { url, fields } = await checkout.json();
  assert.equal(url, "https://secure.payu.in/_payment");
  assert.equal(fields.surl, payu.publicOrigin + "/api/payu/return");
  assert.equal(fields.amount, "500.00");
  assert.equal(JSON.stringify(fields).includes(env.PAYU_MERCHANT_SALT), false);
  const phoneLink = await (await post("phone-link", { ref: intent.ref }, cookie)).json();
  const token = new URL(phoneLink.url).hash.slice(1);
  const phoneForm = await fetch(base.replace("/customer/", "/phone/") + "payu", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: payu.publicOrigin },
    body: JSON.stringify({ token, firstname: "Test", email: "test@example.com", phone: "9876543210" }),
  });
  assert.equal(phoneForm.status, 200);
  const phoneDetails = await phoneForm.json();
  assert.equal(phoneDetails.fields.surl, payu.publicOrigin + "/api/payu/return?phone=1");
  assert.equal(phoneDetails.fields.txnid, fields.txnid);
  assert.equal((await post("confirm", { ref: intent.ref }, cookie)).status, 409);
  const other = await post("login", { user: "second-buyer", password: "test-password" });
  const otherCookie = other.headers.get("set-cookie").split(";")[0];
  assert.equal((await post("payu-status", { ref: intent.ref }, otherCookie)).status, 404);
  const check = async () => (await post("payu-status", { ref: intent.ref }, cookie)).json();
  assert.deepEqual(await check(), { status: "pending" });
  assert.equal((await store.get(merchantId, intent.ref)).confirmed, undefined);
  verifyStatus = "failed";
  assert.deepEqual(await check(), { status: "failed" });
  assert.equal((await store.get(merchantId, intent.ref)).confirmed, undefined);
  verifyStatus = "captured";
  assert.deepEqual(await check(), { status: "captured" });
  assert.equal((await store.get(merchantId, intent.ref)).gateway.providerPaymentId, "123456789123456789");
  assert.deepEqual(await check(), { status: "captured" });
});

test("signed PayU checkout updates the graph only after provider capture", async (t) => {
  const store = sqliteStore(":memory:");
  const app = commerce(store);
  const customer = { merchant: merchantId, user: "buyer", role: "customer" };
  const analyst = { ...customer, role: "analyst" };
  let capture = false;
  let charged = "500.00";
  let verifies = 0;
  const payu = configuredPayU(env, async (url, options) => {
    verifies++;
    assert.equal(url, "https://test.payu.in/merchant/postservice.php?form=2");
    const txnid = options.body.get("var1");
    assert.equal(options.body.get("hash"), hash(`${env.PAYU_MERCHANT_KEY}|verify_payment|${txnid}|${env.PAYU_MERCHANT_SALT}`));
    return Response.json({ transaction_details: { [txnid]: {
      txnid, transaction_amount: charged, status: capture ? "success" : "pending",
      unmappedstatus: capture ? "captured" : "pending", mihpayid: "123456789123456789",
    } } });
  });
  let changes = 0;
  const server = createServer(payuCallback(payu, app, merchantId, () => changes++));
  t.after(() => { server.closeAllConnections(); server.close(); store.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const cake = await app.intent(customer, { kind: "cake" }, payu.mode);
  const wallet = await app.intent(customer, { kind: "topup" }, payu.mode);
  const contact = { firstname: "Test", email: "test@example.com", phone: "9876543210" };
  await assert.rejects(app.pay(customer, cake), { status: 409 });
  await assert.rejects(app.preparePayU(customer, { ...contact, ref: wallet.ref }, payu), { status: 409 });
  const checkout = await app.preparePayU(customer, { ...contact, ref: cake.ref }, payu);
  const { key, txnid, amount, productinfo, firstname, email } = checkout.fields;
  assert.equal(checkout.url, "https://test.payu.in/_payment");
  assert.equal(checkout.fields.hash, hash(`${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${env.PAYU_MERCHANT_SALT}`));
  assert.deepEqual((await app.read(analyst)).cases, []);
  const fields = { key, txnid, amount, productinfo, firstname, email, status: "success", mihpayid: "111" };
  const signed = hash(`${env.PAYU_MERCHANT_SALT}|success|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`);
  const post = (signature = signed, additional = {}, route = "webhook") => fetch(`http://127.0.0.1:${server.address().port}/api/payu/${route}`, {
    method: "POST", body: new URLSearchParams({ ...fields, ...additional, hash: signature }),
  });
  assert.equal((await post("0".repeat(128))).status, 400);
  assert.equal(verifies, 0);
  assert.equal((await post()).status, 503);
  assert.deepEqual((await app.read(analyst)).cases, []);
  const pendingReturn = await post(signed, {}, "return");
  assert.equal(pendingReturn.status, 200);
  assert.match(await pendingReturn.text(), /Check PayU status/);
  assert.match(await (await post(signed, {}, "return?phone=1")).text(), /href="\/phone"/);
  capture = true;
  charged = "20.00";
  assert.equal((await post()).status, 502);
  assert.deepEqual((await app.read(analyst)).cases, []);
  charged = "500.00";
  const splitInfo = '{"splitStatus":"","splitSegments":[]}';
  const splitSignature = hash(`${env.PAYU_MERCHANT_SALT}|success|${splitInfo}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`);
  assert.equal((await post(splitSignature, { splitInfo })).status, 200);
  assert.equal((await post()).status, 200);
  const [entry] = (await app.read(analyst)).cases;
  assert.equal(entry.id, cake.ref);
  assert.equal(entry.provider.paymentId, "123456789123456789");
  assert.equal(entry.provider.transactionId, txnid);
  assert.equal(entry.records[0].source, "Verified PayU sandbox payment");
  assert.equal(changes, 1);
  assert.equal((await app.read(customer)).orders.length, 1);
  await app.pay(customer, wallet);
  assert.equal((await app.read(analyst)).cases.find((row) => row.id === wallet.ref).provider, undefined);
});
