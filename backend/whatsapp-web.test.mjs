import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createWhatsAppWeb } from "./whatsapp-web.mjs";

test("WhatsApp Web waits for connection and a recipient, then sends one alert", async () => {
  class FakeClient extends EventEmitter {
    initialize() { return Promise.resolve(); }
    async getNumberId(number) { return { _serialized: number + "@c.us" }; }
    async sendMessage(target, text) { this.sent = { target, text }; return { id: { _serialized: "message-1" } }; }
  }
  const client = new FakeClient();
  let clock = 0;
  let sends = 0;
  const originalSend = client.sendMessage.bind(client);
  client.sendMessage = (...args) => { sends++; return originalSend(...args); };
  const connection = createWhatsAppWeb({ directory: ".", client, now: () => clock });
  const report = { caseId: "case-1", merchantId: "merchant-1", reason: "Wallet credit linked." };
  assert.deepEqual(await connection.send(report), { status: "retry" });
  client.emit("qr", "example");
  assert.match((await connection.status()).qr, /^data:image\/png;base64,/);
  assert.throws(() => connection.setRecipient("123"));
  connection.setRecipient("+91 98765 43210");
  client.emit("ready");
  assert.deepEqual(await connection.send(report), { status: "submitted", messageId: "message-1" });
  assert.equal(client.sent.target, "919876543210@c.us");
  assert.match(client.sent.text, /case-1/);
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
