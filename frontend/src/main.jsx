import React, { useState, useEffect, useRef, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars, Float, MeshDistortMaterial } from "@react-three/drei";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  Eye,
  FileText,
  Focus,
  GitBranch,
  Layers,
  Link2,
  Maximize2,
  Network,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Target,
  TriangleAlert,
  Users,
  X,
  Zap,
} from "lucide-react";
import * as THREE from "three";
import "./style.css";
import MoneyTrail from "./MoneyTrail.jsx";
import { reviewPolicy, evidenceFor, buildCaseRecord, caseReportHTML } from "./review-policy.js";
const money = (n) => "₹" + n.toLocaleString("en-IN");
const palette = {
  safe: "#42d7ae",
  risk: "#ff776c",
  unknown: "#e7b767",
  neutral: "#389dff",
};
const scenarios = {
  mixed: {
    label: "Mixed-purpose merchant",
    tag: "PURPOSE MISMATCH",
    color: "risk",
    title: "Ordinary payments. A different purpose.",
    desc: "Two ₹500 payments. The same merchant. Follow their evidence to see what each customer paid for.",
    score: 82,
    tx: 248,
    amount: 124000,
    detail:
      "A verified checkout observation links 18 payments to an activity outside the declared bakery profile.",
  },
  seasonal: {
    label: "Diwali sales surge",
    tag: "SUPPORTED ACTIVITY",
    color: "safe",
    title: "A sales spike with a legitimate explanation.",
    desc: "Payment volume rose 6×. Matching orders and delivery records support a seasonal bakery campaign.",
    score: 19,
    tx: 612,
    amount: 306000,
    detail:
      "The campaign, orders and fulfilment records explain the surge. Continue normal monitoring.",
  },
  unknown: {
    label: "Incomplete evidence",
    tag: "CLARIFICATION NEEDED",
    color: "unknown",
    title: "An incomplete trail deserves a question.",
    desc: "Payment records are visible. The checkout purpose is not. Request the missing evidence before drawing a conclusion.",
    score: 56,
    tx: 96,
    amount: 48000,
    detail:
      "The payment session is recorded, but independent evidence of the checkout activity is unavailable.",
  },
};
const baseNodes = [
  {
    id: "customers",
    name: "Customers",
    sub: "Verified payer tokens",
    pos: [-5.4, 1.2, 1.3],
    type: "neutral",
    kind: "customers",
  },
  {
    id: "cake",
    name: "Cake checkout",
    sub: "CKT-CAKE-01",
    pos: [-2.5, 2.1, -1.1],
    type: "safe",
    kind: "checkout",
  },
  {
    id: "other",
    name: "Alternate checkout",
    sub: "CKT-ALT-09",
    pos: [-2.5, -1.5, 2.1],
    type: "risk",
    kind: "checkout",
  },
  {
    id: "bakery",
    name: "Sunrise Bakery",
    sub: "MID • SRB-2041",
    pos: [0.7, 0.3, 0],
    type: "neutral",
    kind: "merchant",
  },
  {
    id: "orders",
    name: "Cake orders",
    sub: "Order + delivery matched",
    pos: [0.4, 3.05, -2.6],
    type: "safe",
    kind: "evidence",
  },
  {
    id: "supplier",
    name: "Flour supplier",
    sub: "Verified operating expense",
    pos: [4, 2, -1.7],
    type: "safe",
    kind: "receiver",
  },
  {
    id: "receiver",
    name: "Receiver R",
    sub: "Owner unverified",
    pos: [4, -1.5, 2.3],
    type: "unknown",
    kind: "receiver",
  },
  {
    id: "endpoint",
    name: "Account Z",
    sub: "Last observed account",
    pos: [6, -3.1, 0.5],
    type: "unknown",
    kind: "receiver",
  },
];
const edgeDefs = [
  ["customers", "cake", "safe"],
  ["customers", "other", "risk"],
  ["cake", "bakery", "safe"],
  ["other", "bakery", "risk"],
  ["cake", "orders", "safe"],
  ["bakery", "supplier", "safe"],
  ["bakery", "receiver", "unknown"],
  ["receiver", "endpoint", "unknown"],
];
function FlowEdge({ a, b, color, active }) {
  const particles = useRef([]);
  const curve = React.useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3((a[0]+b[0])/2, (a[1]+b[1])/2+0.65, (a[2]+b[2])/2+0.9),new THREE.Vector3(...b)),[a,b]);
  const points = React.useMemo(()=>curve.getPoints(48),[curve]);
  useFrame(({clock})=>{if(active) particles.current.forEach((mesh,i)=>{if(mesh)mesh.position.copy(curve.getPoint((clock.elapsedTime*0.14+i/3)%1));});});
  return <><Line points={points} color={color} lineWidth={1.5} transparent opacity={0.58}/>{[0,1,2].map(i=><mesh key={i} ref={el=>particles.current[i]=el} visible={active}><sphereGeometry args={[0.055,12,12]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh>)}</>;
}
function SpatialNode({node:n,selected,onSelect,dim,playing}) {
 const spin=useRef();
 useFrame((_,dt)=>{if(spin.current&&playing)spin.current.rotation.z+=dt*0.22;});
 const c=palette[n.type], radius=n.id==='bakery'?0.57:0.32;
 return <group position={n.pos}>
  <Float speed={playing?1.4:0} rotationIntensity={0.12} floatIntensity={0.25}>
   <mesh onClick={e=>{e.stopPropagation();onSelect(n.id);}}>
    <icosahedronGeometry args={[radius,3]}/><MeshDistortMaterial color={c} emissive={c} emissiveIntensity={selected?1.2:0.45} metalness={0.7} roughness={0.19} distort={0.13} speed={playing?1.6:0} transparent opacity={dim?0.2:1}/>
   </mesh>
   <group ref={spin}><mesh rotation={[Math.PI/2.6,0.3,0]}><torusGeometry args={[radius*1.55,0.018,8,80]}/><meshBasicMaterial color={c} transparent opacity={dim?0.1:0.65}/></mesh>
   {selected&&<mesh rotation={[0.3,Math.PI/2,0]}><torusGeometry args={[radius*1.85,0.012,8,80]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.5}/></mesh>}</group>
  </Float>
  <Html position={[0,-radius-0.4,0]} center zIndexRange={[5,0]}><button aria-label={'Inspect '+n.name} onClick={()=>onSelect(n.id)} className={'spatial-label '+(selected?'active':'')+(dim?' dim':'')} style={{'--node-color':c}}><strong>{n.name}</strong><small>{n.sub}</small></button></Html>
 </group>;
}
function WebGLGraph({
  scenario,
  selected,
  onSelect,
  playing,
  bank,
  evidence,
  focus,
  filter,
}) {
  const [cameraMode,setCameraMode]=useState("perspective");
  const [autoOrbit,setAutoOrbit]=useState(false);
  const nodes = baseNodes.map((n) =>
    n.id === "other"
      ? {
          ...n,
          name:
            scenario === "seasonal" && evidence
              ? "Festival checkout"
              : scenario === "unknown" || !evidence
                ? "Unknown checkout"
                : "Betting checkout",
          type:
            scenario === "seasonal" && evidence
              ? "safe"
              : scenario === "unknown" || !evidence
                ? "unknown"
                : "risk",
        }
      : n,
  );
  const visible = nodes.filter(
    (n) => bank || !["receiver", "endpoint", "supplier"].includes(n.id),
  );
  const kinds = Object.fromEntries(nodes.map((n) => [n.id, n.type]));
  return (
    <Canvas key={focus}
      camera={{ position: [1, 6, 16], fov: 48 }}
      dpr={[1, 1.7]}
    >
      <color attach="background" args={["#040a1b"]} />
      <fog attach="fog" args={["#040a1b",25,65]} />
      <ambientLight intensity={0.7}/><pointLight position={[0,6,6]} intensity={55} color="#3b9bff"/><pointLight position={[-6,-2,3]} intensity={20} color="#9a75ff"/>
      <Stars radius={45} depth={25} count={1400} factor={2.2} saturation={0.4} fade speed={playing?0.3:0}/>
      <gridHelper args={[42,42,"#134b8d","#0a1b37"]} position={[0,-4.3,0]}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-4.32,0]}><planeGeometry args={[50,50]}/><meshStandardMaterial color="#040918" metalness={0.65} roughness={0.36}/></mesh>
      <Suspense fallback={null}>
        <GraphCamera mode={cameraMode} />
        <Html fullscreen style={{pointerEvents:'none'}} zIndexRange={[10,9]}><div className="camera-presets" style={{pointerEvents:'auto'}}><button onClick={()=>setCameraMode('perspective')} className={cameraMode==='perspective'?'active':''}>Perspective</button><button onClick={()=>setCameraMode('top')} className={cameraMode==='top'?'active':''}>Front view</button><button onClick={()=>setAutoOrbit(v=>!v)} aria-pressed={autoOrbit}>{autoOrbit?'Stop orbit':'Auto orbit'}</button></div></Html>
        <group position={[-0.1, 0, 0]}>
          {edgeDefs
            .filter(
              ([a, b]) =>
                visible.some((n) => n.id === a) &&
                visible.some((n) => n.id === b),
            )
            .map(([a, b, t], i) => {
              const c = a === "other" || b === "other" ? kinds.other : t;
              return (
                <FlowEdge
                  key={i}
                  a={nodes.find((n) => n.id === a).pos}
                  b={nodes.find((n) => n.id === b).pos}
                  color={palette[c]}
                  active={playing}
                />
              );
            })}
          {visible.map(n=><SpatialNode key={n.id} node={n} selected={selected===n.id} onSelect={onSelect} playing={playing} dim={filter!=="all"&&n.type!==filter}/>)}
        </group>
        <OrbitControls
          key={focus}
          autoRotate={autoOrbit && playing}
          autoRotateSpeed={0.45}
          enableRotate={true}
          enablePan
          enableZoom
          minDistance={7}
          maxDistance={30}
          maxPolarAngle={Math.PI*0.82}
          enableDamping
          dampingFactor={0.07}
        />
      </Suspense>
    </Canvas>
  );
}
function GraphCamera({mode}) {
 const {camera,size}=useThree();
 useEffect(()=>{camera.position.set(mode==="top"?0:1,mode==="top"?0:6,size.width<650?22:17);camera.lookAt(0,0,0);camera.updateProjectionMatrix();},[camera,size.width,mode]);
 return null;
}
class GraphBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <SVGGraph {...this.props} />
    ) : (
      this.props.children
    );
  }
}
function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
const hasWebGL = supportsWebGL();
function Graph(props) {
  return hasWebGL ? (
    <GraphBoundary {...props}>
      <WebGLGraph {...props} />
    </GraphBoundary>
  ) : (
    <SVGGraph {...props} />
  );
}
function SVGGraph({
  scenario,
  selected,
  onSelect,
  playing,
  bank,
  evidence,
  filter,
  focus,
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState([0, 0]);
  const drag = useRef(null);
  useEffect(() => {
    setZoom(1);
    setPan([0, 0]);
  }, [focus]);
  const coords = {
    customers: [74, 173],
    cake: [238, 100],
    other: [238, 287],
    bakery: [425, 191],
    orders: [420, 63],
    supplier: [605, 100],
    receiver: [605, 287],
    endpoint: [730, 340],
  };
  const nodes = baseNodes
    .filter((n) => bank || !["receiver", "endpoint", "supplier"].includes(n.id))
    .map((n) =>
      n.id === "other"
        ? {
            ...n,
            name:
              scenario === "seasonal" && evidence
                ? "Festival checkout"
                : scenario === "unknown" || !evidence
                  ? "Unknown checkout"
                  : "Betting checkout",
            type:
              scenario === "seasonal" && evidence
                ? "safe"
                : scenario === "unknown" || !evidence
                  ? "unknown"
                  : "risk",
          }
        : n,
    );
  return (
    <svg
      className="svg-graph"
      viewBox="0 0 820 420"
      role="group"
      aria-label="Interactive transaction network"
      onWheel={(e) =>
        setZoom((z) => Math.max(0.7, Math.min(1.8, z - e.deltaY * 0.001)))
      }
      onPointerDown={(e) => {
        if (e.target.closest("[data-node]")) return;
        drag.current = [e.clientX, e.clientY, ...pan];
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          setPan([
            drag.current[2] + (e.clientX - drag.current[0]),
            drag.current[3] + (e.clientY - drag.current[1]),
          ]);
        }
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <defs>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <g
        transform={`translate(${pan[0]} ${pan[1]}) translate(410 210) scale(${zoom}) translate(-410 -210)`}
      >
        {edgeDefs
          .filter(
            ([a, b]) =>
              nodes.some((n) => n.id === a) && nodes.some((n) => n.id === b),
          )
          .map(([a, b, t], i) => {
            const c =
              a === "other" || b === "other"
                ? nodes.find((n) => n.id === "other").type
                : t;
            const p = coords[a],
              q = coords[b];
            const path = `M${p[0]},${p[1]} Q${(p[0] + q[0]) / 2},${p[1]} ${q[0]},${q[1]}`;
            return (
              <g key={i}>
                <path
                  d={path}
                  stroke={palette[c]}
                  strokeWidth="1.4"
                  fill="none"
                  opacity=".35"
                />
                {playing && (
                  <circle r="3" fill={palette[c]}>
                    <animateMotion
                      dur={`${3 + i * 0.2}s`}
                      repeatCount="indefinite"
                      path={path}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        {nodes.map((n) => {
          const [x, y] = coords[n.id],
            c = palette[n.type];
          return (
            <g
              key={n.id}
              data-node={n.id}
              transform={`translate(${x},${y})`}
              role="button"
              aria-label={"Inspect " + n.name}
              tabIndex="0"
              onClick={() => onSelect(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.id);
                }
              }}
              style={{
                cursor: "pointer",
                opacity: filter !== "all" && n.type !== filter ? 0.25 : 1,
              }}
            >
              {selected === n.id && (
                <circle r="35" fill={c} opacity=".12" filter="url(#nodeGlow)" />
              )}
              <circle
                r={n.id === "bakery" ? 29 : 23}
                fill={n.id === "bakery" ? "#1b3538" : "#11212d"}
                stroke={c}
                strokeOpacity=".65"
              />
              {selected === n.id && (
                <circle
                  r={n.id === "bakery" ? 35 : 29}
                  fill="none"
                  stroke={c}
                  strokeWidth="1"
                />
              )}
              <text
                textAnchor="middle"
                y="5"
                fill={c}
                fontSize="16"
                fontFamily="sans-serif"
              >
                {n.kind === "merchant"
                  ? "▥"
                  : n.kind === "customers"
                    ? "◎"
                    : n.kind === "evidence"
                      ? "≡"
                      : n.kind === "receiver"
                        ? "↗"
                        : "⌘"}
              </text>
              <text
                textAnchor="middle"
                y={n.id === "bakery" ? 49 : 42}
                fill="#cfdeea"
                fontSize={n.id === "bakery" ? 13 : 11}
                fontWeight="500"
              >
                {n.name}
              </text>
              <text
                textAnchor="middle"
                y={n.id === "bakery" ? 64 : 56}
                fill="#658397"
                fontSize="8"
              >
                {n.sub}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
function savedCase(id){try{return JSON.parse(localStorage.getItem('merchantlens-case-'+id)||'{}');}catch{return {};}}
function App() {
  const [scenario, setScenario] = useState("mixed"),
    [selected, setSelected] = useState("bakery"),
    [view, setView] = useState("investigation"),
    [playing, setPlaying] = useState(true),
    [bank, setBank] = useState(true),
    [evidence, setEvidence] = useState(true),
    [focus, setFocus] = useState(0),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(""),
    [impact, setImpact] = useState("checkout"),
    [requested, setRequested] = useState(()=>savedCase("mixed").requested ?? false),
    [response, setResponse] = useState(()=>savedCase("mixed").response ?? false),
    [outcome, setOutcome] = useState(()=>savedCase("mixed").outcome ?? ""),
    [reason, setReason] = useState(()=>savedCase("mixed").reason ?? ""),
    [audit, setAudit] = useState(()=>{try{return JSON.parse(localStorage.getItem("merchantlens-audit")||"[]");}catch{return [];}}),
    [verified, setVerified] = useState(false),
    [modal, setModal] = useState(null);
  useEffect(()=>{try{localStorage.setItem('merchantlens-audit',JSON.stringify(audit));}catch{}},[audit]);
  useEffect(()=>{try{localStorage.setItem('merchantlens-case-'+scenario,JSON.stringify({requested,response,outcome,reason}));}catch{}},[scenario,requested,response,outcome,reason]);
  const s = scenarios[scenario];
  const effectiveType = !evidence ? "unknown" : s.color;
  const unresolved = scenario === "unknown" || !evidence;
  const policy = reviewPolicy({scenario, evidence, verified, reason});
  const record = () => buildCaseRecord({scenario,evidence,bank,verified,outcome,reason,audit,requested,response});
  function updateEvidence() { setEvidence(v => !v); setVerified(false); setOutcome(""); }
  function notify(t) {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  }
  function changeScenario(v) {
    setVerified(false);
    setScenario(v);
    setSelected("bakery");
    setEvidence(true);
    const previous=savedCase(v);
    setRequested(previous.requested??false);
    setResponse(previous.response??false);
    setOutcome(previous.outcome??"");
    setReason(previous.reason??"");
    setView("investigation");
  }
  function log(text) {
    setAudit((a) => [
      { text, scenario, reason, time: new Date().toLocaleString("en-GB") },
      ...a,
    ]);
    notify(text);
  }
  function exportCase() {
    const data = record();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "merchantlens-case.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Case report exported");
  }
  function exportPrintableCase() {
    const url = URL.createObjectURL(new Blob([caseReportHTML(record())], {type: "text/html"}));
    const a = document.createElement("a"); a.href = url; a.download = `MerchantLens_Case_${scenario}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Case report downloaded. Open it and choose Print / Save as PDF.");
  }
  const selectedName =
    baseNodes.find((n) => n.id === selected)?.name || "Sunrise Bakery";
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="MerchantLens home"
          onClick={(e) => {
            e.preventDefault();
            setView("investigation");
          }}
        >
          <span className="brand-mark">
            <Network size={23} />
          </span>
          <span>
            merchant<span className="light">lens</span>
            <small>MERCHANT INTELLIGENCE</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">P</span>
          <div>
            Paarth’s workspace<small>Investigation sandbox</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            ["investigation", Network, "Investigation"],
            ["transactions", Activity, "Transactions"],
            ["review", ShieldCheck, "Review queue"],
            ["impact", Target, "Impact preview"],
            ["architecture", Layers, "Architecture"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
              {id === "review" && <span className="nav-count">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-story">
          <div className="tiny-label">THE QUESTION</div>
          <p>Does the activity match the business?</p>
          <span>Follow the evidence.</span>
          <div className="mini-network">
            ◉ <span>────</span> ◉ <span>────</span> ◎
          </div>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Synthetic event replay
          <small>No live payment connection</small>
          <div className="author">
            <span className="avatar">PJ</span>
            <div>
              Paarth Jain<small>Project author</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <ChevronRight size={13} />{" "}
            <span>
              {view === "investigation"
                ? "Follow the hidden connection"
                : view.charAt(0).toUpperCase() + view.slice(1)}
            </span>
          </div>
          <div className="header-actions">
            <span className="demo-tag">
              <span /> DEMO ENVIRONMENT
            </span>
            <button
              className="icon-btn"
              title="Export case"
              onClick={exportCase}
            >
              <Download size={17} />
            </button>

          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div className="eyebrow">FOLLOW THE MONEY. VERIFY THE PURPOSE.</div>
            <div className="title-row">
              <div>
                <h1>
                  {view === "investigation"
                    ? "Follow the hidden connection"
                    : view === "transactions"
                      ? "Transaction explorer"
                      : view === "review"
                        ? "Human review"
                        : view === "impact"
                          ? "Intervention impact"
                          : "System architecture"}
                </h1>
                <p>
                  {view === "investigation"
                    ? "A spatial evidence room. Every payment has a story. Uncover the one that matters."
                    : view === "transactions"
                      ? "Inspect individual payments and their supporting evidence."
                      : view === "review"
                        ? "Resolve the uncertainty. Record the reasoning."
                        : view === "impact"
                          ? "Understand the scope before choosing an action."
                          : "The deployment blueprint behind the prototype."}
                </p>
              </div>
              <div className="scenario-picker">
                <label>REPLAY SCENARIO</label>
                <select
                  value={scenario}
                  onChange={(e) => changeScenario(e.target.value)}
                >
                  {Object.entries(scenarios).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="stats">
            <Metric
              label="Payments observed"
              value={s.tx}
              detail="Synthetic 24-hour window"
              icon={Activity}
            />
            <Metric
              label="Collection value"
              value={money(s.amount)}
              detail="Within provider coverage"
              icon={ArrowDownLeft}
            />
            <Metric
              label="Purpose assessment"
              value={
                effectiveType === "risk"
                  ? "Mismatch"
                  : effectiveType === "safe"
                    ? "Supported"
                    : "Unresolved"
              }
              detail={
                effectiveType === "risk"
                  ? "18 payments linked to checkout"
                  : effectiveType === "safe"
                    ? "Campaign evidence reconciled"
                    : "Additional evidence needed"
              }
              type={effectiveType}
              icon={Shield}
            />
            <Metric
              label="Evidence coverage"
              value={`${3 + (unresolved ? 0 : 1) + (bank ? 1 : 0)} / 5`}
              detail={
                bank ? "Bank feed included in demo" : "Bank feed unavailable"
              }
              icon={GitBranch}
            />
          </div>
          {view === "investigation" && (
            <>
              <MoneyTrail bank={bank} scenario={scenario} onSelect={id=>{setSelected(id);document.querySelector('.graph-panel')?.scrollIntoView({behavior:'smooth',block:'center'});}} onReview={()=>setView('review')}/>
              <div className="investigation-grid">
                <section className="graph-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="green-square" /> Spatial intelligence{" "}
                      <span className="muted">/ SRB-2041</span>
                    </div>
                    <div className="graph-actions">
                      <button
                        title="Pause animation"
                        onClick={() => setPlaying(!playing)}
                      >
                        {playing ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <button
                        title="Reset graph view"
                        onClick={() => setFocus((x) => x + 1)}
                      >
                        <Focus size={16} />
                      </button>
                      <button
                        title="Open graph in focus mode"
                        onClick={() => setModal("graph")}
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="graph-area">
                    <div className="graph-overlay">
                      <span className="replay-dot" />{" "}
                      {playing ? "REPLAY RUNNING" : "REPLAY PAUSED"}
                      <span className="graph-time">12 NOV · 10:00–10:30</span>
                    </div>
                    <Graph
                      {...{
                        scenario,
                        selected,
                        playing,
                        bank,
                        evidence,
                        focus,
                        filter,
                      }}
                      onSelect={setSelected}
                    />
                    <div className="graph-hint">
                      {hasWebGL ? "3D SPACE · Drag to orbit · Right-drag to pan · Scroll to zoom" : "COMPATIBILITY VIEW · WebGL unavailable · Drag to pan"}
                    </div>
                  </div>
                  <div className="graph-footer">
                    <div className="legend">
                      {[
                        ["all", "All relationships"],
                        ["safe", "Supported"],
                        ["risk", "Mismatch"],
                        ["unknown", "Unresolved"],
                      ].map(([id, label]) => (
                        <button
                          onClick={() => setFilter(id)}
                          className={filter === id ? "chosen" : ""}
                          key={id}
                        >
                          <i style={{ background: palette[id] || "#95a9bc" }} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <span>{bank ? "8" : "5"} entities</span>
                  </div>
                </section>
                <EvidencePanel
                  {...{
                    selected,
                    selectedName,
                    scenario,
                    evidence,
                    requested,
                    response,
                  }}
                  onEvidence={updateEvidence}
                  onInspect={() => setModal("evidence")}
                  onRequest={() => {
                    setRequested(true);
                    log("Clarification requested for checkout CKT-ALT-09");
                  }}
                  onImpact={() => setView("impact")}
                />
              </div>
              <div className="bottom-grid">
                <section className="timeline panel">
                  <div className="section-heading">
                    <h3>Evidence timeline</h3>
                    <span className="tiny-label">EVENT TIME</span>
                  </div>
                  {[
                    [
                      "10:02:14",
                      "Cake payment received",
                      "₹500 · TXN-0801",
                      "safe",
                    ],
                    [
                      "10:04:08",
                      scenario === "seasonal" && evidence
                        ? "Festival order received"
                        : "Alternate checkout payment",
                      "₹500 · TXN-0802",
                      effectiveType,
                    ],
                    [
                      "10:05:32",
                      evidence
                        ? "Checkout evidence reconciled"
                        : "Checkout evidence unavailable",
                      evidence
                        ? "Provider session reference matched"
                        : "Purpose remains unresolved",
                      effectiveType,
                    ],
                    [
                      "10:07:11",
                      bank
                        ? "Onward transfer observed"
                        : "Bank feed unavailable",
                      bank
                        ? "Receiver R → Account Z · ₹43,000"
                        : "Trail ends at provider coverage",
                      "unknown",
                    ],
                  ].map(([t, a, b, c]) => (
                    <div className="timeline-row" key={t}>
                      <time>{t}</time>
                      <i style={{ background: palette[c] }} />
                      <div>
                        <strong>{a}</strong>
                        <small>{b}</small>
                      </div>
                      <ChevronRight size={14} />
                    </div>
                  ))}
                </section>
                <section className="panel assessment">
                  <div className="section-heading">
                    <h3>Assessment signals</h3>
                    <span className="fixture">ILLUSTRATIVE</span>
                  </div>
                  <div className="risk-number">
                    <strong style={{ color: palette[effectiveType] }}>
                      {unresolved ? 56 : s.score}
                      <span>/100</span>
                    </strong>
                    <div>
                      Case priority
                      <small>Fixture score · no trained model</small>
                    </div>
                  </div>
                  {[
                    [
                      "XGBoost",
                      unresolved ? 58 : scenario === "mixed" ? 86 : 22,
                    ],
                    [
                      "CatBoost",
                      unresolved ? 54 : scenario === "mixed" ? 78 : 16,
                    ],
                  ].map(([name, value]) => (
                    <div className="model-row" key={name}>
                      <span>{name}</span>
                      <div>
                        <i
                          style={{
                            width: value + "%",
                            background: palette[effectiveType],
                          }}
                        />
                      </div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                  <p className="assessment-note">
                    {unresolved
                      ? "A risk score cannot resolve missing purpose evidence."
                      : s.detail}
                  </p>
                </section>
                <section className="panel coverage">
                  <div className="section-heading">
                    <h3>Coverage controls</h3>
                    <SlidersHorizontal size={16} />
                  </div>
                  <p>Explore how available evidence changes the assessment.</p>
                  <Toggle
                    label="Checkout purpose evidence"
                    checked={evidence}
                    onChange={updateEvidence}
                  />
                  <Toggle
                    label="Authorized bank feed"
                    checked={bank}
                    onChange={() => setBank(!bank)}
                  />
                  <div className="coverage-note">
                    <Eye size={16} />
                    <span>
                      Only observed relationships appear. Missing data stays
                      visible.
                    </span>
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "transactions" && (
            <section className="panel transactions">
              <div className="section-heading">
                <h3>Payment ledger</h3>
                <div className="search">
                  <Search size={16} />
                  <input
                    placeholder="Search ID or purpose"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>TRANSACTION</th>
                    <th>EVENT TIME</th>
                    <th>AMOUNT</th>
                    <th>CHECKOUT</th>
                    <th>PURPOSE</th>
                    <th>EVIDENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => ({
                    id: "TXN-" + String(801 + i).padStart(4, "0"),
                    time: `10:${String(2 + i).padStart(2, "0")}:${String(14 + i * 3).padStart(2, "0")}`,
                    other: i % 3 === 1,
                  }))
                    .filter((t) =>
                      (
                        t.id +
                        " " +
                        (t.other ? "alternate betting" : "cake order")
                      )
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelected(t.other ? "other" : "cake");
                          setView("investigation");
                        }}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSelected(t.other ? "other" : "cake");
                            setView("investigation");
                          }
                        }}
                      >
                        <td>
                          <span className="tx-icon">
                            <ArrowDownLeft size={15} />
                          </span>
                          {t.id}
                        </td>
                        <td>{t.time}</td>
                        <td>₹500.00</td>
                        <td>{t.other ? "CKT-ALT-09" : "CKT-CAKE-01"}</td>
                        <td>
                          <Status
                            type={t.other ? effectiveType : "safe"}
                            text={
                              t.other
                                ? effectiveType === "risk"
                                  ? "Mismatch"
                                  : effectiveType === "safe"
                                    ? "Festival order"
                                    : "Unresolved"
                                : "Cake order"
                            }
                          />
                        </td>
                        <td>
                          {t.other && !evidence
                            ? "Unavailable"
                            : "Inspect record"}{" "}
                          <ArrowUpRight size={13} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="table-foot">
                12 sample records shown · Synthetic dataset · Click a row to
                investigate
              </p>
            </section>
          )}
          {view === "impact" && (
            <div className="impact-layout">
              <section className="panel impact-main">
                <div className="eyebrow">ACTION SCOPE</div>
                <h2>What would this action affect?</h2>
                <p>
                  Compare the observed scope of a checkout restriction with a
                  merchant-wide restriction. This preview does not execute
                  payment controls.
                </p>
                <div className="segmented">
                  <button
                    className={impact === "checkout" ? "active" : ""}
                    onClick={() => setImpact("checkout")}
                  >
                    Linked checkout
                  </button>
                  <button
                    className={impact === "merchant" ? "active" : ""}
                    onClick={() => setImpact("merchant")}
                  >
                    Entire merchant
                  </button>
                </div>
                <div className="impact-big">
                  <div>
                    <strong>{impact === "checkout" ? 18 : s.tx}</strong>
                    <span>payments in selected scope</span>
                  </div>
                  <div>
                    <strong
                      className={impact === "checkout" ? "green" : "coral"}
                    >
                      {impact === "checkout" ? 0 : s.tx - 18}
                    </strong>
                    <span>other payments potentially affected</span>
                  </div>
                </div>
                <div className="payment-dots">
                  {Array.from({ length: 100 }, (_, i) => (
                    <i
                      key={i}
                      className={
                        i < 7
                          ? "risk"
                          : impact === "merchant"
                            ? "affected"
                            : "safe"
                      }
                    />
                  ))}
                </div>
                <div className="legend impact-legend">
                  <span>
                    <i style={{ background: palette.risk }} />
                    Linked activity
                  </span>
                  <span>
                    <i
                      style={{
                        background:
                          impact === "merchant" ? "#e7b767" : palette.safe,
                      }}
                    />
                    {impact === "merchant"
                      ? "Broader impact"
                      : "Outside selected scope"}
                  </span>
                </div>
                <p className="subtle">
                  Schematic distribution. Scope counts use the demonstration
                  fixture.
                </p>
                <button
                  className="primary"
                  disabled={effectiveType !== "risk"}
                  onClick={() => {
                    setView("review");
                    setReason(
                      impact === "checkout"
                        ? "Review restriction of checkout CKT-ALT-09 based on verified purpose mismatch. Confirm technical isolation before action."
                        : "Review merchant-wide intervention. This scope affects 248 observed payments, including 230 outside the linked checkout. Assess proportionality before action.",
                    );
                  }}
                >
                  Send proposal to review <ArrowRight size={16} />
                </button>
                {effectiveType !== "risk" && (
                  <p className="subtle">
                    A targeted restriction proposal requires verified mismatch
                    evidence.
                  </p>
                )}
              </section>
              <section className="panel impact-side">
                <Target size={28} className="green" />
                <h3>Proportionate by design</h3>
                <p>
                  Evidence determines the scope of the investigation. A reviewer
                  determines the response.
                </p>
                <div className="check-item">
                  <CheckCircle2 /> Specific checkout and transaction references
                </div>
                <div className="check-item">
                  <CheckCircle2 /> Supporting legitimate activity stays visible
                </div>
                <div className="check-item">
                  <CheckCircle2 /> Reviewer decision and appeal history
                </div>
                <div className="warning">
                  <TriangleAlert size={18} />
                  <span>
                    Checkout-level action requires a provider integration that
                    can isolate that checkout. A shared channel may require a
                    broader decision.
                  </span>
                </div>
              </section>
            </div>
          )}
          {view === "review" && (
            <div className="review-grid">
              <section className="panel">
                <div className="section-heading">
                  <h3>Case ML-2041</h3>
                  <Status
                    type={record().outcome === "Cleared" ? "safe" : effectiveType}
                    text={record().outcome}
                  />
                </div>
                <h2>Sunrise Bakery</h2>
                <p className="subtle">
                  Declared activity · Bakery and confectionery
                </p>
                <div className="review-summary">
                  {unresolved
                    ? "The alternate checkout purpose is unresolved. Request order and fulfilment evidence linked to session PS-0921."
                    : s.detail}
                </div>
                <h4>Targeted clarification</h4>
                <p className="subtle">
                  Please provide the order reference, description of goods or
                  services, and fulfilment evidence for payment session PS-0921.
                </p>
                <button
                  className="secondary"
                  disabled={requested}
                  onClick={() => {
                    setRequested(true);
                    log("Evidence request recorded for session PS-0921");
                  }}
                >
                  {requested ? <Check size={16} /> : <FileText size={16} />}{" "}
                  {requested ? "Request recorded" : "Request merchant evidence"}
                </button>
                {requested && (
                  <div className="merchant-response">
                    <div className="section-heading">
                      <strong>Merchant response</strong>
                      <span className="fixture">SIMULATED</span>
                    </div>
                    {response ? (
                      <p>
                        {scenario === "seasonal"
                          ? "ORD-582 and DEL-582 match the seasonal campaign, merchant and session PS-0921. Verify the synthetic source records before clearing."
                          : scenario === "mixed"
                            ? "Merchant claims a catering deposit. The supplied generic order does not reconcile the observed alternate checkout at PS-0921. Mismatch remains open."
                            : "Merchant supplied an order reference; independent checkout and fulfilment evidence is still missing. Keep the purpose unresolved."}
                      </p>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => {
                          setResponse(true);
                          log("Simulated merchant response received");
                        }}
                      >
                        Load demo response <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                )}
                <div className="verification-box">
                  <h4>Evidence verification</h4>
                  <p><strong>{evidenceFor(scenario).id}</strong> · SRB-2041 · PS-0921</p>
                  <p className="subtle">{policy.explanation}</p>
                  <label className="verify-label"><input type="checkbox" checked={verified} disabled={!evidence || scenario === "unknown"} onChange={e => {setVerified(e.target.checked); setOutcome("");}} />
                    I checked the merchant, session, flagged interval and synthetic source records.
                  </label>
                  <p className="subtle">Scope: flagged checkout PS-0921. This attestation is local and unsigned.</p>
                </div>
                <h4>Reviewer reasoning</h4>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Record the evidence you checked and why this outcome is appropriate…"
                />
                <div className="decision-actions">
                  <button
                    className="primary"
                    disabled={!policy.canClear}
                    onClick={() => {
                      if (!policy.canClear) return;
                      setOutcome("Cleared");
                      log("Case cleared with reviewer reasoning");
                    }}
                  >
                    <Check size={16} /> Clear case
                  </button>
                  <button
                    className="secondary danger"
                    disabled={!policy.canEscalate}
                    onClick={() => {
                      if (!policy.canEscalate) return;
                      setOutcome("Escalated");
                      log("Case escalated with reviewer reasoning");
                    }}
                  >
                    <Shield size={16} /> Escalate
                  </button>
                </div>
                <p className="subtle">
                  Decisions are local demo state. No real merchant receives a
                  message or restriction.
                </p>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h3>Decision history</h3>
                  <Clock size={17} />
                </div>
                {audit.some(a => a.scenario === scenario) ? (
                  audit.filter(a => a.scenario === scenario).map((a, i) => (
                    <div className="audit-row" key={i}>
                      <span className="audit-dot" />
                      <div>
                        <strong>{a.text}</strong>
                        <small>{a.time} · Reviewer demo</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <ShieldCheck size={34} />
                    <h3>A clear record of every decision</h3>
                    <p>
                      Requests and review outcomes will appear here as you work
                      through the case.
                    </p>
                  </div>
                )}
                <button className="secondary" onClick={exportCase}>
                  <Download size={15} /> Export case record
                </button>
                <button className="secondary" onClick={exportPrintableCase}><FileText size={15} /> Download printable report</button>
              </section>
            </div>
          )}
          {view === "architecture" && (
            <section className="panel architecture">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    PROPOSED PRODUCTION ARCHITECTURE
                  </span>
                  <h2>Event-driven merchant intelligence</h2>
                </div>
                <span className="fixture">CURRENT DEMO: BROWSER-LOCAL</span>
              </div>
              <div className="architecture-flow">
                <Arch
                  title="Authorized event sources"
                  items={[
                    "Payment events and merchant profiles",
                    "Checkout, order and fulfilment evidence",
                    "Optional bank partner feed",
                  ]}
                  icon={Database}
                />
                <ArrowRight />
                <Arch
                  title="Ingest and route"
                  items={[
                    "API Gateway + validation Lambda",
                    "Idempotency and schema checks",
                    "EventBridge event bus",
                  ]}
                  icon={Zap}
                />
                <ArrowRight />
                <Arch
                  title="Graph and features"
                  items={[
                    "Neptune temporal relationships",
                    "DynamoDB rolling metrics",
                    "S3 evidence and model artifacts",
                  ]}
                  icon={Network}
                />
              </div>
              <div className="architecture-flow second">
                <Arch
                  title="Assessment"
                  items={[
                    "XGBoost + CatBoost ensemble",
                    "Independent purpose-evidence checks",
                    "Versioned snapshot and freshness",
                  ]}
                  icon={Activity}
                />
                <ArrowRight />
                <Arch
                  title="Case and clarification"
                  items={[
                    "Scoped evidence and missing fields",
                    "Targeted merchant questions",
                    "Intervention impact preview",
                  ]}
                  icon={FileText}
                />
                <ArrowRight />
                <Arch
                  title="Human decision"
                  items={[
                    "Clear, clarify or escalate",
                    "Reasoned decisions and appeals",
                    "Auditable outcome history",
                  ]}
                  icon={ShieldCheck}
                />
              </div>
              <div className="architecture-foot">
                <Clock />
                <div>
                  <strong>EventBridge Scheduler</strong>
                  <span>
                    Late-event reconciliation · gradual drift · evidence refresh
                  </span>
                </div>
                <div className="architecture-controls">
                  IAM access controls
                  <br />
                  CloudWatch observability
                </div>
              </div>
              <div className="architecture-disclosure">
                <div>
                  <h4>What runs in this prototype</h4>
                  <p>
                    React, React Three Fiber and Three.js render synthetic
                    transactions, interactive evidence, scenario changes, impact
                    previews and local reviewer decisions.
                  </p>
                </div>
                <div>
                  <h4>What production requires</h4>
                  <p>
                    Authorized feeds, deployed AWS services, verified labels,
                    trained and calibrated models, load testing and
                    provider-approved action integrations.
                  </p>
                </div>
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Shield size={12} /> Synthetic demonstration · Evidence-led
              decisions · Human oversight
            </span>
            <span>Designed & developed by Paarth Jain</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={`modal ${modal === "graph" ? "wide" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h3>
                {modal === "graph"
                  ? "Transaction network"
                  : "Evidence record · EV-0921"}
              </h3>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X size={20} />
              </button>
            </div>
            {modal === "graph" ? (
              <div style={{ height: "65vh" }}>
                <Graph
                  {...{
                    scenario,
                    selected,
                    playing,
                    bank,
                    evidence,
                    focus,
                    filter,
                  }}
                  onSelect={setSelected}
                />
              </div>
            ) : (
              <>
                <Status
                  type={effectiveType}
                  text={unresolved ? "Unavailable" : "Verified in demo fixture"}
                />
                <h2>
                  {scenario === "seasonal" && evidence
                    ? "Festival campaign observation"
                    : "Checkout observation"}
                </h2>
                <dl>
                  <dt>Source</dt>
                  <dd>Synthetic provider-session fixture</dd>
                  <dt>Payment session</dt>
                  <dd>PS-0921</dd>
                  <dt>Merchant identifier</dt>
                  <dd>SRB-2041</dd>
                  <dt>Observed purpose</dt>
                  <dd>
                    {unresolved
                      ? "Unknown"
                      : scenario === "seasonal" && evidence
                        ? "Festival bakery orders"
                        : "Betting deposit"}
                  </dd>
                  <dt>Observation time</dt>
                  <dd>12 Nov 2026 · 10:05:32</dd>
                  <dt>Verification method</dt>
                  <dd>
                    {unresolved
                      ? "Missing independent observation"
                      : "Checkout observation matched to provider session reference"}
                  </dd>
                </dl>
                <p className="warning">
                  This record is fabricated for demonstration. Production
                  verification requires authorized, trustworthy source evidence.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({ label, value, detail, icon: Icon, type }) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        <Icon size={16} />
      </div>
      <strong style={type ? { color: palette[type] } : {}}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Status({ type, text }) {
  return (
    <span className={"status " + type}>
      <i />
      {text}
    </span>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={"toggle " + (checked ? "on" : "")}
      >
        <i />
      </button>
    </div>
  );
}
function EvidencePanel({
  selected,
  selectedName,
  scenario,
  evidence,
  requested,
  response,
  onEvidence,
  onInspect,
  onRequest,
  onImpact,
}) {
  const s = scenarios[scenario],
    other = selected === "other",
    receiver = ["receiver", "endpoint"].includes(selected),
    safe =
      ["cake", "orders", "supplier"].includes(selected) ||
      (scenario === "seasonal" && evidence),
    unknown = receiver || scenario === "unknown" || !evidence,
    type = safe ? "safe" : unknown ? "unknown" : s.color;
  return (
    <section className="evidence-panel">
      <div className="panel-heading">
        <span>Entity inspector</span>
        <span className="tiny-label">
          {other ? "CHECKOUT" : receiver ? "ACCOUNT" : "MERCHANT CONTEXT"}
        </span>
      </div>
      <div className="inspector-content">
        <div className={"entity-avatar " + type}>
          {other ? (
            <Link2 size={25} />
          ) : receiver ? (
            <ArrowUpRight size={25} />
          ) : (
            <Store size={25} />
          )}
        </div>
        <h2>
          {other
            ? scenario === "seasonal" && evidence
              ? "Festival checkout"
              : unknown
                ? "Unknown checkout"
                : "Betting checkout"
            : selectedName}
        </h2>
        <span className="entity-id">
          {other
            ? "CKT-ALT-09"
            : receiver
              ? "ACCOUNT • LIMITED COVERAGE"
              : "MID • SRB-2041"}
        </span>
        <Status
          type={type}
          text={
            safe
              ? "Supported purpose"
              : unknown
                ? "Evidence incomplete"
                : "Purpose mismatch"
          }
        />
        <p className="inspector-description">
          {receiver
            ? "Observed transfers show the route within the available feed. Account ownership and ultimate use remain unverified."
            : safe
              ? "Order references and fulfilment evidence support the declared bakery activity."
              : unknown
                ? "The payment is visible, but the underlying activity cannot yet be verified."
                : other
                  ? "A checkout observation links betting deposits to the bakery’s payment session."
                  : "The declared bakery profile conflicts with verified activity at an associated checkout."}
        </p>
        <div className="evidence-list">
          <div>
            <span>Declared purpose</span>
            <strong>Bakery</strong>
          </div>
          <div>
            <span>Observed activity</span>
            <strong className={type === "risk" ? "coral" : ""}>
              {receiver
                ? "Unknown"
                : safe
                  ? "Bakery sales"
                  : unknown
                    ? "Unresolved"
                    : "Betting deposits"}
            </strong>
          </div>
          <div>
            <span>Linked payments</span>
            <strong>
              {other
                ? "18"
                : receiver
                  ? "2"
                  : safe
                    ? scenario === "seasonal" && evidence
                      ? "612"
                      : "230"
                    : String(s.tx)}{" "}
              <small>demo records</small>
            </strong>
          </div>
        </div>
        <button className="evidence-card" onClick={onInspect}>
          <span>
            <FileText size={19} />
          </span>
          <div>
            <strong>
              {unknown
                ? "Missing purpose evidence"
                : "Checkout evidence record"}
            </strong>
            <small>Source, timestamp and session link</small>
          </div>
          <ChevronRight size={16} />
        </button>
        {type === "risk" ? (
          <button className="primary full" onClick={onImpact}>
            Preview intervention <ArrowRight size={15} />
          </button>
        ) : type === "unknown" ? (
          <button
            className="primary full"
            onClick={onRequest}
            disabled={requested}
          >
            {requested ? "Clarification requested" : "Request clarification"}
            <FileText size={15} />
          </button>
        ) : (
          <div className="supported-note">
            <CheckCircle2 size={17} /> Continue normal monitoring
          </div>
        )}
        <div className="inspector-foot">
          <ShieldCheck size={13} /> Every conclusion links back to evidence.
        </div>
      </div>
    </section>
  );
}
function Arch({ title, items, icon: Icon }) {
  return (
    <div className="arch-block">
      <Icon size={23} />
      <h3>{title}</h3>
      {items.map((x) => (
        <p key={x}>{x}</p>
      ))}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);

