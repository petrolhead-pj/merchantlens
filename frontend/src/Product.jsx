import React, { useState, useEffect, useRef } from "react";
import { Network, ShoppingBag, Wallet, ArrowUpRight, ArrowRight, ScanLine, PackageCheck, Smartphone } from "lucide-react";
import "./exhibition.css";
import "./product.css";
import "./storefront.css";
import { cakePrices, checkoutMoney, walletAmount } from "./checkout-prices.js";
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
const sportsbookPath = "/betting.html";
const sportsbook = location.pathname === sportsbookPath;
const checkoutRef = checkoutParams.get("ref");
const accountHint = checkoutParams.get("account");
const demoCustomers = ["buyer", "second-buyer"];
const localBuyer = sportsbook ? "second-buyer" : checkoutParams.get("buyer");
const money = (n) => "₹" + (n / 100).toLocaleString("en-IN");
async function appRequest(area, op, body) {
  const headers = {};
  if (!phoneCheckout && area === "customer" && localBuyer === "second-buyer") {
    headers["X-MerchantLens-Demo-Buyer"] = localBuyer;
  }
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch("/api/app/" + area + "/" + op, {
    method: body ? "POST" : "GET",
    headers,
    ...(area === "phone" ? { credentials: "omit" } : {}),
    ...(body
      ? {
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
  const [enteredAmount, setEnteredAmount] = useState("");
  const [message, setMessage] = useState(token ? "Opening checkout…" : "On your laptop, click Confirm demo payment in the storefront. Scan the QR with your phone camera, or open the full checkout link shown below the QR.");
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
      else if (result.confirmed || result.status === "captured") setCheckout({ ...checkout, ...result, confirmed: true });
      else setMessage(result.status === "failed" ? "PayU reports that the payment failed. Ask for a fresh checkout." : "PayU has not confirmed this payment yet.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const cake = checkout?.kind === "cake";
  const amount = cake || checkout?.confirmed ? checkout?.amount : walletAmount(enteredAmount);
  return <main className="exhibit product-app commerce" ref={root}>
    <section className="payment-app" aria-labelledby="phone-payment-title">
      <div className="payment-app-heading"><Smartphone aria-hidden="true" />
        <h1 id="phone-payment-title">{checkout?.confirmed ? "Payment confirmed" : "Phone checkout"}</h1>
      </div>
      {checkout && <>
        <dl>
          <dt>Checkout</dt><dd>{cake ? checkout.flavour || "Chocolate cake" : "Demo wallet top-up"}</dd>
          <dt>Payee</dt><dd>{checkout.payuMode ? "Shown by PayU" : "Sunrise Bakery"}</dd>
          {(cake || checkout.confirmed) && <><dt>Amount</dt><dd className="payment-app-amount">{checkoutMoney(amount)}</dd></>}
        </dl>
        <p>{checkout.payuMode === "live" ? "Live PayU payment" : checkout.payuMode === "sandbox" ? "PayU sandbox · Test payment" : "Simulated funds"}</p>
        {!checkout.confirmed && <>
          {!cake && <label className="phone-amount">Amount in INR <input inputMode="decimal" maxLength={8} value={enteredAmount} onChange={(event) => setEnteredAmount(event.target.value)} placeholder="Enter amount" /></label>}
          <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Share checkout click with the analyst</label>
          {checkout.submittedToPayU && <button type="button" disabled={busy} onClick={() => runPhone("payu-status")}>Check PayU status</button>}
          <button type="button" className="pay" data-ref={checkout.ref} data-payment={checkout.payment} data-checkout-kind={checkout.kind} data-checkout-amount={amount} disabled={busy || (!cake && !amount)}
            onClick={() => checkout.payuMode ? setShowPayU(true) : runPhone("confirm", { observation: consent ? observed.current : null, ...(!cake ? { amount: enteredAmount } : {}) })}>
            Pay
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
  const storefrontKind = sportsbook || checkoutLane === "wallet" ? "topup" : "cake";
  const singleStorefront = sportsbook || state.localDemo;
  const [mode, choose] = useState(storefrontKind),
    [method, setMethod] = useState("Delivery"),
    [flavour, setFlavour] = useState("Chocolate cake"),
    [sport, setSport] = useState("All");
  const storage = "checkout-" + state.user;
  const [intent, setIntent] = useState(() => {
    if (checkoutRef) return null;
    try {
      const pending = JSON.parse(sessionStorage.getItem(storage) || "null");
      return pending && typeof pending.ref === "string" && typeof pending.payment === "string" &&
        ["cake", "topup"].includes(pending.kind) &&
        (!singleStorefront || pending.kind === storefrontKind) ? pending : null;
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
      }, { allowDraft: true });
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
      if (resumed.flavour) setFlavour(resumed.flavour);
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
  const selectedFlavour = intent?.flavour || flavour;
  const cakeAmount = intent?.amount ?? cakePrices[selectedFlavour];
  const lane = kind === "topup" ? "wallet" : "cake";
  const paymentMode = intent?.payuMode || state.payuMode;
  const phoneOnly = intent?.payuMode && intent.payuMode !== state.payuMode;
  const currentQr = intent && phoneLink?.ref === intent.ref ? phoneLink : null;
  const phoneCode = currentQr && (
    <div className="customer-checkout-qr" role="region" aria-label="Phone payment">
      <CheckoutQr key={currentQr.url} url={currentQr.url} size={192} label="Scan to pay on your phone" />
      <p>Scan with your phone camera, then confirm the simulated payment on your phone.</p>
      <details>
        <summary>Show checkout link</summary>
        <input aria-label="Full phone checkout link" readOnly value={currentQr.url} onFocus={(event) => event.target.select()} />
        <p>Copy the full link and open it on your phone.</p>
      </details>
      <small>The code expires after 10 minutes.</small>
    </div>
  );
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
    const click = consent ? observed.current : null;
    if (!intent) setCheckoutNotice("");
    const checkout = intent || await request("checkout", { kind, method, ...(kind === "cake" ? { flavour } : {}) });
    const observation = click ? { ...click, ref: checkout.ref, payment: checkout.payment } : null;
    saveIntent({ ...checkout, kind, method: checkout.method || method, flavour: checkout.flavour || flavour, paymentApp: true, observation });
    if (checkout.payuMode && state.demoOrigin && !checkoutRef && !phoneCheckout) {
      await makePhoneLink(checkout.ref);
    }
  }
  async function makePhoneLink(ref) {
    if (!state.demoOrigin) throw Error("Phone checkout is unavailable. Use the demo server with Wi-Fi sharing enabled.");
    const { url } = await request("phone-link", { ref, shareEvidence: consent });
    setPhoneLink({ ref, url });
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
    <div className={`commerce ${sportsbook ? "touchline-store" : "bakery-store"}`} ref={root}>
      {handoff ? <section className="payment-app" aria-labelledby="phone-checkout-title">
        <h1 id="phone-checkout-title">Phone checkout</h1>
        <p role="status">{handoff}</p>
        <a href={sportsbook ? sportsbookPath : `/customer?checkout=${lane}${state.localDemo && state.user === "second-buyer" ? "&buyer=second-buyer" : ""}`}>Back to shop</a>
      </section> : intent?.paymentApp ? (
        <section className="payment-app" aria-labelledby="payment-app-title">
          <div className="payment-app-heading"><Smartphone aria-hidden="true" /><h1 id="payment-app-title">{intent.payuMode ? "PayU Hosted Checkout" : "Confirm demo payment"}</h1></div>
          <p>{intent.payuMode === "live" ? "Live payment · ₹500 will be charged" : intent.payuMode === "sandbox" ? "PayU sandbox · Test payment" : "Simulated UPI payment"}</p>
          <dl>
            {intent.payuMode ? <><dt>Order</dt><dd>Chocolate cake</dd></> : <>
              <dt>Paying to</dt><dd>Sunrise Bakery</dd>
              <dt>Merchant account</dt><dd>SRB-2041</dd>
            </>}
            <dt>Amount</dt><dd className="payment-app-amount">{kind === "cake" ? checkoutMoney(cakeAmount) : "Enter on phone"}</dd>
            {intent.kind === "cake" && <><dt>Order</dt><dd>{intent.flavour || "Chocolate cake"}</dd></>}
          </dl>
          {phoneCode}
          {intent.submittedToPayU && <button type="button" disabled={busy} onClick={() => run(checkPayUStatus)}>Check PayU status</button>}
          {intent.payuMode ? <details open={!intent.submittedToPayU} key={Boolean(intent.submittedToPayU)}>
            <summary>{intent.submittedToPayU ? "Reopen the same PayU checkout" : "Contact details for PayU"}</summary>
            <PayUContact busy={busy} pay={(contact) => run(() => openPayU(contact), "Opening PayU…")} />
          </details> : (
          !currentQr && <button className="pay" disabled={busy} onClick={() => state.localDemo && !checkoutRef && !phoneCheckout ? run(() => makePhoneLink(intent.ref)) : run(confirmPayment, "Payment confirmed")}>
            Confirm demo payment
          </button>
          )}
          {!intent.submittedToPayU && <button type="button" disabled={busy} onClick={() => { setPhoneLink(null); saveIntent({ ...intent, paymentApp: false, observation: null }); }}>
            Back to checkout
          </button>}
        </section>
      ) : <>
      {sportsbook ? (
        <div className="sports-intro">
          <p>TOUCHLINE · SPORTSBOOK DEMO</p>
          <h1>The action starts here.</h1>
          <span>Explore the matchday experience with simulated funds.</span>
        </div>
      ) : (
        <div className="bakery-intro">
          <p>BAKED WITH CARE · MADE FOR SHARING</p>
          <h1>A little joy<br />in every slice.</h1>
          <span>Thoughtfully made celebration cakes, ready for your next special moment.</span>
          <a href="#shop-checkout">Explore our signature cake ↓</a>
        </div>
      )}
      {sportsbook && <section className="sports-fixtures" aria-label="Illustrative match fixtures">
        <div className="sports-fixtures-heading"><h2>Match centre</h2><span>Illustrative fixtures</span></div>
        <div className="sports-tabs" aria-label="Filter sports">{["All", "Football", "Cricket", "Basketball", "Tennis"].map(name => <button type="button" key={name} aria-pressed={sport === name} onClick={() => setSport(name)}>{name}</button>)}</div>
        {[["Football", "Harbour City", "Northbridge", "1.85", "3.40", "4.10"], ["Cricket", "River Royals", "Summit Kings", "1.91", "—", "1.91"], ["Basketball", "Metro Owls", "Coast Falcons", "1.58", "—", "2.35"], ["Tennis", "A. Morgan", "J. Carter", "1.72", "—", "2.10"]].filter(([category]) => sport === "All" || category === sport).map(([category, home, away, a, b, c]) => (
          <article className="sports-fixture" key={category}><small>{category.toUpperCase()} · DEMO</small><strong>{home} <span>vs</span> {away}</strong><div><span>HOME <b>{a}</b></span><span>DRAW <b>{b}</b></span><span>AWAY <b>{c}</b></span></div></article>
        ))}
        <p>Fixture odds are illustrative. This demo supports wallet top-ups.</p>
      </section>}
      {!sportsbook && <><div className="store-section-heading"><div><p>THE CAKE COUNTER</p><h2>Choose your cake</h2></div><span>Freshly made to order</span></div><div className="cake-options">{Object.keys(cakePrices).map(name => <button type="button" key={name} disabled={!!intent || (!!paymentMode && name !== "Chocolate cake")} aria-pressed={flavour === name} onClick={() => setFlavour(name)}><span>{name}</span><strong>{checkoutMoney(cakePrices[name])}</strong></button>)}</div></>}
      <div className="shop" id="shop-checkout">
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
          {!singleStorefront && <div className="tabs">
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
          </div>}
          <div className="store-product-tag">{kind === "cake" ? "SUNRISE SIGNATURE" : "YOUR DEMO ACCOUNT"}</div>
          <h2>{kind === "cake" ? selectedFlavour : "Top up your wallet"}</h2>
          <p>
            {kind === "cake"
              ? ({ "Chocolate cake": "Chocolate sponge with smooth cocoa frosting.", "Vanilla berry cake": "Vanilla sponge with berry compote and cream.", "Pistachio cake": "Pistachio sponge with a smooth nutty cream.", "Red velvet cake": "Red velvet sponge with cream cheese frosting." }[selectedFlavour])
              : "Add simulated funds to explore the demo checkout."}
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
            <b>{kind === "cake" ? checkoutMoney(cakeAmount) : "Enter on phone"}</b>
          </div>
          {checkoutNotice && <p role="status">{checkoutNotice}</p>}
          {phoneOnly && <p>Finish this PayU checkout using the phone QR.</p>}
          <div className="checkout-actions">
            <button
              className="pay"
              disabled={busy || phoneOnly}
              data-ref={intent?.ref}
              data-payment={intent?.payment}
              data-checkout-amount={kind === "cake" ? cakeAmount : undefined}
              data-checkout-draft={!intent ? "" : undefined}
              onClick={() => run(openCheckout, "Review your payment")}
            >
              {kind === "cake" ? `Buy ${selectedFlavour.toLowerCase()} · ${checkoutMoney(cakeAmount)}` : "Top up demo wallet"}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
            {intent && !intent.submittedToPayU && (
              <button className="checkout-cancel" type="button" disabled={busy} onClick={() => run(cancelCheckout, "Checkout cancelled")}>
                Cancel checkout
              </button>
            )}
          </div>
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
function Orders({ orders }) {
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
      </article>
    ))
  ) : (
    <p>No orders yet.</p>
  );
}
const orderStages = [...Object.keys(next), "Delivered"];
const orderFilters = [
  ["all", "All orders"],
  ["Placed", "New"],
  ["kitchen", "In the kitchen"],
  ["Ready", "Ready"],
  ["Delivered", "Completed"],
];
const orderTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function MerchantOrders({ orders, advance, busy }) {
  const [filter, setFilter] = useState("all");
  const groups = Object.groupBy(orders, ({ stage }) =>
    stage === "Accepted" || stage === "Preparing" ? "kitchen" : stage);
  const visibleOrders = filter === "all" ? orders : groups[filter] ?? [];
  const sortedOrders = [...visibleOrders].sort((a, b) =>
    Number(a.stage === "Delivered") - Number(b.stage === "Delivered") ||
    (b.events?.at(-1)?.time ?? "").localeCompare(a.events?.at(-1)?.time ?? ""));

  return (
    <section className="business-panel fulfilment">
      <small>Sunrise Bakery · SRB-2041</small>
      <h1>Fulfilment queue</h1>
      <div className="order-filters" role="group" aria-label="Filter orders by fulfilment stage">
        {orderFilters.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label} <span>{key === "all" ? orders.length : groups[key]?.length ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="merchant-order-list">
        {sortedOrders.map((order) => {
          const pickup = order.method === "Pickup";
          const current = orderStages.indexOf(order.stage);
          const stageLabels = {
            Placed: "Order placed",
            Accepted: "Accepted",
            Preparing: "Preparing",
            Ready: pickup ? "Ready for pickup" : "Ready for dispatch",
            Delivered: pickup ? "Collected" : "Delivered",
          };
          const actions = {
            Placed: "Accept order",
            Accepted: "Start preparing",
            Preparing: pickup ? "Mark ready for pickup" : "Mark ready for dispatch",
            Ready: pickup ? "Confirm collection" : "Mark delivered",
          };
          const shortId = order.id.slice(0, 8);
          return (
            <article className="merchant-order" key={order.id} aria-labelledby={"order-" + order.id}>
              <div className="merchant-order-header">
                <div>
                  <small>Order #{shortId} · {order.method}</small>
                  <h2 id={"order-" + order.id}>{order.items.map(({ quantity, name }) => quantity + " × " + name).join(", ")}</h2>
                </div>
                <strong>{checkoutMoney(order.amount)}</strong>
              </div>
              <ol className="order-progress" aria-label="Fulfilment progress">
                {orderStages.map((stage, index) => {
                  const completed = index < current || order.stage === "Delivered";
                  const active = index === current;
                  const event = order.events?.find((entry) => entry.stage === stage);
                  return (
                    <li key={stage} data-step={completed ? "done" : active ? "current" : "pending"} aria-current={active ? "step" : undefined}>
                      <span className="order-step-dot" aria-hidden="true">{completed ? "✓" : ""}</span>
                      <span>{stageLabels[stage]}</span>
                      {event?.time && <time dateTime={event.time}>{orderTime.format(new Date(event.time))}</time>}
                    </li>
                  );
                })}
              </ol>
              <div className="merchant-order-footer">
                <details>
                  <summary>Payment reference</summary>
                  <code>{order.payment}</code>
                </details>
                {next[order.stage] && (
                  <button type="button" disabled={busy} onClick={() => advance(order)}>
                    {actions[order.stage]} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!sortedOrders.length && <p className="merchant-queue-empty">{orders.length ? "No orders in this stage." : "New cake orders will appear here after payment."}</p>}
      </div>
    </section>
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
        <p>{demoOrigin.startsWith("https://") ? "Scan from a phone on Wi-Fi or mobile data." : "Scan from a phone on the same Wi-Fi."} Each code opens one simulated checkout and expires after 10 minutes.</p>
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
    <main className={`exhibit product-app${sportsbook ? " sportsbook-app" : ""}`}>
      <header>
        <div className="product-brand">
          {sportsbook ? <Wallet className="brand-icon" aria-hidden="true" /> : <Network className="brand-icon" aria-hidden="true" />}
          <strong>{sportsbook ? "Touchline Sportsbook" : state?.localDemo && role === "customer" ? "Sunrise Bakery" : "MerchantLens"}</strong>
        </div>
        {sportsbook && <span className="sportsbook-notice">Simulated funds</span>}
        {!phoneCheckout && !sportsbook && <nav className="role-nav" aria-label="Application areas">
          {Object.entries(areas).map(([k, v]) => (
            <a
              key={k}
              href={"/" + k}
              aria-current={k === role ? "page" : undefined}
            >
              {v}
            </a>
          ))}
          {state?.localDemo && <a href={sportsbookPath}>Sportsbook demo</a>}
          {state?.localDemo && role === "analyst" && <a href="/whatsapp-connect.html">WhatsApp</a>}
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
        {state?.localDemo && role === "customer" && !sportsbook && (
          <nav className="role-nav" aria-label="Demo customer">
            <a href="/customer" aria-current={state.user === "buyer" ? "page" : undefined}>Buyer A</a>
            <a href={sportsbookPath}>Buyer B · Sportsbook</a>
          </nav>
        )}
        {state && !state.localDemo && (
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
        <MerchantOrders
          orders={state.orders}
          busy={busy}
          advance={(order) => run(
            () => request("fulfil", { ref: order.ref, stage: next[order.stage] }),
            "Order updated",
          )}
        />
      ) : (
        <Analyst cases={state.cases} refresh={refresh} demoOrigin={state.demoOrigin} analystDemoQr={state.analystDemoQr} />
      )}
    </main>
  );
}
