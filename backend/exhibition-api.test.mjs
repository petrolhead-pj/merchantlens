import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "./server.mjs";

test("case API preserves scoped identity and decision history across out-of-order and concurrent deliveries", async (t) => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port + "/api/cases";
  const post = (route, body) =>
    fetch(base + "/" + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.status);
  const list = () => fetch(base).then((r) => r.json());
  const payment = {
    id: randomUUID(),
    ref: randomUUID(),
    payment: randomUUID(),
    merchant: "SRB-2041",
    amount: 50000,
    currency: "INR",
    time: new Date().toISOString(),
    kind: "payment",
  };
  const event = (kind) => ({ ...payment, id: randomUUID(), kind });
  for (const kind of ["delivery", "cake", "order"])
    assert.equal(await post("evidence", event(kind)), 200);
  assert.deepEqual(await list(), []);
  assert.deepEqual(
    await Promise.all([post("provider", payment), post("provider", payment)]),
    [200, 200],
  );
  const [supported] = await list();
  assert.equal(supported.version, 4);
  assert.equal(supported.status, "Cake sale supported");
  const alias = event("payment");
  assert.equal(await post("provider", alias), 200);
  for (const bad of [
    { ...alias, kind: "refund" },
    { ...payment, ref: randomUUID() },
    { ...payment, id: randomUUID(), ref: randomUUID() },
    { ...payment, merchant: "other" },
  ])
    assert.equal(await post("provider", bad), 409);
  assert.deepEqual(await list(), [supported]);
  const decision = {
    ref: payment.ref,
    version: supported.version,
    action: "Record supported outcome",
  };
  assert.equal(await post("review", decision), 200);
  const [prior] = await list();
  const credit = event("credit");
  assert.equal(await post("evidence", credit), 200);
  const [reopened] = await list();
  assert.equal(reopened.outcome, "Open");
  assert.equal(reopened.status, "Purpose mismatch — review");
  assert.deepEqual(reopened.history.slice(0, -1), prior.history);
  assert.equal(
    await post("review", { ...decision, version: prior.version }),
    409,
  );
  assert.equal(await post("evidence", credit), 200);
  assert.deepEqual(await list(), [reopened]);
});
