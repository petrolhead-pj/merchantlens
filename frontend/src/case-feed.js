import { useEffect, useState } from "react";

const query = new URLSearchParams(location.search);
export const endpoint = query.has("offline") ? "/api/cases" : import.meta.env.VITE_CASE_API || "/api/cases";

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

export const send = (event) => api(event.kind === "payment" ? "/provider" : "/evidence", event);
export const newEvent = (base, kind) => ({
  ...base, id: crypto.randomUUID(), kind, time: new Date().toISOString(),
});

export async function submitCheckout({ scenario, delay, ref, payment, click, orderLabel }, onConfirmed) {
  const base = { ref, payment, amount: 50000, currency: "INR", merchant: "SRB-2041" };
  await send(newEvent(base, "payment"));
  onConfirmed();
  if (scenario === "Conflicting wallet credit") await send(newEvent(base, "order"));
  await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  if (["Cake sale", "Unverified"].includes(scenario)) {
    await send(newEvent(orderLabel ? { ...base, label: orderLabel } : base, "order"));
  }
  if (scenario !== "Unverified" && click?.ref === ref) await send(click);
  if (scenario === "Conflicting wallet credit") await send(newEvent(base, "credit"));
}

export function useCaseFeed(enabled = true) {
  const [cases, setCases] = useState([]);
  const [state, setState] = useState("Connecting");
  useEffect(() => {
    if (!enabled) return;
    let timer;
    let active = true;
    let delay = 800;
    async function poll() {
      if (!document.hidden) {
        try {
          const list = await api();
          if (active) {
            setCases(list);
            setState("Connected");
            delay = 800;
          }
        } catch {
          if (active) {
            setState("Feed interrupted");
            delay = Math.min(10000, delay * 2);
          }
        }
      }
      if (active) timer = setTimeout(poll, delay);
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [enabled]);
  return { cases, state };
}
