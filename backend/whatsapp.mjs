const knownConnectionFailures = new Set([
  "ECONNREFUSED", "ENETDOWN", "ENETUNREACH", "EHOSTUNREACH", "ENOTFOUND", "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export function configuredWhatsApp(env, fetchMessage = fetch) {
  const mode = env.MERCHANTLENS_WHATSAPP;
  if (mode !== "live" && mode !== "test") return null;
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ADMIN, WHATSAPP_GRAPH_VERSION,
    WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_LANGUAGE = "en" } = env;
  const to = WHATSAPP_ADMIN?.replace(/^\+/, "");
  if (!WHATSAPP_TOKEN || !/^\d+$/.test(WHATSAPP_PHONE_NUMBER_ID ?? "") ||
      !/^[1-9]\d{6,14}$/.test(to ?? "") || !/^v\d+\.\d+$/.test(WHATSAPP_GRAPH_VERSION ?? "")) {
    throw Error("Configure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ADMIN and WHATSAPP_GRAPH_VERSION before enabling WhatsApp alerts.");
  }

  return async (report) => {
    const { caseId, merchantId, paymentId, evidenceId, reason } = report;
    const content = mode === "live" && WHATSAPP_TEMPLATE ? {
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE,
        language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
        components: [{ type: "body", parameters: [caseId, merchantId, paymentId, evidenceId, reason].map(
          (value) => ({ type: "text", text: value }),
        ) }],
      },
    } : {
      type: "text",
      text: { body: ["MerchantLens demo · Critical review", `Case ${caseId}`, `Merchant ${merchantId}`,
        `Payment ${paymentId}`, `Evidence ${evidenceId}`, reason, "Review the linked evidence in the analyst workbench."].join("\n") },
    };
    try {
      const response = await fetchMessage(
        `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...content }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
      const payload = await response.json().catch(() => null);
      const messageId = payload?.messages?.[0]?.id;
      if (response.ok && typeof messageId === "string") return { status: "submitted", messageId };
      if (response.status === 429 || payload?.error?.is_transient) return { status: "retry" };
      if (!response.ok && payload?.error) return { status: "rejected" };
      return { status: "unknown" };
    } catch (error) {
      return { status: knownConnectionFailures.has(error.cause?.code) ? "retry" : "unknown" };
    }
  };
}

export async function dispatchWhatsApp(store, merchant, send, now = Date.now) {
  const rows = await store.list(merchant);
  for (const row of rows) {
    const alert = row.whatsapp;
    if (!alert) continue;
    if (alert.status === "sending" && alert.claimedAt + 60000 <= now()) {
      // A stopped process may have been interrupted after Meta accepted the message.
      row.whatsapp = { ...alert, status: "unknown" };
      row.version++;
      await store.save(row);
    }
    if (alert.status !== "queued" || (alert.nextAttempt ?? 0) > now()) continue;

    const claim = { ...alert, status: "sending", attempts: alert.attempts + 1, claimedAt: now() };
    row.whatsapp = claim;
    row.version++;
    if (!(await store.save(row))) continue;

    const result = await send(claim.report);
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await store.get(merchant, row.ref);
      if (current?.whatsapp?.status !== "sending" || current.whatsapp.claimedAt !== claim.claimedAt) break;
      const retry = result.status === "retry";
      current.whatsapp = {
        ...claim,
        ...result,
        status: retry ? "queued" : result.status,
        ...(retry ? { nextAttempt: now() + Math.min(60000, 1000 * 2 ** claim.attempts) } : {}),
      };
      current.version++;
      if (await store.save(current)) break;
    }
  }
}
