import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, RotateCcw, Palette, ChevronDown, ChevronUp,
  Tag, Eye, EyeOff, Box, Maximize2,
} from "lucide-react";

const TEAL = "#00796B";
const π = Math.PI;
const sq = (x: number) => x * x;
const fmt = (n: number, dp = 2) => +n.toFixed(dp);

const PALETTE = [
  "#00796B","#1976D2","#7B1FA2","#E53935","#F9A825",
  "#388E3C","#FF6F00","#0288D1","#37474F","#AD1457",
  "#4527A0","#C62828","#2E7D32","#BF360C","#006064",
];

type Rec = Record<string, number>;
interface DimDef { id: string; label: string; min: number; max: number; step: number; def: number; }
interface NetInfo { available: boolean; render?: (d: Rec) => React.ReactNode; desc?: string; }
interface Shape {
  id: string; name: string; category: string; emoji: string;
  dims: DimDef[];
  vef: { v: number | "∞"; e: number | "∞"; f: number | "∞" };
  makeGeo: (d: Rec) => THREE.BufferGeometry;
  sa: (d: Rec) => number;
  vol: (d: Rec) => number;
  saFormula: string; volFormula: string;
  net: NetInfo;
  keyVertices?: (d: Rec) => { label: string; pos: [number, number, number] }[];
}

/* ── NET RENDERING HELPERS ── */
const NetFace = ({ points, fill, stroke, delay = 0 }: {
  points: string; fill?: string; stroke?: string; delay?: number;
}) => (
  <motion.polygon
    points={points}
    fill={fill ?? `${TEAL}18`}
    stroke={stroke ?? TEAL}
    strokeWidth={1.5}
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4, delay, ease: "easeOut" }}
  />
);
const NetRect = ({ x, y, w, h, fill, delay = 0 }: { x: number; y: number; w: number; h: number; fill?: string; delay?: number }) => (
  <NetFace points={`${x},${y} ${x+w},${y} ${x+w},${y+h} ${x},${y+h}`} fill={fill} delay={delay} />
);
const NetTri = ({ x1,y1,x2,y2,x3,y3,fill,delay=0 }: { x1:number;y1:number;x2:number;y2:number;x3:number;y3:number;fill?:string;delay?:number }) => (
  <NetFace points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill={fill} delay={delay} />
);

// Cube net — classic cross: T F Bo on vertical, L R Bk on horizontal
const CubeNet = ({ a, C }: { a: number; C: number }) => {
  const x0 = 80, y0 = 20;
  const faces = [
    { x: x0 + C, y: y0,         label: "Top" },
    { x: x0,     y: y0 + C,     label: "Left" },
    { x: x0 + C, y: y0 + C,     label: "Front" },
    { x: x0 + 2*C, y: y0 + C,   label: "Right" },
    { x: x0 + 3*C, y: y0 + C,   label: "Back" },
    { x: x0 + C, y: y0 + 2*C,   label: "Bottom" },
  ];
  const fills = [`${TEAL}22`,`${TEAL}18`,`${TEAL}28`,`${TEAL}1A`,`${TEAL}14`,`${TEAL}20`];
  return (
    <svg viewBox={`0 0 ${x0*2+4*C} ${y0*2+3*C}`} className="w-full h-full">
      {faces.map((f, i) => (
        <g key={i}>
          <NetRect x={f.x} y={f.y} w={C} h={C} fill={fills[i]} delay={i * 0.07} />
          <motion.text x={f.x + C/2} y={f.y + C/2 + 4} textAnchor="middle"
            fontSize={10} fill={TEAL} fontWeight="600" fontFamily="Inter, sans-serif"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i*0.07 + 0.35 }}>
            {f.label}
          </motion.text>
        </g>
      ))}
      <motion.text x={x0*2+4*C-5} y={y0*2+3*C-5} textAnchor="end"
        fontSize={9} fill="#9CA3AF" fontFamily="Inter, sans-serif"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        a = {fmt(a, 1)} units
      </motion.text>
    </svg>
  );
};

