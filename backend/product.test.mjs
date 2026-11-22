import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqliteStore } from "./product-store.mjs";
import { commerce, merchantId } from "./product.mjs";
import { randomUUID } from "node:crypto";

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
  const cake = await app.intent(buyer, { kind: "cake", method: "Pickup" });
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
