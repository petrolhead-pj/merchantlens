import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown, CircleCheck, Clock3, Focus,
  GitFork, Link2, List, Maximize, Minus, MousePointer2,
  Plus, TriangleAlert, X,
} from "lucide-react";

import { findingFor, has, linked, money, recordInfo, relationship, supported } from "./case-evidence.js";
export { findingFor } from "./case-evidence.js";

const edgeKey = (edge) => `edge/${edge.from}/${edge.to}`;
const decisiveLinks = (c, finding) => {
  const keys = new Set(["merchant"]);
  if (finding.driver) keys.add(finding.driver);
  if (finding.driver === "cake" && linked(c, "order")) keys.add("order");
  if (finding.tone === "supported") keys.add("delivery");
  if (finding.tone === "conflict") keys.add("profile");
  return c.edges.filter((edge) => keys.has(edge.to));
};

const centers = {
  storefront: [94, 286], cake: [201, 182], topup: [158, 140], order: [370, 300],
  delivery: [588, 310], payment: [470, 150], merchant: [770, 150], profile: [812, 285],
  credit: [259, 63], refund: [688, 50],
};
function position(c, key) {
  if (key === "storefront" && !has(c, "cake")) return [100, 280];
  return centers[key] || [480, 370];
}

const radius = (key) => key === "payment" ? 48 : key === "merchant" ? 35 : 27;

function route(c, edge) {
  const reverse = ["cake", "topup", "credit"].includes(edge.to);
  const [start, end] = reverse ? [edge.to, edge.from] : [edge.from, edge.to];
  const [x, y] = position(c, start);
  const [a, b] = position(c, end);
  const bend = { storefront: 24, cake: -27, topup: -42, credit: -30, merchant: -42,
    profile: -69, order: -30, delivery: 24, refund: -28 }[edge.to] ?? 24;
  const [labelDx, labelDy] = {
    profile: [36, 11], order: [-60, 15], cake: [30, 8],
    storefront: [-25, 27], delivery: [0, -11],
  }[edge.to] ?? [0, 0];
  const span = Math.hypot(a - x, b - y) || 1;
  const cx = (x + a) / 2 - (b - y) * bend / span;
  const cy = (y + b) / 2 + (a - x) * bend / span;
  const startLength = Math.hypot(cx - x, cy - y) || 1;
  const endLength = Math.hypot(cx - a, cy - b) || 1;
  const rx = radius(start) + 3, ry = radius(end) + 6;
  const sx = x + (cx - x) * rx / startLength;
  const sy = y + (cy - y) * rx / startLength;
  const ex = a + (cx - a) * ry / endLength;
  const ey = b + (cy - b) * ry / endLength;
  return {
    path: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
    labelX: (sx + 2 * cx + ex) / 4 + labelDx,
    labelY: (sy + 2 * cy + ey) / 4 - 10 + labelDy,
  };
}

const keyboard = (event, action) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
};