// Cylinder net — rectangle + 2 circles
const CylinderNet = ({ r, h }: { r: number; h: number }) => {
  const scale = 55, cr = r * scale, ch = h * scale * 0.6;
  const cw = 2 * π * r * scale * 0.7;
  const cx1 = 50, cy = 50 + cr, rectX = cx1 + 2*cr + 15, cy2 = cy;
  const cx2 = rectX + cw + 2*cr + 15;
  const svgW = cx2 + cr + 30, svgH = Math.max(2*cr, ch) + 100;
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      {/* left circle */}
      <motion.circle cx={cx1+cr} cy={cy} r={cr} fill={`${TEAL}20`} stroke={TEAL} strokeWidth={1.5}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0 }} style={{ originX: `${cx1+cr}px`, originY: `${cy}px` }} />
      {/* rectangle */}
      <NetRect x={rectX} y={cy - ch/2} w={cw} h={ch} fill={`${TEAL}18`} delay={0.15} />
      {/* right circle */}
      <motion.circle cx={cx2+cr} cy={cy2} r={cr} fill={`${TEAL}20`} stroke={TEAL} strokeWidth={1.5}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }} style={{ originX: `${cx2+cr}px`, originY: `${cy2}px` }} />
      {/* labels */}
      {[
        { x: cx1+cr, y: cy+4, t: "Base" },
        { x: rectX + cw/2, y: cy+4, t: "Lateral" },
        { x: cx2+cr, y: cy2+4, t: "Top" },
      ].map((lb, i) => (
        <motion.text key={i} x={lb.x} y={lb.y} textAnchor="middle" fontSize={10}
          fill={TEAL} fontWeight="600" fontFamily="Inter, sans-serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {lb.t}
        </motion.text>
      ))}
    </svg>
  );
};

// Square Pyramid net — square base + 4 triangles pointing outward
const SquarePyramidNet = ({ a, h }: { a: number; h: number }) => {
  const C = Math.min(70, 280 / (a + 1));
  const sl = Math.sqrt(sq(h) + sq(a / 2));
  const th = sl * C;
  const bx = 90, by = 30 + th;
  const midX = bx + C / 2, midY = by + C / 2;
  return (
    <svg viewBox={`0 0 ${bx*2+C} ${by*2+C+th}`} className="w-full h-full">
      {/* Base */}
      <NetRect x={bx} y={by} w={C} h={C} fill={`${TEAL}28`} delay={0} />
      {/* Top triangle */}
      <NetTri x1={bx} y1={by} x2={bx+C} y2={by} x3={midX} y3={by-th} fill={`${TEAL}1E`} delay={0.08} />
      {/* Bottom triangle */}
      <NetTri x1={bx} y1={by+C} x2={bx+C} y2={by+C} x3={midX} y3={by+C+th} fill={`${TEAL}1E`} delay={0.16} />
      {/* Left triangle */}
      <NetTri x1={bx} y1={by} x2={bx} y2={by+C} x3={bx-th} y3={midY} fill={`${TEAL}1A`} delay={0.24} />
      {/* Right triangle */}
      <NetTri x1={bx+C} y1={by} x2={bx+C} y2={by+C} x3={bx+C+th} y3={midY} fill={`${TEAL}1A`} delay={0.32} />
      <motion.text x={bx + C/2} y={by + C/2 + 4} textAnchor="middle" fontSize={10}
        fill={TEAL} fontWeight="600" fontFamily="Inter, sans-serif"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        Base
      </motion.text>
    </svg>
  );
};

// Tetrahedron net — 4 equilateral triangles in a strip
const TetrahedronNet = ({ a }: { a: number }) => {
  const C = 80, h = C * Math.sqrt(3) / 2;
  const sx = 30, sy = 40 + h;
  // 4 triangles sharing edges
  const tris: [number,number,number,number,number,number][] = [
    [sx, sy, sx + C, sy, sx + C/2, sy - h],
    [sx + C, sy, sx + 2*C, sy, sx + 3*C/2, sy - h],
    [sx + 2*C, sy, sx + 3*C, sy, sx + 5*C/2, sy - h],
    [sx + C/2, sy, sx + 3*C/2, sy, sx + C, sy + h],
  ];
  const fills = [`${TEAL}28`,`${TEAL}1E`,`${TEAL}22`,`${TEAL}18`];
  return (
    <svg viewBox={`0 0 ${sx*2+3*C} ${sy + h + 20}`} className="w-full h-full">
      {tris.map(([x1,y1,x2,y2,x3,y3], i) => (
        <NetTri key={i} x1={x1} y1={y1} x2={x2} y2={y2} x3={x3} y3={y3} fill={fills[i]} delay={i * 0.1} />
      ))}
    </svg>
  );
};

