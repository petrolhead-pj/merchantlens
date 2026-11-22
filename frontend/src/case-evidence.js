import { Banknote, CakeSlice, CreditCard, Landmark, Link2, Monitor, MousePointer2, PackageCheck, Store, Wallet } from "lucide-react";

const mismatch = "Purpose mismatch — review";
export const supported = "Cake sale supported";
export const has = (c, key) => c.nodes.some((node) => node.key === key);
export const linked = (c, key) => c.edges.some((edge) => edge.to === key);
const pickup = (c) => c.fulfilment?.method === "Pickup";
const money = (c) => {
  const event = c.nodes.find((node) => node.key === "payment")?.event;
  return event && new Intl.NumberFormat("en-IN", {
    style: "currency", currency: event.currency, maximumFractionDigits: 2, minimumFractionDigits: 0,
  }).format(event.amount / 100);
};

export function findingFor(c) {
  if (!c) return {};
  const amount = money(c);
  if (!amount) return { title: "Waiting for payment confirmation", reason: c.why, tone: "pending" };
  if (c.status === mismatch) {
    const credit = linked(c, "credit");
    return {
      title: c.sandbox ? "Betting deposit linked to Sunrise Bakery · review"
        : credit ? "Wallet credit linked to Sunrise Bakery · review" : "Wallet top-up linked to Sunrise Bakery · review",
      reason: c.sandbox ? "PayU sandbox confirmed the ₹500 test payment. Its transaction ID matches a deposit initiated on the test betting page." : c.why,
      tone: "conflict", driver: credit ? "credit" : "topup",
    };
  }
  if (c.status === supported) return {
    title: pickup(c) ? "Cake sale supported · collection matched" : "Cake sale supported · delivery matched",
    reason: pickup(c) ? c.why : "The observed cake checkout and merchant order match the payment. A linked delivery record completes the trail.",
    tone: "supported", driver: "cake",
  };
  if (linked(c, "cake")) {
    const waiting = !linked(c, "order") ? "order" : pickup(c) ? "collection" : "delivery";
    const reason = {
      order: "The observed cake checkout matches the payment. Waiting for the merchant order.",
      collection: c.fulfilment?.stage === "Ready" ? "The merchant marked the cake ready for pickup. Waiting for collection." : "The paid order is for pickup. Waiting for collection.",
      delivery: "The observed cake checkout and merchant order are linked to this payment. Waiting for delivery evidence.",
    }[waiting];
    return { title: `Cake checkout matched · ${waiting} pending`, reason, tone: "pending", waiting, driver: "cake" };
  }
  return {
    title: `Payment ${c.paymentState === "Refunded" ? "refunded" : "confirmed"} · checkout source unverified`,
    reason: has(c, "order")
      ? "The merchant reports a cake order. Its checkout source is still unverified."
      : "The recipient is confirmed. Waiting for evidence of what the customer paid for.",
    tone: "pending",
  };
}

const catalog = {
  storefront: ["Checkout page", "Observed storefront", Monitor],
  cake: ["Cake checkout", "Browser click observer", MousePointer2],
  topup: ["Observed wallet top-up", "Browser click observer", Wallet],
  order: ["Chocolate cake order", "Merchant order system", CakeSlice],
  delivery: ["Cake delivered", "Simulated courier", PackageCheck],
  payment: ["Payment", "Simulated provider", CreditCard],
  merchant: ["Sunrise Bakery", "Payment recipient", Store],
  profile: ["Bakery business", "Declared business", Landmark],
  credit: ["Wallet credit", "Simulated wallet ledger", Wallet],
  refund: ["Refund issued", "Simulated provider", Banknote],
};
export const recordInfo = (c, key) => {
  const [name, source, icon] = catalog[key] || [key, "Evidence record", Link2];
  if (key === "payment") return [money(c) || name, c.sandbox ? "PayU sandbox" : (c.paymentState || "Confirmed") + " payment", icon];
  if (c.sandbox && key === "topup") return ["Betting wallet deposit", "Test betting page", icon];
  if (c.sandbox && key === "storefront") return ["Test betting page", "Checkout origin", icon];
  if (key === "delivery") return [pickup(c) ? "Cake collected" : name, c.fulfilment ? "Merchant fulfilment" : source, icon];
  return [name, source, icon];
};

export function relationship(c, edge) {
  const descriptions = {
    storefront: ["observed on", c.sandbox ? "The test betting server recorded that the deposit started on its page." : "The click observer recorded the checkout page and the button the customer used."],
    cake: ["checkout ref match", "The observed cake checkout and provider payment share the same checkout reference."],
    topup: c.sandbox
      ? ["PayU transaction ID match", "The merchant transaction ID from the test betting checkout matches the one verified directly with PayU sandbox."]
      : ["checkout ref match", "The browser-observed wallet action and provider payment share the same checkout reference."],
    credit: ["wallet credit match", "The simulated wallet ledger credit and provider payment share the same checkout reference."],
    order: ["order for payment", "The merchant’s cake order is linked to this payment by checkout reference."],
    delivery: pickup(c)
      ? ["collection for order", "The merchant collection record is linked to the paid cake order."]
      : edge.from === "order"
        ? ["delivery for order", "The delivery record is linked to the paid cake order by checkout reference."]
        : ["delivery ref match", "The delivery record shares the payment’s checkout reference."],
    merchant: ["paid to", "The provider payment identifies this recipient account. The demo registry supplies its name."],
    profile: ["declares", "The demo merchant registry lists the recipient’s declared business as a bakery."],
    refund: ["refund for", "The provider refund is linked to the original payment by checkout reference."],
  };
  return descriptions[edge.to] || ["linked to", "The case feed linked these records."];
}

export { money };
