import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqliteStore } from "./product-store.mjs";
import { commerce, merchantId } from "./product.mjs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { passwordHash, productApi } from "./product-http.mjs";

test("a payment QR grants access to one checkout without opening the customer account", async (t) => {
  const store = sqliteStore(":memory:");
  const account = { merchant: merchantId, role: "customer", user: "buyer", salt: "buyer",
    hash: passwordHash("test-password", "buyer") };
  const demoOrigin = "http://checkout.example.test";
  const api = productApi(store, [account], { demoOrigin });
  const server = createServer((req, res) => api(req, res, demoOrigin));
  t.after(() => { server.closeAllConnections(); server.close(); store.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/app/`;
  const post = (route, body, cookie = "") => fetch(base + route, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: demoOrigin, Cookie: cookie },
    body: JSON.stringify(body),
  });
  assert.equal((await post("customer/phone-link", { kind: "cake" })).status, 401);
  const login = await post("customer/login", { user: "buyer", password: "test-password" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const { url, checkout, expiresAt } = await (await post("customer/phone-link", { kind: "topup" }, cookie)).json();
  const token = new URL(url).hash.slice(1);
  const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1);
  const other = await (await post("customer/checkout", { kind: "topup" }, cookie)).json();
  assert.ok(expiresAt > Date.now());
  assert.equal((await post("phone/state", { token: tampered })).status, 403);
  assert.equal((await post("phone/fulfil", { token })).status, 404);
  const accountState = await fetch(base + "customer/state");
  assert.equal(accountState.status, 401);
  const phoneState = await (await post("phone/state", { token })).json();
  assert.deepEqual(phoneState, checkout);
  for (let count = 0; count < 2; count++)
    assert.equal((await post("phone/confirm", { token, ref: other.ref })).status, 200);
  assert.equal((await store.get(merchantId, checkout.ref)).ledger.payment, checkout.payment);
  assert.equal((await store.get(merchantId, other.ref)).confirmed, undefined);
});

test("a confirmed customer payment immediately notifies the authenticated analyst feed", async (t) => {
  const store = sqliteStore(":memory:");
  const accounts = [["customer", "buyer"], ["analyst", "reviewer"]].map(([role, user]) => ({
    role, user, merchant: merchantId, salt: user, hash: passwordHash("test-password", user),
  }));
  const server = createServer(productApi(store, accounts));
  const cancel = new AbortController();
  t.after(() => { cancel.abort(); server.closeAllConnections(); server.close(); store.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/app/`;
  const post = (route, body, cookie = "") => fetch(base + route, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body),
  });
  const login = async (role, user) => {
    const response = await post(`${role}/login`, { user, password: "test-password" });
    return response.headers.get("set-cookie").split(";")[0];
  };
  const analyst = await login("analyst", "reviewer");
  const buyer = await login("customer", "buyer");
  assert.equal((await fetch(base + "analyst/events")).status, 401);
  assert.equal((await fetch(base + "customer/events", { headers: { Cookie: buyer } })).status, 404);
  const stream = await fetch(base + "analyst/events", {
    headers: { Cookie: analyst }, signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(5000)]),
  });
  assert.match(stream.headers.get("content-type"), /text\/event-stream/);
  const reader = stream.body.getReader();
  assert.match(Buffer.from((await reader.read()).value).toString(), /connected/);
  const intent = await (await post("customer/checkout", { kind: "cake" }, buyer)).json();
  const cases = async () => (await (await fetch(base + "analyst/state", { headers: { Cookie: analyst } })).json()).cases;
  assert.deepEqual(await cases(), []);
  assert.equal((await post("customer/confirm", intent, buyer)).status, 200);
  let event = "";
  while (!event.endsWith("\n\n")) {
    const chunk = await reader.read();
    assert.equal(chunk.done, false);
    event += Buffer.from(chunk.value);
  }
  assert.match(event, /^event: changed/);
  assert.equal((await cases())[0].id, intent.ref);
});