function TraceGraph({ c, finding, path, selected, pick, explaining, fit, arrival, full }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState([0, 0]);
  const drag = useRef(null);
  const activeNodes = new Set(path.flatMap((edge) => [edge.from, edge.to]));
  const height = 390;
  const graph = useRef(null);
  useEffect(() => {
    setZoom(1);
    setPan([0, 0]);
    if (graph.current) graph.current.scrollLeft = 0;
  }, [fit]);
  return (
    <div className={`ml-graph-wrap ${full ? "ml-full-graph" : ""}`}>
      <div className="ml-graph-viewport" ref={graph}>
        <svg viewBox={`0 0 920 ${height}`} aria-label="Payment evidence graph"
          onPointerDown={(event) => {
            if (zoom === 1 || event.target.closest("[role=button]")) return;
            drag.current = [event.clientX, event.clientY, ...pan, event.currentTarget.getScreenCTM().a];
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const [x, y, startX, startY, scale] = drag.current;
            setPan([startX + (event.clientX - x) / scale, startY + (event.clientY - y) / scale]);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}>
          <defs>
            <radialGradient id="ml-orb-shade" cx="34%" cy="22%" r="83%">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".13" />
              <stop offset="1" stopColor="#080e1b" stopOpacity=".44" />
            </radialGradient>
            {["neutral", "supported", "pending", "conflict"].map((tone) =>
              <marker key={tone} id={`ml-arrow-${tone}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path className={`ml-arrow ${tone}`} d="M 0 0 L 8 4 L 0 8 z" />
              </marker>)}
          </defs>
          <g data-view={[zoom, ...pan].join(",")} transform={`translate(${460 + pan[0]} ${height / 2 + pan[1]}) scale(${zoom}) translate(-460 ${-height / 2})`}>
            {c.edges.map((edge) => {
              const key = edgeKey(edge);
              const primary = path.includes(edge);
              const tone = primary ? finding.tone : "neutral";
              const { path: d, labelX, labelY } = route(c, edge);
              const [label] = relationship(c, edge);
              return <g key={key} role="button" tabIndex="0" aria-label={label} aria-pressed={selected === key}
                className={`ml-edge ${tone} ${explaining && !primary && edge.to !== "order" ? "ml-dim" : ""} ${arrival.has(key) ? "ml-arrival" : ""}`}
                onClick={() => pick(key)} onKeyDown={(event) => keyboard(event, () => pick(key))}>
                <path className="ml-edge-hit" d={d} />
                <path className="ml-edge-line" d={d} markerEnd={`url(#ml-arrow-${tone})`} />
                {primary && (explaining || arrival.has(key)) && <path className="ml-flow-pulse" d={d} />}
                <text x={labelX} y={labelY}>{label}</text>
              </g>;
            })}
            {c.nodes.map((node) => {
              const [name, source, Icon] = recordInfo(c, node.key);
              const [x, y] = position(c, node.key);
              const payment = node.key === "payment";
              const active = activeNodes.has(node.key);
              const r = radius(node.key);
              return <g key={node.key} role="button" tabIndex="0" aria-label={`${name} · ${source}`} aria-pressed={selected === node.key}
                className={`ml-node ${payment ? "ml-payment" : ""} ${active ? finding.tone : ""} ${explaining && !active && node.key !== "order" ? "ml-dim" : ""}`}
                transform={`translate(${x} ${y})`}
                onClick={() => pick(node.key)} onKeyDown={(event) => keyboard(event, () => pick(node.key))}>
                <circle className="ml-orb-halo" r={r + 15} />
                <circle className="ml-orb-ring" r={r + 6} />
                <circle className="ml-orb-face" r={r} />
                <circle className="ml-orb-shade" r={r - 1} fill="url(#ml-orb-shade)" />
                <Icon x={payment ? -8 : -11} y={payment ? -29 : -11} width={payment ? 16 : 22} height={payment ? 16 : 22} />
                <text y={payment ? 17 : r + 23} className="ml-node-title">{name}</text>
                <text y={payment ? r + 25 : r + 41} className="ml-node-source">{source}</text>
              </g>;
            })}
          </g>
        </svg>
      </div>
      <div className="ml-map-key" aria-hidden="true"><span>Evidence links</span><i className={finding.tone} /><span>Finding path</span></div>
      <div className="ml-zoom">
        <button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom - .25)); if (zoom <= 1.25) setPan([0, 0]); }}><Minus size={15} /></button>
        <button aria-label="Zoom in" disabled={zoom >= 2.5} onClick={() => setZoom(zoom + .25)}><Plus size={15} /></button>
        <button onClick={() => { setZoom(1); setPan([0, 0]); graph.current.scrollLeft = 0; }}><Maximize size={14} /> Fit</button>
      </div>
    </div>
  );
}

function VerticalTrace({ c, finding, path, selected, pick, arrival, explaining }) {
  const decisiveEdge = path.find((edge) => edge.to === finding.driver);
  const paidTo = path.find((edge) => edge.to === "merchant");
  const profile = c.edges.find((edge) => edge.to === "profile");
  const order = c.edges.find((edge) => edge.to === "order");
  const delivery = path.find((edge) => edge.to === "delivery");
  const activeNodes = new Set(path.flatMap((edge) => [edge.from, edge.to]));
  const record = (key) => {
    if (!has(c, key)) return null;
    const [name, source, Icon] = recordInfo(c, key);
    return <button className={`ml-step ${key === "payment" ? "ml-step-payment" : ""} ${explaining && activeNodes.has(key) ? "ml-step-highlight" : ""}`} aria-pressed={selected === key} onClick={() => pick(key)}>
      <Icon size={18} /><span><strong>{name}</strong><small>{source}</small></span>
    </button>;
  };
  const relation = (edge) => edge && <button className={`ml-step-edge ${arrival.has(edgeKey(edge)) ? "ml-arrival" : ""}`} aria-pressed={selected === edgeKey(edge)} onClick={() => pick(edgeKey(edge))}>
    <ArrowDown size={15} /> {relationship(c, edge)[0]}
  </button>;
  if (!has(c, "payment")) return <div className="ml-vertical">{c.nodes.map((node) =>
    <React.Fragment key={node.key}>{record(node.key)}</React.Fragment>)}</div>;
  return <div className={`ml-vertical ${finding.tone}`}>
    {decisiveEdge && <>{record(decisiveEdge.to)}{relation(decisiveEdge)}</>}
    {record("payment")}
    {relation(paidTo)}
    {record("merchant")}
    {relation(profile)}
    {record("profile")}
    {order && <div className="ml-vertical-branch">
      <p>From confirmed payment</p>
      {relation(order)}{record("order")}
      {relation(delivery)}{delivery && record("delivery")}
    </div>}
  </div>;
}

