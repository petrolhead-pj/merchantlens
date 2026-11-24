import React, { useState, useEffect, useRef } from "react";
import { Network, ShoppingBag, Wallet, ArrowUpRight, ArrowRight, ScanLine, PackageCheck, Smartphone } from "lucide-react";
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
const phoneCheckout = !["localhost", "127.0.0.1"].includes(location.hostname);
const checkoutParams = new URLSearchParams(location.search);
const checkoutLane = checkoutParams.get("checkout");
const checkoutRef = checkoutParams.get("ref");
const accountHint = checkoutParams.get("account");
const demoCustomers = ["buyer", "second-buyer"];
const money = (n) => "₹" + (n / 100).toLocaleString("en-IN");
async function appRequest(area, op, body) {
  const response = await fetch("/api/app/" + area + "/" + op, {
    method: body ? "POST" : "GET",
    ...(area === "phone" ? { credentials: "omit" } : {}),
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
const request = (op, body) => appRequest(role, op, body);

function submitPayUForm({ url, fields }) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    Object.assign(input, { type: "hidden", name, value });
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

function PayUContact({ busy, pay }) {
  return <form className="payu-contact" onSubmit={(event) => {
    event.preventDefault();
    pay(Object.fromEntries(new FormData(event.currentTarget)));
  }}>
    <label>First name<input name="firstname" autoComplete="given-name" required maxLength={60} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={100} /></label>
    <label>Mobile number<input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" required /></label>
    <button className="pay" disabled={busy}>Continue to PayU</button>
  </form>;
}

export function PhoneCheckout() {
  const [handoff] = useState(() => {
    const scanned = location.hash.slice(1);
    try {
      if (scanned) sessionStorage.setItem("phone-payment-qr", scanned);
      return scanned || sessionStorage.getItem("phone-payment-qr") || "";
    } catch {
      return scanned;
    }
  });
  const [token, preferences] = handoff.split("?");
  const [checkout, setCheckout] = useState(null);
  const [message, setMessage] = useState(token ? "Opening checkout…" : "Scan a payment QR from the customer page.");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(() => new URLSearchParams(preferences).get("share") !== "0");
  const [showPayU, setShowPayU] = useState(false);
  const root = useRef(null);
  const observed = useRef(null);

  useEffect(() => {
    let active = true;
    if (token) appRequest("phone", "state", { token }).then((result) => {
      if (active) {
        setCheckout(result);
        setMessage("");
      }
    }).catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    observed.current = null;
    if (consent) return observeCheckout(root.current, (value) => { observed.current = value; });
  }, [consent]);

  async function runPhone(operation, args = {}) {
    setBusy(true);
    setMessage("");
    try {
      const result = await appRequest("phone", operation, { ...args, token });
      if (operation === "payu") submitPayUForm(result);
      else if (result.confirmed || result.status === "captured") setCheckout({ ...checkout, confirmed: true });
      else setMessage(result.status === "failed" ? "PayU reports that the payment failed. Ask for a fresh checkout." : "PayU has not confirmed this payment yet.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const cake = checkout?.kind === "cake";
  const label = cake ? "Buy chocolate cake · ₹500" : "Top up demo wallet · ₹500";
  return <main className="exhibit product-app commerce" ref={root}>
    <section className="payment-app" aria-labelledby="phone-payment-title">
      <div className="payment-app-heading"><Smartphone aria-hidden="true" />
        <h1 id="phone-payment-title">{checkout?.confirmed ? "Payment confirmed" : "Phone checkout"}</h1>
      </div>
      {checkout && <>
        <dl>
          <dt>Checkout</dt><dd>{cake ? "Chocolate cake" : "Demo wallet top-up"}</dd>
          <dt>Payee</dt><dd>{checkout.payuMode ? "Shown by PayU" : "Sunrise Bakery"}</dd>
          <dt>Amount</dt><dd className="payment-app-amount">₹500</dd>
        </dl>
        <p>{checkout.payuMode === "live" ? "Live PayU payment" : checkout.payuMode === "sandbox" ? "PayU sandbox · Test payment" : "Simulated funds"}</p>
        {!checkout.confirmed && <>
          <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Share checkout click with the analyst</label>
          {checkout.submittedToPayU && <button type="button" disabled={busy} onClick={() => runPhone("payu-status")}>Check PayU status</button>}
          <button type="button" className="pay" data-ref={checkout.ref} data-payment={checkout.payment} disabled={busy}
            onClick={() => checkout.payuMode ? setShowPayU(true) : runPhone("confirm", { observation: observed.current })}>
            {label}
          </button>
          {showPayU && <PayUContact busy={busy} pay={(contact) => runPhone("payu", { ...contact, observation: observed.current })} />}
        </>}
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>;
}
const signInContent = {
  customer: {
    title: "Sunrise Bakery",
    description: "Order a chocolate cake, track fulfilment, or add funds to your simulated wallet.",
    icon: ShoppingBag,
    account: checkoutRef && demoCustomers.includes(accountHint) ? accountHint : checkoutLane === "wallet" ? "second-buyer" : "buyer",
  },
  merchant: {
    title: "Manage fulfilment",
    description: "Accept orders and update their progress through preparation, pickup, or delivery.",
    icon: PackageCheck,
    account: "bakery",
  },
  analyst: {
    title: "Review payment evidence",
    description: "Inspect checkout records and document your assessment of each payment.",
    icon: ScanLine,
    account: "reviewer",
  },
};

function Login({ run, busy }) {
  const { title, description, icon: Icon, account } = signInContent[role];
  const [error, setError] = useState("");
  return (
    <div className="login-layout">
      <section className="login-intro" aria-labelledby="portal-title">
        <small>{areas[role]}</small>
        <h1 id="portal-title">{title}</h1>
        <p>{description}</p>
        <div className="portal-art" aria-hidden="true">
          <span className="portal-icon"><Icon size={56} strokeWidth={1.35} /></span>
        </div>
      </section>
      <form
        className="login"
        onChange={() => setError("")}
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          fields.user = fields.user.trim();
          run(() => request("login", fields), "Signed in", (failure) => {
            setError(failure.status === 401
              ? `Sign-in failed. Use the local password assigned to ${account}.`
              : failure.message);
          });
        }}
      >
        <h2>Sign in</h2>
        <p id="login-help" className="login-help">Use the local MerchantLens account <code>{account}</code> and its assigned password.</p>
        <label>
          Account
          <input name="user" autoComplete="username" autoCapitalize="none" spellCheck={false}
            aria-describedby="login-help" required defaultValue={account} />
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
        {error && <p className="login-error" role="alert">{error}</p>}
        <button disabled={busy}>
          Sign in <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
function Customer({ state, run, busy }) {
  const [mode, choose] = useState(checkoutLane === "wallet" ? "topup" : "cake"),
    [method, setMethod] = useState("Delivery");
  const storage = "checkout-" + state.user;
  const [intent, setIntent] = useState(() => {
    if (checkoutRef) return null;
    try {
      const pending = JSON.parse(sessionStorage.getItem(storage) || "null");
      return pending && typeof pending.ref === "string" && typeof pending.payment === "string" &&
        ["cake", "topup"].includes(pending.kind) ? pending : null;
    } catch {
      return null;
    }
  });
  const root = useRef(null),
    observed = useRef(null);
  const [consent, setConsent] = useState(true);
  const [handoff, setHandoff] = useState(checkoutRef ? "Opening checkout…" : "");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [phoneLink, setPhoneLink] = useState(null);
  useEffect(() => {
    observed.current = null;
    if (consent)
      return observeCheckout(root.current, (x) => {
        observed.current = x;
      });
  }, [consent]);
  useEffect(() => {
    if (!checkoutRef) return;
    let active = true;
    request("resume-checkout", { ref: checkoutRef }).then(({ confirmed, ...pending }) => {
      if (!active) return;
      if (confirmed) {
        setHandoff("This payment is already confirmed.");
        return;
      }
      const resumed = { ...pending, paymentApp: Boolean(pending.submittedToPayU) };
      sessionStorage.setItem(storage, JSON.stringify(resumed));
      choose(resumed.kind);
      setIntent(resumed);
      setHandoff("");
    }).catch((error) => {
      if (active) setHandoff(error.status === 404
        ? "Checkout unavailable for this account. Sign in with the account that started it."
        : error.message);
    });
    return () => { active = false; };
  }, [storage]);
  useEffect(() => {
    if (!intent || ![...state.orders, ...state.ledger].some((record) => record.ref === intent.ref)) return;
    sessionStorage.removeItem(storage);
    setIntent(null);
    setCheckoutNotice("Payment confirmed.");
  }, [intent, state.orders, state.ledger, storage]);
  const kind = intent?.kind || mode;
  const lane = kind === "topup" ? "wallet" : "cake";
  const paymentMode = intent?.payuMode || state.payuMode;
  const phoneOnly = intent?.payuMode && intent.payuMode !== state.payuMode;
  const currentQr = intent && phoneLink?.ref === intent.ref ? phoneLink : null;
  const phoneCode = state.demoOrigin && !checkoutRef && !(phoneCheckout && checkoutLane) &&
    <div className="customer-checkout-qr">
      {currentQr && <CheckoutQr key={currentQr.url} url={currentQr.url} size={192} label="Scan to pay on your phone" />}
      <button type="button" disabled={busy} onClick={() => run(makePhoneLink, "Payment QR ready")}>
        {currentQr ? "Refresh payment QR" : "Show payment QR"}
      </button>
      {currentQr && <small>The code opens this checkout for 10 minutes.</small>}
    </div>;
  const saveIntent = (pending) => {
    if (pending) sessionStorage.setItem(storage, JSON.stringify(pending));
    else sessionStorage.removeItem(storage);
    setIntent(pending);
  };
  function clearCheckout() {
    observed.current = null;
    saveIntent(null);
    setPhoneLink(null);
  }
  async function cancelCheckout() {
    await request("cancel-checkout", { ref: intent.ref });
    clearCheckout();
  }
  async function openCheckout() {
    if (!intent) {
      setCheckoutNotice("");
      const refs = await request("checkout", { kind, method });
      saveIntent({ ...refs, kind, method });
      return;
    }
    saveIntent({ ...intent, paymentApp: true, observation: observed.current });
  }
  async function makePhoneLink() {
    const { checkout, url } = await request("phone-link", {
      ...(intent ? { ref: intent.ref } : { kind, method }),
      shareEvidence: consent,
    });
    if (!intent) {
      setCheckoutNotice("");
      saveIntent(checkout);
    }
    setPhoneLink({ ref: checkout.ref, url });
  }
  async function confirmPayment() {
    await request("confirm", {
      ref: intent.ref,
      observation: intent.observation,
    });
    clearCheckout();
  }
  async function openPayU(contact) {
    const checkout = await request("payu", { ref: intent.ref, observation: intent.observation, ...contact });
    saveIntent({ ...intent, submittedToPayU: true });
    submitPayUForm(checkout);
  }
  async function checkPayUStatus() {
    const { status } = await request("payu-status", { ref: intent.ref });
    if (status === "captured") {
      clearCheckout();
      return "PayU confirmed the payment.";
    }
    if (status === "failed") {
      clearCheckout();
      return "PayU reports that the payment failed. You can start a new checkout.";
    }
    return "PayU has not confirmed the payment yet. Check again before starting another checkout.";
  }
  return (
    <div className="commerce" ref={root}>
      {handoff ? <section className="payment-app" aria-labelledby="phone-checkout-title">
        <h1 id="phone-checkout-title">Phone checkout</h1>
        <p role="status">{handoff}</p>
        <a href={`/customer?checkout=${lane}`}>Back to shop</a>
      </section> : intent?.paymentApp ? (
        <section className="payment-app" aria-labelledby="payment-app-title">
          <div className="payment-app-heading"><Smartphone aria-hidden="true" /><h1 id="payment-app-title">{intent.payuMode ? "PayU Hosted Checkout" : "Demo payment app"}</h1></div>
          <p>{intent.payuMode === "live" ? "Live payment · ₹500 will be charged" : intent.payuMode === "sandbox" ? "PayU sandbox · Test payment" : "Simulated UPI payment"}</p>
          <dl>
            {intent.payuMode ? <><dt>Order</dt><dd>Chocolate cake</dd></> : <>
              <dt>Paying to</dt><dd>Sunrise Bakery</dd>
              <dt>Merchant account</dt><dd>SRB-2041</dd>
            </>}
            <dt>Amount</dt><dd className="payment-app-amount">₹500</dd>
          </dl>
          {intent.submittedToPayU && <button type="button" disabled={busy} onClick={() => run(checkPayUStatus)}>Check PayU status</button>}
          {intent.payuMode ? <details open={!intent.submittedToPayU} key={Boolean(intent.submittedToPayU)}>
            <summary>{intent.submittedToPayU ? "Reopen the same PayU checkout" : "Contact details for PayU"}</summary>
            <PayUContact busy={busy} pay={(contact) => run(() => openPayU(contact), "Opening PayU…")} />
          </details> : (
          <button className="pay" disabled={busy} onClick={() => run(confirmPayment, "Payment confirmed")}>
            Confirm demo payment
          </button>
          )}
          {!intent.submittedToPayU && <button type="button" disabled={busy} onClick={() => saveIntent({ ...intent, paymentApp: false, observation: null })}>
            Back to checkout
          </button>}
          {phoneCode}
        </section>
      ) : <>
      <div className="section-head">
        <h1>Sunrise Bakery</h1>
        <span>{kind === "cake" && paymentMode === "live" ? "Live PayU checkout" : kind === "cake" && paymentMode === "sandbox" ? "PayU sandbox" : "Simulated funds"}</span>
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
          <h2>{kind === "cake" ? "Chocolate cake" : "Wallet top-up"}</h2>
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
          <label className="consent">
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
          {checkoutNotice && <p role="status">{checkoutNotice}</p>}
          {phoneOnly && <p>Finish this PayU checkout using the phone QR.</p>}
          <button
            className="pay"
            disabled={busy || phoneOnly}
            data-ref={intent?.ref}
            data-payment={intent?.payment}
            onClick={() =>
              run(openCheckout, intent ? "Payment app opened" : "Checkout ready")
            }
          >
            {intent
              ? kind === "cake"
                ? "Buy chocolate cake · ₹500"
                : "Top up demo wallet · ₹500"
              : "Continue to checkout"}
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
          {intent && !intent.submittedToPayU && <button type="button" disabled={busy} onClick={() => run(cancelCheckout, "Checkout cancelled")}>
            Cancel checkout
          </button>}
          {phoneCode}
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
              <b>Wallet credit · +{money(l.amount)}</b>
              <small>
                {new Date(l.posted).toLocaleString()} · Payment {l.payment}
              </small>
            </article>
          ))
        ) : (
          <p>No wallet credits yet.</p>
        )}
      </section>
      </>}
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
function CheckoutQr({ url, label, size }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    import("qrcode").then(({ default: qr }) => qr.toDataURL(url, { width: size, margin: 4 }))
      .then((value) => { if (active) setImage(value); }).catch(() => {});
    return () => { active = false; };
  }, [url, size]);
  return <a href={url} className="checkout-qr-link">
    {image && <img src={image} alt="" width={size} height={size} />}
    {label}
  </a>;
}

function DemoPhoneLinks({ origin }) {
  const lanes = [["cake", "User A · Cake checkout"], ["wallet", "User B · Betting wallet demo"]];
  return <details className="phone-checkouts">
    <summary>Customer sign-in QR codes</summary>
    <div className="phone-checkout-codes">{lanes.map(([lane, label]) => {
      const url = new URL("/customer?checkout=" + lane, origin).href;
      return <CheckoutQr key={url} url={url} label={label} size={190} />;
    })}</div>
  </details>;
}

function DemoPaymentQr({ kind, label, cases }) {
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const paid = code && cases.some((entry) => entry.id === code.checkout.ref);
  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, code.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [code]);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      setCode(await request("demo-payment-qr", { kind }));
      setExpired(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="demo-payment-lane">
    <strong>{label}</strong>
    {code && !paid && !expired
      ? <CheckoutQr url={code.url} label={"Open " + label + " payment"} size={192} />
      : <>
        {code && <small role="status">{paid ? "Payment confirmed" : "QR expired"}</small>}
        <button type="button" disabled={busy} onClick={generate}>
          {busy ? "Generating…" : kind === "cake" ? "Generate cake QR" : "Generate wallet QR"}
        </button>
      </>}
    {error && <small role="alert">{error}</small>}
  </div>;
}

function Analyst({ cases, refresh, demoOrigin, analystDemoQr }) {
  const [id, select] = useState(""),
    [filter, setFilter] = useState("All cases"),
    [payer, setPayer] = useState("");
  const payers = [...new Set(cases.map((c) => c.payer))].sort();
  const rows = cases.filter((c) => (!payer || c.payer === payer) &&
    (filter === "All cases" || c.status === filter));
  const c = rows.find((entry) => entry.id === id) || rows[0];
  return (
    <>
      <div className="heading">
        <div>
          <small>Payment investigations</small>
          <h1>Sunrise Bakery</h1>
        </div>
      </div>
      {analystDemoQr && <details className="phone-checkouts demo-payment-codes">
        <summary>Demo payment QR codes</summary>
        <p>{demoOrigin.startsWith("https://") ? "Scan from a phone on Wi-Fi or mobile data." : "Scan from a phone on the same Wi-Fi."} Each code opens one simulated ₹500 checkout and expires after 10 minutes.</p>
        <div className="phone-checkout-codes">
          <DemoPaymentQr kind="cake" label="User A · Cake" cases={cases} />
          <DemoPaymentQr kind="topup" label="User B · Wallet" cases={cases} />
        </div>
      </details>}
      {demoOrigin && <DemoPhoneLinks origin={demoOrigin} />}
      <section className="payment-network" aria-labelledby="payment-network-title">
        <div className="payment-network-header">
          <h2 id="payment-network-title">Live payment graph</h2>
          <label>
            Payer
            <select value={payer} onChange={(event) => { setPayer(event.target.value); select(""); }}>
              <option value="">All users</option>
              {payers.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          {(id || payer || filter !== "All cases") && <button type="button" onClick={() => {
            select("");
            setPayer("");
            setFilter("All cases");
          }}>Follow latest</button>}
        </div>
        {rows.length ? <ul className="payment-paths">
          {rows.map((entry) => {
            const payment = entry.records.find(({ event }) => event.kind === "payment").event;
            return <li key={entry.id}>
              <button type="button" className="payment-path" aria-pressed={c?.id === entry.id}
                onClick={() => select(entry.id)}>
                <span><b>{entry.payer}</b><small>{entry.provider ? `PayU ${entry.provider.mode}` : "Simulated"} · {entry.id.slice(0, 8)}</small></span>
                <ArrowRight aria-hidden="true" />
                <span><b>{money(payment.amount)}</b><small>{payment.merchant} · Sunrise Bakery</small></span>
                <ArrowRight aria-hidden="true" />
                <span className={entry.status === "Purpose mismatch — review" ? "payment-path-critical" : ""}>
                  <b>{entry.status}</b>
                </span>
              </button>
            </li>;
          })}
        </ul> : <p>Confirmed payments appear here as each customer checks out.</p>}
      </section>
      <div className="workgrid">
        <nav aria-label="Case queue">
          <h2>Case queue <em>{rows.length}</em></h2>
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
              aria-current={c?.id === r.id ? "true" : undefined}
              onClick={() => select(r.id)}
            >
              <b>{r.payer} · Sunrise Bakery</b>
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
        } else {
          setFeed(state ? "Feed interrupted · showing last received state" : "Feed unavailable");
        }
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
  useEffect(() => {
    if (!state || role === "customer") return;
    const events = new EventSource("/api/app/" + role + "/events");
    events.onopen = refresh;
    events.addEventListener("changed", refresh);
    return () => events.close();
  }, [!!state]);
  async function run(fn, done, onError) {
    setBusy(true);
    message("Processing…");
    try {
      const result = await fn();
      await refresh();
      message(done ?? result ?? "");
    } catch (e) {
      if (onError) {
        message("");
        onError(e);
      } else {
        message(e.message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="exhibit product-app">
      <header>
        <div className="product-brand">
          <Network className="brand-icon" aria-hidden="true" />
          <strong>MerchantLens</strong>
        </div>
        {!phoneCheckout && <nav className="role-nav" aria-label="Application areas">
          {Object.entries(areas).map(([k, v]) => (
            <a
              key={k}
              href={"/" + k}
              aria-current={k === role ? "page" : undefined}
            >
              {v}
            </a>
          ))}
        </nav>}
      </header>
      <div className="session">
        <span role="status">{msg}</span>
        <span className="session-feed">
          <strong>{state?.mode || "Simulated payments"}</strong>
          {" · "}
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
        <div className="app-loading">
          {feed === "Feed unavailable" ? (
            <>
              <h1>Application unavailable</h1>
              <p role="status">MerchantLens could not reach the application server.</p>
              <button onClick={() => {
                setFeed("Connecting");
                refresh();
              }}>
                Try again
              </button>
            </>
          ) : (
            <p role="status">Connecting to the application…</p>
          )}
        </div>
      ) : !state ? (
        <Login run={run} busy={busy} />
      ) : role === "customer" ? (
        <Customer state={state} run={run} busy={busy} />
      ) : role === "merchant" ? (
        <section className="business-panel fulfilment">
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
        <Analyst cases={state.cases} refresh={refresh} demoOrigin={state.demoOrigin} analystDemoQr={state.analystDemoQr} />
      )}
    </main>
  );
}
