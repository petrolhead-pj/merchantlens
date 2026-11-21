import { isDeepStrictEqual } from "node:util";
import { checkoutVerdict } from "../frontend/src/review-policy.js";

export const titles = {
  payment: "Payment confirmed",
  cake: "Buy chocolate cake",
  topup: "Top up demo wallet",
  order: "Chocolate cake",
  delivery: "Cake delivered",
  credit: "Wallet credited",
  refund: "Payment refunded",
};
const sources = {
  payment: "Simulated provider",
  refund: "Simulated provider",
  cake: "Browser click observer",
  topup: "Browser click observer",
  order: "Merchant order system",
  delivery: "Simulated courier",
  credit: "Simulated wallet ledger",
};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function validate(e) {
  const fields = [
    "kind",
    "ref",
    "payment",
    "id",
    "merchant",
    "amount",
    "currency",
    "time",
    "label",
  ];
  if (
    !e ||
    Object.keys(e).some((k) => !fields.includes(k)) ||
    typeof e.time !== "string" ||
    e.time.length > 35 ||
    (e.label !== undefined &&
      (typeof e.label !== "string" || e.label.length > 80))
  )
    throw Error("Invalid event fields");
  if (
    !e ||
    !Object.hasOwn(titles, e.kind) ||
    ![e.id, e.ref, e.payment].every(
      (v) => typeof v === "string" && uuid.test(v),
    ) ||
    e.merchant !== "SRB-2041" ||
    e.amount !== 50000 ||
    e.currency !== "INR" ||
    !Number.isFinite(Date.parse(e.time)) ||
    Date.parse(e.time) > Date.now() + 30000
  )
    throw Error("Invalid record identity, merchant, amount or event time");
}
export function append(previous, e, received = new Date().toISOString()) {
  validate(e);
  const c = previous ?? {
    id: e.ref,
    version: 0,
    records: [],
    history: [],
    outcome: "Open",
  };
  const duplicate = c.records.find(
    (r) => r.source === sources[e.kind] && r.event.id === e.id,
  );
  if (duplicate) {
    if (!isDeepStrictEqual(duplicate.event, e))
      throw Error("Conflicting event identity");
    return c;
  }
  if (
    c.records.some(
      (r) => r.event.payment !== e.payment || r.event.ref !== e.ref,
    )
  )
    throw Error("Payment reference conflict");
  if (e.kind === "payment" && c.records.some((r) => r.event.kind === "payment"))
    return c;
  const records = [
    ...c.records,
    { source: sources[e.kind], event: e, received },
  ];
  const verdict = checkoutVerdict(records.map((r) => r.event.kind));
  const reopened =
    c.outcome !== "Open" &&
    verdict.status === "Purpose mismatch — review" &&
    verdict.status !== c.status;
  const history = [
    ...c.history,
    {
      time: received,
      text: (reopened ? "Reopened · " : "") + titles[e.kind],
      evidence: e.id,
      status: verdict.status,
      outcome: reopened ? "Open" : c.outcome,
      rule: "checkout/1",
      version: c.version + 1,
    },
  ];
  const nodes = Object.fromEntries(
    records.map((r) => [r.event.kind, { ...r, key: r.event.kind }]),
  );
  const edges = [];
  if (nodes.payment) {
    for (const key of ["merchant", "profile"])
      nodes[key] = {
        ...nodes.payment,
        key,
        source: "Demo merchant registry · SRB-2041",
      };
    const click = nodes.cake || nodes.topup;
    if (click) nodes.storefront = { ...click, key: "storefront" };
    for (const key of Object.keys(nodes).filter((key) => key !== "payment")) {
      const from =
        key === "profile"
          ? "merchant"
          : key === "storefront"
            ? click.key
            : key === "delivery" && nodes.order
              ? "order"
              : "payment";
      edges.push({
        from,
        to: key,
        evidenceIds: [...new Set([nodes[from].event.id, nodes[key].event.id])],
        ref: e.ref,
      });
    }
  }
  return {
    ...c,
    ...verdict,
    rule: "checkout/1",
    paymentState: nodes.refund
      ? "Refunded"
      : nodes.payment
        ? "Confirmed"
        : "Pending",
    evidenceIds: records.map((r) => r.event.id),
    nodes: Object.values(nodes),
    edges,
    version: c.version + 1,
    records,
    history,
    outcome: reopened ? "Open" : c.outcome,
  };
}
export function review(c, { version, action }) {
  if (!c || version !== c.version)
    throw Error("Case changed. Read the latest evidence.");
  if (
    !["Request evidence", "Escalate", "Record supported outcome"].includes(
      action,
    ) ||
    (action === "Record supported outcome" &&
      c.status !== "Cake sale supported")
  )
    throw Error("Unsupported decision");
  return {
    ...c,
    outcome: action,
    version: version + 1,
    history: [
      ...c.history,
      {
        time: new Date().toISOString(),
        text: action,
        version: version + 1,
        evidence: c.records.map((r) => r.event.id),
      },
    ],
  };
}
export function localCases() {
  const cases = new Map(),
    identities = new Map(),
    payments = new Map();
  return async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/api/cases") {
        res.end(
          JSON.stringify(
            [...cases.values()]
              .filter((c) => c.records.some((r) => r.event.kind === "payment"))
              .reverse(),
          ),
        );
        return;
      }
      if (
        req.method !== "POST" ||
        req.headers["content-type"] !== "application/json"
      )
        throw Error("Expected JSON POST");
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8192) throw Error("Record too large");
      }
      const e = JSON.parse(raw);
      if (req.url === "/api/cases/review") {
        cases.set(e.ref, review(cases.get(e.ref), e));
      } else {
        validate(e);
        const provider = ["payment", "refund"].includes(e.kind);
        if (
          req.url !== (provider ? "/api/cases/provider" : "/api/cases/evidence")
        )
          throw Error("Wrong source route");
        const identity = sources[e.kind] + e.id;
        if (
          (identities.has(identity) && !isDeepStrictEqual(identities.get(identity),e)) ||
          (payments.has(e.payment) && payments.get(e.payment) !== e.ref)
        )
          throw Error("Conflicting scoped identifier");
        cases.set(e.ref, append(cases.get(e.ref), e));
        identities.set(identity, e);
        payments.set(e.payment, e.ref);
      }
      res.end('{"accepted":true}');
    } catch (error) {
      res.writeHead(409);
      res.end(JSON.stringify({ error: error.message }));
    }
  };
}