function Inspector({ c, selected, close, api }) {
  const [message, setMessage] = useState("");
  const title = useRef(null);
  useEffect(() => {
    title.current.focus({ preventScroll: !matchMedia("(max-width: 840px)").matches });
  }, []);
  const edge = c.edges.find((entry) => edgeKey(entry) === selected);
  const record = c.nodes.find((node) => node.key === (edge?.to || selected));
  const origin = edge && c.nodes.find((node) => node.key === edge.from);
  const heading = edge ? relationship(c, edge)[0] : record ? recordInfo(c, record.key)[0] : "Review history";
  return (
    <aside className="ml-inspector" aria-label="Evidence inspector">
      <div className="ml-inspector-top"><h3>Evidence inspector</h3><button aria-label="Close inspector" onClick={close}><X size={17} /></button></div>
      <h4 ref={title} tabIndex="-1">{heading}</h4>
      {edge && <p>{relationship(c, edge)[1]}</p>}
      {record && <>
        <dl>
          <dt>{edge ? recordInfo(c, record.key)[0] : "Source"}</dt><dd>{record.source}</dd>
          {origin && origin.source !== record.source && <><dt>{recordInfo(c, origin.key)[0]}</dt><dd>{origin.source}</dd></>}
          {record.event.label && <><dt>Observed button</dt><dd>{record.event.label}</dd></>}
        </dl>
        <details><summary>Matching IDs &amp; timestamps</summary>
          <dl>
            <dt>Evidence IDs</dt><dd>{(edge?.evidenceIds || [record.event.id]).join(" / ")}</dd>
            <dt>Checkout reference</dt><dd>{edge?.ref || record.event.ref}</dd>
            <dt>Payment ID</dt><dd>{record.event.payment}</dd>
            <dt>Event time</dt><dd>{new Date(record.event.time).toLocaleString()}</dd>
            <dt>Received time</dt><dd>{new Date(record.received).toLocaleString()}</dd>
          </dl>
        </details>
      </>}
      {c.unresolved && <details><summary>Unresolved browser observation</summary><p>{c.unresolved.reason}</p><p>{c.unresolved.record.ref}</p></details>}
      <details><summary>Applied evidence rule</summary><p>{c.rule} · {c.status}</p><p>{c.why}</p><p>{c.evidenceIds.join(" / ")}</p></details>
      <details open={selected === "history" ? true : undefined}><summary>Decision history</summary>
        <p>Analyst decision · {c.outcome}</p>
        <div className="ml-review">
          {["Request evidence", "Escalate", "Record supported outcome"].map((action) =>
            <button key={action} disabled={action.startsWith("Record") && c.status !== supported}
              onClick={() => api("/review", { ref: c.id, version: c.version, action })
                .then(() => setMessage("Decision saved")).catch((error) => setMessage(error.message))}>{action}</button>)}
        </div>
        {message && <p role="status">{message}</p>}
        <ol>{[...c.history].reverse().map((entry) => <li key={entry.version}>
          {entry.text}{entry.actor ? " · " + entry.actor : ""} <time>{new Date(entry.time).toLocaleString()}</time>
        </li>)}</ol>
      </details>
    </aside>
  );
}

function CaseOverview({ c, path, pick }) {
  return (
    <aside className="ml-overview" aria-label="Case overview">
      <span className="ml-kicker">Case overview</span>
      <h3>Sunrise Bakery</h3>
      <dl>
        <div><dt>Declared business</dt><dd>Bakery</dd></div>
        <div><dt>Evidence linked</dt><dd>{c.edges.length} {c.edges.length === 1 ? "relationship" : "relationships"}</dd></div>
        <div><dt>Analyst decision</dt><dd>{c.outcome}</dd></div>
      </dl>
      {path.length > 0 && <div className="ml-overview-links">
        <span className="ml-kicker">Finding path</span>
        {path.map((edge) => <button key={edgeKey(edge)} aria-label={`Inspect ${relationship(c, edge)[0]}`} onClick={() => pick(edgeKey(edge))}>
          <Link2 size={14} /><span>{relationship(c, edge)[0]}</span>
        </button>)}
      </div>}
    </aside>
  );
}

