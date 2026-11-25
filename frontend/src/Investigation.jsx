import React, { useState } from "react";
import {
  Activity,
  GitFork,
  List,
  Clock3,
  FileText,
  TriangleAlert,
  CircleCheck,
  Link2,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import {
  EvidenceMap,
  decisive,
  recordName,
  relationName,
} from "./EvidenceMap.jsx";
import { checkoutEvidence } from "./review-policy.js";
const time = (t) => new Date(t).toLocaleTimeString();
const notificationLabels = {
  preview: "Preview · live sending disabled",
  queued: "Queued for WhatsApp",
  sending: "Submitting to WhatsApp",
  submitted: "Accepted by WhatsApp",
  rejected: "Rejected by WhatsApp · check sender setup",
  unknown: "Delivery unconfirmed · check the admin phone",
};
function DetectionTrace({ trace, rule, expanded, onToggle }) {
  const { payment, trigger, checks, browserMatched } = trace;
  const wallet = trigger.event.kind === "credit";
  const triggerLabel = wallet ? "Wallet ledger credit" : "Browser top-up observation";
  return (
    <details className="detection-trace" open={expanded} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>How this payment was flagged</summary>
      <p><strong>{rule}</strong> · The matched {wallet ? "wallet credit" : "top-up observation"} conflicts with the merchant’s declared bakery business. The case is flagged for review.</p>
      <p>{wallet && !browserMatched
        ? "No matching browser top-up observation was used. The wallet record was enough to trigger this rule."
        : wallet ? "The wallet credit triggered the rule. A browser top-up observation also matched."
          : "This flag relies on a client-reported click. There is no matching wallet-credit record."}</p>
      <div className="trace-table-scroll">
        <table>
          <caption>Matching payment and evidence fields</caption>
          <thead><tr><th scope="col">Field</th><th scope="col">Confirmed payment</th><th scope="col">{triggerLabel}</th></tr></thead>
          <tbody>{checks.map(({ label, payment, trigger }) => (
            <tr key={label}><th scope="row">{label}</th><td><code>{payment}</code></td><td><code>{trigger}</code></td></tr>
          ))}</tbody>
        </table>
      </div>
      <details>
        <summary>Raw records and timestamps</summary>
        <pre>{JSON.stringify({ payment, trigger }, null, 2)}</pre>
      </details>
      {wallet && <p>The demo backend posts this simulated ledger credit when the wallet top-up is confirmed. A real investigation would need access to evidence linking the payment to the wallet.</p>}
    </details>
  );
}

export function Investigation({ c, api }) {
  const [selected, select] = useState("payment"),
    [explaining, setExplain] = useState(false),
    [showTrace, setShowTrace] = useState(false),
    [tab, setTab] = useState("Graph"),
    [message, notice] = useState("");
  const key = selected.replace("edge/", ""),
    record = c.nodes.find((n) => n.key === key) || c.nodes[0],
    edge = c.edges.find((e) => e.to === key);
  const driver = decisive(c),
    conflict = ["credit", "topup"].includes(driver),
    supported = c.status === "Cake sale supported";
  const tone = conflict ? "conflict" : supported ? "supported" : "pending",
    Icon = conflict ? TriangleAlert : supported ? CircleCheck : Clock3;
  const hasOrder = c.nodes.some((n) => n.key === "order");
  const { trace } = checkoutEvidence(c.records);
  const pick = (k) => {
    select(k);
    setExplain(false);
  };
  const explain = () => {
    select(c.edges.some((e) => e.to === driver) ? "edge/" + driver : driver);
    setExplain(true);
    setShowTrace(true);
    setTab("Graph");
  };
  const history = (
    <ol className="history">
      {c.history.map((h) => (
        <li key={h.version}>
          <time>{time(h.time)}</time>
          {h.text}
          {h.actor ? " · " + h.actor : ""}
        </li>
      ))}
    </ol>
  );
  const ids = selected.startsWith("edge/")
    ? edge?.evidenceIds
    : [record.event.id];
  return (
    <>
      <section className="investigation">
        <div className="section-head">
          <h2>Evidence explorer</h2>
          <div className="tabs">
            {[
              [GitFork, "Graph"],
              [Clock3, "Timeline"],
              [List, "Links"],
            ].map(([I, name]) => (
              <button
                key={name}
                aria-pressed={name === tab}
                onClick={() => setTab(name)}
              >
                <I />
                {name}
              </button>
            ))}
          </div>
        </div>
        <EvidenceMap
          c={c}
          selected={selected}
          pick={pick}
          explain={explaining}
          onExplain={explain}
          visible={tab === "Graph"}
        />
        {tab === "Timeline" && (
          <section className="alternative">
            <h3>Evidence timeline</h3>
            {history}
          </section>
        )}
        {tab === "Links" && (
          <section className="alternative">
            <h3>Relationships</h3>
            {c.edges.map((e) => (
              <button key={e.to} onClick={() => pick("edge/" + e.to)}>
                <Link2 />
                {recordName(c, e.from)} <span>{relationName(c, e.to)}</span>{" "}
                {recordName(c, e.to)}
                <ChevronRight />
              </button>
            ))}
          </section>
        )}
        <div className="evidence-strip">
          <FileText />
          <div>
            <small>Merchant claim</small>
            <b>{hasOrder ? recordName(c, "order") : "Awaiting order"}</b>
          </div>
          <ArrowDownRight />
          <div className={tone}>
            <small>
              {conflict ? "Contradictory evidence" : "Linked outcome"}
            </small>
            <b>
              {conflict || supported
                ? recordName(c, driver)
                : "Evidence pending"}
            </b>
          </div>
        </div>
        {trace && <DetectionTrace trace={trace} rule={c.rule} expanded={showTrace} onToggle={setShowTrace} />}
      </section>
      <aside data-case={c.id} data-version={c.version}>
        <div className="section-head">
          <h2 className="inspector-heading">Case inspector</h2>
        </div>
        <div className={"finding " + tone} aria-live="polite">
          <span className="eyebrow">
            <Icon />
            Finding
          </span>
          <h2>{c.status}</h2>
          <p>{c.why}</p>
          {c.unresolved && (
            <details>
              <summary>Unresolved browser observation</summary>
              <p>{c.unresolved.reason}</p>
              <small>Reported reference {c.unresolved.record.ref}</small>
            </details>
          )}
          {c.fulfilment && (
            <p>
              {c.fulfilment.method} ·{" "}
              {c.fulfilment.stage === "Delivered" &&
              c.fulfilment.method === "Pickup"
                ? "Collected"
                : c.fulfilment.stage}
            </p>
          )}
        </div>
        {c.notification && (
          <div className="record-section" aria-live="polite">
            <small>Admin WhatsApp alert</small>
            <h3>{notificationLabels[c.notification.status]}</h3>
            <details>
              <summary>View critical report</summary>
              <p>{c.notification.report.reason}</p>
              <dl>
                <dt>Case ID</dt><dd>{c.notification.report.caseId}</dd>
                <dt>Payment ID</dt><dd>{c.notification.report.paymentId}</dd>
                <dt>Evidence ID</dt><dd>{c.notification.report.evidenceId}</dd>
              </dl>
            </details>
          </div>
        )}
        <div className="record-section">
          <small>
            Selected {selected.startsWith("edge/") ? "relationship" : "record"}
          </small>
          <h3>
            {selected.startsWith("edge/")
              ? relationName(c, key)
              : recordName(c, record.key)}
          </h3>
          <p className="source">
            <Activity /> {record.source}
          </p>
          <details>
            <summary>Matching IDs &amp; timestamps</summary>
            <dl>
              {Object.entries({
                "Record IDs": ids?.join(" / "),
                "Checkout reference": c.id,
                "Payment ID": record.event.payment,
                ...(c.provider ? {
                  "PayU transaction ID": c.provider.transactionId,
                  "PayU payment ID": c.provider.paymentId,
                } : {}),
                "Event time": new Date(record.event.time).toLocaleString(),
                "Received time": new Date(record.received).toLocaleString(),
                ...(record.event.label
                  ? { [record.key === "order" ? "Order description" : "Observed button"]: record.event.label }
                  : {}),
              }).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
          <details>
            <summary>Applied evidence rule</summary>
            <p>{c.rule}</p>
            <dl>
              <dt>Input evidence IDs</dt>
              <dd>{c.evidenceIds.join(" / ")}</dd>
            </dl>
            {c.fulfilment?.events?.map((e) => (
              <p key={e.id}>
                {e.stage} · {e.actor} · {e.id}
              </p>
            ))}
          </details>
        </div>
        <div className="review">
          <small>Analyst decision</small>
          <strong>{c.outcome}</strong>
          <div>
            {["Request evidence", "Escalate", "Record supported outcome"].map(
              (action) => (
                <button
                  key={action}
                  disabled={action.startsWith("Record") && !supported}
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
          {message && <p role="status">{message}</p>}
          <details>
            <summary>Decision history</summary>
            {history}
          </details>
        </div>
      </aside>
    </>
  );
}
