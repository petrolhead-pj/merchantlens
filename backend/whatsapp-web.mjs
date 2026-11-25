import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toDataURL } from "qrcode";

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require("whatsapp-web.js");

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
  const client = suppliedClient || new Client({
    authStrategy: new LocalAuth({ dataPath: resolve(directory, "whatsapp-session") }),
    ...(sender ? { pairWithPhoneNumber: { phoneNumber: sender, showNotification: false } } : {}),
    puppeteer: { headless: true, ...(browser ? { executablePath: browser } : {}) },
  });
  client.on("qr", (value) => { qr = value; state = "scan"; });
  client.on("code", (value) => { code = value; state = "pair"; });
  client.on("authenticated", () => { qr = null; code = null; state = "authenticated"; });
  client.on("ready", () => { qr = null; code = null; state = "connected"; });
  client.on("auth_failure", () => { qr = null; code = null; state = "authentication failed"; });
  client.on("disconnected", () => { qr = null; code = null; state = "disconnected"; });

  return {
    start() { client.initialize().catch(() => { state = "connection failed"; }); },
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
        if (!target || !/^[0-9]+@c\.us$/.test(target._serialized)) {
          const result = { status: "rejected" };
          outcomes.set(report.caseId, result);
          return result;
        }
        const message = await client.sendMessage(target._serialized, [
          "MerchantLens demo · Review required",
          `Case: ${report.caseId}`,
          `Merchant: ${report.merchantId}`,
          report.reason,
          "Review the linked evidence in the analyst dashboard.",
        ].join("\n"));
        const result = { status: "submitted", messageId: message.id._serialized };
        outcomes.set(report.caseId, result);
        return result;
      } catch {
        return { status: "unknown" };
      }
    },
  };
}