export function CaseTrace({ c, api, delivery }) {
  const [selected, setSelected] = useState(null);
  const [inspector, setInspector] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [tab, setTab] = useState("trace");
  const [fit, setFit] = useState(0);
  const previous = useRef(new Set(c.edges.map(edgeKey)));
  const [arrival, setArrival] = useState(new Set());
  const pickFrom = useRef(null);
  const findings = findingFor(c);
  const { title, reason, tone } = findings;
  const path = decisiveLinks(c, findings);
  const matchedBy = path.find((edge) => edge.to === findings.driver);
  const FindingIcon = tone === "supported" ? CircleCheck : tone === "conflict" ? TriangleAlert : Clock3;

  useEffect(() => {
    const keys = new Set(c.edges.map(edgeKey));
    const current = new Set([...keys].filter((key) => !previous.current.has(key)));
    previous.current = keys;
    if (current.size) setArrival(current);
  }, [c.edges]);

  useEffect(() => {
    if (!arrival.size) return;
    const timer = setTimeout(() => setArrival(new Set()), 1800);
    return () => clearTimeout(timer);
  }, [arrival]);

  function explain() {
    setTab("trace");
    setFit((value) => value + 1);
    setExplaining(true);
    setSelected(matchedBy ? edgeKey(matchedBy) : null);
    setInspector(false);
  }

  function pick(key) {
    pickFrom.current = document.activeElement;
    setSelected(key);
    setInspector(true);
  }

  return (
    <article className="ml-case" data-case={c.id} data-version={c.version}>
      <div className={`ml-finding ${tone}`} aria-live="polite" aria-atomic="true">
        <FindingIcon size={22} />
        <div><div className="ml-kicker">Finding</div><h1>{title}</h1><p>{reason}</p></div>
        {money(c) && <div className="ml-finding-amount"><strong>{money(c)}</strong><span>to Sunrise Bakery</span></div>}
      </div>
      <section className="ml-trace" aria-label="Evidence trace">
        <div className="ml-trace-toolbar">
          <h2><GitFork size={18} /> Evidence trace</h2>
          <div className="ml-trace-actions">
            {delivery}
            <button className="ml-links" aria-pressed={tab === "links"} onClick={() => setTab(tab === "links" ? "trace" : "links")}><List size={16} /> Links</button>
            <button className="ml-full-toggle" aria-pressed={tab === "full"} onClick={() => setTab(tab === "full" ? "trace" : "full")}><Maximize size={15} /> {tab === "full" ? "Path" : "Full graph"}</button>
            {tone === "conflict" && <button className="ml-explain" aria-pressed={explaining} onClick={explain}><Focus size={17} /> Explain this flag</button>}
          </div>
        </div>
        <div className={`ml-trace-frame ${inspector ? "ml-inspecting" : ""}`}>
          <div className="ml-canvas">
            {tab === "links" ? <div className="ml-link-list">
              {c.edges.map((edge) => <button key={edgeKey(edge)} aria-pressed={selected === edgeKey(edge)} onClick={() => pick(edgeKey(edge))}>
                <Link2 size={16} /><span><strong>{relationship(c, edge)[0]}</strong><small>{recordInfo(c, edge.from)[0]} · {recordInfo(c, edge.to)[0]}</small></span>
              </button>)}
              {!c.edges.length && <p>Relationships appear when records are linked.</p>}
            </div> : <>
              <TraceGraph c={c} finding={findings} path={path} selected={selected} pick={pick} explaining={explaining} fit={fit} arrival={arrival} full={tab === "full"} />
              {tab === "trace" && <VerticalTrace c={c} finding={findings} path={path} selected={selected} pick={pick} arrival={arrival} explaining={explaining} />}
            </>}
            <div className="ml-trace-footer">
              <button className="ml-history" onClick={() => pick("history")}>Review history</button>
              {explaining && matchedBy ? <button onClick={() => pick(edgeKey(matchedBy))}><Link2 size={15} /> Inspect {relationship(c, matchedBy)[0]}</button>
                : <span className="ml-trace-hint">Select a record or link to inspect it</span>}
            </div>
          </div>
          {inspector ? <Inspector key={selected} c={c} selected={selected} api={api} close={() => {
            setInspector(false);
            pickFrom.current?.focus();
          }} /> : <CaseOverview c={c} path={path} pick={pick} />}
        </div>
      </section>
    </article>
  );
}
