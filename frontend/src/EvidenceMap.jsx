import React, { useEffect, useRef, useState } from "react";
import {
  Banknote,
  CakeSlice,
  CheckCheck,
  CreditCard,
  Landmark,
  Monitor,
  MousePointer2,
  PackageCheck,

  Store,
  Wallet,
  Minus,
  Plus,
  Maximize,
  RotateCcw,
} from "lucide-react";

export const records = {
  storefront: ["Checkout page", Monitor, 96, 46],
  cake: ["Cake checkout", MousePointer2, 96, 150],
  topup: ["Wallet top-up", Wallet, 96, 150],
  order: ["Chocolate cake", CakeSlice, 96, 295],
  delivery: ["Cake delivered", PackageCheck, 96, 390],
  payment: ["₹500", CreditCard, 350, 192],
  merchant: ["Sunrise Bakery", Store, 605, 150],
  profile: ["Bakery business", Landmark, 605, 295],
  credit: ["Wallet credited", Wallet, 350, 338],
  refund: ["Refund issued", Banknote, 350, 46],
};
export const verbs = {
  storefront: "observed on",
  cake: "ref match",
  topup: "ref match",
  order: "reports order",
  delivery: "delivery for order",
  merchant: "paid to",
  profile: "declares",
  credit: "credited wallet",
  refund: "refund for",
};
export const decisive = (c) =>
  ["credit", "topup", "delivery", "order", "merchant"].find((k) =>
    c.nodes.some((n) => n.key === k),
  ) || "payment";
const labels = {
  payment: "Confirmed payment",
  merchant: "Recipient",
  profile: "Business profile",
  order: "Merchant claim",
  credit: "Ledger outcome",
  cake: "Browser action",
  topup: "Browser action",
  delivery: "Courier record",
  storefront: "Storefront",
  refund: "Provider",
};
const point = (k) => records[k].slice(2);
export function EvidenceMap({
  c,
  selected,
  pick,
  explain,
  onExplain,
  visible,
}) {
  const [hover, setHover] = useState(null),
    [zoom, scale] = useState(1),
    [pan, move] = useState([0, 0]);
  const drag = useRef(null),
    viewport = useRef(null);
  const initial = useRef(new Set(c.nodes.map((n) => n.key)));
  const active = hover
    ? c.edges.filter((e) => e.from === hover || e.to === hover)
    : explain
      ? c.edges.filter((e) =>
          ["merchant", "profile", "order", decisive(c)].includes(e.to),
        )
      : null;
  const lit = active && new Set(active.flatMap((e) => [e.from, e.to]));
  useEffect(() => {
    const area = viewport.current;
    const center = () => { area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2; };
    const observer = new ResizeObserver(center);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  const home = () => {
    scale(1);
    move([0, 0]);
    const area = viewport.current;
    area.scrollTo((area.scrollWidth - area.clientWidth) / 2, 0);
  };
  const keyboard = (e, fn) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  return (
    <div hidden={!visible} className="map">
      <div className="map-header">
        <span>
          <i /> Payment trace
        </span>
        <button onClick={onExplain}>
          <CheckCheck size={16} /> Explain this flag
        </button>
      </div>
      <div ref={viewport} className="map-scroll">
        <svg
          viewBox="0 0 700 436"
          aria-label="Payment evidence graph"
          onPointerDown={(e) => {
            if (e.target.closest("[role=button]")) return;
            const matrix = e.currentTarget.getScreenCTM();
            drag.current = [e.clientX, e.clientY, ...pan, matrix.a];
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const [x, y, a, b, k] = drag.current;
              move([a + (e.clientX - x) / k, b + (e.clientY - y) / k]);
            }
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <g
            data-view={zoom + "," + pan.join(",")}
            transform={`translate(${350 + pan[0]} ${218 + pan[1]}) scale(${zoom}) translate(-350 -218)`}
          >
            {c.edges.map((e) => {
              const [x, y] = point(e.from),
                [a, b] = point(e.to),
                fn = () => pick("edge/" + e.to);
              return (
                <g
                  key={e.to}
                  role="button"
                  tabIndex="0"
                  aria-label={verbs[e.to]}
                  onClick={fn}
                  onKeyDown={(v) => keyboard(v, fn)}
                  className={[
                    "edge",
                    active && !active.includes(e) ? "quiet" : "",
                    ["credit", "topup"].includes(e.to) ? "alert" : "",
                    selected === "edge/" + e.to ? "selected" : "",
                    !initial.current.has(e.to) ? "arrival" : "",
                  ].join(" ")}
                >
                  <line className="hit" x1={x} y1={y} x2={a} y2={b} />
                  <line x1={x} y1={y} x2={a} y2={b} />
                  <text x={(x + a) / 2} y={(y + b) / 2 - 4}>
                    {verbs[e.to]}
                  </text>
                </g>
              );
            })}
            {c.nodes.map((n) => {
              const [name, Icon, x, y] = records[n.key],
                pay = n.key === "payment",
                fn = () => pick(n.key);
              return (
                <g
                  key={n.key}
                  role="button"
                  tabIndex="0"
                  aria-label={labels[n.key] + " · " + name}
                  onMouseEnter={() => setHover(n.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.key)}
                  onBlur={() => setHover(null)}
                  onClick={fn}
                  onKeyDown={(e) => keyboard(e, fn)}
                  transform={`translate(${x} ${y})`}
                  className={[
                    "node",
                    pay ? "money" : "",
                    n.key === "credit" || n.key === "topup" ? "alert" : "",
                    lit && !lit.has(n.key) ? "quiet" : "",
                    selected.replace("edge/", "") === n.key ? "selected" : "",
                    !initial.current.has(n.key) ? "arrival" : "",
                  ].join(" ")}
                >
                  <rect
                    x="-83"
                    y={pay ? -41 : -29}
                    width="166"
                    height={pay ? 82 : 58}
                    rx="10"
                  />
                  <Icon x="-71" y={pay ? -27 : -18} width="17" height="17" />
                  <text x="-47" y={pay ? -13 : -4} className="node-type">
                    {labels[n.key]}
                  </text>
                  <text x="-69" y={pay ? 27 : 18} className="node-title">
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="map-foot">
        <span>
          {c.nodes.length} records · {c.edges.length} links
        </span>
        <div>
          <button
            aria-label="Zoom out"
            onClick={() => scale((v) => Math.max(0.6, v - 0.2))}
          >
            <Minus />
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => scale((v) => Math.min(2.6, v + 0.2))}
          >
            <Plus />
          </button>
          <button onClick={home}>
            <Maximize /> Fit
          </button>
          <button aria-label="Reset view" onClick={home}>
            <RotateCcw />
          </button>
        </div>
      </div>
    </div>
  );
}
