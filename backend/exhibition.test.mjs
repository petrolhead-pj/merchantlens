import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { append, review } from "./exhibition.mjs";
test("early evidence, duplicate, late conflict, stale review and scoped match", () => {
  const base = {
    ref: randomUUID(),
    payment: randomUUID(),
    merchant: "SRB-2041",
    amount: 50000,
    currency: "INR",
    time: new Date().toISOString(),
  };
  const event = (kind) => ({ ...base, id: randomUUID(), kind });
  const pay = event("payment");
  let c = append(null, event("cake"));
  c = append(c, pay);
  assert.equal(append(c, pay), c);
  assert.equal(c.status, "Purpose unverified");
  for (const kind of ["order", "delivery"]) c = append(c, event(kind));
  assert.equal(c.status, "Cake sale supported");
  c = review(c, { version: c.version, action: "Record supported outcome" });
  const late = append(c, event("credit"));
  assert.equal(late.outcome, "Open");
  assert.equal(late.status, "Purpose mismatch — review");
  assert.equal(late.history.at(-2).text, "Record supported outcome");
  assert.throws(() => review(late, { version: c.version, action: "Escalate" }));
  assert.throws(() => append(c, { ...event("credit"), merchant: "other" }));
  assert.throws(() => append(c, { ...event("credit"), payment: randomUUID() }));
});
