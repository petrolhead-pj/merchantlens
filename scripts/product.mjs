import http from "node:http";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { productApi, passwordHash } from "../backend/product-http.mjs";
import { sqliteStore, dynamoStore } from "../backend/product-store.mjs";
import { commerce, merchantId } from "../backend/product.mjs";
import { configuredWhatsApp, dispatchWhatsApp } from "../backend/whatsapp.mjs";
import { configuredPayU, payuCallback } from "../backend/payu.mjs";
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
  const sendWhatsApp = configuredWhatsApp(process.env);
  const payu = configuredPayU(process.env);
  const port = Number(process.env.PRODUCT_PORT || 4180);
  const demoHost = process.env.PRODUCT_DEMO_HOST;
  const localAddresses = Object.values(networkInterfaces()).flat();
  if (demoHost && (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(demoHost) ||
      !localAddresses.some((address) => address.family === "IPv4" && address.address === demoHost))) {
    throw Error("PRODUCT_DEMO_HOST must be this laptop's private Wi-Fi or hotspot IPv4 address.");
  }
  const publicCheckout = process.env.PRODUCT_PUBLIC_ORIGIN
    ? new URL(process.env.PRODUCT_PUBLIC_ORIGIN)
    : null;
  if (publicCheckout && (publicCheckout.protocol !== "https:" || publicCheckout.href !== publicCheckout.origin + "/"))
    throw Error("PRODUCT_PUBLIC_ORIGIN must be an HTTPS origin.");
  if (payu && publicCheckout && payu.publicOrigin !== publicCheckout.origin)
    throw Error("PRODUCT_PUBLIC_ORIGIN must match PAYU_CALLBACK_ORIGIN when both are set.");
  const publicOrigin = payu?.publicOrigin || publicCheckout?.origin;
  const demoOrigin = publicOrigin || (demoHost ? `http://${demoHost}:${port}` : undefined);
  const root = resolve(process.env.STALL_DIST || "frontend/dist");
  await access(resolve(root, "index.html"));
  const store = process.env.MERCHANTLENS_TABLE
    ? dynamoStore(process.env.MERCHANTLENS_TABLE)
    : sqliteStore(resolve(dir, "commerce.sqlite"));
  const api = productApi(
    store,
    JSON.parse(await readFile(resolve(dir, "accounts.json"), "utf8")),
    { sendWhatsApp: Boolean(sendWhatsApp), demoOrigin, payu },
  );
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
  };
  async function serve(req, res, customerOrigin) {
    const allowedHosts = customerOrigin ? [new URL(customerOrigin).hostname] : ["127.0.0.1", "localhost"];
    if (!allowedHosts.includes(req.headers.host?.split(":")[0])) {
      res.writeHead(403);
      return res.end();
    }
    let path;
    try {
      path = new URL(req.url, "http://localhost").pathname;
    } catch {
      res.writeHead(400);
      return res.end("Invalid path");
    }
    if (customerOrigin && !(path === "/" || path === "/customer" || path === "/phone" || path === "/chocolate-cake.jpg" ||
      path.startsWith("/assets/") || path.startsWith("/api/app/customer/") || path.startsWith("/api/app/phone/"))) {
      res.writeHead(404);
      return res.end("Not found");
    }
    if (req.url.startsWith("/api/app/")) return api(req, res, customerOrigin);
    if (path === "/") {
      res.writeHead(302, { Location: "/customer" });
      return res.end();
    }
    try {
      const file = resolve(
        root,
        "." +
          (["/", "/customer", "/phone", "/merchant", "/analyst"].includes(path)
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
  }
  const server = http.createServer((req, res) => serve(req, res));
  server.listen(port, "127.0.0.1", () =>
    console.log(
      "MerchantLens " + store.mode + " ready on " + server.address().port,
    ),
  );
  if (demoHost) {
    const localOrigin = `http://${demoHost}:${port}`;
    http.createServer((req, res) => serve(req, res, localOrigin)).listen(port, demoHost, () =>
      console.log("Demo phones: " + localOrigin + "/customer"),
    );
  }
  if (publicOrigin) {
    const callback = payu && payuCallback(payu, commerce(store, { sendWhatsApp: Boolean(sendWhatsApp) }), merchantId, api.notify);
    const publicPort = Number(process.env.PRODUCT_PUBLIC_PORT || (payu && process.env.PAYU_PUBLIC_PORT) || 4185);
    http.createServer((req, res) => {
      if (callback && req.url.startsWith("/api/payu/")) return callback(req, res);
      return serve(req, res, publicOrigin);
    }).listen(publicPort, "127.0.0.1", () => console.log(`HTTPS checkout origin ready on loopback port ${publicPort}`));
  }
  if (sendWhatsApp) {
    let processing = false;
    let storageInterrupted = false;
    const timer = setInterval(async () => {
      if (processing) return;
      processing = true;
      try {
        await dispatchWhatsApp(store, merchantId, sendWhatsApp);
        storageInterrupted = false;
      } catch {
        if (!storageInterrupted) console.error("WhatsApp queue storage unavailable. The worker will retry.");
        storageInterrupted = true;
      } finally {
        processing = false;
      }
    }, 1000);
    server.once("close", () => clearInterval(timer));
  }
}
