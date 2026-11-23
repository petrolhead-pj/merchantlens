import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

const up = new THREE.Vector3(0, 1, 0);
const shell = "#e1d9c8";
const graphite = "#303b48";

function Part({ at, size, color = shell, rotation, metalness = 0.2, glow = 0 }) {
  return (
    <mesh position={at} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.38}
        metalness={metalness}
        emissive={color}
        emissiveIntensity={glow}
      />
    </mesh>
  );
}

function Customers({ color }) {
  return [
    [-0.36, -0.09, 0.03, 0.77],
    [0.36, -0.09, 0.03, 0.77],
    [0, 0, 0.21, 1],
  ].map(([x, y, z, scale]) => (
    <group key={x} position={[x, y, z]} scale={scale}>
      <mesh position={[0, -0.05, 0]} scale={[1, 0.78, 0.64]}>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.29, 0]}>
        <sphereGeometry args={[0.155, 18, 14]} />
        <meshStandardMaterial color={shell} roughness={0.45} />
      </mesh>
    </group>
  ));
}

function Checkout({ color }) {
  return (
    <>
      <Part at={[0, -0.27, 0]} size={[0.95, 0.14, 0.79]} color={graphite} />
      <group position={[0, 0.115, 0]} rotation={[-0.28, 0, 0]}>
        <Part at={[0, 0, 0]} size={[0.73, 0.82, 0.2]} />
        <Part at={[0, 0.17, 0.103]} size={[0.57, 0.33, 0.025]} color={graphite} />
        <Part at={[0, 0.17, 0.125]} size={[0.49, 0.24, 0.018]} color={color} glow={0.3} />
        <Part at={[-0.08, 0.17, 0.139]} size={[0.21, 0.022, 0.01]} color={graphite} />
        {[-0.16, 0, 0.16].map((x) => (
          <Part key={x} at={[x, -0.12, 0.123]} size={[0.1, 0.08, 0.046]} color={graphite} />
        ))}
        <Part at={[0, -0.29, 0.12]} size={[0.32, 0.026, 0.037]} color={graphite} />
      </group>
    </>
  );
}

function Storefront({ color }) {
  return (
    <>
      <Part at={[0, 0.03, 0]} size={[1.31, 0.9, 0.88]} />
      <Part at={[0, 0.53, 0]} size={[1.48, 0.13, 1]} color={graphite} />
      <Part at={[0, 0.42, 0.455]} size={[0.63, 0.12, 0.075]} color={color} glow={0.17} />
      <Part at={[-0.28, -0.12, 0.447]} size={[0.36, 0.58, 0.035]} color={graphite} />
      <Part at={[0.28, -0.03, 0.451]} size={[0.43, 0.36, 0.035]} color={graphite} />
      <Part at={[0.28, -0.03, 0.474]} size={[0.34, 0.27, 0.018]} color={color} glow={0.19} />
      {[-0.56, -0.37, -0.18, 0, 0.18, 0.37, 0.56].map((x, index) => (
        <Part
          key={x}
          at={[x, 0.23, 0.54]}
          size={[0.185, 0.085, 0.37]}
          rotation={[0.25, 0, 0]}
          color={index % 2 ? shell : color}
        />
      ))}
    </>
  );
}

function Evidence({ color }) {
  return (
    <group rotation={[-0.22, 0, -0.16]}>
      <Part at={[0.11, -0.085, -0.12]} size={[0.69, 0.86, 0.115]} color={color} />
      <Part at={[0, 0.015, 0]} size={[0.68, 0.89, 0.1]} />
      <Part at={[0, 0.32, 0.06]} size={[0.5, 0.075, 0.024]} color={color} />
      {[0.14, 0, -0.14].map((y) => (
        <Part key={y} at={[0, y, 0.06]} size={[0.43, 0.03, 0.018]} color={graphite} />
      ))}
    </group>
  );
}

function Parcels({ color }) {
  return [
    [-0.23, -0.18, 0, 0.61],
    [0.26, 0.18, -0.04, 0.53],
  ].map(([x, y, z, size]) => (
    <group key={x} position={[x, y, z]} rotation={[0, x, 0]}>
      <Part at={[0, 0, 0]} size={[size, size * 0.79, size]} color="#b48252" />
      <Part at={[0, size * 0.395, 0]} size={[size * 0.27, 0.015, size]} color={color} />
      <Part at={[0, 0, size / 2]} size={[size * 0.27, size * 0.79, 0.018]} color={color} />
    </group>
  ));
}

