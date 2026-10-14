"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The landing-page sky: a slow nebula of points with a few bright bodies
 * drifting through it. Reacts gently to the pointer. Runs at low cost.
 */

/** Small seeded PRNG so the sky is deterministic (and pure to render). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSprite(size = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function Dust({ count = 2600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const sprite = useMemo(() => makeSprite(), []);
  const { positions, colors } = useMemo(() => {
    const rand = mulberry32(1337);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const gold = new THREE.Color("#f2c14e");
    const lilac = new THREE.Color("#a79bd6");
    const teal = new THREE.Color("#5ee0c4");
    for (let i = 0; i < count; i++) {
      const r = 6 + rand() * 30;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = (r * Math.sin(phi) * Math.sin(theta)) * 0.55;
      positions[i * 3 + 2] = r * Math.cos(phi) - 10;
      const t = rand();
      const c = t < 0.12 ? gold : t < 0.2 ? teal : lilac;
      const dim = 0.35 + rand() * 0.65;
      colors[i * 3] = c.r * dim;
      colors[i * 3 + 1] = c.g * dim;
      colors[i * 3 + 2] = c.b * dim;
    }
    return { positions, colors };
  }, [count]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.012;
    const px = state.pointer.x * 0.12;
    const py = state.pointer.y * 0.08;
    ref.current.rotation.x += (py - ref.current.rotation.x) * 0.02;
    ref.current.rotation.z += (px - ref.current.rotation.z) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.11} map={sprite} alphaMap={sprite} vertexColors transparent opacity={0.95} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Body({ radius, speed, size, color, phase, tilt }: { radius: number; speed: number; size: number; color: string; phase: number; tilt: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, Math.sin(t) * radius * tilt, Math.sin(t * 0.7) * 2 - 6);
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[size, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight color={color} intensity={2} distance={12} />
    </group>
  );
}

function Rig() {
  useFrame((state) => {
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 1.2 - cam.position.x) * 0.02;
    cam.position.y += (state.pointer.y * 0.6 - cam.position.y) * 0.02;
    cam.lookAt(0, 0, -8);
  });
  return null;
}

export default function Constellation({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 8], fov: 55, near: 0.1, far: 120 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <fog attach="fog" args={["#120f2a", 10, 46]} />
        <Rig />
        <Dust />
        <Body radius={4.5} speed={0.11} size={0.28} color="#f2c14e" phase={0} tilt={0.35} />
        <Body radius={7} speed={0.07} size={0.2} color="#5ee0c4" phase={2.1} tilt={0.5} />
        <Body radius={9.5} speed={0.05} size={0.16} color="#ff7a59" phase={4.2} tilt={0.3} />
        <Body radius={3} speed={0.16} size={0.12} color="#a79bd6" phase={1.2} tilt={0.6} />
      </Canvas>
    </div>
  );
}
