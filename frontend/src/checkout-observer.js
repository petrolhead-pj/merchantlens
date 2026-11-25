// Test instrumentation: classify only known visible buttons in the controlled lab.
const actions = new Map([
  ["Pay ₹500", "cake"],
  ["Buy chocolate cake · ₹500", "cake"],
  ["Top up demo wallet · ₹500", "topup"],
  ["Top up demo wallet", "topup"],
]);
function observationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
export function observeCheckout(container, onObservation, { allowDraft = false } = {}) {
  function capture(click) {
    const button = click.target.closest(allowDraft
      ? "button[data-ref][data-payment], button[data-checkout-draft]"
      : "button[data-ref][data-payment]");
    if (!click.isTrusted || !button) return;
    const label = button.innerText.trim();
    const kind = label === "Pay" ? button.dataset.checkoutKind : actions.get(label) || (/^Buy (chocolate cake|vanilla berry cake|pistachio cake|red velvet cake) · ₹\d+$/.test(label) ? "cake" : undefined);
    if (!["cake", "topup"].includes(kind)) return;
    onObservation({
      kind,
      label,
      id: observationId(),
      time: new Date().toISOString(),
      payment: button.dataset.payment,
      ref: button.dataset.ref,
      merchant: "SRB-2041",
      currency: "INR",
      amount: Number(button.dataset.checkoutAmount || 50000),
    });
  }
  container.addEventListener("click", capture, true);
  return () => container.removeEventListener("click", capture, true);
}
