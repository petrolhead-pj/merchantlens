// Test instrumentation: classify only known visible buttons in the controlled lab.
const actions = new Map([
  ["Buy chocolate cake · ₹500", "cake"],
  ["Top up demo wallet · ₹500", "topup"],
]);
export function observeCheckout(container, onObservation) {
  function capture(click) {
    const button = click.target.closest("button[data-ref][data-payment]");
    if (!click.isTrusted || !button) return;
    const label = button.innerText.trim();
    const kind = actions.get(label);
    if (!kind) return;
    onObservation({
      kind,
      label,
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      payment: button.dataset.payment,
      ref: button.dataset.ref,
      merchant: "SRB-2041",
      currency: "INR",
      amount: 50000,
    });
  }
  container.addEventListener("click", capture, true);
  return () => container.removeEventListener("click", capture, true);
}
