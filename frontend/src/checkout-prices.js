export const cakePrices = Object.freeze({
  "Chocolate cake": 50000,
  "Vanilla berry cake": 45000,
  "Pistachio cake": 65000,
  "Red velvet cake": 60000,
});

export function checkoutMoney(amount) {
  return "₹" + (amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function walletAmount(value) {
  if (typeof value !== "string" || !/^\d{1,5}(\.\d{1,2})?$/.test(value)) return null;
  const amount = Math.round(Number(value) * 100);
  return amount >= 1 && amount <= 9999999 ? amount : null;
}
