import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createWhatsAppWeb } from "./whatsapp-web.mjs";

test("WhatsApp Web waits for connection and a recipient, then sends one alert", async () => {
  class FakeClient extends EventEmitter {
    initialize() { return Promise.resolve(); }
    async getNumberId(number) { this.lookedUp = number; return { _serialized: "123456789@lid" }; }
    async sendMessage(target, text) { this.sent = { target, text }; return { id: { _serialized: "message-1" } }; }
  }
  const client = new FakeClient();
  let clock = 0;
  let sends = 0;
  const originalSend = client.sendMessage.bind(client);
  client.sendMessage = (...args) => { sends++; return originalSend(...args); };
  const connection = createWhatsAppWeb({ directory: ".", client, now: () => clock });
  const report = { caseId: "case-1", merchantId: "SRB-2041", amount: 37525, evidenceKind: "credit", reason: "A wallet top-up conflicts with the declared bakery business." };
  assert.deepEqual(await connection.send(report), { status: "retry" });
  client.emit("qr", "example");
  assert.match((await connection.status()).qr, /^data:image\/png;base64,/);
  assert.throws(() => connection.setRecipient("123"));
  connection.setRecipient("+91 98765 43210");
  client.emit("ready");
  assert.deepEqual(await connection.send(report), { status: "submitted", messageId: "message-1" });
  assert.equal(client.lookedUp, "919876543210");
  assert.equal(client.sent.target, "123456789@lid");
  assert.match(client.sent.text, /₹375.25\* to Sunrise Bakery/);
  assert.match(client.sent.text, /Why it was flagged[\s\S]*conflicts with the declared bakery business/);
  assert.match(client.sent.text, /Wallet credit matched the payment ID/);
  assert.match(client.sent.text, /Case: case-1/);
  assert.throws(() => connection.setRecipient("+919999999999"), /locked/);
  assert.deepEqual(await connection.send(report), { status: "submitted", messageId: "message-1" });
  assert.deepEqual(await connection.send({ ...report, caseId: "case-2" }), { status: "retry" });
  for (let i = 2; i <= 5; i++) {
    clock += 15000;
    assert.equal((await connection.send({ ...report, caseId: "case-" + i })).status, "submitted");
  }
  clock += 15000;
  assert.equal((await connection.send({ ...report, caseId: "case-6" })).status, "rejected");
  assert.equal(sends, 5);
  client.emit("disconnected");
  assert.deepEqual(await connection.send(report), { status: "retry" });
});