test("committed orders, credits, findings and decisions survive restart, retries and role boundaries", async () => {
  const path = join(
    mkdtempSync(join(tmpdir(), "ml-commerce-")),
    "store.sqlite",
  );
  let store = sqliteStore(path),
    app = commerce(store);
  const actor = (role, user) => ({ role, user, merchant: merchantId });
  const buyer = actor("customer", "buyer"),
    other = actor("customer", "other"),
    merchant = actor("merchant", "bakery"),
    analyst = actor("analyst", "reviewer");
  const abandoned = await app.intent(buyer, { kind: "topup" });
  await assert.rejects(app.cancelCheckout(other, abandoned), { status: 404 });
  await app.cancelCheckout(buyer, abandoned);
  await assert.rejects(app.resumeCheckout(buyer, abandoned), { status: 410 });
  await assert.rejects(app.pay(buyer, abandoned), { status: 410 });
  const cake = await app.intent(buyer, { kind: "cake", method: "Pickup" });
  assert.deepEqual(await app.resumeCheckout(buyer, cake), { ...cake, kind: "cake", method: "Pickup", confirmed: false });
  await assert.rejects(app.resumeCheckout(other, cake), { status: 404 });
  await assert.rejects(app.resumeCheckout(buyer, cake, "live"), { status: 409 });
  const observation = {
    ...cake,
    id: randomUUID(),
    time: new Date().toISOString(),
    merchant: merchantId,
    amount: 50000,
    currency: "INR",
    kind: "cake",
    label: "Buy chocolate cake · ₹500",
  };
  await assert.rejects(app.pay(other, cake), { status: 404 });
  await app.pay(buyer, { ...cake, observation });
  assert.equal((await app.resumeCheckout(buyer, cake)).confirmed, true);
  for (const stage of ["Accepted", "Preparing", "Ready", "Delivered"]) {
    await assert.rejects(app.fulfil(buyer, { ...cake, stage }), {
      status: 403,
    });
    await app.fulfil(merchant, { ...cake, stage });
    if (stage === "Ready")
      assert.match((await app.read(analyst)).cases[0].why, /ready for pickup/);
  }
  const supported = (await app.read(analyst)).cases[0];
  assert.equal(supported.status, "Cake sale supported");
  assert.match(supported.why, /collection/);
  await app.decide(analyst, {
    ...cake,
    version: supported.version,
    action: "Record supported outcome",
  });
  const prior = (await app.read(analyst)).cases[0];
  await Promise.all(
    Array.from({ length: 5 }, () => app.fixtureCredit(merchantId, cake.ref)),
  );
  const reopened = (await app.read(analyst)).cases[0];
  assert.equal(reopened.outcome, "Open");
  assert.equal(reopened.status, "Purpose mismatch — review");
  assert.deepEqual(reopened.history.slice(0, -1), prior.history);
  await assert.rejects(
    app.decide(analyst, {
      ...cake,
      version: prior.version,
      action: "Escalate",
    }),
    { status: 409 },
  );
  const wallet = await app.intent(buyer, { kind: "topup" });
  await Promise.all(Array.from({ length: 8 }, () => app.pay(buyer, wallet)));
  const missing = await app.intent(buyer, { kind: "cake" });
  await app.pay(buyer, missing);
  const unmatched = await app.intent(buyer, { kind: "cake" });
  await app.pay(buyer, {
    ...unmatched,
    observation: { ...observation, id: randomUUID() },
  });
  const unlinked = (await app.read(analyst)).cases.find(
    (c) => c.id === unmatched.ref,
  );
  assert.ok(unlinked.unresolved);
  assert.equal(unlinked.status, "Purpose unverified");
  assert.ok(!unlinked.nodes.some((n) => n.key === "cake"));
  const before = await app.read(buyer),
    cases = await app.read(analyst);
  assert.equal(before.balance, 100000);
  assert.equal(before.ledger.length, 2);
  assert.equal(
    cases.cases.find((c) => c.id === missing.ref).status,
    "Purpose unverified",
  );
  assert.equal((await app.read(other)).orders.length, 0);
  assert.equal(
    (await app.read({ ...analyst, merchant: "another-merchant" })).cases.length,
    0,
  );
  store.close();
  store = sqliteStore(path);
  app = commerce(store);
  assert.deepEqual(await app.read(buyer), before);
  assert.deepEqual(await app.read(analyst), cases);
  store.close();
});

test("failure before or after the atomic save cannot orphan or duplicate wallet evidence", async () => {
  const db = sqliteStore(join(mkdtempSync(join(tmpdir(), "ml-atomic-")), "db"));
  const actor = { role: "customer", user: "alice", merchant: merchantId };
  const app = commerce(db);
  const intent = await app.intent(actor, { kind: "topup" });
  const failing = commerce({
    ...db,
    save() {
      throw Error("write unavailable");
    },
  });
  await assert.rejects(failing.pay(actor, intent), /write unavailable/);
  assert.equal((await app.read(actor)).balance, 0);
  assert.equal((await db.get(merchantId, intent.ref)).case, undefined);
  const ambiguous = commerce({
    ...db,
    save(row) {
      db.save(row);
      throw Error("ack lost");
    },
  });
  await assert.rejects(ambiguous.pay(actor, intent), /ack lost/);
  await app.pay(actor, intent);
  const row = await db.get(merchantId, intent.ref);
  assert.equal((await app.read(actor)).balance, 50000);
  assert.deepEqual(
    row.case.records
      .filter((r) => r.event.kind === "credit")
      .map((r) => r.event.id),
    [row.ledger.id],
  );
  db.close();
});
