import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const { chromium } = createRequire(
  new URL("../.demo-tools/package.json", import.meta.url),
)("playwright-core");
const port = Number(process.env.REHEARSAL_PORT || 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 4173)
  throw Error("Choose a test port other than the stall port.");
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["scripts/stall.mjs"], {
  env: { ...process.env, STALL_PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((ok, fail) => {
  server.stdout.once("data", ok);
  server.once("exit", () => fail(Error("Stall failed to start")));
});
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext();
  await ctx.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  const board = await ctx.newPage(),
    lab = await ctx.newPage();
  await board.goto(origin);
  await board.evaluate(() => {
    window.visibleVersions = {};
    new MutationObserver(() => {
      const inspector = document.querySelector("aside[data-version]");
      if (inspector)
        window.visibleVersions[
          inspector.dataset.case + "/" + inspector.dataset.version
        ] ??= Date.now();
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  await lab.goto(origin + "/?lab");
  let cake;
  for (const [name, result] of [
    ["Cake sale", "Cake sale supported"],
    ["Wallet top-up", "Purpose mismatch — review"],
    ["Unverified", "Purpose unverified"],
    ["Conflicting wallet credit", "Purpose mismatch — review"],
  ]) {
    await lab.getByLabel("Scenario").selectOption(name);
    await lab.getByLabel("Evidence delay").fill("1");
    const ref = await lab.locator("[data-ref]").getAttribute("data-ref");
    await lab.locator("[data-ref]").click();
    await lab.getByText("Run received · inspect the workbench").waitFor();
    if (name === "Cake sale")
      await lab.getByText("Send simulated delivery").click();
    await board
      .locator('aside[data-case="' + ref + '"] h2')
      .filter({ hasText: result })
      .waitFor();
    await lab.getByText("Send duplicate confirmation").click();
    await lab.getByText("Duplicate acknowledged").waitFor();
    console.log(name, result);
    const record = await board.evaluate(
      async ({ ref, endpoint, kind }) => {
        const stop = Date.now() + 30000;
        do {
          const records = await (await fetch(endpoint)).json(),
            record = records.find((c) => c.id === ref);
          if (record?.records.some((r) => r.event.kind === kind)) return record;
          await new Promise((resolve) => setTimeout(resolve, 250));
        } while (Date.now() < stop);
        throw Error("Missing final evidence for " + ref);
      },
      {
        ref,
        endpoint: process.env.REHEARSAL_API || "/api/cases",
        kind: {
          "Cake sale": "delivery",
          "Wallet top-up": "topup",
          Unverified: "order",
          "Conflicting wallet credit": "credit",
        }[name],
      },
    );
    assert.equal(
      record.records.filter((r) => r.event.kind === "payment").length,
      1,
    );
    const versionKey = record.id + "/" + record.version;
    if(name==="Cake sale")cake=record;
    await board.waitForFunction(
      (key) => window.visibleVersions[key],
      versionKey,
    );
    const shown = await board.evaluate(
      (key) => window.visibleVersions[key],
      versionKey,
    );
    console.log(
      "Last evidence receipt to rendered case",
      shown - Math.max(...record.records.map((r) => Date.parse(r.received))),
      "ms",
    );
    await lab.getByText("Reset demo").click();
  }
  await board.getByRole("button").filter({hasText:cake.id.slice(0,6)}).click();
  await board.getByRole("button",{name:"Record supported outcome"}).click();
  await board.locator("aside strong").filter({hasText:"Record supported outcome"}).waitFor();
  const endpoint=origin+(process.env.REHEARSAL_API || "/api/cases");
  const priorVersion=Number(await board.locator("aside").getAttribute("data-version"));
  const late={...cake.records.find(r=>r.event.kind==="payment").event,id:crypto.randomUUID(),time:new Date().toISOString(),kind:"credit"};
  assert.ok((await board.request.post(endpoint+"/evidence",{data:late})).ok());
  await board.locator("aside h2").filter({hasText:"Purpose mismatch — review"}).waitFor();
  await board.getByRole("button",{name:"Explain this flag"}).click();
  assert.equal(await board.locator("aside h3").innerText(),"credited wallet");
  const stale=await board.request.post(endpoint+"/review",{data:{ref:cake.id,version:priorVersion,action:"Escalate"}});
  assert.equal(stale.status(),409);
  const scope = await board.locator("aside").getAttribute("data-case");
  const feedPattern = "**" + (process.env.REHEARSAL_API || "/api/cases");
  await board.route(feedPattern, (route) => route.abort());
  await board.getByText("Feed stale", { exact: false }).first().waitFor();
  assert.equal(await board.locator("aside").getAttribute("data-case"), scope);
  await board.unroute(feedPattern);
  await board.getByText("Connected", { exact: true }).waitFor();
  console.log("Feed disconnect retained case; polling resumed.");
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await board.setViewportSize({ width, height });
    await board.getByText("Explain this flag").click();
    assert.ok(
      await board.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Horizontal overflow",
    );
    await board.screenshot({
      path: `.demo-tools/workbench-${width}.png`,
      fullPage: true,
    });
  }
} finally {
  await browser?.close();
  server.kill();
}
