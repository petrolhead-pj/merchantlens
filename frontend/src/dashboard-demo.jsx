import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Link2, Store, X } from "lucide-react";
import { findingFor, recordInfo, relationship } from "./case-evidence.js";
import { api, newEvent, send, submitCheckout, useCaseFeed } from "./case-feed.js";
import { observeCheckout } from "./checkout-observer.js";

const positions = {
  storefront: [78, 324], cake: [208, 260], topup: [208, 260],
  order: [385, 310], delivery: [590, 310], payment: [380, 145],
  merchant: [590, 145], profile: [740, 247], credit: [177, 73],
  refund: [370, 54],
};

const tone = { conflict: "risk", supported: "safe", pending: "unknown" };

export function caseGraph(entry) {
  const nodes = (entry?.nodes || []).map(record => {
    const { key } = record;
    const [name, sub] = recordInfo(entry, key);
    const [x, y] = positions[key] || [700, 55];
    const type = ["topup", "credit"].includes(key) ? "risk"
      : ["cake", "delivery"].includes(key) ? "safe"
        : key === "order" && !entry.nodes.some(node => node.key === "cake") ? "unknown" : "neutral";
    return {
      id: key, name: key === "payment" ? name + " payment" : name, sub, type,
      kind: key === "merchant" ? "merchant" : ["order", "delivery"].includes(key) ? "evidence" : "checkout",
      coords: [x, y],
      pos: [(x - 410) / 62, (210 - y) / 54, key === "payment" ? 1 : 0],
    };
  });
  const types = Object.fromEntries(nodes.map(node => [node.id, node.type]));
  return {
    nodes,
    edges: (entry?.edges || []).map(edge => [edge.from, edge.to, types[edge.to]]),
  };
}

