import { randomUUID } from "node:crypto";
import { append, review, validate } from "./exhibition.mjs";
import { commerceFinding } from "../frontend/src/review-policy.js";
export const merchantId = "SRB-2041";
export const price = 50000;
const now = () => new Date().toISOString();
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
function record(r, kind, id = randomUUID(), observation) {
  const event = observation || {
    id,
    ref: r.ref,
    payment: r.payment,
    merchant: r.merchant,
    amount: price,
    currency: "INR",
    kind,
    time: now(),
  };
  r.case = append(r.case, event);
  r.case.rule = "commerce/1";
  const added = r.case.records.at(-1);
  added.source = descriptions[kind];
  for (const n of r.case.nodes) {
    if (n.key === "merchant" || n.key === "profile") {
      n.source = "Configured merchant profile " + r.merchant;
      n.event = { ...n.event, id: r.profile.id, time: r.profile.captured };
    } else n.source = descriptions[n.event.kind];
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
  if (r.ledger) return false;
  r.ledger = {
    id: randomUUID(),
    payment: r.payment,
    ref: r.ref,
    owner: r.owner,
    amount: price,
    currency: "INR",
    posted: now(),
  };
  record(r, "credit", r.ledger.id);
  return true;
}
const stages = ["Placed", "Accepted", "Preparing", "Ready", "Delivered"];
export function commerce(store) {
  async function mutate(actor, ref, fn) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = await store.get(actor.merchant, ref);
      if (!r || (actor.role === "customer" && r.owner !== actor.user))
        fail(404, "Transaction not found");
      if (!fn(r)) return r;
      if (r.case)
        Object.assign(
          r.case,
          commerceFinding(r.case.records, r.order, r.unresolved),
        );
      r.version++;
      if (await store.save(r)) return r;
    }
    fail(409, "Concurrent change. Retry this operation.");
  }
  return {
    async intent(actor, { kind, method = "Delivery" }) {
      requireRole(actor, "customer");
      if (
        !["cake", "topup"].includes(kind) ||
        !["Delivery", "Pickup"].includes(method)
      )
        fail(400, "Invalid checkout");
      const r = {
        merchant: actor.merchant,
        ref: randomUUID(),
        payment: randomUUID(),
        kind,
        method,
        owner: actor.user,
        version: 1,
        created: now(),
      };
      if (!(await store.save(r))) fail(409, "Checkout conflict");
      return { ref: r.ref, payment: r.payment };
    },
    async pay(actor, { ref, observation }) {
      requireRole(actor, "customer");
      await mutate(actor, ref, (r) => {
        if (r.confirmed) return false;
        if (observation) {
          try {
            validate(observation);
          } catch {
            fail(400, "Invalid observer record");
          }
          if (
            observation.ref !== ref ||
            observation.payment !== r.payment ||
            observation.kind !== r.kind ||
            observation.label !==
              (r.kind === "cake"
                ? "Buy chocolate cake · ₹500"
                : "Top up demo wallet · ₹500")
          ) {
            r.unresolved = {
              record: observation,
              received: now(),
              reason:
                "The reported checkout reference, payment ID or visible action did not match this transaction.",
            };
          }
        }
        r.confirmed = now();
        r.profile = {
          id: randomUUID(),
          merchant: r.merchant,
          name: "Sunrise Bakery",
          business: "Bakery business",
          captured: r.confirmed,
        };
        record(r, "payment", r.payment);
        if (r.kind === "cake") {
          r.order = {
            id: randomUUID(),
            items: [{ name: "Chocolate cake", quantity: 1, unitAmount: price }],
            amount: price,
            payment: r.payment,
            ref: r.ref,
            method: r.method,
            stage: "Placed",
            events: [],
          };
          record(r, "order", r.order.id);
        }
        if (observation && !r.unresolved)
          record(r, r.kind, observation.id, observation);
        if (r.kind === "topup") credit(r);
        return true;
      });
      return { ref, confirmed: true };
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
          cases: rows.map((r) => ({
            ...r.case,
            ...commerceFinding(r.case.records, r.order, r.unresolved),
            unresolved: r.unresolved || null,
            fulfilment: r.order
              ? {
                  method: r.method,
                  stage: r.order.stage,
                  events: r.order.events,
                }
              : null,
          })),
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
