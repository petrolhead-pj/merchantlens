import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

for (const [resource, name] of Object.entries({
  Intake: "intake",
  Worker: "worker",
  Cases: "cases",
  Reconciler: "reconcile",
})) {
  const root = resolve(process.argv[2] || ".aws-sam/build", resource);
  const handlers = await import(
    pathToFileURL(resolve(root, "cloud/handlers.mjs"))
  );
  assert.equal(typeof handlers[name], "function");
  const { append } = await import(
    pathToFileURL(resolve(root, "backend/exhibition.mjs"))
  );
  const payment = {
    ref: randomUUID(),
    id: randomUUID(),
    payment: randomUUID(),
    merchant: "SRB-2041",
    kind: "payment",
    amount: 50000,
    currency: "INR",
    time: new Date().toISOString(),
  };
  const pending = append(null, {
    ...payment,
    id: randomUUID(),
    kind: "credit",
  });
  assert.equal(append(pending, payment).status, "Purpose mismatch — review");
  if (name === "intake")
    assert.equal((await handlers.intake({ body: "{}" })).statusCode, 400);
  if (name === "worker") {
    // Exercise the packaged worker's retry loop without making AWS requests.
    const sdk = createRequire(resolve(root, "package.json"))(
      "@aws-sdk/lib-dynamodb",
    );
    const client = sdk.DynamoDBDocumentClient.prototype;
    const original = client.send;
    let commits = 0;
    client.send = async (command) => {
      if (command instanceof sdk.GetCommand) return {};
      assert.ok(command instanceof sdk.TransactWriteCommand);
      if (++commits === 1)
        throw Object.assign(Error("Concurrent update"), {
          name: "TransactionCanceledException",
        });
      assert.equal(command.input.TransactItems.at(-1).Put.Item.c.version, 1);
      return {};
    };
    try {
      const result = await handlers.worker({
        Records: [
          {
            messageId: "valid",
            body: JSON.stringify({ event: payment, received: payment.time }),
          },
          { messageId: "invalid", body: "{}" },
        ],
      });
      assert.deepEqual(result, {
        batchItemFailures: [{ itemIdentifier: "invalid" }],
      });
      assert.equal(commits, 2);
    } finally {
      client.send = original;
    }
  }
  console.log(resource, name, "loaded and exercised packaged case rules");
}