function Vault({ color }) {
  return (
    <>
      <Part at={[0, 0, 0]} size={[0.87, 0.79, 0.65]} color={graphite} metalness={0.55} />
      <Part at={[0, 0.015, 0.335]} size={[0.74, 0.68, 0.085]} color="#aebcc4" metalness={0.45} />
      <mesh position={[0, 0.025, 0.408]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.075, 24]} />
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.32} />
      </mesh>
      <Part at={[0, 0.025, 0.463]} size={[0.31, 0.035, 0.037]} color={graphite} />
      <Part at={[0, 0.025, 0.464]} size={[0.035, 0.31, 0.037]} color={graphite} />
    </>
  );
}

function Account({ color }) {
  return (
    <>
      <Part at={[0, -0.08, 0]} size={[0.87, 0.61, 0.61]} color={graphite} metalness={0.5} />
      <Part at={[0, 0.26, 0]} size={[0.95, 0.13, 0.69]} color="#aebcc4" metalness={0.4} />
      <Part at={[0, 0.04, 0.32]} size={[0.23, 0.26, 0.055]} color={color} />
      <Part at={[0, 0.055, 0.356]} size={[0.065, 0.11, 0.018]} color={graphite} />
    </>
  );
}

const modelFor = {
  customers: Customers,
  cake: Checkout,
  other: Checkout,
  bakery: Storefront,
  orders: Evidence,
  supplier: Parcels,
  receiver: Vault,
  endpoint: Account,
};

export function EvidenceNode({ node, color, selected, dim, playing, onSelect }) {
  const model = useRef(null);
  const elapsed = useRef(0);
  const Model = modelFor[node.id];
  const size = node.id === "bakery" ? 1.15 : 1;
  const pedestal = node.id === "bakery" ? 0.94 : 0.64;
  const phase = node.pos[0] * 0.52;
  const tint = dim ? new THREE.Color(color).lerp(new THREE.Color("#4b4e51"), 0.78) : color;
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (playing) elapsed.current += dt;
    const time = elapsed.current;
    model.current.rotation.y = -0.32 + Math.sin(time * 0.85 + phase) * 0.25;
    model.current.position.y = Math.sin(time * 1.7 + phase) * 0.045;
    const target = size * (selected ? 1.11 : dim ? 0.83 : 1);
    const scale = playing ? THREE.MathUtils.damp(model.current.scale.x, target, 9, dt) : target;
    model.current.scale.setScalar(scale);
  });

  return (
    <group
      position={node.pos}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <mesh position={[0, -0.56, 0]}>
        <cylinderGeometry args={[pedestal, pedestal * 0.88, 0.17, 6]} />
        <meshStandardMaterial color={graphite} roughness={0.43} metalness={0.44} />
      </mesh>
      <mesh position={[0, -0.47, 0]}>
        <cylinderGeometry args={[pedestal, pedestal, 0.035, 6]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={selected ? 0.63 : 0.14} />
      </mesh>
      <group ref={model} scale={size}>
        <Model color={tint} />
      </group>
    </group>
  );
}

export function FlowEdge({ from, to, color, playing, dim, highlighted }) {
  const packets = useRef([]);
  const elapsed = useRef(0);
  const tangent = useRef(new THREE.Vector3());
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const bend = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.46, -0.22));
    return new THREE.QuadraticBezierCurve3(start, bend, end);
  }, [from, to]);
  const points = useMemo(() => curve.getPoints(36), [curve]);
  const speed = 0.94 / curve.getLength();

  useFrame((_, delta) => {
    if (playing) elapsed.current += Math.min(delta, 0.05);
    for (const [index, mesh] of packets.current.entries()) {
      if (!mesh) continue;
      const position = (elapsed.current * speed + 0.23 + index * 0.5) % 1;
      curve.getPointAt(position, mesh.position);
      curve.getTangentAt(position, tangent.current);
      mesh.quaternion.setFromUnitVectors(up, tangent.current);
    }
  });

  return (
    <>
      <Line
        points={points}
        color={color}
        lineWidth={highlighted ? 1.8 : 1.2}
        transparent
        opacity={dim ? 0.14 : highlighted ? 0.72 : 0.4}
      />
      {[0, 1].map((index) => (
        <mesh
          key={index}
          visible={!dim}
          ref={(element) => { packets.current[index] = element; }}
        >
          <coneGeometry args={[0.067, 0.24, 4]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
