import assert from "node:assert/strict";
import { test } from "node:test";
import { commerce, merchantId } from "./product.mjs";
import { sqliteStore } from "./product-store.mjs";
import { configuredWhatsApp, dispatchWhatsApp } from "./whatsapp.mjs";

test("each payer has a separate graph and only a linked mismatch queues one alert", async (t) => {
  const store = sqliteStore(":memory:");
  t.after(() => store.close());
  const app = commerce(store, { sendWhatsApp: true });
  const buyer = { merchant: merchantId, role: "customer", user: "buyer" };
  const friend = { ...buyer, user: "second-buyer" };
  const analyst = { ...buyer, user: "reviewer", role: "analyst" };
  const cake = await app.intent(buyer, { kind: "cake" });
  const wallet = await app.intent(friend, { kind: "topup" });
  await app.pay(buyer, cake);
  await Promise.all([app.pay(friend, wallet), app.pay(friend, wallet)]);

  const { cases } = await app.read(analyst);
  const cakeCase = cases.find(({ id }) => id === cake.ref);
  const walletCase = cases.find(({ id }) => id === wallet.ref);
  assert.equal(cakeCase.payer, "User A");
  assert.equal(cakeCase.status, "Purpose unverified");
  assert.equal(cakeCase.notification, null);
  assert.equal(walletCase.payer, "User B");
  assert.equal(walletCase.status, "Purpose mismatch — review");
  assert.deepEqual(walletCase.edges.find(({ to }) => to === "payer").evidenceIds, [wallet.payment]);
  assert.equal(walletCase.notification.status, "queued");
  const report = walletCase.notification.report;
  assert.equal(report.paymentId, wallet.payment);
  assert.equal(report.evidenceId, walletCase.nodes.find(({ key }) => key === "credit").event.id);

  let sendAttempts = 0;
  let now = 1000;
  const send = async (payload) => {
    assert.deepEqual(payload, report);
    return ++sendAttempts === 1 ? { status: "retry" } : { status: "submitted", messageId: "test-id" };
  };
  const dispatch = () => dispatchWhatsApp(store, merchantId, send, () => now);
  await Promise.all([dispatch(), dispatch()]);
  assert.equal(sendAttempts, 1);
  assert.equal((await store.get(merchantId, wallet.ref)).whatsapp.status, "queued");
  now += 2000;
  await Promise.all([dispatch(), dispatch()]);
  await app.pay(friend, wallet);
  await dispatch();
  assert.equal(sendAttempts, 2);
  assert.equal((await store.get(merchantId, wallet.ref)).whatsapp.status, "submitted");
});

test("Meta receives a case report at the configured admin number, and an ambiguous timeout is not retried", async () => {
  const env = { MERCHANTLENS_WHATSAPP: "live", WHATSAPP_TOKEN: "test-token",
    WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_ADMIN: "+919999999999", WHATSAPP_GRAPH_VERSION: "v99.0" };
  const report = { caseId: "case-1", merchantId: merchantId, paymentId: "payment-1", evidenceId: "evidence-1", reason: "Linked wallet credit." };
  let request;
  const send = configuredWhatsApp(env, async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return Response.json({ messages: [{ id: "wamid.mock" }] });
  });
  assert.deepEqual(await send(report), { status: "submitted", messageId: "wamid.mock" });
  assert.equal(request.url, "https://graph.facebook.com/v99.0/12345/messages");
  assert.equal(request.body.to, "919999999999");
  assert.match(request.body.text.body, /Case case-1[\s\S]*Evidence evidence-1/);
  const sendTest = configuredWhatsApp({
    ...env, MERCHANTLENS_WHATSAPP: "test", WHATSAPP_TEMPLATE: "production_alert",
  }, async (_url, options) => {
    assert.equal(JSON.parse(options.body).type, "text");
    return Response.json({ messages: [{ id: "wamid.test" }] });
  });
  assert.deepEqual(await sendTest(report), { status: "submitted", messageId: "wamid.test" });
  assert.equal(configuredWhatsApp({}), null);
  const disconnected = configuredWhatsApp(env, async () => {
    throw new Error("fetch failed", { cause: { code: "ENETUNREACH" } });
  });
  assert.deepEqual(await disconnected(report), { status: "retry" });
  const timedOut = configuredWhatsApp(env, async () => { throw new DOMException("timeout", "TimeoutError"); });
  assert.deepEqual(await timedOut(report), { status: "unknown" });
});
