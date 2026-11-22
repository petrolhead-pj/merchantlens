import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { commerce, fail } from "./product.mjs";
export function passwordHash(password, salt) {
  return scryptSync(password, salt, 32).toString("hex");
}
export function productApi(store, accounts) {
  const service = commerce(store),
    sessions = new Map(),
    attempts = new Map();
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    try {
      const [, api, app, role, operation] = req.url.split("/");
      if (
        !["customer", "merchant", "analyst"].includes(role) ||
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
          req.headers.origin !== "http://" + req.headers.host
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
            "; Max-Age=28800",
        );
        return res.end('{"signedIn":true}');
      }
      const actor = sessions.get(digest(token));
      if (!actor || actor.role !== role || actor.until < Date.now())
        fail(401, "Sign in to continue");
      if (operation === "logout" && req.method === "POST") {
        sessions.delete(digest(token));
        return res.end("{}");
      }
      if (operation === "state" && req.method === "GET")
        return res.end(
          JSON.stringify({
            user: actor.user,
            mode: store.mode,
            ...(await service.read(actor)),
          }),
        );
      const operations = {
        checkout: "intent",
        confirm: "pay",
        fulfil: "fulfil",
        review: "decide",
      };
      if (req.method !== "POST" || !Object.hasOwn(operations, operation))
        fail(404, "Unknown operation");
      res.end(
        JSON.stringify(await service[operations[operation]](actor, body)),
      );
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
}
