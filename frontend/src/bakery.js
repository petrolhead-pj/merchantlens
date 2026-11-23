import { submitCheckout } from "./case-feed.js";
import { observeCheckout } from "./checkout-observer.js";

const form = document.querySelector("form");
const button = document.querySelector("#pay");
const status = document.querySelector("#status");
const selectedCake = document.querySelector("#selected-cake");
form.addEventListener("change", () => {
  selectedCake.textContent = new FormData(form).get("cake");
});
const ref = crypto.randomUUID();
const payment = crypto.randomUUID();
button.dataset.ref = ref;
button.dataset.payment = payment;
document.querySelector("#investigation").href = "./index.html?case=" + ref;

let click;
observeCheckout(form, observation => { click = observation; });
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!click || button.disabled) return;
  const cake = new FormData(form).get("cake");
  button.disabled = true;
  form.querySelector("fieldset").disabled = true;
  status.textContent = "Sending simulated payment.";
  try {
    await submitCheckout({ scenario: "Cake sale", delay: 4, ref, payment, click, orderLabel: cake + " order" }, () => {
      status.textContent = "Payment confirmed. Recording your " + cake.toLowerCase() + " order.";
    });
    status.textContent = "Order recorded. View the case in MerchantLens.";
  } catch {
    status.textContent = "The checkout could not complete. Reload to start a fresh payment.";
  }
});