// Triangular Prism net — 2 triangles + 3 rectangles
const TriPrismNet = ({ a, h }: { a: number; h: number }) => {
  const C = 70, ch = Math.min(60, h * 30);
  const triH = C * Math.sqrt(3) / 2;
  const sx = 30, sy = 30;
  const faces = [
    // 3 rectangles in a row
    { type: "rect", x: sx, y: sy + triH + 10, w: C, h: ch },
    { type: "rect", x: sx + C, y: sy + triH + 10, w: C, h: ch },
    { type: "rect", x: sx + 2*C, y: sy + triH + 10, w: C, h: ch },
    // triangle tops
    { type: "tri", x1: sx, y1: sy + triH + 10, x2: sx + C/2, y2: sy, x3: sx + C, y3: sy + triH + 10 },
    { type: "tri", x1: sx + 2*C, y1: sy + triH + ch + 10, x2: sx + 5*C/2, y2: sy + ch + triH + triH + 10, x3: sx + 3*C, y3: sy + triH + ch + 10 },
  ];
  return (
    <svg viewBox={`0 0 ${sx*2 + 3*C} ${sy + triH + ch + triH + 50}`} className="w-full h-full">
      {faces.map((f: any, i) => f.type === "rect"
        ? <NetRect key={i} x={f.x} y={f.y} w={f.w} h={f.h} fill={i === 1 ? `${TEAL}28` : `${TEAL}1A`} delay={i*0.1} />
        : <NetTri key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} x3={f.x3} y3={f.y3} fill={`${TEAL}22`} delay={i*0.1} />
      )}
    </svg>
  );
};

