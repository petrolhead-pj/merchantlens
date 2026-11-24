import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { commerce, fail } from "./product.mjs";
import { reconcilePayU } from "./payu.mjs";
export function passwordHash(password, salt) {
  return scryptSync(password, salt, 32).toString("hex");
}
export function productApi(store, accounts, { demoOrigin, payu, ...options } = {}) {
  const service = commerce(store, options),
    sessions = new Map(),
    attempts = new Map(),
    streams = new Set();
  const phoneKey = randomBytes(32);
  const signPhone = (payload) => createHmac("sha256", phoneKey).update(payload).digest();
  const phoneLifetime = 10 * 60 * 1000;
  const analystDemoQr = Boolean(demoOrigin && !payu && store.mode === "SQLite");
  async function phoneLink(actor, { ref, kind, method, shareEvidence }, payuMode) {
    if (!ref) ({ ref } = await service.intent(actor, { kind, method }, payuMode));
    const checkout = await service.resumeCheckout(actor, { ref }, payuMode);
    if (checkout.confirmed) fail(409, "Payment already confirmed");
    const expiresAt = Date.now() + phoneLifetime;
    const payload = `${Buffer.from(actor.merchant).toString("base64url")}.${ref}.${expiresAt.toString(36)}`;
    const url = new URL("/phone", demoOrigin);
    const preference = shareEvidence === false ? "?share=0" : "";
    url.hash = `${payload}.${signPhone(payload).toString("base64url")}${preference}`;
    return { checkout, url: url.href, expiresAt };
  }
  async function phoneOperation(operation, body, publicOrigin) {
    if (!demoOrigin || publicOrigin !== demoOrigin || !["state", "confirm", "payu", "payu-status"].includes(operation))
      fail(404, "Phone checkout unavailable");
    const token = typeof body.token === "string" && body.token.length < 250 ? body.token : "";
    const [merchantCode, ref, expiration, signature, extra] = token.split(".");
    if (extra !== undefined || !/^[a-f0-9-]{36}$/.test(ref ?? "") || !/^[0-9a-z]+$/.test(expiration ?? "") ||
        !/^[A-Za-z0-9_-]{43}$/.test(signature ?? "") ||
        !timingSafeEqual(Buffer.from(signature, "base64url"), signPhone(`${merchantCode}.${ref}.${expiration}`))) {
      fail(403, "Invalid payment QR. Ask for a fresh code.");
    }
    if (Number.parseInt(expiration, 36) <= Date.now())
      fail(410, "This payment QR expired. Ask for a fresh code.");
    const merchant = Buffer.from(merchantCode, "base64url").toString();
    const row = await store.get(merchant, ref);
    if (!row) fail(404, "Checkout unavailable");
    const actor = { role: "customer", merchant, user: row.owner };
    const checkout = await service.resumeCheckout(actor, { ref }, payu?.mode);
    if (operation === "state") return checkout;
    if (operation === "confirm") {
      const result = await service.pay(actor, { ref, observation: body.observation });
      notify(merchant);
      return result;
    }
    if (!payu) fail(404, "PayU is unavailable for this checkout");
    if (operation === "payu") return service.preparePayU(actor, { ...body, ref }, payu, true);
    const pending = await service.customerPayUCheckout(actor, ref, payu.mode);
    return reconcilePayU(payu, service, pending, notify);
  }
  const notify = (merchant) => {
    for (const stream of streams) {
      if (stream.actor.merchant === merchant && stream.actor.until > Date.now())
        stream.res.write("event: changed\ndata: {}\n\n");
    }
  };
  const handle = async (req, res, publicOrigin) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    try {
      const [, api, app, role, operation] = req.url.split("/");
      const hostedPayU = role === "customer" && publicOrigin && publicOrigin === payu?.publicOrigin ? payu : null;
      if (
        !["customer", "merchant", "analyst", "phone"].includes(role) ||
        req.url !== "/api/app/" + role + "/" + operation
      )
        fail(404, "Unknown endpoint");
      const cookie = "ml_" + req.socket.localPort + "_" + role;
      const token =
        (req.headers.cookie || "")
          .split("; ")
          .find((c) => c.startsWith(cookie + "="))
          ?.slice(cookie.length + 1) || "";
      const digest = (t) => createHash("sha256").update(t).digest("hex");
      let body = {};
      if (req.method === "POST") {
        if (
          req.headers.origin &&
          req.headers.origin !== (publicOrigin || "http://" + req.headers.host)
        )
          fail(403, "Cross-origin operation denied");
        if (req.headers["content-type"] !== "application/json")
          fail(415, "Expected JSON");
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 8192) fail(413, "Request too large");
        }
        try {
          body = JSON.parse(raw);
        } catch {
          fail(400, "Invalid JSON");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          fail(400, "Expected an object");
      }
      if (role === "phone") {
        if (req.method !== "POST") fail(404, "Unknown endpoint");
        return res.end(JSON.stringify(await phoneOperation(operation, body, publicOrigin)));
      }
      if (operation === "login" && req.method === "POST") {
        const key = req.socket.remoteAddress + "|" + role;
        const failures = (attempts.get(key) || []).filter(
          (time) => Date.now() - time < 60000,
        );
        if (failures.length >= 12)
          fail(429, "Too many attempts. Try again in one minute.");
        const account = accounts.find(
          (a) => a.user === body.user && a.role === role,
        );
        const hash = passwordHash(
          String(body.password || ""),
          account?.salt || "invalid-login",
        );
        if (
          !account ||
          !timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(account.hash, "hex"),
          )
        ) {
          attempts.set(key, [...failures, Date.now()]);
          fail(401, "Invalid account or password");
        }
        attempts.delete(key);
        for (const [key, session] of sessions)
          if (session.until <= Date.now()) sessions.delete(key);
        const fresh = randomBytes(32).toString("hex");
        sessions.set(digest(fresh), {
          user: account.user,
          role,
          merchant: account.merchant,
          until: Date.now() + 8 * 3600000,
        });
        res.setHeader(
          "Set-Cookie",
          cookie +
            "=" +
            fresh +
            "; HttpOnly; SameSite=Strict; Path=/api/app/" +
            role +
            "; Max-Age=28800" + (publicOrigin?.startsWith("https://") ? "; Secure" : ""),
        );
        return res.end('{"signedIn":true}');
      }
      const actor = sessions.get(digest(token));
      if (!actor || actor.role !== role || actor.until < Date.now())
        fail(401, "Sign in to continue");
      if (operation === "logout" && req.method === "POST") {
        sessions.delete(digest(token));
        for (const stream of streams) {
          if (stream.actor === actor) stream.res.end();
        }
        return res.end("{}");
      }
      if (operation === "events" && req.method === "GET" && role !== "customer") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" });
        res.write(": connected\n\n");
        const stream = { actor, res };
        streams.add(stream);
        const heartbeat = setInterval(() => {
          if (actor.until <= Date.now()) res.end();
          else res.write(": heartbeat\n\n");
        }, 15000);
        res.on("close", () => { clearInterval(heartbeat); streams.delete(stream); });
        return;
      }
      if (operation === "state" && req.method === "GET")
        return res.end(
          JSON.stringify({
            user: actor.user,
            mode: store.mode,
            ...(role !== "merchant" && demoOrigin ? { demoOrigin } : {}),
            ...(role === "analyst" && analystDemoQr ? { analystDemoQr } : {}),
            ...(role === "customer" && demoOrigin && payu ? { demoPayUMode: payu.mode } : {}),
            ...(hostedPayU ? { payuMode: hostedPayU.mode } : {}),
            ...(await service.read(actor)),
          }),
        );
      const operations = {
        checkout: "intent",
        confirm: "pay",
        fulfil: "fulfil",
        review: "decide",
      };
      if (req.method === "POST" && operation === "phone-link" && role === "customer" && demoOrigin) {
        return res.end(JSON.stringify(await phoneLink(actor, body, payu?.mode)));
      }
      if (req.method === "POST" && operation === "demo-payment-qr" && role === "analyst" && analystDemoQr) {
        const user = body.kind === "cake" ? "buyer" : body.kind === "topup" ? "second-buyer" : null;
        if (!user) fail(400, "Choose the cake or wallet scenario");
        const customer = accounts.find((account) =>
          account.role === "customer" && account.merchant === actor.merchant && account.user === user);
        if (!customer) fail(404, "Demo customer account unavailable");
        return res.end(JSON.stringify(await phoneLink(customer, { kind: body.kind })));
      }
      if (req.method === "POST" && operation === "payu" && hostedPayU)
        return res.end(JSON.stringify(await service.preparePayU(actor, body, hostedPayU)));
      if (req.method === "POST" && operation === "resume-checkout")
        return res.end(JSON.stringify(await service.resumeCheckout(actor, body, hostedPayU?.mode)));
      if (req.method === "POST" && operation === "cancel-checkout")
        return res.end(JSON.stringify(await service.cancelCheckout(actor, body)));
      if (req.method === "POST" && operation === "payu-status" && hostedPayU) {
        const row = await service.customerPayUCheckout(actor, body.ref, hostedPayU.mode);
        return res.end(JSON.stringify(await reconcilePayU(hostedPayU, service, row, notify)));
      }
      if (req.method !== "POST" || !Object.hasOwn(operations, operation))
        fail(404, "Unknown operation");
      const result = await service[operations[operation]](actor, body, hostedPayU?.mode);
      if (operation !== "checkout") {
        notify(actor.merchant);
      }
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = e.status || 500;
      res.end(
        JSON.stringify({
          error: e.status
            ? e.message
            : "Operation unavailable. Retry with the same reference.",
        }),
      );
    }
  };
  return Object.assign(handle, { notify });
}
