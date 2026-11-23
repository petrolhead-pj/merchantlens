export const offline = new URLSearchParams(location.search).has("offline");
export const endpoint = offline ? "/api/cases" : import.meta.env.VITE_CASE_API || "/api/cases";

export async function api(path = "", body) {
  const response = await fetch(endpoint + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    credentials: "same-origin",
    signal: AbortSignal.timeout(8000),
    body: body && JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Feed unavailable");
  return value;
}

export function investigationURL(ref) {
  const url = new URL("/", import.meta.env.VITE_DASHBOARD_ORIGIN || "http://127.0.0.1:4173");
  url.searchParams.set("case", ref);
  if (offline) url.searchParams.set("offline", "");
  return url.href;
}

export async function submitCheckout({ scenario, delay, ref, payment, click, orderLabel }, onConfirmed) {
  const base = { ref, payment, amount: 50000, currency: "INR", merchant: "SRB-2041" };
  const event = (kind) => ({
    ...base,
    id: crypto.randomUUID(),
    kind,
    time: new Date().toISOString(),
  });
  const sendEvidence = (record) => api("/evidence", record);
  const paid = event("payment");
  await api("/provider", paid);
  onConfirmed(paid);
  if (scenario === "Conflicting wallet credit") await sendEvidence(event("order"));
  await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  if (scenario === "Cake sale" || scenario === "Unverified") {
    const order = event("order");
    if (orderLabel) order.label = orderLabel;
    await sendEvidence(order);
  }
  if (scenario !== "Unverified" && click?.ref === ref) await sendEvidence(click);
  if (scenario === "Conflicting wallet credit") await sendEvidence(event("credit"));
}
