import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

const SHAPES = [
  { position: [-3.8, 2.2, -3]   as [number,number,number], type: "oct",    color: "#0D9488", scale: 0.65, speed: 0.9,  opacity: 0.70, wire: false },
  { position: [4.5,  -1.2, -4]  as [number,number,number], type: "torus",  color: "#0F766E", scale: 0.55, speed: 0.65, opacity: 0.60, wire: false },
  { position: [3.2,  2.8, -3.5] as [number,number,number], type: "box",    color: "#14B8A6", scale: 0.40, speed: 1.20, opacity: 0.65, wire: false },
  { position: [-4.5, -2.0, -5]  as [number,number,number], type: "ico",    color: "#0D9488", scale: 0.85, speed: 0.75, opacity: 0.45, wire: true  },
  { position: [1.0,  -3.2, -5]  as [number,number,number], type: "oct",    color: "#0F766E", scale: 0.50, speed: 1.00, opacity: 0.55, wire: false },
  { position: [-1.5, 3.5, -6]   as [number,number,number], type: "sphere", color: "#14B8A6", scale: 0.35, speed: 1.30, opacity: 0.45, wire: false },
  { position: [6.0,  1.0, -6]   as [number,number,number], type: "torus",  color: "#0D9488", scale: 0.45, speed: 0.80, opacity: 0.40, wire: false },
  { position: [-6.0, 0.5, -7]   as [number,number,number], type: "box",    color: "#14B8A6", scale: 0.60, speed: 0.70, opacity: 0.35, wire: true  },
];

const GEO: Record<string, THREE.BufferGeometry> = {};
function getGeo(type: string): THREE.BufferGeometry {
  if (!GEO[type]) {
    switch (type) {
      case "torus":  GEO[type] = new THREE.TorusGeometry(0.75, 0.28, 12, 28); break;
      case "box":    GEO[type] = new THREE.BoxGeometry(1.1, 1.1, 1.1); break;
      case "ico":    GEO[type] = new THREE.IcosahedronGeometry(1, 0); break;
      case "sphere": GEO[type] = new THREE.SphereGeometry(0.75, 16, 16); break;
      default:       GEO[type] = new THREE.OctahedronGeometry(1, 0);
    }
  }
  return GEO[type];
}

function Shape({ position, type, color, scale, speed, opacity, wire }: typeof SHAPES[number]) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mesh.current.rotation.x = t * speed * 0.25;
    mesh.current.rotation.y = t * speed * 0.38;
  });
  return (
    <Float speed={speed * 0.55} rotationIntensity={0.18} floatIntensity={0.65}>
      <mesh ref={mesh} position={position} scale={scale}>
        <primitive object={getGeo(type)} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} transparent opacity={opacity} wireframe={wire} />
      </mesh>
    </Float>
  );
}

function MouseTracker() {
  const mouse = useRef({ x: 0, y: 0 });
  const tgt = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 0.4;
    };
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  useFrame(({ camera }) => {
    tgt.current.x += (mouse.current.x - tgt.current.x) * 0.04;
    tgt.current.y += (mouse.current.y - tgt.current.y) * 0.04;
    camera.position.x = tgt.current.x;
    camera.position.y = tgt.current.y;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ThreeHero() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ background: "transparent", pointerEvents: "none", position: "absolute", inset: 0 }}
      aria-hidden
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 6, 4]} intensity={0.9} />
      <pointLight position={[-4, 3, 2]} intensity={0.5} color="#0D9488" />
      <MouseTracker />
      {SHAPES.map((s, i) => <Shape key={i} {...s} />)}
    </Canvas>
  );
}
