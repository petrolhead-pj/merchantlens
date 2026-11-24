import React, { useEffect, useRef, useState } from "react";
import {
  Network,
  ArrowUpRight,
  ChevronDown,
  Inbox,
  SlidersHorizontal,
  Wallet,
  CircleCheck,
} from "lucide-react";
import { Investigation } from "./Investigation.jsx";
import "./exhibition.css";
import { observeCheckout } from "./checkout-observer.js";
import { api, endpoint, submitCheckout } from "./exhibition-checkout.js";

const mode = endpoint === "/api/cases" ? "Local rehearsal" : "AWS feed";
const statuses = [
  "All cases",
  "Purpose mismatch — review",
  "Purpose unverified",
  "Cake sale supported",
];
const stamp = (t) => new Date(t).toLocaleTimeString();
const tone = (c) =>
  c.status === statuses[1]
    ? "conflict"
    : c.status === statuses[3]
      ? "verified"
      : "waiting";
function Lab() {
  const [scenario, setScenario] = useState("Cake sale"),
    [delay, setDelay] = useState(4),
    [run, setRun] = useState(null),
    [message, setMessage] = useState("Ready for checkout"),
    [busy, setBusy] = useState(false);
  const observer = useRef(null),
    form = useRef(null);
  useEffect(() => {
    return observeCheckout(form.current, (observation) => {
      observer.current = observation;
    });
  }, []);
  const [ref, setRef] = useState(() => crypto.randomUUID());
  const [payment, setPayment] = useState(() => crypto.randomUUID());
  async function checkout() {
    setBusy(true);
    try {
      await submitCheckout({ scenario, delay, ref, payment, click: observer.current }, (paid) => {
        setRun(paid);
        setMessage("Payment confirmed · waiting for evidence");
      });
      setMessage("Run received · inspect the workbench");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lab" ref={form}>
      <div className="shop">
        {scenario === "Wallet top-up" ? (
          <div className="wallet-art">
            <Wallet size={60} />
            <span>Demo wallet</span>
            <b>₹500</b>
            <small>Simulated credit</small>
          </div>
        ) : (
          <img
            className="product"
            src="/chocolate-cake.jpg"
            alt="Chocolate layer cake with chocolate frosting"
          />
        )}
        <div className="product-info">
          <small>
            {scenario === "Wallet top-up"
              ? "Fictional wallet"
              : "Sunrise Bakery"}
          </small>
          <h1>
            {scenario === "Wallet top-up" ? "Wallet top-up" : "Chocolate cake"}
          </h1>
          <p>
            {scenario === "Wallet top-up"
              ? "Add simulated funds to your demo wallet."
              : "Chocolate sponge layered with rich cocoa frosting."}
          </p>
          <div className="total">
            <span>Checkout total</span>
            <b>₹500.00</b>
          </div>
          <button
            data-ref={ref}
            data-payment={payment}
            disabled={busy || !!run}
            onClick={checkout}
          >
            {scenario === "Wallet top-up"
              ? "Top up demo wallet · ₹500"
              : "Buy chocolate cake · ₹500"}
          </button>
          <p className="checkout-state" role="status">
            {run && <CircleCheck />}
            {message}
          </p>
          {run && (
            <a
              href={`?case=${ref}${endpoint === "/api/cases" ? "&offline" : ""}`}
              target="_blank"
              rel="noreferrer"
            >
              Open matching workbench ↗
            </a>
          )}
          <footer>
            Paid to Sunrise Bakery · SRB-2041
            <br />
            Simulated funds
          </footer>
        </div>
      </div>
      <details className="presenter">
        <summary>
          <SlidersHorizontal /> Presenter controls <ChevronDown />
        </summary>
        <div>
          <label>
            Scenario
            <select
              value={scenario}
              disabled={busy || !!run}
              onChange={(e) => setScenario(e.target.value)}
            >
              {[
                "Cake sale",
                "Wallet top-up",
                "Conflicting wallet credit",
                "Unverified",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Evidence delay (seconds)
            <input
              type="number"
              min="0"
              max="60"
              value={delay}
              onChange={(e) =>
                setDelay(Math.min(60, Math.max(0, +e.target.value)))
              }
            />
          </label>
          {run && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  api("/provider", run)
                    .then(() => setMessage("Duplicate acknowledged"))
                    .catch((e) => setMessage(e.message))
                }
              >
                Send duplicate confirmation
              </button>
              {scenario === "Cake sale" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    api("/evidence", {
                      ...run,
                      id: crypto.randomUUID(),
                      kind: "delivery",
                      time: new Date().toISOString(),
                    })
                      .then(() => setMessage("Simulated delivery received"))
                      .catch((e) => setMessage(e.message))
                  }
                >
                  Send simulated delivery
                </button>
              )}
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setRun(null);
              setRef(crypto.randomUUID());
              setPayment(crypto.randomUUID());
              setMessage("Fresh checkout ready");
            }}
          >
            Reset demo
          </button>
        </div>
      </details>
    </section>
  );
}
export default function Exhibition() {
  const lab = new URLSearchParams(location.search).has("lab");
  const [cases, update] = useState([]),
    [state, feed] = useState("Connecting"),
    [id, choose] = useState(
      new URLSearchParams(location.search).get("case") || "",
    ),
    [filter, setFilter] = useState(statuses[0]);
  useEffect(() => {
    if (lab) return;
    let timer,
      active = true,
      delay = 800;
    async function poll() {
      if (!document.hidden)
        try {
          const list = await api();
          if (active) {
            update(list);
            feed("Connected");
            delay = 800;
          }
        } catch {
          if (active) {
            feed("Feed stale");
            delay = Math.min(10000, delay * 2);
          }
        }
      if (active) timer = setTimeout(poll, delay);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lab]);
  const list = cases.filter(
      (c) => filter === statuses[0] || c.status === filter,
    ),
    c =
      list.find((c) => c.id === id) ||
      (id && new URLSearchParams(location.search).get("case") === id
        ? undefined
        : list[0]);
  return (
    <main className="exhibit">
      <header>
        <Network className="brand-icon" aria-hidden="true" />
        <strong>MerchantLens</strong>
        <span className="mode-tag">{mode} · Simulated funds</span>
        <a
          href={lab ? (endpoint === "/api/cases" ? "?offline" : "?exhibition") : (endpoint === "/api/cases" ? "?lab&offline" : "?lab")}
          target="_blank"
          rel="noreferrer"
        >
          {lab ? "Workbench" : "Demo Lab"} <ArrowUpRight size={14}/>
        </a>
        <a href="?seed">Seeded replay</a>
      </header>
      {lab ? (
        <Lab />
      ) : (
        <>
          <div className="heading">
            <div>
              <small>
                Investigations / {c ? "Payment detail" : "Workbench"}
              </small>
              <h1>{c ? "Sunrise Bakery" : "Payment investigations"}</h1>
            </div>
            <span role="status">
              {state}{" "}
              {state === "Feed stale" && (
                <a href="?offline">Open offline rehearsal</a>
              )}
            </span>
          </div>
          <div className="workgrid">
            <nav aria-label="Case queue">
              <h2>
                Case queue <em>{list.length}</em>
              </h2>
              <select
                aria-label="Filter cases"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {list.map((r) => (
                <button
                  aria-current={c?.id === r.id ? "true" : undefined}
                  className={c?.id === r.id ? "active" : ""}
                  key={r.id}
                  onClick={() => choose(r.id)}
                >
                  <b>
                    Sunrise Bakery <span>₹500</span>
                  </b>
                  <small>
                    {stamp(r.records[0].received)} · {r.id.slice(0, 6)}
                  </small>
                  <span className={"badge " + tone(r)}>
                    {
                      {
                        conflict: "!  Mismatch",
                        verified: "✓  Supported",
                        waiting: "◷  Unverified",
                      }[tone(r)]
                    }
                  </span>
                </button>
              ))}
            </nav>
            {c ? (
              <Investigation key={c.id} c={c} api={api} />
            ) : (
              <section className="empty">
                <Inbox size={38} aria-hidden="true"/>
                <h2>
                  {state === "Connecting"
                    ? "Loading cases…"
                    : state === "Feed stale" ? "Waiting for the feed to reconnect" : cases.length
                      ? "No matching cases"
                      : "Awaiting the first payment"}
                </h2>
                <p>{state === "Connecting" ? "Retrieving payment evidence…" : cases.length ? "Choose another case filter or start a fresh checkout." : "Make a simulated ₹500 purchase to trace its recipient and checkout evidence."}</p>
                <a
                  href={endpoint === "/api/cases" ? "?lab&offline" : "?lab"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open checkout ↗
                </a>
              </section>
            )}
          </div>
        </>
      )}
    </main>
  );
}
