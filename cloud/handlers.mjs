import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { append, review, validate } from "../backend/exhibition.mjs";
import { isDeepStrictEqual } from "node:util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const artifacts = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  queue = new SQSClient({});
const TableName = process.env.TABLE,
  Key = (ref) => ({ pk: "DEMO", sk: ref });
const read = async (key) =>
  (await db.send(new GetCommand({ TableName, Key: key, ConsistentRead: true })))
    .Item;
const response = (statusCode, data) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(data),
});
export async function intake(request) {
  let event;
  try {
    if (request.isBase64Encoded || Buffer.byteLength(request.body || "") > 8192)
      throw Error();
    event = JSON.parse(request.body);
    validate(event);
    if (
      request.rawPath.endsWith("/provider") !==
      ["payment", "refund"].includes(event.kind)
    )
      throw Error();
  } catch {
    return response(400, { error: "Invalid source event" });
  }
  await queue.send(
    new SendMessageCommand({
      QueueUrl: process.env.QUEUE,
      MessageBody: JSON.stringify({
        event,
        received: new Date().toISOString(),
      }),
    }),
  );
  return response(202, { accepted: true });
}
function casePut(c, old) {
  const pending = c.nodes.some((n) => n.key === "payment")
    ? {}
    : { pending: "OPEN", firstReceipt: c.records[0].received };
  return {
    Put: {
      TableName,
      Item: { ...Key(c.id), c, version: c.version, ...pending },
      ConditionExpression: old ? "#v = :v" : "attribute_not_exists(pk)",
      ...(old
        ? {
            ExpressionAttributeNames: { "#v": "version" },
            ExpressionAttributeValues: { ":v": old.version },
          }
        : {}),
    },
  };
}
async function processRecord({ event: e, received }) {
  validate(e);
  const key = {
    pk:
      "EVENT#" +
      ({
        cake: "browser",
        topup: "browser",
        payment: "provider",
        refund: "provider",
      }[e.kind] || e.kind),
    sk: e.id,
  };
  const existing = await read(key);
  if (existing) {
    if (!isDeepStrictEqual(existing.event, e))
      throw Error("Conflicting identity");
    return;
  }
  const old = (await read(Key(e.ref)))?.c,
    c = append(old, e, received);
  const writes = [
    {
      Put: {
        TableName,
        Item: { ...key, event: e },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    },
    {
      Update: {
        TableName,
        Key: { pk: "PAYMENT", sk: e.payment },
        UpdateExpression: "SET checkoutRef = :ref",
        ConditionExpression:
          "attribute_not_exists(checkoutRef) OR checkoutRef = :ref",
        ExpressionAttributeValues: { ":ref": e.ref },
      },
    },
  ];
  if (c !== old) writes.push(casePut(c, old));
  await db.send(new TransactWriteCommand({ TransactItems: writes }));
}
export async function worker(batch) {
  const batchItemFailures = [];
  const start = Date.now();
  for (const r of batch.Records)
    try {
      const envelope = JSON.parse(r.body);
      // Two feeds can update one case in the same polling interval. Reread
      // the case and recompute the verdict before waiting for SQS redelivery.
      for (let attempt = 0; ; attempt++) {
        try {
          await processRecord(envelope);
          break;
        } catch (error) {
          if (
            attempt >= 2 ||
            ![
              "TransactionCanceledException",
              "TransactionConflictException",
            ].includes(error.name)
          )
            throw error;
          await delay(25 * (attempt + 1) + Math.random() * 25);
        }
      }
    } catch {
      batchItemFailures.push({ itemIdentifier: r.messageId });
    }
  metric("BatchMilliseconds", Date.now() - start, "Milliseconds");
  metric("FailedRecords", batchItemFailures.length, "Count");
  return { batchItemFailures };
}
function metric(name, value, unit) {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MerchantLens/Exhibition",
            Dimensions: [[]],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      [name]: value,
    }),
  );
}
export async function reconcile() {
  // A confirmation and its early evidence share a transactionally versioned case.
  // Pending entries leave the sparse index automatically when confirmation arrives.
  const page = await db.send(
    new QueryCommand({
      TableName,
      IndexName: "PendingAge",
      KeyConditionExpression: "#pending = :p",
      ExpressionAttributeNames: { "#pending": "pending" },
      ExpressionAttributeValues: { ":p": "OPEN" },
      Limit: 1,
    }),
  );
  const first = page.Items[0]?.firstReceipt;
  metric(
    "OldestPendingSeconds",
    first ? Math.max(0, (Date.now() - Date.parse(first)) / 1000) : 0,
    "Seconds",
  );
}
export async function cases(request) {
  if (request.requestContext.http.method === "GET") {
    const cursor = request.queryStringParameters?.after;
    const page = await db.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: "pk = :p",
        ExpressionAttributeValues: { ":p": "DEMO" },
        Limit: 25,
        ...(cursor ? { ExclusiveStartKey: Key(cursor) } : {}),
      }),
    );
    const result = response(
      200,
      page.Items.map((i) => i.c).filter((c) =>
        c.records.some((r) => r.event.kind === "payment"),
      ),
    );
    if (page.LastEvaluatedKey)
      result.headers["x-next-case"] = page.LastEvaluatedKey.sk;
    return result;
  }
  try {
    const e = JSON.parse(request.body),
      old = (await read(Key(e.ref)))?.c,
      c = review(old, e);
    const artifactId = "exports/" + e.ref + "/" + randomUUID() + ".json";
    await artifacts.send(
      new PutObjectCommand({
        Bucket: process.env.ARTIFACTS,
        Key: artifactId,
        ContentType: "application/json",
        Body: JSON.stringify(c),
      }),
    );
    c.history.at(-1).artifactId = artifactId;
    await db.send(
      new TransactWriteCommand({ TransactItems: [casePut(c, old)] }),
    );
    return response(200, { accepted: true });
  } catch {
    return response(409, { error: "Review rejected. Refresh case version." });
  }
}
