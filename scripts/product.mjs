import http from "node:http";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { productApi, passwordHash } from "../backend/product-http.mjs";
import { sqliteStore, dynamoStore } from "../backend/product-store.mjs";
import { merchantId } from "../backend/product.mjs";
const dir = resolve(process.env.MERCHANTLENS_DATA || ".demo-tools/product");
await mkdir(dir, { recursive: true, mode: 0o700 });
if (process.argv.includes("--setup")) {
  const accounts = [],
    lines = [];
  for (const [user, role] of [
    ["buyer", "customer"],
    ["second-buyer", "customer"],
    ["bakery", "merchant"],
    ["reviewer", "analyst"],
  ]) {
    const password = randomBytes(18).toString("base64url"),
      salt = randomBytes(16).toString("hex");
    accounts.push({
      user,
      role,
      merchant: merchantId,
      salt,
      hash: passwordHash(password, salt),
    });
    lines.push(role + "  " + user + "  " + password);
  }
  await writeFile(resolve(dir, "accounts.json"), JSON.stringify(accounts), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(resolve(dir, "initial-logins.txt"), lines.join("\n"), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    "Created workstation accounts. Store the initial-logins.txt handoff privately.",
  );
} else {
  const root = resolve(process.env.STALL_DIST || "frontend/dist");
  await access(resolve(root, "index.html"));
  const store = process.env.MERCHANTLENS_TABLE
    ? dynamoStore(process.env.MERCHANTLENS_TABLE)
    : sqliteStore(resolve(dir, "commerce.sqlite"));
  const api = productApi(
    store,
    JSON.parse(await readFile(resolve(dir, "accounts.json"), "utf8")),
  );
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
  };
  const server = http.createServer(async (req, res) => {
    if (!["127.0.0.1", "localhost"].includes(req.headers.host?.split(":")[0])) {
      res.writeHead(403);
      return res.end();
    }
    if (req.url.startsWith("/api/app/")) return api(req, res);
    if (req.url === "/") {
      res.writeHead(302, { Location: "/customer" });
      return res.end();
    }
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      const file = resolve(
        root,
        "." +
          (["/", "/customer", "/merchant", "/analyst"].includes(path)
            ? "/index.html"
            : decodeURIComponent(path)),
      );
      if (!file.startsWith(root + sep) || req.method !== "GET") throw Error();
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.listen(Number(process.env.PRODUCT_PORT || 4180), "127.0.0.1", () =>
    console.log(
      "MerchantLens " + store.mode + " ready on " + server.address().port,
    ),
  );
}
