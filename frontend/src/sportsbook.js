import { submitCheckout } from "./case-feed.js";
import { observeCheckout } from "./checkout-observer.js";

const button = document.querySelector("#deposit");
const status = document.querySelector("#status");
const ref = crypto.randomUUID();
const payment = crypto.randomUUID();
button.dataset.ref = ref;
button.dataset.payment = payment;
document.querySelector("#investigation").href = "./index.html?case=" + ref;

let click;
observeCheckout(document.querySelector("main"), observation => { click = observation; });
button.addEventListener("click", async () => {
  if (!click) return;
  button.disabled = true;
  status.textContent = "Sending simulated payment…";
  try {
    await submitCheckout({ scenario: "Wallet top-up", delay: 5, ref, payment, click }, () => {
      status.textContent = "Payment confirmed. Sending wallet evidence in 5 seconds.";
    });
    status.textContent = "Wallet evidence sent. Open MerchantLens to see the case.";
  } catch {
    status.textContent = "The event feed could not complete this checkout. Reload to start a fresh payment.";
  }
});
