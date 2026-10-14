"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Doc, Entity, Work } from "@/lib/types";
import { KIND_META } from "@/lib/entities";

export type AtlasSelection = { type: "work" | "doc" | "entity"; id: string } | null;

export interface AtlasNode {
  id: string;
  type: "work" | "doc" | "entity";
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  workId: string;
  links: string[]; // node ids this node connects to
  meta?: string;
}

/** three.js parses hsl(), not oklch(); keep 3D colours in hsl. */
const hsl = (hue: number, l = 68) => `hsl(${Math.round(hue)}, 72%, ${l}%)`;

export function layoutAtlas(works: Work[], docs: Doc[], entities: Entity[]): AtlasNode[] {
  const nodes: AtlasNode[] = [];
  const pos = new Map<string, THREE.Vector3>();

  works.forEach((w, i) => {
    const r = i === 0 ? 0 : 7 + i * 5.5;
    const a = i * 2.39996; // golden angle spiral
    const p = new THREE.Vector3(Math.cos(a) * r, Math.sin(i * 1.3) * 1.5, Math.sin(a) * r);
    pos.set(w.id, p);
    const wdocs = docs.filter((d) => d.workId === w.id);
    const totalWords = wdocs.reduce((n, d) => n + d.wordCount, 0);
    nodes.push({
      id: w.id,
      type: "work",
      position: [p.x, p.y, p.z],
      color: hsl(w.hue, 66),
      size: 0.55 + Math.min(0.6, Math.sqrt(totalWords) / 220),
      label: w.title,
      workId: w.id,
      links: [],
      meta: `${wdocs.length} pieces · ${totalWords.toLocaleString()} words`,
    });

    const roots = wdocs.filter((d) => !d.parentId).sort((a, b) => a.order - b.order);
    const ringR = 2.4 + roots.length * 0.18;
    roots.forEach((d, j) => {
      const ang = (j / Math.max(1, roots.length)) * Math.PI * 2;
      const dp = new THREE.Vector3(p.x + Math.cos(ang) * ringR, p.y + Math.sin(j * 0.9) * 0.5, p.z + Math.sin(ang) * ringR);
      pos.set(d.id, dp);
      nodes.push({
        id: d.id,
        type: "doc",
        position: [dp.x, dp.y, dp.z],
        color: hsl(w.hue, 80),
        size: 0.14 + Math.min(0.28, Math.sqrt(d.wordCount) / 140),
        label: d.title,
        workId: w.id,
        links: [w.id],
        meta: `${d.wordCount.toLocaleString()} words · ${d.status}`,
      });
      const forks = wdocs.filter((f) => f.parentId === d.id);
      forks.forEach((f, k) => {
        const fa = ang + (k + 1) * 0.35;
        const fp = new THREE.Vector3(p.x + Math.cos(fa) * (ringR + 1.1), dp.y + 0.6 + k * 0.3, p.z + Math.sin(fa) * (ringR + 1.1));
        pos.set(f.id, fp);
        nodes.push({
          id: f.id,
          type: "doc",
          position: [fp.x, fp.y, fp.z],
          color: hsl(300, 74),
          size: 0.12 + Math.min(0.2, Math.sqrt(f.wordCount) / 160),
          label: f.forkLabel ? `↳ ${f.forkLabel}` : f.title,
          workId: w.id,
          links: [d.id],
          meta: `branch · ${f.wordCount.toLocaleString()} words`,
        });
      });
    });

    const wents = entities.filter((e) => e.workId === w.id && e.docIds.length > 0);
    wents.forEach((e, k) => {
      const c = new THREE.Vector3();
      let n = 0;
      for (const id of e.docIds) {
        const dp = pos.get(id);
        if (dp) {
          c.add(dp);
          n++;
        }
      }
      if (n === 0) return;
      c.divideScalar(n);
      const away = c.clone().sub(p);
      if (away.length() < 0.01) away.set(Math.cos(k), 0, Math.sin(k));
      away.normalize();
      const lift = (k % 2 === 0 ? 1 : -1) * (1.2 + (k % 5) * 0.35);
      const ep = c.clone().add(away.multiplyScalar(1.6 + (k % 3) * 0.5)).add(new THREE.Vector3(0, lift, 0));
      pos.set(e.id, ep);
      nodes.push({
        id: e.id,
        type: "entity",
        position: [ep.x, ep.y, ep.z],
        color: hsl(KIND_META[e.kind].hue, 70),
        size: 0.08 + Math.min(0.14, e.mentions / 60),
        label: e.name,
        workId: w.id,
        links: e.docIds.filter((id) => pos.has(id)),
        meta: `${KIND_META[e.kind].label.toLowerCase()} · ${e.mentions} mentions`,
      });
    });
  });

  return nodes;
}

