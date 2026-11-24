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
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
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
  await buyer.evaluate(() => sessionStorage.setItem("checkout-buyer", "{corrupt"));
  await buyer.reload();
  await buyer.getByRole("button", { name: "Continue to checkout" }).click();
  await buyer.getByRole("button", { name: "Cancel checkout" }).click();
  await buyer.getByRole("button", { name: "Continue to checkout" }).waitFor();
  assert.equal(await buyer.getByRole("button", { name: "Wallet", exact: true }).isEnabled(), true);
  const pay = async (kind, observe = true, customer = buyer) => {
    await customer
      .getByRole("button", {
        name: kind === "cake" ? "Bakery" : "Wallet",
        exact: true,
      })
      .click();
    await customer.getByRole("checkbox").setChecked(observe);
    await customer.getByRole("button", { name: "Continue to checkout" }).click();
    const button = customer.locator("button[data-ref]");
    await button.waitFor();
    const ref = await button.getAttribute("data-ref");
    await button.click();
    await customer.getByRole("heading", { name: "Demo payment app" }).waitFor();
    assert.equal((await state(analyst, "analyst")).cases.some((entry) => entry.id === ref), false);
    await customer.getByRole("button", { name: "Confirm demo payment" }).click();
    await customer.getByText("Payment confirmed", { exact: true }).waitFor();
    return ref;
  };
  const before = await state(buyer, "customer"),
    secondBefore = await state(second, "customer"),
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
  const wallet = await pay("topup", true, second);
  const graph = analyst.getByRole("region", { name: "Live payment graph" });
  await graph.getByRole("button", { name: /User A.*Cake sale supported/ }).waitFor();
  await graph.getByRole("button", { name: /User B.*Purpose mismatch/ }).waitFor();
  await graph.getByLabel("Payer").selectOption("User B");
  assert.equal(await graph.getByRole("button", { name: /User A/ }).count(), 0);
  await analyst.getByRole("button", { name: "Demo customer · User B" }).waitFor();
  if (process.env.MERCHANTLENS_WHATSAPP !== "live") {
    const alert = analyst.locator("aside .record-section").filter({ hasText: "Admin WhatsApp alert" });
    await alert.getByRole("heading", { name: "Preview · live sending disabled" }).waitFor();
    await alert.getByText("View critical report", { exact: true }).click();
    await alert.getByText(wallet, { exact: true }).waitFor();
  }
  await graph.getByLabel("Payer").selectOption("");
  await select(wallet, "Purpose mismatch");
  const space = analyst.getByRole("group", { name: "3D payment evidence graph" });
  await space.getByRole("button", { name: "Demo customer · User B" }).waitFor();
  await space.locator("canvas").waitFor();
  const nodeLabel = "Confirmed payment · ₹500";
  const paymentNode = space.getByRole("button", { name: nodeLabel });
  await paymentNode.waitFor();
  const perspectivePosition = await paymentNode.evaluate((node) => node.style.transform);
  await space.getByRole("button", { name: "Front view", exact: true }).click();
  await analyst.waitForFunction(({ nodeLabel, perspectivePosition }) =>
    [...document.querySelectorAll(".webgl-graph .graph-node-control")].some((node) =>
      node.getAttribute("aria-label") === nodeLabel && node.style.transform !== perspectivePosition
    ), { nodeLabel, perspectivePosition });
  await space.getByRole("button", { name: "Perspective", exact: true }).click();
  await space.getByRole("button", { name: "Ledger outcome · Wallet credited" }).click();
  await analyst.locator("aside h3").filter({ hasText: "Wallet credited" }).waitFor();
  await Promise.all(
    Array.from({ length: 5 }, async () =>
      assert.equal(
        (await post(second, "customer", "confirm", { ref: wallet })).status(),
        200,
      ),
    ),
  );
  assert.equal(
    (await state(second, "customer")).balance,
    secondBefore.balance + 50000,
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
  assert.equal(final.balance, before.balance + 50000);
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
  if (process.env.PRODUCT_DEMO_HOST) {
    await login(second, "customer", "second-buyer");
    await analyst.getByText("Customer sign-in QR codes", { exact: true }).click();
    const lanes = [
      { name: /User A · Cake checkout/, user: "buyer", kind: "cake", tab: "Bakery", desktop: buyer },
      { name: /User B · Betting wallet demo/, user: "second-buyer", kind: "topup", tab: "Wallet", desktop: second },
    ];
    for (const lane of lanes) {
      const qr = analyst.getByRole("link", { name: lane.name });
      assert.match(await qr.locator("img").getAttribute("src"), /^data:image\/png;base64,/);
      await lane.desktop.getByRole("button", { name: lane.tab, exact: true }).click();
      const shareEvidence = lane.kind !== "cake";
      await lane.desktop.getByRole("checkbox", { name: "Share checkout click with the analyst" }).setChecked(shareEvidence);
      if (lane.kind === "cake") await lane.desktop.getByRole("button", { name: "Continue to checkout" }).click();
      await lane.desktop.getByRole("button", { name: "Show payment QR" }).click();
      const resumeQr = lane.desktop.getByRole("link", { name: "Scan to pay on your phone" });
      const url = await resumeQr.getAttribute("href");
      assert.equal(new URL(url).pathname, "/phone");
      assert.ok(new URL(url).hash);
      const ref = await lane.desktop.locator("button[data-ref]").getAttribute("data-ref");
      assert.match(await resumeQr.locator("img").getAttribute("src"), /^data:image\/png;base64,/);
      const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await phone.goto(url);
      await phone.getByRole("heading", { name: "Phone checkout" }).waitFor();
      assert.equal(await phone.getByRole("button", { name: "Sign in" }).count(), 0);
      assert.equal(await phone.getByRole("checkbox").isChecked(), shareEvidence);
      await phone.locator(`button[data-ref="${ref}"]`).click();
      await phone.getByRole("heading", { name: "Payment confirmed" }).waitFor();
      await analyst.locator(`[data-case-id="${ref}"]`).waitFor();
      const matchingCases = (await state(analyst, "analyst")).cases.filter((c) => c.id === ref);
      assert.equal(matchingCases.length, 1);
      assert.equal(matchingCases[0].nodes.some((node) => node.key === lane.kind), shareEvidence);
      assert.equal(matchingCases[0].payer, lane.user === "buyer" ? "User A" : "User B");
      await lane.desktop.getByRole("button", { name: "Continue to checkout" }).waitFor();
      await phone.reload();
      await phone.getByRole("heading", { name: "Payment confirmed" }).waitFor();
      assert.equal((await phone.request.get(new URL("/analyst", url).href)).status(), 404);
      assert.equal((await phone.request.get(new URL("/api/app/analyst/events", url).href)).status(), 404);
      await phone.close();
    }
    console.log("Storefront QR codes opened the same checkout without sign-in, preserved evidence sharing, and reopened paid checkouts.");
    if ((await state(analyst, "analyst")).analystDemoQr) {
      assert.equal((await post(buyer, "customer", "demo-payment-qr", { kind: "cake" })).status(), 404);
      await analyst.getByText("Demo payment QR codes", { exact: true }).click();
      await graph.getByLabel("Payer").selectOption("User A");
      await analyst.getByLabel("Filter cases").selectOption("Purpose unverified");
      await graph.getByRole("button", { name: "Follow latest" }).click();
      assert.equal(await graph.getByLabel("Payer").inputValue(), "");
      assert.equal(await analyst.getByLabel("Filter cases").inputValue(), "All cases");
      for (const demo of [
        { action: "Generate cake QR", title: "User A · Cake", status: "Cake sale supported" },
        { action: "Generate wallet QR", title: "User B · Wallet", status: "Purpose mismatch" },
      ]) {
        await analyst.getByRole("button", { name: demo.action }).click();
        const link = analyst.getByRole("link", { name: "Open " + demo.title + " payment" });
        await link.locator("img").waitFor();
        const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await phone.goto(await link.getAttribute("href"));
        const confirm = phone.locator("button[data-ref]");
        const ref = await confirm.getAttribute("data-ref");
        assert.equal((await state(analyst, "analyst")).cases.some((entry) => entry.id === ref), false);
        assert.equal(await phone.getByRole("button", { name: "Sign in" }).count(), 0);
        await confirm.click();
        await phone.getByRole("heading", { name: "Payment confirmed" }).waitFor();
        await analyst.locator(`aside[data-case="${ref}"]`).waitFor();
        if (demo.action === "Generate cake QR") {
          const order = (await state(ops, "merchant")).orders.find((record) => record.ref === ref);
          const row = ops.locator("article").filter({ hasText: order.payment });
          for (const label of ["Accept order", "Start preparing", "Ready for dispatch", "Mark delivered"])
            await row.getByRole("button", { name: label }).click();
        }
        const finding = analyst.locator(`aside[data-case="${ref}"] .finding h2`);
        await finding.filter({ hasText: demo.status }).waitFor();
        await space.getByRole("button", {
          name: demo.action === "Generate cake QR" ? "Merchant record · Cake delivered" : "Ledger outcome · Wallet credited",
        }).waitFor();
        const report = analyst.locator("aside .record-section").filter({ hasText: "Admin WhatsApp alert" });
        if (demo.action === "Generate cake QR") {
          assert.equal(await report.count(), 0);
        } else if (process.env.MERCHANTLENS_WHATSAPP !== "live") {
          await report.getByRole("heading", { name: "Preview · live sending disabled" }).waitFor();
          await report.getByText("View critical report", { exact: true }).click();
          await report.getByText(ref, { exact: true }).waitFor();
        }
        await phone.close();
      }
      console.log("Analyst QR rehearsal passed: two phone checkouts, live 3D evidence, cake fulfilment, and a WhatsApp preview only for the mismatch.");
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
