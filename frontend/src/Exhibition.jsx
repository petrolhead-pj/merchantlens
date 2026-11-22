import React, { useEffect, useRef, useState } from "react";
import "@fontsource-variable/instrument-sans";
import {
  Aperture, ArrowLeft, ArrowRight, CakeSlice, ChevronDown, GitFork,
  Radio, SlidersHorizontal, Truck, Wallet, X,
} from "lucide-react";
import { api, endpoint, newEvent, send, submitCheckout, useCaseFeed } from "./case-feed.js";
import { observeCheckout } from "./checkout-observer.js";
import { CaseTrace, findingFor } from "./CaseTrace.jsx";
import "./workbench.css";

const query = new URLSearchParams(location.search);
const offline = query.has("offline") ? "&offline" : "";
const presenterScenarios = [
  ["Unverified", "Run missing-evidence checkout"],
  ["Conflicting wallet credit", "Run conflicting wallet credit"],
];

function Checkout({ scenario, delay, busy, onCheckout, onClose, modal }) {
  const form = useRef(null);
  const observer = useRef(null);
  const [ref] = useState(() => crypto.randomUUID());
  const [payment] = useState(() => crypto.randomUUID());
  const wallet = scenario === "Wallet top-up";
  useEffect(() => observeCheckout(form.current, (click) => { observer.current = click; }), []);

  return (
    <section className="ml-shop" ref={form}>
      {wallet ? <div className="ml-wallet-art"><Wallet size={62} /><span>Test wallet</span></div>
        : <img src={import.meta.env.BASE_URL + "chocolate-cake.jpg"} alt="Chocolate layer cake with chocolate frosting" />}
      <div className="ml-shop-copy">
        {modal && <button className="ml-close" aria-label="Close checkout" onClick={onClose}><X size={19} /></button>}
        <span className="ml-kicker">Simulated checkout</span>
        <h1 id="ml-checkout-title">{wallet ? "Wallet top-up" : "Chocolate cake"}</h1>
        <p>{wallet ? "Add ₹500 in simulated funds to the test wallet." : "Chocolate sponge layered with cocoa frosting."}</p>
        <dl className="ml-total"><dt>Payment recipient</dt><dd>Sunrise Bakery</dd><dt>Total</dt><dd>₹500.00</dd></dl>
        <button className="ml-primary" data-ref={ref} data-payment={payment} disabled={busy}
          onClick={() => onCheckout({ scenario, delay, ref, payment, click: observer.current })}>
          {wallet ? "Top up demo wallet · ₹500" : "Buy chocolate cake · ₹500"}
        </button>
        <button className="ml-return" onClick={onClose}><ArrowLeft size={15} /> Back to workbench</button>
      </div>
    </section>
  );
}