function Node({
  node,
  selected,
  dim,
  onSelect,
  onOpen,
  onHover,
}: {
  node: AtlasNode;
  selected: boolean;
  dim: boolean;
  onSelect: (n: AtlasNode) => void;
  onOpen: (n: AtlasNode) => void;
  onHover: (n: AtlasNode | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = selected ? 1 + Math.sin(t * 3) * 0.08 : hover ? 1.15 : 1;
    ref.current.scale.setScalar(pulse);
    if (node.type === "work") ref.current.rotation.y = t * 0.15;
  });
  const isWork = node.type === "work";
  const isEntity = node.type === "entity";
  const opacity = dim ? 0.25 : 1;
  return (
    <group
      ref={ref}
      position={node.position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onOpen(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        onHover(node);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <mesh>
        {isEntity ? <icosahedronGeometry args={[node.size, 1]} /> : <sphereGeometry args={[node.size, isWork ? 32 : 18, isWork ? 32 : 18]} />}
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isWork ? 1.6 : selected ? 1.4 : 0.7}
          roughness={0.35}
          transparent
          opacity={opacity}
        />
      </mesh>
      {(isWork || selected) && (
        <mesh scale={isWork ? 2.2 : 2.6}>
          <sphereGeometry args={[node.size, 16, 16]} />
          <meshBasicMaterial color={node.color} transparent opacity={isWork ? 0.09 : 0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {isWork && <pointLight color={node.color} intensity={6} distance={14} decay={2} />}
      {(isWork || selected || hover) && (
        <Html center distanceFactor={isWork ? 18 : 12} position={[0, node.size + (isWork ? 0.7 : 0.35), 0]} style={{ pointerEvents: "none", opacity }}>
          <div
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-center backdrop-blur"
            style={{
              background: "rgba(12,10,31,0.72)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ede8ff",
              fontFamily: isWork ? "var(--font-fraunces), Georgia, serif" : "var(--font-instrument), system-ui, sans-serif",
              fontSize: isWork ? 22 : 13,
              fontWeight: isWork ? 500 : 400,
              letterSpacing: isWork ? "-0.01em" : 0,
            }}
          >
            {node.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Links({ nodes, selected }: { nodes: AtlasNode[]; selected: AtlasSelection }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const segments = useMemo(() => {
    const out: { a: [number, number, number]; b: [number, number, number]; color: string; hot: boolean; entity: boolean }[] = [];
    for (const n of nodes) {
      for (const l of n.links) {
        const t = byId.get(l);
        if (!t) continue;
        const hot = selected ? selected.id === n.id || selected.id === t.id : false;
        out.push({ a: n.position, b: t.position, color: n.type === "entity" ? n.color : t.color, hot, entity: n.type === "entity" });
      }
    }
    return out;
  }, [nodes, byId, selected]);
  return (
    <>
      {segments.map((s, i) => (
        <Line
          key={i}
          points={[s.a, s.b]}
          color={s.color}
          lineWidth={s.hot ? 1.6 : s.entity ? 0.6 : 0.9}
          transparent
          opacity={s.hot ? 0.9 : s.entity ? 0.28 : 0.35}
          dashed={s.entity}
          dashSize={0.25}
          gapSize={0.18}
        />
      ))}
    </>
  );
}

function FlyTo({ target, controls }: { target: THREE.Vector3 | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!target) return;
    const dir = camera.position.clone().sub(target).normalize();
    if (dir.length() < 0.01) dir.set(0, 0.5, 1).normalize();
    goal.current = { pos: target.clone().add(dir.multiplyScalar(6)).add(new THREE.Vector3(0, 1.5, 0)), look: target.clone() };
  }, [target, camera]);
  useFrame(() => {
    if (!goal.current || !controls.current) return;
    camera.position.lerp(goal.current.pos, 0.06);
    controls.current.target.lerp(goal.current.look, 0.08);
    controls.current.update();
    if (camera.position.distanceTo(goal.current.pos) < 0.05) goal.current = null;
  });
  return null;
}

export function AtlasScene({
  nodes,
  selected,
  onSelect,
  onOpen,
  onHover,
  flyTarget,
}: {
  nodes: AtlasNode[];
  selected: AtlasSelection;
  onSelect: (n: AtlasNode | null) => void;
  onOpen: (n: AtlasNode) => void;
  onHover: (n: AtlasNode | null) => void;
  flyTarget: THREE.Vector3 | null;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const focusWork = selected ? nodes.find((n) => n.id === selected.id)?.workId : null;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 10, 26], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
      style={{ background: "radial-gradient(80% 60% at 50% 40%, #16123a 0%, #0c0a1f 70%, #07061a 100%)" }}
    >
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#a79bd6", "#0c0a1f", 0.5]} />
      <Stars radius={70} depth={40} count={6000} factor={4} saturation={0.35} fade speed={0.4} />
      <fog attach="fog" args={["#0c0a1f", 40, 150]} />
      <Links nodes={nodes} selected={selected} />
      {nodes.map((n) => (
        <Node
          key={n.id}
          node={n}
          selected={selected?.id === n.id}
          dim={Boolean(focusWork && n.workId !== focusWork)}
          onSelect={onSelect}
          onOpen={onOpen}
          onHover={onHover}
        />
      ))}
      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!selected}
        autoRotateSpeed={0.35}
        minDistance={2}
        maxDistance={90}
        maxPolarAngle={Math.PI * 0.85}
      />
      <FlyTo target={flyTarget} controls={controls} />
    </Canvas>
  );
}
