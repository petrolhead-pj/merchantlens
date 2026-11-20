import React,{useState,useEffect,useRef,Suspense} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Float,Line,MeshDistortMaterial,OrbitControls,Stars} from '@react-three/drei';
import * as THREE from 'three';
const palette = {
  safe: "#42d7ae",
  risk: "#ff776c",
  unknown: "#e7b767",
  neutral: "#389dff",
};
const baseNodes = [
  {
    id: "customers",
    name: "Customers",
    sub: "Sample payer tokens",
    pos: [-5.4, 1.2, 1.3],
    type: "neutral",
    kind: "customers",
  },
  {
    id: "cake",
    name: "Order reference",
    sub: "CKT-CAKE-01",
    pos: [-2.5, 2.1, -1.1],
    type: "safe",
    kind: "checkout",
  },
  {
    id: "other",
    name: "CKT-ALT-09",
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
    sub: "Matched records",
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
  ["customers", "bakery", "neutral"],
  ["customers", "cake", "safe"],
  ["customers", "other", "risk"],
  ["cake", "bakery", "safe"],
  ["other", "bakery", "risk"],
  ["cake", "orders", "safe"],
  ["bakery", "supplier", "safe"],
  ["bakery", "receiver", "unknown"],
  ["receiver", "endpoint", "unknown"],
];
function visibleEdge(from,to,bankEdges) {
  if (!['supplier','receiver','endpoint'].includes(to)) return true;
  return bankEdges.some(row=>row.from===from && row.to===to);
}
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
 </group>;
}
function WebGLGraph({
  activeNodes,
  bankEdges,
  selected,
  onSelect,
  playing,
  focus,
  filter,
}) {
  const [cameraMode,setCameraMode]=useState("perspective");
  const [autoOrbit,setAutoOrbit]=useState(false);
  const nodes = baseNodes.filter(n=>activeNodes.includes(n.id));
  const visible=nodes;
  const kinds = Object.fromEntries(nodes.map((n) => [n.id, n.type]));
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <div className="actions"><button onClick={()=>setCameraMode(cameraMode==='top'?'perspective':'top')}>Change camera</button>
      <button onClick={()=>setAutoOrbit(!autoOrbit)} aria-pressed={autoOrbit}>Orbit</button>
      <select aria-label="Inspect graph node" value={selected} onChange={e=>onSelect(e.target.value)}>{visible.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
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
        <group position={[-0.1, 0, 0]}>
          {edgeDefs
            .filter(
              ([a, b]) =>
                visible.some((n) => n.id === a) &&
                visible.some((n) => n.id === b) && visibleEdge(a,b,bankEdges),
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
          autoRotate={autoOrbit}
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
    </Canvas></div>
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
export default function Graph(props) {
  return hasWebGL ? (
    <GraphBoundary {...props}>
      <WebGLGraph {...props} />
    </GraphBoundary>
  ) : (
    <SVGGraph {...props} />
  );
}
function SVGGraph({
  activeNodes,
  bankEdges,
  selected,
  onSelect,
  playing,
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
  const nodes = baseNodes.filter(n=>activeNodes.includes(n.id));
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
              nodes.some((n) => n.id === a) && nodes.some((n) => n.id === b) && visibleEdge(a,b,bankEdges),
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
