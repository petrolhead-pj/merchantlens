import React, { useState, useEffect, useRef } from "react";
import { Aperture, ShoppingBag, Wallet, ArrowRight } from "lucide-react";
import "@fontsource-variable/instrument-sans";
import "./exhibition.css";
import "./product.css";
import { observeCheckout } from "./checkout-observer.js";
import { Investigation } from "./Investigation.jsx";

const areas = {
  customer: "Customer",
  merchant: "Merchant operations",
  analyst: "Analyst workbench",
};
const role = Object.hasOwn(areas, location.pathname.slice(1))
  ? location.pathname.slice(1)
  : "customer";
const money = (n) => "₹" + (n / 100).toLocaleString("en-IN");
async function request(op, body) {
  const response = await fetch("/api/app/" + role + "/" + op, {
    method: body ? "POST" : "GET",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(Error(result.error), { status: response.status });
  return result;
}
function Login({ run }) {
  return (
    <form
      className="login"
      onSubmit={(e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        run(() => request("login", Object.fromEntries(fields)), "Signed in");
      }}
    >
      <small>{areas[role]}</small>
      <h1>Welcome back</h1>
      <label>
        Account
        <input name="user" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button>Sign in</button>
    </form>
  );
}
function Customer({ state, run, busy }) {
  const [mode, choose] = useState("cake"),
    [method, setMethod] = useState("Delivery");
  const storage = "checkout-" + state.user;
  const [intent, setIntent] = useState(() =>
    JSON.parse(sessionStorage.getItem(storage) || "null"),
  );
  const root = useRef(null),
    observed = useRef(null);
  const [consent, setConsent] = useState(true);
  useEffect(() => {
    observed.current = null;
    if (consent)
      return observeCheckout(root.current, (x) => {
        observed.current = x;
      });
  }, [consent]);
  const kind = intent?.kind || mode;
  async function checkout() {
    if (!intent) {
      const refs = await request("checkout", { kind, method });
      const pending = { ...refs, kind, method };
      sessionStorage.setItem(storage, JSON.stringify(pending));
      setIntent(pending);
      return;
    }
    await request("confirm", {
      ref: intent.ref,
      observation: observed.current,
    });
    observed.current = null;
    sessionStorage.removeItem(storage);
    setIntent(null);
  }
  return (
    <div className="commerce" ref={root}>
      <div className="section-head">
        <h1>Sunrise Bakery</h1>
        <span>Simulated funds</span>
      </div>
      <div className="shop">
        {kind === "cake" ? (
          <img
            className="product"
            src="/chocolate-cake.jpg"
            alt="Chocolate layer cake"
          />
        ) : (
          <div className="wallet-art">
            <Wallet size={44} />
            <span>Your wallet</span>
            <b>{money(state.balance)}</b>
          </div>
        )}
        <div className="product-info">
          <div className="tabs">
            {[
              ["cake", "Bakery"],
              ["topup", "Wallet"],
            ].map(([k, title]) => (
              <button
                key={k}
                disabled={!!intent}
                aria-pressed={kind === k}
                onClick={() => choose(k)}
              >
                {title}
              </button>
            ))}
          </div>
          <h1>{kind === "cake" ? "Chocolate cake" : "Wallet top-up"}</h1>
          <p>
            {kind === "cake"
              ? "Chocolate sponge with cocoa frosting."
              : "Add ₹500 to your simulated balance."}
          </p>
          {kind === "cake" && (
            <label>
              Fulfilment{" "}
              <select
                disabled={!!intent}
                value={intent?.method || method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>Delivery</option>
                <option>Pickup</option>
              </select>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Share checkout click with the analyst
          </label>
          <small>
            The in-page listener reports the clicked button and checkout
            reference from this browser.
          </small>
          <div className="total">
            <span>Total</span>
            <b>₹500</b>
          </div>
          <button
            className="pay"
            disabled={busy}
            data-ref={intent?.ref}
            data-payment={intent?.payment}
            onClick={() =>
              run(checkout, intent ? "Payment confirmed" : "Checkout ready")
            }
          >
            {intent
              ? kind === "cake"
                ? "Buy chocolate cake · ₹500"
                : "Top up demo wallet · ₹500"
              : "Continue to checkout"}
          </button>
        </div>
      </div>
      <section className="business-panel">
        <h2>Order history</h2>
        <Orders orders={state.orders} />
      </section>
      <section className="business-panel">
        <h2>
          Wallet activity <span>{money(state.balance)}</span>
        </h2>
        {state.ledger.length ? (
          state.ledger.map((l) => (
            <article key={l.id}>
              <b>Wallet credit　+{money(l.amount)}</b>
              <small>
                {new Date(l.posted).toLocaleString()} · Payment {l.payment}
              </small>
            </article>
          ))
        ) : (
          <p>No wallet credits yet.</p>
        )}
      </section>
    </div>
  );
}
const next = {
  Placed: "Accepted",
  Accepted: "Preparing",
  Preparing: "Ready",
  Ready: "Delivered",
};
function Orders({ orders, act, busy }) {
  return orders.length ? (
    orders.map((o) => (
      <article key={o.id}>
        <div>
          <b>
            {o.items.map((i) => i.quantity + " × " + i.name).join(", ")} ·{" "}
            {money(o.amount)}
          </b>
          <p>
            {o.method} ·{" "}
            {o.stage === "Delivered" && o.method === "Pickup"
              ? "Collected"
              : o.stage}
          </p>
          <small>
            Order {o.id.slice(0, 8)} · Payment {o.payment}
          </small>
        </div>
        {act && next[o.stage] && (
          <button disabled={busy} onClick={() => act(o)}>
            {
              {
                Placed: "Accept order",
                Accepted: "Start preparing",
                Preparing:
                  o.method === "Pickup"
                    ? "Ready for pickup"
                    : "Ready for dispatch",
                Ready:
                  o.method === "Pickup"
                    ? "Confirm collection"
                    : "Mark delivered",
              }[o.stage]
            }
          </button>
        )}
      </article>
    ))
  ) : (
    <p>No orders yet.</p>
  );
}
function Analyst({ cases, refresh }) {
  const [id, select] = useState(""),
    [filter, setFilter] = useState("All cases");
  const rows = cases.filter(
      (c) => filter === "All cases" || c.status === filter,
    ),
    c = rows.find((c) => c.id === id) || rows[0];
  return (
    <>
      <div className="heading">
        <div>
          <small>Payment investigations</small>
          <h1>Sunrise Bakery</h1>
        </div>
      </div>
      <div className="workgrid">
        <nav>
          <h2>Case queue</h2>
          <select
            aria-label="Filter cases"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All cases",
              "Purpose mismatch — review",
              "Purpose unverified",
              "Cake sale supported",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {rows.map((r) => (
            <button
              key={r.id}
              data-case-id={r.id}
              className={c?.id === r.id ? "active" : ""}
              onClick={() => select(r.id)}
            >
              <b>Sunrise Bakery · ₹500</b>
              <small>
                {new Date(r.records[0].received).toLocaleTimeString()} ·{" "}
                {r.id.slice(0, 8)}
              </small>
              {r.status}
            </button>
          ))}
        </nav>
        {c ? (
          <Investigation
            key={c.id}
            c={c}
            api={async (_, body) => {
              await request("review", body);
              await refresh();
            }}
          />
        ) : (
          <section className="empty">
            <ShoppingBag />
            <h2>No matching payments</h2>
            <p>Confirmed checkouts appear here.</p>
          </section>
        )}
      </div>
    </>
  );
}
export default function Product() {
  const [state, setState] = useState(),
    [msg, message] = useState(""),
    [busy, setBusy] = useState(false),
    [feed, setFeed] = useState("Connecting");
  const generation = useRef(0);
  async function refresh() {
    const g = ++generation.current;
    try {
      const data = await request("state");
      if (g === generation.current) {
        setState(data);
        setFeed("Connected");
      }
    } catch (e) {
      if (g === generation.current) {
        if (e.status === 401) {
          setState(null);
          setFeed("Signed out");
        } else setFeed("Feed interrupted — showing last received state");
      }
    }
  }
  useEffect(() => {
    refresh();
    const i = setInterval(() => {
      if (!document.hidden && state) refresh();
    }, 3000);
    return () => clearInterval(i);
  }, [!!state]);
  async function run(fn, done) {
    setBusy(true);
    message("Processing…");
    try {
      await fn();
      await refresh();
      message(done);
    } catch (e) {
      message(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="exhibit product-app">
      <header>
        <Aperture className="brand-icon" />
        <strong>MerchantLens</strong>
        <span className="mode-tag">{state?.mode || "Simulated payments"}</span>
        {Object.entries(areas).map(([k, v]) => (
          <a
            key={k}
            href={"/" + k}
            aria-current={k === role ? "page" : undefined}
          >
            {v}
          </a>
        ))}
      </header>
      <div className="session">
        <span role="status">{msg}</span>
        <span>
          {feed}
          {state ? " · " + state.user : ""}
        </span>
        {state && (
          <button
            onClick={() => run(() => request("logout", {}), "Signed out")}
          >
            Sign out
          </button>
        )}
      </div>
      {state === undefined ? (
        <p>Connecting to the application…</p>
      ) : !state ? (
        <Login run={run} />
      ) : role === "customer" ? (
        <Customer state={state} run={run} busy={busy} />
      ) : role === "merchant" ? (
        <section className="business-panel">
          <small>Sunrise Bakery · SRB-2041</small>
          <h1>Fulfilment queue</h1>
          <Orders
            orders={state.orders}
            busy={busy}
            act={(o) =>
              run(
                () => request("fulfil", { ref: o.ref, stage: next[o.stage] }),
                "Fulfilment updated",
              )
            }
          />
        </section>
      ) : (
        <Analyst cases={state.cases} refresh={refresh} />
      )}
    </main>
  );
}
