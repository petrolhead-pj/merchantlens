// Controlled integration rehearsal. Its only fault is a committed wallet posting
// against the same paid cake checkout. There is no public fault-injection API.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { commerce, merchantId } from "../backend/product.mjs";
import { sqliteStore, dynamoStore } from "../backend/product-store.mjs";
const { chromium } = createRequire(
  new URL("../.demo-tools/package.json", import.meta.url),
)("playwright-core");
const dir = resolve(process.env.MERCHANTLENS_DATA || ".demo-tools/product");
const port = process.env.VERIFY_PORT || 4190,
  base = "http://127.0.0.1:" + port;
const passwords = new Map(
  (await readFile(resolve(dir, "initial-logins.txt"), "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(/\s+/).slice(1)),
);
const start = async () => {
  const p = spawn(process.execPath, ["scripts/product.mjs"], {
    env: { ...process.env, PRODUCT_PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await Promise.race([
    once(p.stdout, "data"),
    once(p, "exit").then(() => {
      throw Error("Server failed to start");
    }),
  ]);
  return p;
};
const stop = async (p) => {
  const ended = once(p, "exit");
  p.kill();
  await ended;
};
let server = await start(),
  browser,
  store;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const login = async (page, role, user) => {
    await page.goto(base + "/" + role);
    await page.getByLabel("Account", { exact: true }).fill(user);
    await page.getByLabel("Password").fill(passwords.get(user));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Sign out" }).waitFor();
  };
  const page = async (r, u) => {
    const p = await browser.newPage();
    await login(p, r, u);
    return p;
  };
  const buyer = await page("customer", "buyer"),
    ops = await page("merchant", "bakery"),
    analyst = await page("analyst", "reviewer"),
    second = await page("customer", "second-buyer");
  const state = async (p, r) =>
    (await p.request.get(base + "/api/app/" + r + "/state")).json();
  const post = (p, role, op, data) =>
    p.request.post(base + "/api/app/" + role + "/" + op, { data });
  const pay = async (kind, observe = true) => {
    await buyer
      .getByRole("button", {
        name: kind === "cake" ? "Bakery" : "Wallet",
        exact: true,
      })
      .click();
    await buyer.getByRole("checkbox").setChecked(observe);
    await buyer.getByRole("button", { name: "Continue to checkout" }).click();
    const button = buyer.locator("button[data-ref]");
    await button.waitFor();
    const ref = await button.getAttribute("data-ref");
    await button.click();
    await buyer.getByText("Payment confirmed", { exact: true }).waitFor();
    return ref;
  };
  const before = await state(buyer, "customer"),
    cake = await pay("cake");
  const order = (await state(buyer, "customer")).orders.find(
    (o) => o.ref === cake,
  );
  const row = ops.locator("article").filter({ hasText: order.payment });
  for (const label of [
    "Accept order",
    "Start preparing",
    "Ready for dispatch",
    "Mark delivered",
  ])
    await row.getByRole("button", { name: label }).click();
  const select = async (ref, status) => {
    await analyst.locator('[data-case-id="' + ref + '"]').click();
    const finding = analyst.locator(
      'aside[data-case="' + ref + '"] .finding h2',
    );
    await finding.filter({ hasText: status }).waitFor();
  };
  await select(cake, "Cake sale supported");
  await analyst
    .getByRole("button", { name: "Record supported outcome" })
    .click();
  await analyst
    .locator("aside strong")
    .filter({ hasText: "Record supported outcome" })
    .waitFor();
  const saved = (await state(analyst, "analyst")).cases.find(
    (c) => c.id === cake,
  );
  const wallet = await pay("topup");
  await select(wallet, "Purpose mismatch");
  await Promise.all(
    Array.from({ length: 5 }, async () =>
      assert.equal(
        (await post(buyer, "customer", "confirm", { ref: wallet })).status(),
        200,
      ),
    ),
  );
  assert.equal(
    (await state(buyer, "customer")).balance,
    before.balance + 50000,
  );
  const missing = await pay("cake", false);
  await select(missing, "Purpose unverified");
  await analyst.getByText(/No browser observation is linked/).waitFor();
  assert.equal(
    (await post(second, "customer", "confirm", { ref: cake })).status(),
    404,
  );
  assert.equal(
    (
      await post(buyer, "customer", "fulfil", { ref: cake, stage: "Delivered" })
    ).status(),
    403,
  );
  assert.equal(
    (await buyer.request.get(base + "/api/app/analyst/state")).status(),
    401,
  );
  assert.equal(
    (
      await post(buyer, "analyst", "login", {
        user: "buyer",
        password: passwords.get("buyer"),
      })
    ).status(),
    401,
  );
  assert.equal(
    (await post(analyst, "analyst", "checkout", { kind: "topup" })).status(),
    403,
  );
  assert.ok(
    !(await state(second, "customer")).orders.some((o) => o.ref === cake),
  );
  store = process.env.MERCHANTLENS_TABLE
    ? dynamoStore(process.env.MERCHANTLENS_TABLE)
    : sqliteStore(resolve(dir, "commerce.sqlite"));
  const app = commerce(store);
  await Promise.all([
    app.fixtureCredit(merchantId, cake),
    app.fixtureCredit(merchantId, cake),
  ]);
  await select(cake, "Purpose mismatch");
  await analyst.getByRole("button", { name: "Explain this flag" }).click();
  await analyst
    .locator("aside h3")
    .filter({ hasText: "credited wallet" })
    .waitFor();
  const reopened = (await state(analyst, "analyst")).cases.find(
    (c) => c.id === cake,
  );
  assert.equal(reopened.outcome, "Open");
  assert.deepEqual(reopened.history.slice(0, -1), saved.history);
  assert.equal(
    (
      await post(analyst, "analyst", "review", {
        ref: cake,
        version: saved.version,
        action: "Escalate",
      })
    ).status(),
    409,
  );
  const final = await state(buyer, "customer");
  assert.equal(final.balance, before.balance + 100000);
  await buyer.reload();
  await buyer.getByRole("heading", { name: "Order history" }).waitFor();
  await stop(server);
  server = await start();
  await login(buyer, "customer", "buyer");
  await login(analyst, "analyst", "reviewer");
  await login(ops, "merchant", "bakery");
  assert.deepEqual((await state(buyer, "customer")).ledger, final.ledger);
  assert.deepEqual((await state(buyer, "customer")).orders, final.orders);
  assert.deepEqual(
    (await state(analyst, "analyst")).cases.find((c) => c.id === cake),
    reopened,
  );
  await select(cake, "Purpose mismatch");
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    for (const [role, p] of [
      ["customer", buyer],
      ["merchant", ops],
      ["analyst", analyst],
    ]) {
      await p.setViewportSize({ width, height });
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: ".demo-tools/product-" + role + "-" + width + ".png",
        fullPage: true,
      });
    }
  }
  console.log(
    store.mode +
      " passed: cake fulfilment, wallet balance, observer disconnected, late ledger conflict, concurrent retries, ownership, roles, restart and responsive views.",
  );
} finally {
  store?.close?.();
  await browser?.close();
  await stop(server);
}
