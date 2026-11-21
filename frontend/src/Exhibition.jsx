import React, { useEffect, useRef, useState } from "react";
import "./exhibition.css";
import { observeCheckout } from "./checkout-observer.js";

const endpoint = new URLSearchParams(location.search).has("offline")
  ? "/api/cases"
  : import.meta.env.VITE_CASE_API || "/api/cases";
const mode = endpoint === "/api/cases" ? "Local rehearsal" : "AWS feed";
async function api(path = "", body) {
  const response = await fetch(endpoint + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    credentials: "same-origin",
    signal: AbortSignal.timeout(8000),
    body: body && JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Feed unavailable");
  return value;
}
const labels = {
  storefront: "Checkout page",
  payment: "₹500 payment",
  cake: "Cake checkout",
  topup: "Wallet top-up",
  order: "Chocolate cake",
  delivery: "Cake delivered",
  credit: "Wallet credited",
  refund: "Refund issued",
  merchant: "Sunrise Bakery",
  profile: "Bakery business",
};
const relations = {
  storefront: "observed on",
  cake: "matched by reference",
  topup: "matched by reference",
  order: "merchant reports",
  delivery: "delivery for order",
  credit: "credited wallet",
  refund: "refund for",
  merchant: "paid to",
  profile: "declares",
};
const positions = {
  storefront: [115, 25],
  cake: [115, 95],
  topup: [115, 95],
  order: [115, 245],
  payment: [330, 164],
  merchant: [545, 95],
  profile: [545, 245],
  credit: [330, 325],
  delivery: [115, 375],
  refund: [330, 42],
};
const statuses = [
  "All cases",
  "Purpose mismatch — review",
  "Purpose unverified",
  "Cake sale supported",
];
const stamp = (t) => new Date(t).toLocaleTimeString();
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
  const send = (e) => api(e.kind === "payment" ? "/provider" : "/evidence", e);
  async function checkout() {
    setBusy(true);
    const base = {
      ref,
      payment,
      amount: 50000,
      currency: "INR",
      merchant: "SRB-2041",
    };
    const event = (kind, time = new Date().toISOString()) => ({
      ...base,
      id: crypto.randomUUID(),
      kind,
      time,
    });
    const paid = event("payment"),
      click = observer.current;
    try {
      await send(paid);
      setRun(paid);
      setMessage("Payment confirmed · waiting for evidence");
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      if (scenario !== "Wallet top-up") await send(event("order"));
      if (scenario !== "Unverified" && click?.ref === ref) await send(click);
      if (scenario === "Conflicting wallet credit") await send(event("credit"));
      setMessage("Run received · inspect the workbench");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lab" ref={form}>
      <small>DEMO LAB / SIMULATED FUNDS</small>
      <h1>Checkout counter</h1>
      <p>Both checkouts pay Sunrise Bakery · SRB-2041.</p>
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
          onChange={(e) => setDelay(Math.min(60, Math.max(0, +e.target.value)))}
        />
      </label>
      <h2>
        {scenario === "Wallet top-up" ? "Fictional wallet" : "Sunrise Bakery"}
      </h2>
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
      <p role="status">{message}</p>
      {run && (
        <>
          <button
            disabled={busy}
            onClick={() =>
              send(run)
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
                send({
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
    </section>
  );
}
function Evidence({ c }) {
  const [selected, select] = useState("payment"),
    [zoom, scale] = useState(1),
    [pan, move] = useState([0, 0]),
    [timeline, toggle] = useState(false),
    [msg, notice] = useState("");
  const drag = useRef(null);
  const rows = c.records.map((r) => ({ ...r, key: r.event.kind })),
    paid = rows.find((r) => r.key === "payment");
  const { nodes, edges } = c;
  const key = selected.replace("edge/", ""),
    record = nodes.find((n) => n.key === key) || paid;
  const details = (
    <ol>
      {c.history.map((h) => (
        <li key={h.version}>
          {h.text}
          <small>
            {stamp(h.time)} · v{h.version}
          </small>
        </li>
      ))}
    </ol>
  );
  function fit() {
    scale(1);
    move([0, 0]);
  }
  return (
    <>
      <section className="canvas">
        <div className="rail">
          <h2>{timeline ? "Evidence timeline" : "Evidence graph"}</h2>
          <button onClick={() => toggle(!timeline)}>
            {timeline ? "Graph" : "Timeline"}
          </button>
        </div>
        <p>
          Sunrise Bakery <span> / ₹500.00 INR</span>
        </p>
        {timeline ? (
          details
        ) : (
          <svg
            viewBox="0 0 660 430"
            aria-label="Payment evidence graph"
            onPointerDown={(e) => {
              if (e.target.tagName === "svg") {
                drag.current = [e.clientX, e.clientY, ...pan];
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                const [x, y, a, b] = drag.current,
                  k = 660 / e.currentTarget.clientWidth;
                move([a + (e.clientX - x) * k, b + (e.clientY - y) * k]);
              }
            }}
            onPointerUp={() => (drag.current = null)}
          >
            <g
              transform={`translate(${330 + pan[0]} ${215 + pan[1]}) scale(${zoom}) translate(-330 -215)`}
            >
              {edges.map(({ from, to }) => {
                const [x, y] = positions[from],
                  [a, b] = positions[to];
                return (
                  <g
                    key={to}
                    role="button"
                    tabIndex="0"
                    aria-label={relations[to]}
                    onKeyDown={(e) => e.key === "Enter" && select("edge/" + to)}
                    onClick={() => select("edge/" + to)}
                  >
                    <line
                      className={
                        ["credit", "topup"].includes(to)
                          ? "conflicting"
                          : c.status === statuses[1] &&
                              ["merchant", "profile", "order"].includes(to)
                            ? "related"
                            : ""
                      }
                      x1={x}
                      y1={y}
                      x2={a}
                      y2={b}
                    />
                    <text x={(x + a) / 2} y={(y + b) / 2 - 5}>
                      {relations[to]}
                    </text>
                  </g>
                );
              })}
              {nodes.map((n) => {
                const [x, y] = positions[n.key];
                return (
                  <g
                    key={n.key}
                    role="button"
                    tabIndex="0"
                    onClick={() => select(n.key)}
                    onKeyDown={(e) => e.key === "Enter" && select(n.key)}
                    transform={`translate(${x} ${y})`}
                  >
                    <title>{n.event.label || labels[n.key]}</title>
                    <rect
                      className={
                        n.key === key
                          ? "chosen"
                          : ["topup", "credit"].includes(n.key)
                            ? "conflict"
                            : ""
                      }
                      x="-70"
                      y="-21"
                      width="140"
                      height="42"
                      rx="7"
                    />
                    <text y="5">{labels[n.key]}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        <div className="rail">
          <button onClick={() => scale(Math.max(0.6, zoom - 0.2))}>−</button>
          <button onClick={() => scale(Math.min(2, zoom + 0.2))}>+</button>
          <button onClick={fit}>Fit view</button>
          <button
            onClick={() => {
              toggle(false);
              fit();
              select(
                "edge/" +
                  (nodes.find((n) =>
                    ["credit", "topup", "delivery"].includes(n.key),
                  )?.key || "merchant"),
              );
            }}
          >
            Explain this flag
          </button>
        </div>
        <details>
          <summary>Relationship list</summary>
          {edges.map((e) => (
            <button key={e.to} onClick={() => select("edge/" + e.to)}>
              {labels[e.from]} · {relations[e.to]} · {labels[e.to]}
            </button>
          ))}
        </details>
      </section>
      <aside data-case={c.id} data-version={c.version}>
        <small>CASE INSPECTOR</small>
        <h2
          className={
            c.status === statuses[1]
              ? "warn"
              : c.status === statuses[2]
                ? "pending"
                : "supported"
          }
        >
          {c.status}
        </h2>
        <p aria-live="polite">{c.why}</p>
        <hr />
        <h3>{selected.startsWith("edge/") ? relations[key] : labels[key]}</h3>
        <dl>
          {Object.entries({
            Source: record.source,
            ...(record.event.label
              ? { "Observed button": record.event.label }
              : {}),
            "Record IDs": selected.startsWith("edge/")
              ? edges.find((e) => e.to === key)?.evidenceIds.join(" / ")
              : record.event.id,
            "Checkout reference": c.id,
            "Payment ID": paid.event.payment,
            "Event time": stamp(record.event.time),
            "Received time": stamp(record.received),
          }).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <hr />
        <strong>{c.outcome}</strong>
        <div>
          {["Request evidence", "Escalate", "Record supported outcome"].map(
            (action) => (
              <button
                key={action}
                disabled={
                  action.startsWith("Record") && c.status !== statuses[3]
                }
                onClick={() =>
                  api("/review", { ref: c.id, version: c.version, action })
                    .then(() => notice("Decision saved"))
                    .catch((e) => notice(e.message))
                }
              >
                {action}
              </button>
            ),
          )}
        </div>
        <p role="status">{msg}</p>
        <details>
          <summary>Case history</summary>
          {details}
        </details>
      </aside>
    </>
  );
}
export default function Exhibition() {
  const lab = new URLSearchParams(location.search).has("lab");
  const [cases, update] = useState([]),
    [state, feed] = useState("Connecting"),
    [id, choose] = useState(""),
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
    c = list.find((c) => c.id === id) || list[0];
  return (
    <main className="exhibit">
      <header>
        <strong>MerchantLens</strong>
        <span>{mode} · Simulated payments</span>
        <a
          href={endpoint === "/api/cases" ? "?lab&offline" : "?lab"}
          target="_blank"
          rel="noreferrer"
        >
          Demo Lab ↗
        </a>
        <a href="?seed">Seeded replay</a>
      </header>
      {lab ? (
        <Lab />
      ) : (
        <>
          <div className="heading">
            <small>PAYMENT RISK OPERATIONS</small>
            <h1>Case workbench</h1>
            <span role="status">
              {state}{" "}
              {state === "Feed stale" && (
                <a href="?offline">Open offline rehearsal</a>
              )}
            </span>
          </div>
          <div className="workgrid">
            <nav>
              <h2>Cases</h2>
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
                  className={c?.id === r.id ? "active" : ""}
                  key={r.id}
                  onClick={() => choose(r.id)}
                >
                  <b>Sunrise Bakery · ₹500</b>
                  <small>
                    {stamp(r.records[0].received)} · {r.id.slice(0, 6)}
                  </small>
                  {r.status}
                </button>
              ))}
            </nav>
            {c ? (
              <Evidence key={c.id} c={c} />
            ) : (
              <section className="empty">
                <h2>
                  {state === "Connecting"
                    ? "Loading cases…"
                    : "No matching cases"}
                </h2>
                <p>Open the Demo Lab and make a simulated ₹500 purchase.</p>
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
