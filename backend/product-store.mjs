import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Each aggregate contains one payment and its business records, events and case.
// A version-conditional commit makes the whole operation visible at once.
export function sqliteStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS payments (merchant TEXT, ref TEXT, version INTEGER, body TEXT, PRIMARY KEY(merchant,ref))",
  );
  const get = db.prepare(
    "SELECT body FROM payments WHERE merchant=? AND ref=?",
  );
  const list = db.prepare(
    "SELECT body FROM payments WHERE merchant=? ORDER BY rowid DESC",
  );
  const write = db.prepare(
    "INSERT INTO payments VALUES(?,?,?,?) ON CONFLICT(merchant,ref) DO UPDATE SET version=excluded.version, body=excluded.body WHERE payments.version=excluded.version-1",
  );
  return {
    mode: "SQLite",
    get: (m, r) => JSON.parse(get.get(m, r)?.body || "null"),
    list: (m) => list.all(m).map((r) => JSON.parse(r.body)),
    save: (r) =>
      write.run(r.merchant, r.ref, r.version, JSON.stringify(r)).changes === 1,
    close: () => db.close(),
  };
}
export function dynamoStore(table) {
  const require = createRequire(import.meta.url);
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const db = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION }),
  );
  const pk = (m) => "PRODUCT#" + m;
  return {
    mode: "AWS DynamoDB",
    async get(m, r) {
      return (
        (
          await db.send(
            new GetCommand({
              TableName: table,
              Key: { pk: pk(m), sk: r },
              ConsistentRead: true,
            }),
          )
        ).Item?.body || null
      );
    },
    async list(m) {
      const rows = [];
      let cursor;
      do {
        const page = await db.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "pk=:m",
            ExpressionAttributeValues: { ":m": pk(m) },
            ConsistentRead: true,
            ExclusiveStartKey: cursor,
          }),
        );
        rows.push(...page.Items.map((i) => i.body));
        cursor = page.LastEvaluatedKey;
      } while (cursor);
      return rows.sort((a, b) => b.created.localeCompare(a.created));
    },
    async save(r) {
      try {
        await db.send(
          new PutCommand({
            TableName: table,
            Item: {
              pk: pk(r.merchant),
              sk: r.ref,
              version: r.version,
              body: r,
            },
            ConditionExpression:
              r.version === 1 ? "attribute_not_exists(pk)" : "#v=:prior",
            ...(r.version === 1
              ? {}
              : {
                  ExpressionAttributeNames: { "#v": "version" },
                  ExpressionAttributeValues: { ":prior": r.version - 1 },
                }),
          }),
        );
        return true;
      } catch (e) {
        if (e.name === "ConditionalCheckFailedException") return false;
        throw e;
      }
    },
  };
}
