import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const { chromium } = createRequire(
  new URL("../.demo-tools/package.json", import.meta.url),
)("playwright-core");
const server = spawn(process.execPath, ["scripts/stall.mjs"], {
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
  await board.goto("http://127.0.0.1:4173");
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
  await lab.goto("http://127.0.0.1:4173/?lab");
  for (const [name, result] of [
    ["Cake sale", "Cake sale supported"],
    ["Wallet top-up", "Purpose mismatch — review"],
    ["Unverified", "Purpose unverified"],
    ["Conflicting wallet credit", "Purpose mismatch — review"],
  ]) {
    await lab.getByLabel("Scenario").selectOption(name);
    await lab.getByLabel("Evidence delay").fill("1");
    await lab.locator("[data-ref]").click();
    await lab.getByText("Run received · inspect the workbench").waitFor();
    if (name === "Cake sale")
      await lab.getByText("Send simulated delivery").click();
    await board.locator("aside h2").filter({ hasText: result }).waitFor();
    await lab.getByText("Send duplicate confirmation").click();
    await lab.getByText("Duplicate acknowledged").waitFor();
    console.log(name, result);
    const cases = await (
      await board.request.get("http://127.0.0.1:4173/api/cases")
    ).json();
    assert.equal(
      cases[0].records.filter((r) => r.event.kind === "payment").length,
      1,
    );
    const versionKey = cases[0].id + "/" + cases[0].version;
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
      shown - Date.parse(cases[0].records.at(-1).received),
      "ms",
    );
    await lab.getByText("Reset demo").click();
  }
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