export function useDashboardDemo(enabled) {
  const { cases, state } = useCaseFeed(enabled);
  const [id, setId] = useState(() => new URLSearchParams(location.search).get("case") || "");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(2);
  const entry = cases.find(item => item.id === id);
  const sandbox = Boolean(entry?.sandbox || (id && !entry && new URLSearchParams(location.search).has("payu")));
  const payment = entry?.nodes.find(node => node.key === "payment")?.event;
  const finding = findingFor(entry);
  const type = tone[finding.tone] || "unknown";

  async function run(checkout) {
    setBusy(true);
    setMessage("");
    try {
      await submitCheckout(checkout, () => {
        setId(checkout.ref);
        setDraft("");
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function perform(action) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return {
    cases, state, id, setId, draft, setDraft, busy, message, delay, setDelay,
    entry, finding, type, payment, run, sandbox,
    deliver: finding.waiting === "delivery" && payment
      ? () => perform(() => send(newEvent(payment, "delivery"))) : undefined,
    duplicate: payment && !sandbox && (() => perform(async () => {
      await send(payment);
      setMessage("Duplicate acknowledged. Payment count is unchanged.");
    })),
    review: action => perform(() => api("/review", { ref: entry.id, version: entry.version, action })),
  };
}

export function DemoControls({ demo, choose, onReplay }) {
  return (
    <div className="dashboard-demo-controls">
      <div className="dashboard-demo-actions">
        <button className="primary" disabled={demo.busy} onClick={() => demo.setDraft("Cake sale")}>Buy a ₹500 cake</button>
        <button className="secondary" disabled={demo.busy} onClick={() => demo.setDraft("Wallet top-up")}>Top up a test wallet</button>
        <a href="/betting-demo" target="_blank" rel="noopener">Open test betting page</a>
        <button className="secondary" onClick={onReplay}>Back to seeded replay</button>
      </div>
      <div className="dashboard-demo-actions">
        <label>Checkout case
          <select value={demo.id} onChange={event => choose(event.target.value)}>
            <option value="">Select a case</option>
            {demo.id && !demo.entry && <option value={demo.id}>Awaiting confirmation</option>}
            {demo.cases.map(entry => <option key={entry.id} value={entry.id}>
              {findingFor(entry).title} · {entry.id.slice(0, 6)}
            </option>)}
          </select>
        </label>
        <details className="dashboard-presenter">
          <summary>Presenter controls</summary>
          <label>Evidence delay (seconds)
            <input type="number" min="0" max="60" value={demo.delay}
              onChange={event => demo.setDelay(Math.min(60, Math.max(0, +event.target.value)))} />
          </label>
          <button className="secondary" disabled={demo.busy} onClick={() => demo.setDraft("Unverified")}>Run missing-evidence checkout</button>
          <button className="secondary" disabled={demo.busy} onClick={() => demo.setDraft("Conflicting wallet credit")}>Run conflicting wallet credit</button>
          {demo.duplicate && <button className="secondary" disabled={demo.busy} onClick={demo.duplicate}>Send duplicate confirmation</button>}
        </details>
      </div>
      <p role="status">{demo.message || (demo.state === "Connected"
        ? demo.sandbox ? demo.entry ? "PayU sandbox · Test payment verified" : "Waiting for PayU sandbox verification" : "Connected · Simulated funds"
        : demo.state)}</p>
    </div>
  );
}

export function DemoCheckout({ demo }) {
  const dialog = useRef(null);
  const observation = useRef(null);
  const [ref] = useState(() => crypto.randomUUID());
  const [payment] = useState(() => crypto.randomUUID());
  const wallet = demo.draft === "Wallet top-up";

  useEffect(() => {
    dialog.current.showModal();
    return observeCheckout(dialog.current, value => { observation.current = value; });
  }, []);

  return (
    <dialog ref={dialog} className="modal dashboard-checkout" aria-labelledby="dashboard-checkout-title"
      onCancel={event => { if (demo.busy) event.preventDefault(); }}
      onClose={() => demo.setDraft("")}>
      <div className="section-heading">
        <h3>Simulated checkout</h3>
        <button className="icon-btn" aria-label="Close checkout" disabled={demo.busy} onClick={() => dialog.current.close()}><X size={20} /></button>
      </div>
      <h2 id="dashboard-checkout-title">{wallet ? "Test wallet" : "Chocolate cake"}</h2>
      {!wallet && <img src={import.meta.env.BASE_URL + "chocolate-cake.jpg"} alt="Chocolate layer cake with chocolate frosting" />}
      <dl><dt>Payment recipient</dt><dd>Sunrise Bakery</dd><dt>Total</dt><dd>₹500</dd></dl>
      {demo.message && <p role="status">{demo.message}</p>}
      <button className="primary" data-ref={ref} data-payment={payment} disabled={demo.busy}
        onClick={() => demo.run({ scenario: demo.draft, delay: demo.delay, ref, payment, click: observation.current })}>
        {wallet ? "Top up demo wallet · ₹500" : "Buy chocolate cake · ₹500"}
      </button>
    </dialog>
  );
}

export function DemoInspector({ demo, selected, onSelect }) {
  const { entry, finding, type } = demo;
  const record = entry?.nodes.find(node => node.key === selected);
  const edge = entry?.edges.find(link => link.to === selected);
  const [name, source, Icon] = record ? recordInfo(entry, selected) : ["Sunrise Bakery", "Case finding", Store];
  return (
    <section className="evidence-panel">
      <div className="panel-heading"><span>Entity inspector</span><span className="tiny-label">{source}</span></div>
      <div className="inspector-content">
        <div className={"entity-avatar " + type}><Icon size={25} /></div>
        <h2>{name}</h2>
        <p className="inspector-description" aria-live="polite"><strong>{finding.title || "Awaiting checkout"}</strong></p>
        <p className="inspector-description">{finding.reason || "Start a simulated checkout to see its evidence here."}</p>
        {record && <dl className="dashboard-record">
          <dt>Source</dt><dd>{record.source}</dd>
          <dt>Checkout reference</dt><dd>{record.event.ref}</dd>
          <dt>Payment ID</dt><dd>{record.event.payment}</dd>
          {entry.sandbox && <><dt>PayU transaction ID</dt><dd>{entry.sandbox.txnid}</dd>
            <dt>PayU reference</dt><dd>{entry.sandbox.providerId}</dd></>}
          <dt>Evidence ID</dt><dd>{record.event.id}</dd>
          <dt>Event time</dt><dd>{new Date(record.event.time).toLocaleString()}</dd>
          {edge && <><dt>{relationship(entry, edge)[0]}</dt><dd>{relationship(entry, edge)[1]}</dd></>}
        </dl>}
        {finding.driver && selected !== finding.driver && <button className="secondary" onClick={() => onSelect(finding.driver)}><Link2 size={16} /> Inspect matching evidence</button>}
        {demo.deliver && <button className="primary" disabled={demo.busy} onClick={demo.deliver}>Send simulated delivery</button>}
      </div>
    </section>
  );
}

export function DemoTimeline({ demo, onSelect }) {
  return (
    <section className="timeline panel">
      <div className="section-heading"><h3>Evidence timeline</h3><span className="tiny-label">EVENT TIME</span></div>
      {demo.entry?.records.map(record => {
        const [name, source] = recordInfo(demo.entry, record.event.kind);
        return <button className="timeline-row dashboard-timeline-row" key={record.event.id}
          onClick={() => onSelect(record.event.kind)}>
          <time>{new Date(record.event.time).toLocaleTimeString()}</time>
          <i /><div><strong>{name}</strong><small>{source}</small></div><ChevronRight size={14} />
        </button>;
      })}
      {!demo.entry && <p>Events appear here as the case feed receives them.</p>}
    </section>
  );
}
