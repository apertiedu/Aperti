import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Layers, RotateCcw, Palette, ChevronDown, ChevronUp, Info } from "lucide-react";

const TEAL = "#00796B";

const PALETTE = [
  "#00796B","#1976D2","#7B1FA2","#E53935","#F9A825",
  "#388E3C","#FF6F00","#0288D1","#AD1457","#546E7A",
  "#4527A0","#2E7D32","#C62828","#37474F","#BF360C",
];

const π = Math.PI;
const sq = (x: number) => x * x;

interface DimDef { id: string; label: string; min: number; max: number; step: number; def: number; }
interface Shape {
  id: string; name: string; category: string; emoji: string;
  dims: DimDef[];
  vef: { v: number | "∞"; e: number | "∞"; f: number | "∞" };
  makeGeo: (d: Rec) => THREE.BufferGeometry;
  sa: (d: Rec) => number;
  vol: (d: Rec) => number;
  saFormula: string;
  volFormula: string;
}
type Rec = Record<string, number>;

const r = (n: number, dp = 2) => +n.toFixed(dp);

const SHAPES: Shape[] = [
  // ── PRISMS & COMMON ───────────────────────────────────────────────────────
  {
    id: "cube", name: "Cube", category: "Prisms & Cylinders", emoji: "⬜",
    dims: [{ id: "a", label: "Side (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 8, e: 12, f: 6 },
    makeGeo: d => new THREE.BoxGeometry(d.a, d.a, d.a),
    sa: d => 6 * sq(d.a),
    vol: d => d.a ** 3,
    saFormula: "SA = 6a²",
    volFormula: "V = a³",
  },
  {
    id: "cuboid", name: "Cuboid", category: "Prisms & Cylinders", emoji: "📦",
    dims: [
      { id: "l", label: "Length (l)", min: 0.5, max: 5, step: 0.1, def: 3 },
      { id: "w", label: "Width (w)", min: 0.5, max: 5, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 1.5 },
    ],
    vef: { v: 8, e: 12, f: 6 },
    makeGeo: d => new THREE.BoxGeometry(d.l, d.h, d.w),
    sa: d => 2 * (d.l*d.w + d.w*d.h + d.l*d.h),
    vol: d => d.l * d.w * d.h,
    saFormula: "SA = 2(lw + wh + lh)",
    volFormula: "V = lwh",
  },
  {
    id: "triangular-prism", name: "Triangular Prism", category: "Prisms & Cylinders", emoji: "🔺",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 3 },
    ],
    vef: { v: 6, e: 9, f: 5 },
    makeGeo: d => new THREE.CylinderGeometry(d.a / Math.sqrt(3), d.a / Math.sqrt(3), d.h, 3),
    sa: d => (Math.sqrt(3) / 2) * sq(d.a) + 3 * d.a * d.h,
    vol: d => (Math.sqrt(3) / 4) * sq(d.a) * d.h,
    saFormula: "SA = (√3/2)a² + 3ah",
    volFormula: "V = (√3/4)a²h",
  },
  {
    id: "hexagonal-prism", name: "Hexagonal Prism", category: "Prisms & Cylinders", emoji: "⬡",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 3 },
    ],
    vef: { v: 12, e: 18, f: 8 },
    makeGeo: d => new THREE.CylinderGeometry(d.a, d.a, d.h, 6),
    sa: d => 3 * Math.sqrt(3) * sq(d.a) + 6 * d.a * d.h,
    vol: d => (3 * Math.sqrt(3) / 2) * sq(d.a) * d.h,
    saFormula: "SA = 3√3a² + 6ah",
    volFormula: "V = (3√3/2)a²h",
  },
  {
    id: "cylinder", name: "Cylinder", category: "Prisms & Cylinders", emoji: "🥫",
    dims: [
      { id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: "∞", e: "∞", f: 3 },
    makeGeo: d => new THREE.CylinderGeometry(d.r, d.r, d.h, 36),
    sa: d => 2 * π * d.r * (d.r + d.h),
    vol: d => π * sq(d.r) * d.h,
    saFormula: "SA = 2πr(r + h)",
    volFormula: "V = πr²h",
  },
  // ── PYRAMIDS & CONES ──────────────────────────────────────────────────────
  {
    id: "cone", name: "Cone", category: "Pyramids & Cones", emoji: "🍦",
    dims: [
      { id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: "∞", e: "∞", f: 2 },
    makeGeo: d => new THREE.ConeGeometry(d.r, d.h, 36),
    sa: d => { const l = Math.sqrt(sq(d.r) + sq(d.h)); return π * d.r * (d.r + l); },
    vol: d => (π * sq(d.r) * d.h) / 3,
    saFormula: "SA = πr(r + l),  l = √(r²+h²)",
    volFormula: "V = ⅓πr²h",
  },
  {
    id: "square-pyramid", name: "Square Pyramid", category: "Pyramids & Cones", emoji: "🔷",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: 5, e: 8, f: 5 },
    makeGeo: d => new THREE.ConeGeometry(d.a / Math.SQRT2, d.h, 4, 1),
    sa: d => { const l = Math.sqrt(sq(d.h) + sq(d.a / 2)); return sq(d.a) + 2 * d.a * l; },
    vol: d => (sq(d.a) * d.h) / 3,
    saFormula: "SA = a² + 2al,  l = √(h²+(a/2)²)",
    volFormula: "V = ⅓a²h",
  },
  {
    id: "tetrahedron", name: "Tetrahedron", category: "Pyramids & Cones", emoji: "🔺",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 4, e: 6, f: 4 },
    makeGeo: d => new THREE.TetrahedronGeometry(d.a / Math.sqrt(2) * 0.9),
    sa: d => Math.sqrt(3) * sq(d.a),
    vol: d => sq(d.a) * d.a / (6 * Math.SQRT2),
    saFormula: "SA = √3 · a²",
    volFormula: "V = a³ / (6√2)",
  },
  // ── ROUND SOLIDS ──────────────────────────────────────────────────────────
  {
    id: "sphere", name: "Sphere", category: "Round Solids", emoji: "🔵",
    dims: [{ id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.SphereGeometry(d.r, 48, 32),
    sa: d => 4 * π * sq(d.r),
    vol: d => (4 / 3) * π * d.r ** 3,
    saFormula: "SA = 4πr²",
    volFormula: "V = ⁴⁄₃πr³",
  },
  {
    id: "hemisphere", name: "Hemisphere", category: "Round Solids", emoji: "🌐",
    dims: [{ id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.SphereGeometry(d.r, 48, 24, 0, 2 * π, 0, π / 2),
    sa: d => 3 * π * sq(d.r),
    vol: d => (2 / 3) * π * d.r ** 3,
    saFormula: "SA = 3πr²",
    volFormula: "V = ²⁄₃πr³",
  },
  {
    id: "torus", name: "Torus", category: "Round Solids", emoji: "🍩",
    dims: [
      { id: "R", label: "Major radius (R)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "r", label: "Tube radius (r)", min: 0.1, max: 1, step: 0.05, def: 0.4 },
    ],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.TorusGeometry(d.R, d.r, 20, 80),
    sa: d => 4 * sq(π) * d.R * d.r,
    vol: d => 2 * sq(π) * d.R * sq(d.r),
    saFormula: "SA = 4π²Rr",
    volFormula: "V = 2π²Rr²",
  },
  // ── PLATONIC SOLIDS ───────────────────────────────────────────────────────
  {
    id: "octahedron", name: "Octahedron", category: "Platonic Solids", emoji: "💎",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 6, e: 12, f: 8 },
    makeGeo: d => new THREE.OctahedronGeometry(d.a / Math.SQRT2),
    sa: d => 2 * Math.sqrt(3) * sq(d.a),
    vol: d => (Math.SQRT2 / 3) * d.a ** 3,
    saFormula: "SA = 2√3 · a²",
    volFormula: "V = (√2/3)a³",
  },
  {
    id: "dodecahedron", name: "Dodecahedron", category: "Platonic Solids", emoji: "🔮",
    dims: [{ id: "a", label: "Edge (a)", min: 0.3, max: 2.5, step: 0.1, def: 1.2 }],
    vef: { v: 20, e: 30, f: 12 },
    makeGeo: d => new THREE.DodecahedronGeometry(d.a * 1.401),
    sa: d => 3 * Math.sqrt(25 + 10 * Math.sqrt(5)) * sq(d.a),
    vol: d => ((15 + 7 * Math.sqrt(5)) / 4) * d.a ** 3,
    saFormula: "SA = 3√(25+10√5) · a²",
    volFormula: "V = ((15+7√5)/4)a³",
  },
  {
    id: "icosahedron", name: "Icosahedron", category: "Platonic Solids", emoji: "❄️",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: 12, e: 30, f: 20 },
    makeGeo: d => new THREE.IcosahedronGeometry(d.a * 0.951),
    sa: d => 5 * Math.sqrt(3) * sq(d.a),
    vol: d => ((5 * (3 + Math.sqrt(5))) / 12) * d.a ** 3,
    saFormula: "SA = 5√3 · a²",
    volFormula: "V = (5(3+√5)/12)a³",
  },
];

const CATEGORIES = Array.from(new Set(SHAPES.map(s => s.category)));

export default function Geometrix() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: any; mesh: THREE.Mesh | null; animId: number }>( null as any);

  const [shapeId, setShapeId] = useState("cube");
  const [color, setColor] = useState(TEAL);
  const [dims, setDims] = useState<Rec>({});
  const [expandedCat, setExpandedCat] = useState("Prisms & Cylinders");
  const [showInfo, setShowInfo] = useState(true);

  const shape = SHAPES.find(s => s.id === shapeId)!;

  const activeDims = useMemo<Rec>(() => {
    const result: Rec = {};
    shape.dims.forEach(d => { result[d.id] = dims[`${shapeId}_${d.id}`] ?? d.def; });
    return result;
  }, [shape, dims, shapeId]);

  const saVal = r(shape.sa(activeDims));
  const volVal = r(shape.vol(activeDims));

  // Three.js setup
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth, H = el.clientHeight || 400;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F8FAFA");

    // Grid
    const grid = new THREE.GridHelper(10, 20, "#E5E7EB", "#E5E7EB");
    (grid.material as THREE.Material).opacity = 0.6;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = -2.2;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(4, 3, 5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.5;
    controls.maxDistance = 15;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(6, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xB2DFDB, 0.4);
    fill.position.set(-5, -3, -5);
    scene.add(fill);

    const animId = requestAnimationFrame(function loop() {
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    });

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight || 400;
      renderer.setSize(W2, H2);
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    sceneRef.current = { renderer, scene, camera, controls, mesh: null, animId };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // Update mesh when shape/dims/color change
  useEffect(() => {
    const sr = sceneRef.current;
    if (!sr) return;

    if (sr.mesh) {
      sr.scene.remove(sr.mesh);
      sr.mesh.geometry.dispose();
      (sr.mesh.material as THREE.Material).dispose();
    }

    const geo = shape.makeGeo(activeDims);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Wireframe overlay
    const wireGeo = geo.clone();
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(0.6),
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.add(wireMesh);

    sr.scene.add(mesh);
    sr.mesh = mesh;
  }, [shape, activeDims, color]);

  const setDim = (key: string, val: number) => setDims(prev => ({ ...prev, [`${shapeId}_${key}`]: val }));

  const resetCamera = () => {
    const sr = sceneRef.current;
    if (!sr) return;
    sr.camera.position.set(4, 3, 5);
    sr.controls.target.set(0, 0, 0);
    sr.controls.update();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
          <Layers className="h-4 w-4" style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-base leading-none">Geometrix</h1>
          <p className="text-xs text-gray-400 mt-0.5">Interactive 3D Geometry Lab</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="text-[10px] bg-amber-50 text-amber-700 border-0 rounded-full px-2">
            Nets & Slicing — Coming Soon
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 108px)" }}>

        {/* LEFT SIDEBAR — Shape selector */}
        <div className="w-52 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Shapes</p>
            {CATEGORIES.map(cat => (
              <div key={cat} className="mb-1">
                <button
                  onClick={() => setExpandedCat(expandedCat === cat ? "" : cat)}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span>{cat}</span>
                  {expandedCat === cat ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {expandedCat === cat && (
                  <div className="ml-1 space-y-0.5 mt-0.5">
                    {SHAPES.filter(s => s.category === cat).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setShapeId(s.id)}
                        className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs transition-all ${
                          shapeId === s.id
                            ? "font-bold text-white"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                        style={shapeId === s.id ? { background: TEAL } : {}}
                      >
                        <span>{s.emoji}</span>
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN — 3D Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={mountRef} className="flex-1 relative" style={{ minHeight: 320 }}>
            {/* Reset camera button */}
            <button
              onClick={resetCamera}
              className="absolute top-3 right-3 z-10 bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 flex items-center gap-1.5 shadow-sm hover:bg-white transition-colors backdrop-blur-sm"
            >
              <RotateCcw className="h-3 w-3" /> Reset View
            </button>
            <div className="absolute bottom-3 left-3 z-10 bg-white/90 border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] text-gray-400 shadow-sm backdrop-blur-sm">
              🖱 Drag to rotate · Scroll to zoom · Right-drag to pan
            </div>
          </div>

          {/* Dimensions panel */}
          <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Color</span>
              <div className="flex gap-1 flex-wrap">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: color === c ? "#121212" : "transparent",
                      transform: color === c ? "scale(1.15)" : undefined,
                    }}
                  />
                ))}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-5 h-5 rounded-full cursor-pointer border-0 bg-transparent" />
              </div>
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {shape.dims.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium min-w-[60px]">{d.label}</span>
                <input
                  type="range" min={d.min} max={d.max} step={d.step}
                  value={activeDims[d.id] ?? d.def}
                  onChange={e => setDim(d.id, parseFloat(e.target.value))}
                  className="w-20 accent-[#00796B]"
                />
                <span className="text-xs tabular-nums text-gray-400 w-8">{r(activeDims[d.id] ?? d.def, 1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — Measurements */}
        <div className="w-56 bg-white border-l border-gray-100 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Shape info */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Properties</p>
                <button onClick={() => setShowInfo(s => !s)}>
                  <Info className="h-3.5 w-3.5 text-gray-300" />
                </button>
              </div>
              <div className="text-center py-3 rounded-xl border border-gray-100" style={{ background: `${TEAL}06` }}>
                <p className="text-2xl mb-0.5">{shape.emoji}</p>
                <p className="font-extrabold text-gray-900 text-sm">{shape.name}</p>
              </div>
            </div>

            {/* Topology */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Topology</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Vertices", val: shape.vef.v },
                  { label: "Edges", val: shape.vef.e },
                  { label: "Faces", val: shape.vef.f },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border border-gray-100 p-2 text-center">
                    <p className="text-base font-black" style={{ color: TEAL }}>{item.val}</p>
                    <p className="text-[9px] text-gray-400 leading-none mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
              {typeof shape.vef.v === "number" && (
                <p className="text-[9px] text-gray-400 mt-1 text-center">
                  Euler: V − E + F = {Number(shape.vef.v) - Number(shape.vef.e) + Number(shape.vef.f)}
                </p>
              )}
            </div>

            {/* Measurements */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Measurements</p>
              <div className="space-y-2">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Surface Area</p>
                  <p className="text-xl font-black" style={{ color: TEAL }}>{saVal}</p>
                  <p className="text-[9px] text-gray-400">units²</p>
                  {showInfo && (
                    <p className="text-[10px] text-gray-400 mt-1.5 font-mono border-t border-gray-50 pt-1.5 leading-relaxed">
                      {shape.saFormula}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Volume</p>
                  <p className="text-xl font-black" style={{ color: "#1976D2" }}>{volVal}</p>
                  <p className="text-[9px] text-gray-400">units³</p>
                  {showInfo && (
                    <p className="text-[10px] text-gray-400 mt-1.5 font-mono border-t border-gray-50 pt-1.5 leading-relaxed">
                      {shape.volFormula}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Coming soon features */}
            <div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-2">Coming Soon</p>
              {["Net Unfolding", "Face Colouring", "Slicing Tool", "Vertex Labels", "Angle Calc"].map(f => (
                <div key={f} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 mb-1">
                  <span className="text-[10px] text-gray-400">{f}</span>
                  <Badge className="text-[8px] px-1 py-0 bg-amber-50 text-amber-600 border-0 rounded-full">Soon</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