export default function Exhibition({ onBack } = {}) {
  const Workbench = onBack ? "section" : "main";
  const standalone = !onBack && query.has("lab");
  const [draft, setDraft] = useState(standalone ? "Cake sale" : null);
  const [delay, setDelay] = useState(4);
  const [id, setId] = useState(query.get("case") || "");
  const [busy, setBusy] = useState(false);
  const [deliveryRequests, setDeliveryRequests] = useState({});
  const [message, setMessage] = useState("");
  const dialog = useRef(null);
  const { cases, state } = useCaseFeed();
  const current = id ? cases.find((entry) => entry.id === id) : cases[0];
  const paid = current?.nodes.find((record) => record.key === "payment")?.event;
  const canDeliver = findingFor(current).waiting === "delivery";
  const boardLink = current ? `?case=${current.id}${offline}` : offline ? "?offline" : "/";

  function closeCheckout() {
    if (standalone) location.href = boardLink;
    else dialog.current.close();
  }

  useEffect(() => {
    if (!standalone && draft && !dialog.current.open) dialog.current.showModal();
  }, [draft, standalone]);

  async function checkout({ scenario, delay, ref, payment, click }) {
    setBusy(true);
    setMessage("");
    try {
      await submitCheckout({ scenario, delay, ref, payment, click }, () => {
        setId(ref);
        if (!standalone && dialog.current.open) dialog.current.close();
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    const ref = paid.ref;
    setDeliveryRequests((requests) => ({ ...requests, [ref]: "Sending delivery…" }));
    setMessage("");
    try {
      await send(newEvent(paid, "delivery"));
      setDeliveryRequests((requests) => ({ ...requests, [ref]: "Waiting for delivery evidence…" }));
    } catch (error) {
      setMessage(error.message);
      setDeliveryRequests((requests) => ({ ...requests, [ref]: null }));
    }
  }

  const checkoutPanel = draft && <Checkout key={draft + (standalone ? id : "")}
    scenario={draft} delay={delay} busy={busy} onCheckout={checkout} modal={!standalone} onClose={closeCheckout} />;

  return (
    <Workbench className="ml-workbench">
      <header className="ml-header">
        <div className="ml-brand"><Aperture size={24} /><strong>MerchantLens</strong><span>Payment investigations</span></div>
        <div className="ml-header-end">
          <span className="ml-simulated">Simulated funds</span>
          {onBack ? <button onClick={onBack}>Back to investigation</button> : <a href="/">Seeded replay</a>}
        </div>
      </header>
      <div className="ml-shell">
        <div className="ml-tools">
          <div className="ml-actions" aria-label="Start a simulated checkout">
            <button className="ml-action ml-action-cake" disabled={busy} onClick={() => setDraft("Cake sale")}><CakeSlice size={18} /> Buy a ₹500 cake <ArrowRight size={16} /></button>
            <button className="ml-action" disabled={busy} onClick={() => setDraft("Wallet top-up")}><Wallet size={18} /> Top up a test wallet <ArrowRight size={16} /></button>
          </div>
          <div className="ml-secondary">
            <span className={`ml-feed ${state === "Connected" ? "online" : ""}`} role="status">
              <Radio size={15} /> {state === "Connected" ? (endpoint === "/api/cases" ? "Local feed" : "AWS feed") : state}
            </span>
            {state === "Feed interrupted" && endpoint !== "/api/cases" && <a href="?offline">Switch to local rehearsal</a>}
            <details className="ml-popover">
              <summary>Cases <b>{cases.length}</b> <ChevronDown size={13} /></summary>
              <div className="ml-popover-body ml-cases">
                {cases.length ? cases.map((entry) => {
                  const finding = findingFor(entry);
                  return <button key={entry.id} aria-current={current?.id === entry.id ? "true" : undefined}
                    onClick={(event) => {
                      setId(entry.id);
                      const menu = event.currentTarget.closest("details");
                      menu.open = false;
                      menu.querySelector("summary").focus();
                    }}>
                    <strong>{finding.title}</strong>
                    <small>{new Date(entry.records[0].received).toLocaleTimeString()} · {entry.id.slice(0, 6)}</small>
                  </button>;
                }) : <p>No cases received yet.</p>}
              </div>
            </details>
            <details className="ml-popover ml-presenter">
              <summary><SlidersHorizontal size={15} /> Presenter <ChevronDown size={13} /></summary>
              <div className="ml-popover-body">
                <label>Evidence delay (seconds)
                  <input type="number" min="0" max="60" value={delay}
                    onChange={(event) => setDelay(Math.min(60, Math.max(0, +event.target.value)))} />
                </label>
                {presenterScenarios.map(([scenario, label]) => <button key={scenario} disabled={busy} onClick={(event) => {
                  event.currentTarget.closest("details").open = false;
                  setDraft(scenario);
                }}>{label}</button>)}
                {paid && <button onClick={() => send(paid).then(() => setMessage("Duplicate acknowledged")).catch((error) => setMessage(error.message))}>Send duplicate confirmation</button>}
              </div>
            </details>
          </div>
        </div>
        {message && <p className="ml-notice" role="status">{message}</p>}
        {standalone && <div className="ml-standalone">{checkoutPanel}</div>}
        {current ? <CaseTrace key={current.id} c={current} api={api}
          delivery={canDeliver && paid && <button className="ml-deliver" disabled={!!deliveryRequests[paid.ref]} onClick={deliver}><Truck size={17} /> {deliveryRequests[paid.ref] || "Send simulated delivery"}</button>} />
          : <section className="ml-empty">
            <GitFork size={32} />
            <h1>{id ? "Waiting for this case" : "Trace a payment"}</h1>
            <p>{id ? "The workbench will open the case when the payment reaches the feed."
              : "Start a cake checkout or a test wallet top-up. Follow the ₹500 payment to Sunrise Bakery and see what the evidence supports."}</p>
          </section>}
      </div>
      {!standalone && <dialog className="ml-dialog" ref={dialog} aria-labelledby="ml-checkout-title" onClose={() => setDraft(null)}>
        {checkoutPanel}
        {draft && message && <p className="ml-notice" role="status">{message}</p>}
      </dialog>}
    </Workbench>
  );
}
