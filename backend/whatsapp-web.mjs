import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toDataURL } from "qrcode";
import { checkoutMoney } from "../frontend/src/checkout-prices.js";

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require("whatsapp-web.js");

class DemoWhatsAppClient extends Client {
  #configuredPages = new WeakSet();

  inject() {
    const page = this.pupPage;
    if (!this.#configuredPages.has(page)) {
      this.#configuredPages.add(page);
      const waitForFunction = page.waitForFunction.bind(page);
      page.waitForFunction = (predicate, options, ...args) => {
        // Startup readiness does not depend on the browser painting a frame.
        const readinessCheck = String(predicate).includes("window.Debug?.VERSION") ||
          String(predicate).includes("WAWebSocketModel") || String(predicate).includes("window.WWebJS");
        return waitForFunction(predicate, readinessCheck ? { ...options, polling: 250 } : options, ...args);
      };
    }
    return super.inject();
  }
}

function formatReviewAlert(report) {
  const merchant = report.merchantId === "SRB-2041" ? "Sunrise Bakery" : report.merchantId;
  const payment = Number.isSafeInteger(report.amount) && report.amount > 0
    ? `Payment: *${checkoutMoney(report.amount)}* to ${merchant}`
    : `Merchant: ${merchant}`;
  const evidence = {
    credit: "Wallet credit matched the payment ID, checkout reference, merchant ID, amount and currency.",
    topup: "The observed wallet top-up matched the payment ID, checkout reference, merchant ID, amount and currency.",
  }[report.evidenceKind];
  return [
    "*MerchantLens | Payment needs review*",
    "",
    payment,
    "",
    "*Why it was flagged*",
    report.reason,
    ...(evidence ? ["", "*What matched*", evidence] : []),
    "",
    "*Next step*",
    "Open the MerchantLens analyst dashboard and review the linked evidence before taking action.",
    `Case: ${report.caseId}`,
  ].join("\n");
}

export function createWhatsAppWeb({ directory, client: suppliedClient, now = Date.now } = {}) {
  let state = "starting";
  let qr = null;
  let code = null;
  const senderFile = directory && resolve(directory, "whatsapp-sender.txt");
  const sender = senderFile && existsSync(senderFile) ? readFileSync(senderFile, "utf8").trim() : "";
  if (sender && !/^[1-9]\d{7,14}$/.test(sender)) throw Error("Invalid saved WhatsApp sender.");
  let recipient = "";
  const recipientFile = directory && resolve(directory, "whatsapp-recipient.txt");
  if (recipientFile && existsSync(recipientFile)) {
    recipient = readFileSync(recipientFile, "utf8").trim().replace(/^\+/, "");
    if (!/^[1-9]\d{7,14}$/.test(recipient)) throw Error("Invalid saved WhatsApp recipient.");
  }
  let attempts = 0;
  let lastAttempt = -Infinity;
  const outcomes = new Map();
  const browser = process.env.WHATSAPP_BROWSER || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  const client = suppliedClient || new DemoWhatsAppClient({
    authStrategy: new LocalAuth({ dataPath: resolve(directory, "whatsapp-session") }),
    ...(sender ? { pairWithPhoneNumber: { phoneNumber: sender, showNotification: false } } : {}),
    authTimeoutMs: 90000,
    webVersionCache: { type: "none" },
    userAgent: false,
    puppeteer: {
      headless: process.env.WHATSAPP_VISIBLE !== "1",
      ...(browser ? { executablePath: browser } : {}),
    },
  });
  client.on("qr", (value) => { qr = value; state = "scan"; });
  client.on("code", (value) => { code = value; state = "pair"; });
  client.on("authenticated", () => { qr = null; code = null; if (state !== "connected") state = "authenticated"; });
  client.on("ready", () => { qr = null; code = null; state = "connected"; });
  client.on("auth_failure", () => { qr = null; code = null; state = "authentication failed"; });
  client.on("disconnected", () => { qr = null; code = null; state = "disconnected"; });

  return {
    start() {
      client.initialize().catch((error) => {
        state = "connection failed";
        const message = error instanceof Error ? error.message : String(error);
        console.error("WhatsApp Web startup failed:", message.split(/\r?\n/, 1)[0]);
      });
    },
    async status() {
      return { state, code, qr: qr ? await toDataURL(qr, { margin: 2, width: 280 }) : null,
        recipientConfigured: Boolean(recipient), remainingAlerts: Math.max(0, 5 - attempts) };
    },
    setRecipient(number) {
      const normalized = String(number || "").replace(/[\s+()-]/g, "");
      if (!/^[1-9]\d{7,14}$/.test(normalized)) throw Error("Enter a phone number with country code.");
      if (recipient && recipient !== normalized) throw Error("The demo recipient is locked until the server restarts.");
      recipient = normalized;
    },
    async send(report) {
      if (state !== "connected" || !recipient || (sender && client.info?.wid?.user !== sender)) return { status: "retry" };
      if (!report || typeof report.caseId !== "string" || !report.caseId) return { status: "rejected" };
      if (outcomes.has(report.caseId)) return outcomes.get(report.caseId);
      if (attempts >= 5) return { status: "rejected" };
      if (now() - lastAttempt < 15000) return { status: "retry" };
      attempts++;
      lastAttempt = now();
      outcomes.set(report.caseId, { status: "unknown" });
      try {
        const target = await client.getNumberId(recipient);
        const targetId = target?._serialized ?? target?.$1;
        // WhatsApp can resolve the locked phone number to a private contact ID.
        const matchesRecipient = targetId === recipient + "@c.us" ||
          (typeof targetId === "string" && /^[0-9]+@lid$/.test(targetId));
        if (!matchesRecipient) {
          const result = { status: "rejected" };
          outcomes.set(report.caseId, result);
          return result;
        }
        const message = await client.sendMessage(targetId, formatReviewAlert(report));
        const result = { status: "submitted", messageId: message.id._serialized };
        outcomes.set(report.caseId, result);
        return result;
      } catch {
        return { status: "unknown" };
      }
    },
  };
}
