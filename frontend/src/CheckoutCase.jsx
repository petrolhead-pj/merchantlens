import React, { useEffect, useState } from "react";
import { Investigation } from "./Investigation.jsx";
import { api } from "./exhibition-checkout.js";
import "./exhibition.css";

export function CheckoutCase({ reference }) {
  const [entry, setEntry] = useState(null);
  const [feed, setFeed] = useState("Checking for payment");

  useEffect(() => {
    let active = true;
    let timer;
    let delay = 800;

    async function poll() {
      if (!document.hidden) {
        try {
          const cases = await api();
          if (active) {
            const match = cases.find((item) => item.id === reference);
            setEntry(match ?? null);
            setFeed(match ? "Connected" : "Awaiting payment");
            delay = 800;
          }
        } catch {
          if (active) {
            setFeed("Reconnecting to the case feed");
            delay = Math.min(delay * 2, 10000);
          }
        }
      }
      if (active) timer = setTimeout(poll, delay);
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reference]);

  return (
    <section className="exhibit checkout-case" aria-labelledby="checkout-case-title">
      <div className="checkout-case-heading">
        <div>
          <h2 id="checkout-case-title">Checkout evidence</h2>
          <p>Reference {reference}</p>
        </div>
        <span role="status">{feed}</span>
      </div>
      {entry ? (
        <div className="workgrid">
          <Investigation key={entry.id} c={entry} api={api} />
        </div>
      ) : (
        <p className="checkout-case-waiting">
          This case will appear here when the simulated payment is confirmed.
        </p>
      )}
    </section>
  );
}