/* ── SHAPE DEFINITIONS ── */
const SHAPES: Shape[] = [
  // ── PRISMS & CYLINDERS ────────────────────────────────────────────────────
  {
    id: "cube", name: "Cube", category: "Prisms & Cylinders", emoji: "⬜",
    dims: [{ id: "a", label: "Side (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 8, e: 12, f: 6 },
    makeGeo: d => new THREE.BoxGeometry(d.a, d.a, d.a),
    sa: d => 6 * sq(d.a), vol: d => d.a ** 3,
    saFormula: "6a²", volFormula: "a³",
    keyVertices: d => {
      const h = d.a / 2;
      return [
        { label: "A", pos: [-h,-h,-h] }, { label: "B", pos: [h,-h,-h] },
        { label: "C", pos: [h,h,-h] },  { label: "D", pos: [-h,h,-h] },
        { label: "E", pos: [-h,-h,h] }, { label: "F", pos: [h,-h,h] },
        { label: "G", pos: [h,h,h] },   { label: "H", pos: [-h,h,h] },
      ];
    },
    net: { available: true, render: d => <CubeNet a={d.a} C={60} />, desc: "Classic cross (11 nets exist)" },
  },
  {
    id: "cuboid", name: "Rectangular Prism", category: "Prisms & Cylinders", emoji: "📦",
    dims: [
      { id: "l", label: "Length (l)", min: 0.5, max: 5, step: 0.1, def: 3 },
      { id: "w", label: "Width (w)",  min: 0.5, max: 5, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 1.5 },
    ],
    vef: { v: 8, e: 12, f: 6 },
    makeGeo: d => new THREE.BoxGeometry(d.l, d.h, d.w),
    sa: d => 2*(d.l*d.w + d.w*d.h + d.l*d.h), vol: d => d.l*d.w*d.h,
    saFormula: "2(lw + wh + lh)", volFormula: "lwh",
    net: { available: false },
  },
  {
    id: "triangular-prism", name: "Triangular Prism", category: "Prisms & Cylinders", emoji: "🔺",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 5, step: 0.1, def: 3 },
    ],
    vef: { v: 6, e: 9, f: 5 },
    makeGeo: d => new THREE.CylinderGeometry(d.a/Math.sqrt(3), d.a/Math.sqrt(3), d.h, 3),
    sa: d => (Math.sqrt(3)/2)*sq(d.a) + 3*d.a*d.h,
    vol: d => (Math.sqrt(3)/4)*sq(d.a)*d.h,
    saFormula: "(√3/2)a² + 3ah", volFormula: "(√3/4)a²h",
    net: { available: true, render: d => <TriPrismNet a={d.a} h={d.h} />, desc: "2 triangles + 3 rectangles" },
  },
  {
    id: "pentagonal-prism", name: "Pentagonal Prism", category: "Prisms & Cylinders", emoji: "⬠",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: 10, e: 15, f: 7 },
    makeGeo: d => new THREE.CylinderGeometry(d.a/(2*Math.sin(π/5)), d.a/(2*Math.sin(π/5)), d.h, 5),
    sa: d => { const R = d.a/(2*Math.sin(π/5)); return 5*d.a*d.h + (5*sq(d.a))/(4*Math.tan(π/5)); },
    vol: d => (5*d.a*d.h*d.a)/(4*Math.tan(π/5)),
    saFormula: "5ah + (5a²)/(4tan(π/5))", volFormula: "(5a²h)/(4tan(π/5))",
    net: { available: false },
  },
  {
    id: "hexagonal-prism", name: "Hexagonal Prism", category: "Prisms & Cylinders", emoji: "⬡",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 5, step: 0.1, def: 3 },
    ],
    vef: { v: 12, e: 18, f: 8 },
    makeGeo: d => new THREE.CylinderGeometry(d.a, d.a, d.h, 6),
    sa: d => 3*Math.sqrt(3)*sq(d.a) + 6*d.a*d.h,
    vol: d => (3*Math.sqrt(3)/2)*sq(d.a)*d.h,
    saFormula: "3√3a² + 6ah", volFormula: "(3√3/2)a²h",
    net: { available: false },
  },
  {
    id: "cylinder", name: "Cylinder", category: "Prisms & Cylinders", emoji: "🥫",
    dims: [
      { id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.2 },
      { id: "h", label: "Height (h)", min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: "∞", e: "∞", f: 3 },
    makeGeo: d => new THREE.CylinderGeometry(d.r, d.r, d.h, 36),
    sa: d => 2*π*d.r*(d.r+d.h), vol: d => π*sq(d.r)*d.h,
    saFormula: "2πr(r + h)", volFormula: "πr²h",
    net: { available: true, render: d => <CylinderNet r={d.r} h={d.h} />, desc: "2 circles + rectangle" },
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
    sa: d => { const l = Math.sqrt(sq(d.r)+sq(d.h)); return π*d.r*(d.r+l); },
    vol: d => (π*sq(d.r)*d.h)/3,
    saFormula: "πr(r + l),  l=√(r²+h²)", volFormula: "⅓πr²h",
    net: { available: false },
  },
  {
    id: "square-pyramid", name: "Square Pyramid", category: "Pyramids & Cones", emoji: "🔷",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 5, step: 0.1, def: 2.5 },
    ],
    vef: { v: 5, e: 8, f: 5 },
    makeGeo: d => new THREE.ConeGeometry(d.a/Math.SQRT2, d.h, 4, 1),
    sa: d => { const l = Math.sqrt(sq(d.h)+sq(d.a/2)); return sq(d.a)+2*d.a*l; },
    vol: d => sq(d.a)*d.h/3,
    saFormula: "a² + 2al,  l=√(h²+(a/2)²)", volFormula: "⅓a²h",
    keyVertices: d => {
      const h2 = d.a / 2;
      return [
        { label: "A", pos: [-h2, -d.h/2, -h2] }, { label: "B", pos: [h2, -d.h/2, -h2] },
        { label: "C", pos: [h2, -d.h/2, h2] },   { label: "D", pos: [-h2, -d.h/2, h2] },
        { label: "E", pos: [0, d.h/2, 0] },
      ];
    },
    net: { available: true, render: d => <SquarePyramidNet a={d.a} h={d.h} />, desc: "Square + 4 triangles" },
  },
  {
    id: "triangular-pyramid", name: "Tetrahedron", category: "Pyramids & Cones", emoji: "🔺",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 4, e: 6, f: 4 },
    makeGeo: d => new THREE.TetrahedronGeometry(d.a/Math.sqrt(2)*0.9),
    sa: d => Math.sqrt(3)*sq(d.a), vol: d => sq(d.a)*d.a/(6*Math.SQRT2),
    saFormula: "√3 · a²", volFormula: "a³ / (6√2)",
    net: { available: true, render: d => <TetrahedronNet a={d.a} />, desc: "Strip of 4 triangles" },
  },
  {
    id: "pentagonal-pyramid", name: "Pentagonal Pyramid", category: "Pyramids & Cones", emoji: "🔶",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 4, step: 0.1, def: 2 },
    ],
    vef: { v: 6, e: 10, f: 6 },
    makeGeo: d => new THREE.ConeGeometry(d.a/(2*Math.sin(π/5)), d.h, 5),
    sa: d => { const R = d.a/(2*Math.sin(π/5)); const l = Math.sqrt(sq(d.h)+sq(R)); return (5*sq(d.a))/(4*Math.tan(π/5)) + 5*d.a*l/2; },
    vol: d => (5*sq(d.a)*d.h)/(12*Math.tan(π/5)),
    saFormula: "(5a²)/(4tan(π/5)) + (5al)/2", volFormula: "(5a²h)/(12tan(π/5))",
    net: { available: false },
  },
  {
    id: "hexagonal-pyramid", name: "Hexagonal Pyramid", category: "Pyramids & Cones", emoji: "🟡",
    dims: [
      { id: "a", label: "Base edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "h", label: "Height (h)",   min: 0.5, max: 4, step: 0.1, def: 2 },
    ],
    vef: { v: 7, e: 12, f: 7 },
    makeGeo: d => new THREE.ConeGeometry(d.a, d.h, 6),
    sa: d => { const l = Math.sqrt(sq(d.h)+sq(d.a*Math.sqrt(3)/2)); return 3*Math.sqrt(3)*sq(d.a)/2 + 3*d.a*l; },
    vol: d => Math.sqrt(3)*sq(d.a)*d.h/2,
    saFormula: "3√3a²/2 + 3al,  l=√(h²+3a²/4)", volFormula: "(√3/2)a²h",
    net: { available: false },
  },
  // ── ROUND SOLIDS ──────────────────────────────────────────────────────────
  {
    id: "sphere", name: "Sphere", category: "Round Solids", emoji: "🔵",
    dims: [{ id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.SphereGeometry(d.r, 48, 32),
    sa: d => 4*π*sq(d.r), vol: d => (4/3)*π*d.r**3,
    saFormula: "4πr²", volFormula: "⁴⁄₃πr³",
    net: { available: false },
  },
  {
    id: "hemisphere", name: "Hemisphere", category: "Round Solids", emoji: "🌐",
    dims: [{ id: "r", label: "Radius (r)", min: 0.3, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.SphereGeometry(d.r, 48, 24, 0, 2*π, 0, π/2),
    sa: d => 3*π*sq(d.r), vol: d => (2/3)*π*d.r**3,
    saFormula: "3πr²", volFormula: "²⁄₃πr³",
    net: { available: false },
  },
  {
    id: "torus", name: "Torus", category: "Round Solids", emoji: "🍩",
    dims: [
      { id: "R", label: "Major radius (R)", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { id: "r", label: "Tube radius (r)",  min: 0.1, max: 1, step: 0.05, def: 0.4 },
    ],
    vef: { v: "∞", e: "∞", f: "∞" },
    makeGeo: d => new THREE.TorusGeometry(d.R, d.r, 20, 80),
    sa: d => 4*sq(π)*d.R*d.r, vol: d => 2*sq(π)*d.R*sq(d.r),
    saFormula: "4π²Rr", volFormula: "2π²Rr²",
    net: { available: false },
  },
  // ── PLATONIC SOLIDS ───────────────────────────────────────────────────────
  {
    id: "octahedron", name: "Octahedron", category: "Platonic Solids", emoji: "💎",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 4, step: 0.1, def: 2 }],
    vef: { v: 6, e: 12, f: 8 },
    makeGeo: d => new THREE.OctahedronGeometry(d.a/Math.SQRT2),
    sa: d => 2*Math.sqrt(3)*sq(d.a), vol: d => (Math.SQRT2/3)*d.a**3,
    saFormula: "2√3 · a²", volFormula: "(√2/3)a³",
    net: { available: false },
  },
  {
    id: "dodecahedron", name: "Dodecahedron", category: "Platonic Solids", emoji: "🔮",
    dims: [{ id: "a", label: "Edge (a)", min: 0.3, max: 2.5, step: 0.1, def: 1.2 }],
    vef: { v: 20, e: 30, f: 12 },
    makeGeo: d => new THREE.DodecahedronGeometry(d.a*1.401),
    sa: d => 3*Math.sqrt(25+10*Math.sqrt(5))*sq(d.a),
    vol: d => ((15+7*Math.sqrt(5))/4)*d.a**3,
    saFormula: "3√(25+10√5) · a²", volFormula: "((15+7√5)/4)a³",
    net: { available: false },
  },
  {
    id: "icosahedron", name: "Icosahedron", category: "Platonic Solids", emoji: "❄️",
    dims: [{ id: "a", label: "Edge (a)", min: 0.5, max: 3, step: 0.1, def: 1.5 }],
    vef: { v: 12, e: 30, f: 20 },
    makeGeo: d => new THREE.IcosahedronGeometry(d.a*0.951),
    sa: d => 5*Math.sqrt(3)*sq(d.a), vol: d => (5*(3+Math.sqrt(5))/12)*d.a**3,
    saFormula: "5√3 · a²", volFormula: "(5(3+√5)/12)a³",
    net: { available: false },
  },
];

const CATEGORIES = Array.from(new Set(SHAPES.map(s => s.category)));

/* ── MAIN COMPONENT ── */
export default function Geometrix() {
  const mountRef       = useRef<HTMLDivElement>(null);
  const labelDivRef    = useRef<HTMLDivElement>(null);
  const sceneRef       = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: any;
    mesh: THREE.Mesh | null;
    animId: number;
  }>(null as any);

  const [shapeId,      setShapeId]      = useState("cube");
  const [color,        setColor]        = useState(TEAL);
  const [dims,         setDims]         = useState<Rec>({});
  const [expandedCat,  setExpandedCat]  = useState("Prisms & Cylinders");
  const [showNet,      setShowNet]      = useState(false);
  const [showLabels,   setShowLabels]   = useState(false);
  const [showFormulas, setShowFormulas] = useState(true);

  const shape = SHAPES.find(s => s.id === shapeId)!;

  const activeDims = useMemo<Rec>(() => {
    const d: Rec = {};
    shape.dims.forEach(dim => { d[dim.id] = dims[`${shapeId}_${dim.id}`] ?? dim.def; });
    return d;
  }, [shape, dims, shapeId]);

  const saVal  = fmt(shape.sa(activeDims));
  const volVal = fmt(shape.vol(activeDims));

  // ── Three.js scene init (once) ────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth || 600, H = el.clientHeight || 450;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F8FAFA");

    const grid = new THREE.GridHelper(12, 24, "#E5E7EB", "#E5E7EB");
    (grid.material as THREE.Material).opacity = 0.6;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = -2.5;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 100);
    camera.position.set(4.5, 3.5, 5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.5;
    controls.maxDistance = 18;

    const ambient  = new THREE.AmbientLight(0xffffff, 0.55);
    const sun      = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(6, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const fill     = new THREE.DirectionalLight(0xB2DFDB, 0.35);
    fill.position.set(-5, -3, -5);
    scene.add(ambient, sun, fill);

    // Label-aware animation loop
    const animId = requestAnimationFrame(function loop() {
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);

      // Project vertex labels to screen space (direct DOM, no setState)
      const labelEl = labelDivRef.current;
      const sr = sceneRef.current;
      if (labelEl && sr?.mesh && sr.mesh.userData.showLabels) {
        const { width, height } = renderer.domElement.getBoundingClientRect();
        const keyVerts: { label: string; pos: [number,number,number] }[] = sr.mesh.userData.keyVertices || [];
        let html = "";
        keyVerts.forEach(v => {
          const vec = new THREE.Vector3(...v.pos).project(camera);
          const sx = (vec.x + 1) * width  / 2;
          const sy = (-vec.y + 1) * height / 2;
          if (sx > -20 && sx < width + 20 && sy > -20 && sy < height + 20 && vec.z < 1) {
            html += `<div style="position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);
              background:${TEAL};color:#fff;font-size:10px;font-weight:700;padding:2px 5px;
              border-radius:4px;white-space:nowrap;pointer-events:none;font-family:Inter,sans-serif">
              ${v.label}</div>`;
          }
        });
        labelEl.innerHTML = html;
      } else if (labelEl) {
        labelEl.innerHTML = "";
      }
    });

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight || 450;
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
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ── Rebuild mesh when shape / dims / color / labels change ────────────────
  useEffect(() => {
    const sr = sceneRef.current;
    if (!sr) return;

    if (sr.mesh) {
      sr.scene.remove(sr.mesh);
      sr.mesh.geometry.dispose();
      (sr.mesh.material as THREE.Material).dispose();
      sr.mesh.children.forEach(c => {
        (c as THREE.Mesh).geometry?.dispose();
        ((c as THREE.Mesh).material as THREE.Material)?.dispose();
      });
    }

    const geo = shape.makeGeo(activeDims);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3, metalness: 0.06, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.showLabels  = showLabels;
    mesh.userData.keyVertices = shape.keyVertices?.(activeDims) ?? [];

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), wireframe: true, transparent: true, opacity: 0.1 });
    mesh.add(new THREE.Mesh(geo.clone(), wireMat));

    sr.scene.add(mesh);
    sr.mesh = mesh;
  }, [shape, activeDims, color, showLabels]);

  const setDim = (key: string, val: number) =>
    setDims(prev => ({ ...prev, [`${shapeId}_${key}`]: val }));

  const resetCamera = () => {
    const sr = sceneRef.current;
    if (!sr) return;
    sr.camera.position.set(4.5, 3.5, 5);
    sr.controls.target.set(0, 0, 0);
    sr.controls.update();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F5F5" }}>

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
          <Box className="h-5 w-5" style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="font-black text-gray-900 text-base leading-none">Geometrix</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Interactive 3D Geometry Lab</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {shape.net.available && (
            <button
              onClick={() => setShowNet(n => !n)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showNet ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={showNet ? { background: TEAL } : {}}>
              {showNet ? <Maximize2 className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {showNet ? "3D View" : "Show Net"}
            </button>
          )}
          {shape.keyVertices && (
            <button
              onClick={() => setShowLabels(l => !l)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showLabels ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={showLabels ? { background: "#1976D2" } : {}}>
              {showLabels ? <EyeOff className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
              Vertices
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT SIDEBAR — Shape picker ── */}
        <div className="w-52 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Shape Library</p>
            {CATEGORIES.map(cat => (
              <div key={cat} className="mb-1">
                <button onClick={() => setExpandedCat(expandedCat === cat ? "" : cat)}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  <span>{cat}</span>
                  {expandedCat === cat ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                </button>
                <AnimatePresence>
                  {expandedCat === cat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden ml-1 mt-0.5">
                      {SHAPES.filter(s => s.category === cat).map(s => (
                        <button key={s.id} onClick={() => { setShapeId(s.id); setShowNet(false); }}
                          className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs transition-all mb-0.5 ${
                            shapeId === s.id ? "font-bold text-white" : "text-gray-600 hover:bg-gray-50"
                          }`}
                          style={shapeId === s.id ? { background: TEAL } : {}}>
                          <span className="text-sm">{s.emoji}</span>
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN — 3D Viewer or Net View ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {showNet && shape.net.available && shape.net.render ? (
              /* NET VIEW */
              <motion.div key="net"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                className="flex-1 bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-4 left-4 right-4 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800">{shape.name} — Net</span>
                  {shape.net.desc && (
                    <span className="text-[10px] text-gray-400">{shape.net.desc}</span>
                  )}
                </div>
                <div className="w-full max-w-lg" style={{ height: 300 }}>
                  {shape.net.render(activeDims)}
                </div>
                <p className="text-[10px] text-gray-300 mt-4">
                  This is the unfolded 2D net of a {shape.name}. Fold along the edges to form the 3D shape.
                </p>
              </motion.div>
            ) : (
              /* 3D VIEW */
              <motion.div key="3d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 relative"
                style={{ minHeight: 320 }}>
                <div ref={mountRef} className="w-full h-full" />
                {/* Vertex label overlay */}
                <div ref={labelDivRef} className="absolute inset-0 pointer-events-none" />
                {/* Reset camera */}
                <button onClick={resetCamera}
                  className="absolute top-3 right-3 z-10 bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 flex items-center gap-1.5 shadow-sm hover:bg-white transition-colors backdrop-blur-sm">
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <div className="absolute bottom-3 left-3 z-10 bg-white/85 border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] text-gray-400 shadow-sm backdrop-blur-sm">
                  Drag · scroll to zoom · right-drag to pan
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── DIMENSIONS & COLOR BAR ── */}
          <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-5 flex-wrap shrink-0">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-gray-400" />
              <div className="flex gap-1 flex-wrap">
                {PALETTE.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                    style={{ background: c, borderColor: color === c ? "#121212" : "transparent", transform: color === c ? "scale(1.2)" : undefined }} />
                ))}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-4 h-4 rounded-full cursor-pointer border-0 bg-transparent" />
              </div>
            </div>
            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
            {shape.dims.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium min-w-[54px] shrink-0">{d.label}</span>
                <input type="range" min={d.min} max={d.max} step={d.step}
                  value={activeDims[d.id] ?? d.def}
                  onChange={e => setDim(d.id, parseFloat(e.target.value))}
                  className="w-20 accent-[#00796B]" />
                <span className="text-xs tabular-nums text-gray-400 w-7">{fmt(activeDims[d.id] ?? d.def, 1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL — Measurements ── */}
        <div className="w-56 bg-white border-l border-gray-100 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">

            {/* Shape card */}
            <div className="text-center py-3 rounded-xl border border-gray-100" style={{ background: `${TEAL}06` }}>
              <p className="text-3xl mb-1">{shape.emoji}</p>
              <p className="font-extrabold text-gray-900 text-sm leading-tight">{shape.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{shape.category}</p>
            </div>

            {/* Topology */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Topology</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ l: "V", v: shape.vef.v }, { l: "E", v: shape.vef.e }, { l: "F", v: shape.vef.f }].map(t => (
                  <div key={t.l} className="rounded-lg border border-gray-100 p-2 text-center">
                    <p className="text-base font-black" style={{ color: TEAL }}>{t.v}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{t.l}</p>
                  </div>
                ))}
              </div>
              {typeof shape.vef.v === "number" && (
                <p className="text-[9px] text-gray-400 mt-1 text-center">
                  Euler: {shape.vef.v} − {shape.vef.e} + {shape.vef.f} = {Number(shape.vef.v) - Number(shape.vef.e) + Number(shape.vef.f)}
                </p>
              )}
            </div>

            {/* Measurements */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Measurements</p>
                <button onClick={() => setShowFormulas(f => !f)} className="text-gray-300 hover:text-gray-500">
                  {showFormulas ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Surface Area</p>
                  <p className="text-2xl font-black" style={{ color: TEAL }}>{saVal}</p>
                  <p className="text-[9px] text-gray-400">units²</p>
                  {showFormulas && (
                    <p className="text-[10px] text-gray-400 mt-2 font-mono border-t border-gray-50 pt-2 leading-relaxed">
                      {shape.saFormula}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Volume</p>
                  <p className="text-2xl font-black" style={{ color: "#1976D2" }}>{volVal}</p>
                  <p className="text-[9px] text-gray-400">units³</p>
                  {showFormulas && (
                    <p className="text-[10px] text-gray-400 mt-2 font-mono border-t border-gray-50 pt-2 leading-relaxed">
                      {shape.volFormula}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Vertex list (when labels on) */}
            {showLabels && shape.keyVertices && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Vertices</p>
                <div className="space-y-1">
                  {shape.keyVertices(activeDims).map(v => (
                    <div key={v.label} className="flex items-center gap-2 text-[10px]">
                      <span className="font-bold w-4 text-center rounded px-0.5" style={{ color: TEAL, background: `${TEAL}15` }}>{v.label}</span>
                      <span className="text-gray-400 font-mono">
                        ({v.pos.map(n => fmt(n,1)).join(", ")})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coming Soon features */}
            <div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-2">Coming Soon</p>
              {[
                { n: "Net Folding Animation", done: false },
                { n: "Multiple Net Presets", done: false },
                { n: "Net Verification Quiz", done: false },
                { n: "Face Colouring", done: false },
                { n: "Slicing Tool", done: false },
                { n: "Angle Calculator", done: false },
              ].map(f => (
                <div key={f.n} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 mb-1">
                  <span className="text-[10px] text-gray-400">{f.n}</span>
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
