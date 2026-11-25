import { createHash, randomBytes, randomUUID } from "node:crypto";
import { append, review, validate } from "./exhibition.mjs";
import { checkoutEvidence, commerceFinding } from "../frontend/src/review-policy.js";
import { cakePrices, checkoutMoney, walletAmount } from "../frontend/src/checkout-prices.js";
export const merchantId = "SRB-2041";
export const price = 50000;
export const mismatchStatus = "Purpose mismatch — review";
const now = () => new Date().toISOString();
const namedPayers = new Map([["buyer", "User A"], ["second-buyer", "User B"]]);
const payerLabel = (owner) => namedPayers.get(owner) ??
  "User " + createHash("sha256").update(owner).digest("hex").slice(0, 6);

function analystCase(row) {
  const c = row.case;
  const payment = c.nodes.find((node) => node.key === "payment");
  const payer = payerLabel(row.owner);
  return {
    ...c,
    ...commerceFinding(c.records, row.order, row.unresolved),
    payer,
    confirmed: row.confirmed,
    ...(row.gateway ? { provider: { mode: row.gateway.mode, transactionId: row.gateway.txnid, paymentId: row.gateway.providerPaymentId } } : {}),
    nodes: [...c.nodes, { ...payment, key: "payer", source: "Demo checkout identity" }],
    edges: [...c.edges, { from: "payment", to: "payer", evidenceIds: [payment.event.id], ref: c.id }],
    notification: row.whatsapp ? { status: row.whatsapp.status, report: row.whatsapp.report } : null,
    unresolved: row.unresolved || null,
    fulfilment: row.order
      ? { method: row.method, stage: row.order.stage, events: row.order.events }
      : null,
  };
}
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function requireRole(actor, role) {
  if (actor.role !== role)
    fail(403, "This action requires the " + role + " role");
}
const descriptions = {
  payment: "Simulated payment provider",
  order: "Committed merchant order",
  cake: "Customer browser click listener (client-reported)",
  topup: "Customer browser click listener (client-reported)",
  credit: "Committed simulated wallet ledger",
  delivery: "Merchant fulfilment record",
};
function checkoutLabels(r) {
  const amount = checkoutMoney(r.amount ?? price);
  return r.kind === "cake"
    ? [`Buy ${(r.flavour || "Chocolate cake").toLowerCase()} · ${amount}`, "Pay"]
    : ["Top up demo wallet", "Top up demo wallet · ₹500", "Pay"];
}
function record(r, kind, id = randomUUID(), observation) {
  const event = observation || {
    id,
    ref: r.ref,
    payment: r.payment,
    merchant: r.merchant,
    amount: r.amount ?? price,
    currency: "INR",
    kind,
    time: now(),
    ...(kind === "order" && r.order?.items?.[0]?.name ? { label: r.order.items[0].name } : {}),
  };
  r.case = append(r.case, event, undefined, true);
  r.case.rule = "commerce/1";
  const paymentSource = r.gateway ? "Verified PayU " + r.gateway.mode + " payment" : descriptions.payment;
  const added = r.case.records.at(-1);
  added.source = kind === "payment" ? paymentSource : descriptions[kind];
  for (const n of r.case.nodes) {
    if (n.key === "merchant" || n.key === "profile") {
      n.source = "Configured merchant profile " + r.merchant;
      n.event = { ...n.event, id: r.profile.id, time: r.profile.captured };
    } else n.source = n.event.kind === "payment" ? paymentSource : descriptions[n.event.kind];
  }
  for (const e of r.case.edges) {
    e.evidenceIds = [
      ...new Set(
        [e.from, e.to].map(
          (key) => r.case.nodes.find((n) => n.key === key).event.id,
        ),
      ),
    ];
  }
  r.case.history.at(-1).rule = r.case.rule;
}
function credit(r) {
  if (!r.confirmed) fail(409, "Waiting for confirmed payment");
  if (r.gateway) fail(409, "Wallet fixtures require a simulated payment");
  if (r.ledger) return false;
  r.ledger = {
    id: randomUUID(),
    payment: r.payment,
    ref: r.ref,
    owner: r.owner,
    amount: r.amount ?? price,
    currency: "INR",
    posted: now(),
  };
  record(r, "credit", r.ledger.id);
  return true;
}
const stages = ["Placed", "Accepted", "Preparing", "Ready", "Delivered"];
export function commerce(store, { sendWhatsApp = false } = {}) {
  async function mutate(actor, ref, fn) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = await store.get(actor.merchant, ref);
      if (!r || (actor.role === "customer" && r.owner !== actor.user))
        fail(404, "Transaction not found");
      const previousFinding = r.case?.status;
      if (!fn(r)) return r;
      if (r.case)
        Object.assign(
          r.case,
          commerceFinding(r.case.records, r.order, r.unresolved),
        );
      if (r.case?.status === mismatchStatus && previousFinding !== mismatchStatus && !r.whatsapp) {
        const evidence = checkoutEvidence(r.case.records).trace.trigger;
        r.whatsapp = {
          status: sendWhatsApp ? "queued" : "preview",
          report: {
            caseId: r.ref,
            paymentId: r.payment,
            merchantId: r.merchant,
            amount: r.amount ?? price,
            reason: r.case.why,
            evidenceId: evidence.event.id,
            evidenceKind: evidence.event.kind,
          },
          attempts: 0,
        };
      }
      r.version++;
      if (await store.save(r)) return r;
    }
    fail(409, "Concurrent change. Retry this operation.");
  }
  async function confirm(actor, { ref, observation, amount }, receipt) {
    await mutate(actor, ref, (r) => {
      if (r.cancelled) fail(410, "This checkout was cancelled");
      if (Boolean(r.gateway) !== Boolean(receipt) || (receipt && r.gateway.txnid !== receipt.txnid))
        fail(409, "This payment must be confirmed through its original provider");
      if (r.confirmed) {
        if (receipt && r.gateway.providerPaymentId !== receipt.providerPaymentId)
          fail(409, "PayU payment identity changed");
        return false;
      }
      if (r.kind === "topup" && amount !== undefined) {
        r.amount = walletAmount(amount);
        if (r.amount === null) fail(400, "Enter an amount from ₹0.01 to ₹99,999.99");
      }
      if (receipt) {
        r.gateway.providerPaymentId = receipt.providerPaymentId;
        observation = r.gateway.observation;
        delete r.gateway.observation;
      }
      if (observation) {
        try {
          validate(observation, true);
        } catch {
          fail(400, "Invalid observer record");
        }
        if (observation.ref !== ref || observation.payment !== r.payment || observation.kind !== r.kind ||
            observation.amount !== (r.amount ?? price) || !checkoutLabels(r).includes(observation.label)) {
          r.unresolved = { record: observation, received: now(),
            reason: "The reported checkout reference, payment ID or visible action did not match this transaction." };
        }
      }
      r.confirmed = now();
      r.profile = { id: randomUUID(), merchant: r.merchant, name: "Sunrise Bakery",
        business: "Bakery business", captured: r.confirmed };
      record(r, "payment", r.payment);
      if (r.kind === "cake") {
        r.order = {
          id: randomUUID(), items: [{ name: r.flavour || "Chocolate cake", quantity: 1, unitAmount: r.amount ?? price }],
          amount: r.amount ?? price, payment: r.payment, ref: r.ref, method: r.method, stage: "Placed", events: [],
        };
        record(r, "order", r.order.id);
      }
      if (observation && !r.unresolved) record(r, r.kind, observation.id, observation);
      if (r.kind === "topup") credit(r);
      return true;
    });
    return { ref, confirmed: true };
  }
  return {
    async intent(actor, { kind, method = "Delivery", flavour = "Chocolate cake" }, payuMode) {
      requireRole(actor, "customer");
      if (
        !["cake", "topup"].includes(kind) ||
        !["Delivery", "Pickup"].includes(method) ||
        !Object.hasOwn(cakePrices, flavour) ||
        (payuMode && kind === "cake" && flavour !== "Chocolate cake")
      )
        fail(400, "Invalid checkout");
      const r = {
        merchant: actor.merchant,
        ref: randomUUID(),
        payment: randomUUID(),
        kind,
        method,
        ...(kind === "cake" ? { flavour, amount: cakePrices[flavour] } : {}),
        owner: actor.user,
        version: 1,
        created: now(),
        ...(kind === "cake" && payuMode ? { gateway: { mode: payuMode, txnid: randomBytes(12).toString("hex") } } : {}),
      };
      if (!(await store.save(r))) fail(409, "Checkout conflict");
      return { ref: r.ref, payment: r.payment, amount: r.amount, ...(r.gateway ? { payuMode } : {}) };
    },
    async resumeCheckout(actor, { ref }, payuMode) {
      requireRole(actor, "customer");
      if (typeof ref !== "string") fail(400, "Checkout reference required");
      const row = await store.get(actor.merchant, ref);
      if (!row || row.owner !== actor.user) fail(404, "Checkout unavailable for this account");
      if (row.cancelled) fail(410, "This checkout was cancelled");
      if (row.kind === "cake" && row.gateway?.mode !== payuMode)
        fail(409, "Open this checkout in its original payment environment");
      return {
        ref: row.ref, payment: row.payment, kind: row.kind, method: row.method, flavour: row.flavour,
        confirmed: Boolean(row.confirmed),
        amount: row.amount ?? (row.kind === "cake" || row.confirmed ? price : null),
        ...(row.gateway ? { payuMode: row.gateway.mode, submittedToPayU: Boolean(row.gateway.prepared) } : {}),
      };
    },
    async cancelCheckout(actor, { ref }) {
      requireRole(actor, "customer");
      if (typeof ref !== "string") fail(400, "Checkout reference required");
      await mutate(actor, ref, (row) => {
        if (row.confirmed || row.gateway?.prepared)
          fail(409, "Check the payment status before cancelling this checkout");
        if (row.cancelled) return false;
        row.cancelled = true;
        return true;
      });
      return { cancelled: true };
    },
    pay(actor, input) {
      requireRole(actor, "customer");
      return confirm(actor, input);
    },
    async preparePayU(actor, { ref, observation, firstname, email, phone }, payu, phoneCheckout = false) {
      requireRole(actor, "customer");
      const contact = (value, limit) => typeof value === "string" && value.length <= limit && !/[|\r\n]/.test(value);
      if (!contact(firstname, 60) || !firstname.trim() || !contact(email, 100) || !/^\S+@\S+\.\S+$/.test(email) ||
          typeof phone !== "string" || !/^\d{10}$/.test(phone)) fail(400, "Enter your name, email and 10-digit phone number");
      const row = await mutate(actor, ref, (r) => {
        if (r.cancelled) fail(410, "This checkout was cancelled");
        if (r.kind !== "cake" || !r.gateway || r.gateway.mode !== payu.mode || r.confirmed)
          fail(409, "PayU is available for a pending cake checkout in this mode");
        if (observation) {
          try { validate(observation); } catch { fail(400, "Invalid observer record"); }
          r.gateway.observation = observation;
        } else {
          delete r.gateway.observation;
        }
        r.gateway.prepared = true;
        return true;
      });
      return payu.checkout(row.gateway.txnid, { firstname, email, phone }, phoneCheckout);
    },
    async payuCheckout(merchant, txnid, mode) {
      const row = (await store.list(merchant)).find((r) => r.gateway?.txnid === txnid && r.gateway.mode === mode && r.gateway.prepared);
      if (!row) fail(404, "Unknown PayU checkout");
      return row;
    },
    async customerPayUCheckout(actor, ref, mode) {
      requireRole(actor, "customer");
      if (typeof ref !== "string") fail(400, "Checkout reference required");
      const row = await store.get(actor.merchant, ref);
      if (!row || row.owner !== actor.user || row.gateway?.mode !== mode || !row.gateway.prepared)
        fail(404, "No PayU payment has been started for this checkout");
      return row;
    },
    confirmPayU(row, providerPaymentId) {
      return confirm({ merchant: row.merchant, role: "gateway" }, { ref: row.ref },
        { txnid: row.gateway.txnid, providerPaymentId });
    },
    async fulfil(actor, { ref, stage }) {
      requireRole(actor, "merchant");
      return mutate(actor, ref, (r) => {
        if (!r.order) fail(404, "Order not found");
        const step = stages.indexOf(stage),
          current = stages.indexOf(r.order.stage);
        if (step <= 0) fail(400, "Unknown fulfilment step");
        if (step <= current) return false;
        if (step !== current + 1)
          fail(409, "Complete the previous fulfilment step first");
        const event = {
          id: randomUUID(),
          time: now(),
          stage,
          actor: actor.user,
          order: r.order.id,
          payment: r.payment,
        };
        r.order.stage = stage;
        r.order.events.push(event);
        if (stage === "Delivered") {
          record(r, "delivery", event.id);
          r.case.history.at(-1).text =
            r.method === "Pickup"
              ? "Merchant confirmed collection"
              : "Merchant confirmed delivery";
        } else {
          r.case.version++;
          r.case.history.push({
            time: event.time,
            version: r.case.version,
            evidence: event.id,
            text: "Order " + stage.toLowerCase() + " · " + actor.user,
            rule: "commerce/1",
          });
        }
        return true;
      }).then(() => ({ ref, stage }));
    },
    async decide(actor, body) {
      requireRole(actor, "analyst");
      await mutate(actor, body.ref, (r) => {
        if (!r.case) fail(404, "Case unavailable");
        try {
          r.case = review(r.case, body);
        } catch (e) {
          fail(409, e.message);
        }
        r.case.history.at(-1).actor = actor.user;
        return true;
      });
      return { saved: true };
    },
    // Only called by the integration fixture, never exposed as an HTTP operation.
    fixtureCredit: (merchant, ref) =>
      mutate({ role: "fixture", merchant }, ref, credit),
    async read(actor) {
      const rows = (await store.list(actor.merchant)).filter(
        (r) => r.confirmed,
      );
      if (actor.role === "analyst")
        return {
          cases: rows.sort((a, b) => b.confirmed.localeCompare(a.confirmed)).map(analystCase),
        };
      if (actor.role === "merchant")
        return { orders: rows.filter((r) => r.order).map((r) => r.order) };
      requireRole(actor, "customer");
      const mine = rows.filter((r) => r.owner === actor.user),
        ledger = mine.flatMap((r) => (r.ledger ? [r.ledger] : []));
      return {
        orders: mine.flatMap((r) => (r.order ? [r.order] : [])),
        ledger,
        balance: ledger.reduce((sum, e) => sum + e.amount, 0),
      };
    },
  };
}
