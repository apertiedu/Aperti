import React from "react";

const T = "#0D9488";
const T_DIM = "#0D948840";
const T_FAINT = "#0D948818";

const PARTICLES: { cx: number; cy: number; r: number; anim: number; delay: number; op: number }[] = [
  { cx:  8, cy: 14, r: 2.5, anim: 0, delay: 0,    op: 0.45 },
  { cx: 18, cy: 72, r: 1.5, anim: 1, delay: 0.7,  op: 0.30 },
  { cx: 28, cy: 38, r: 2,   anim: 2, delay: 1.4,  op: 0.40 },
  { cx: 38, cy: 85, r: 1.5, anim: 3, delay: 0.3,  op: 0.28 },
  { cx: 55, cy: 22, r: 3,   anim: 4, delay: 1.1,  op: 0.50 },
  { cx: 62, cy: 60, r: 1.5, anim: 0, delay: 1.9,  op: 0.25 },
  { cx: 72, cy: 10, r: 2,   anim: 1, delay: 0.5,  op: 0.38 },
  { cx: 80, cy: 45, r: 2.5, anim: 2, delay: 1.6,  op: 0.44 },
  { cx: 88, cy: 80, r: 1.5, anim: 3, delay: 0.8,  op: 0.30 },
  { cx: 93, cy: 28, r: 2,   anim: 4, delay: 1.3,  op: 0.42 },
  { cx: 45, cy: 50, r: 1.5, anim: 0, delay: 2.1,  op: 0.22 },
  { cx: 12, cy: 90, r: 2,   anim: 1, delay: 0.2,  op: 0.35 },
  { cx: 75, cy: 92, r: 1.5, anim: 2, delay: 1.8,  op: 0.28 },
  { cx: 35, cy: 68, r: 2.5, anim: 3, delay: 0.6,  op: 0.40 },
  { cx: 50, cy: 5,  r: 2,   anim: 4, delay: 1.0,  op: 0.35 },
  { cx: 65, cy: 35, r: 1.5, anim: 0, delay: 2.3,  op: 0.22 },
  { cx: 20, cy: 55, r: 2,   anim: 1, delay: 0.4,  op: 0.38 },
  { cx: 90, cy: 55, r: 1.5, anim: 2, delay: 1.5,  op: 0.30 },
  { cx: 42, cy: 18, r: 2.5, anim: 3, delay: 0.9,  op: 0.45 },
  { cx: 58, cy: 78, r: 2,   anim: 4, delay: 2.0,  op: 0.32 },
  { cx: 5,  cy: 50, r: 1.5, anim: 0, delay: 1.2,  op: 0.25 },
  { cx: 95, cy: 70, r: 2,   anim: 1, delay: 0.1,  op: 0.36 },
  { cx: 25, cy: 25, r: 1.5, anim: 2, delay: 1.7,  op: 0.28 },
  { cx: 82, cy: 18, r: 2.5, anim: 3, delay: 0.4,  op: 0.42 },
  { cx: 48, cy: 95, r: 1.5, anim: 4, delay: 1.9,  op: 0.22 },
];

const GRAPH_NODES = [
  { x: 20, y: 22 }, { x: 78, y: 18 }, { x: 88, y: 65 },
  { x: 65, y: 88 }, { x: 15, y: 75 }, { x: 50, y: 50 },
  { x: 38, y: 38 }, { x: 72, y: 42 },
];

const GRAPH_EDGES = [
  [0,6],[1,7],[2,7],[3,4],[4,5],[5,6],[5,7],[6,7],[0,5],[1,2],
];

const CUBES: { x: string; y: string; size: number; speed: number; opacity: number; rotX: number; delay: number }[] = [
  { x: "10%",  y: "18%",  size: 52, speed: 14, opacity: 0.22, rotX: 25,  delay: 0   },
  { x: "82%",  y: "22%",  size: 38, speed: 18, opacity: 0.17, rotX: -18, delay: 1.5 },
  { x: "70%",  y: "75%",  size: 28, speed: 11, opacity: 0.20, rotX: 30,  delay: 3   },
  { x: "6%",   y: "68%",  size: 44, speed: 22, opacity: 0.14, rotX: -22, delay: 0.8 },
  { x: "52%",  y: "8%",   size: 22, speed: 9,  opacity: 0.18, rotX: 15,  delay: 2   },
  { x: "92%",  y: "45%",  size: 34, speed: 16, opacity: 0.15, rotX: -10, delay: 1.2 },
];

const RINGS = [
  { cx: "50%", cy: "50%", rx: 200, ry: 55,  stroke: 0.22, dur: "16s", delay: "0s",   dotDur: "16s"  },
  { cx: "50%", cy: "50%", rx: 150, ry: 35,  stroke: 0.18, dur: "22s", delay: "-5s",  dotDur: "22s"  },
  { cx: "50%", cy: "50%", rx: 260, ry: 70,  stroke: 0.14, dur: "30s", delay: "-12s", dotDur: "30s"  },
];

export function Landing3DHeroCanvas() {
  const cubeKeyframes = CUBES.map((c, i) => `
    @keyframes cube3DRotate${i} {
      from { transform: rotateX(${c.rotX}deg) rotateY(0deg); }
      to   { transform: rotateX(${c.rotX}deg) rotateY(360deg); }
    }
  `).join("");

  const floatKeyframes = `
    @keyframes pf0 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(4px,-14px)} 66%{transform:translate(-3px,-8px)} }
    @keyframes pf1 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-8px,-10px)} 66%{transform:translate(5px,-6px)} }
    @keyframes pf2 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(6px,-8px)} 66%{transform:translate(-4px,-14px)} }
    @keyframes pf3 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-5px,-16px)} 66%{transform:translate(6px,-7px)} }
    @keyframes pf4 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(10px,-6px)} 66%{transform:translate(-7px,-12px)} }
  `;

  const otherKeyframes = `
    @keyframes glowPulse { 0%,100%{opacity:0.055;transform:scale(1)} 50%{opacity:0.13;transform:scale(1.18)} }
    @keyframes glowPulse2 { 0%,100%{opacity:0.04;transform:scale(1)} 50%{opacity:0.09;transform:scale(1.1)} }
    @keyframes edgeDash { from{stroke-dashoffset:0} to{stroke-dashoffset:-24} }
    @keyframes nodePulse { 0%,100%{r:3;opacity:0.7} 50%{r:4.5;opacity:1} }
    @keyframes scanLine { 0%{top:-2px;opacity:0} 10%{opacity:0.4} 90%{opacity:0.4} 100%{top:100%;opacity:0} }
    @keyframes ringGlow { 0%,100%{stroke-opacity:0.14} 50%{stroke-opacity:0.32} }
  `;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{cubeKeyframes + floatKeyframes + otherKeyframes}</style>

      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="ldot-grid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill={T} opacity="0.06" />
          </pattern>
          <radialGradient id="lradial" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor={T} stopOpacity="0.03" />
            <stop offset="100%" stopColor={T} stopOpacity="0" />
          </radialGradient>
          <filter id="lglow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#ldot-grid)" />
        <ellipse cx="50%" cy="45%" rx="40%" ry="35%" fill="url(#lradial)" />
      </svg>

      {/* Subtle corner accents — very low opacity */}
      <div style={{
        position: "absolute", top: "-10%", right: "-8%",
        width: 340, height: 340, borderRadius: "50%",
        background: T, filter: "blur(100px)",
        opacity: 0.04,
      }} />
      <div style={{
        position: "absolute", bottom: "-8%", left: "-6%",
        width: 240, height: 240, borderRadius: "50%",
        background: T, filter: "blur(90px)",
        opacity: 0.03,
      }} />

      {/* CSS 3D Cubes */}
      {CUBES.map((c, i) => {
        const half = c.size / 2;
        const faces = [
          `translateZ(${half}px)`,
          `rotateY(180deg) translateZ(${half}px)`,
          `rotateY(90deg) translateZ(${half}px)`,
          `rotateY(-90deg) translateZ(${half}px)`,
          `rotateX(90deg) translateZ(${half}px)`,
          `rotateX(-90deg) translateZ(${half}px)`,
        ];
        return (
          <div key={i} style={{
            position: "absolute", left: c.x, top: c.y,
            width: c.size, height: c.size,
            marginLeft: -half, marginTop: -half,
            perspective: `${c.size * 5}px`,
          }}>
            <div style={{
              width: "100%", height: "100%",
              transformStyle: "preserve-3d",
              animation: `cube3DRotate${i} ${c.speed}s linear ${c.delay}s infinite`,
              opacity: c.opacity,
            }}>
              {faces.map((f, fi) => (
                <div key={fi} style={{
                  position: "absolute",
                  width: c.size, height: c.size,
                  border: `1.5px solid ${T}`,
                  background: T_FAINT,
                  transform: f,
                }} />
              ))}
            </div>
          </div>
        );
      })}

      {/* SVG layer — rings, nodes, particles */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nodeglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={T} stopOpacity="1" />
            <stop offset="100%" stopColor={T} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Orbit rings — tilted ellipses */}
        {RINGS.map((r, i) => (
          <g key={i}>
            <ellipse
              cx="50" cy="50"
              rx={r.rx / 12} ry={r.ry / 12}
              fill="none"
              stroke={T}
              strokeWidth="0.25"
              strokeOpacity={r.stroke}
              style={{ animation: `ringGlow ${r.dur} ease-in-out ${r.delay} infinite` }}
            />
            <circle r="1.4" fill={T} opacity="0.8" filter="url(#lglow)">
              <animateMotion dur={r.dotDur} begin={r.delay} repeatCount="indefinite">
                <mpath href={`#orbit${i}`} />
              </animateMotion>
            </circle>
            <ellipse
              id={`orbit${i}`}
              cx="50" cy="50"
              rx={r.rx / 12} ry={r.ry / 12}
              fill="none" stroke="none"
            />
          </g>
        ))}

        {/* Connection graph edges */}
        {GRAPH_EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={GRAPH_NODES[a].x} y1={GRAPH_NODES[a].y}
            x2={GRAPH_NODES[b].x} y2={GRAPH_NODES[b].y}
            stroke={T}
            strokeWidth="0.18"
            strokeOpacity="0.28"
            strokeDasharray="1.5 1.5"
            style={{ animation: `edgeDash ${3 + i * 0.4}s linear infinite` }}
          />
        ))}

        {/* Connection graph nodes */}
        {GRAPH_NODES.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="1.8" fill={T} opacity="0.12" />
            <circle cx={n.x} cy={n.y} r="1" fill={T} opacity="0.75" filter="url(#lglow)"
              style={{ animation: `nodePulse ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }} />
          </g>
        ))}

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={p.cx} cy={p.cy} r={p.r * 0.35}
            fill={T}
            opacity={p.op}
            style={{ animation: `pf${p.anim} ${4 + p.r * 2}s ease-in-out ${p.delay}s infinite` }}
          />
        ))}
      </svg>

      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        height: 1,
        background: `linear-gradient(to right, transparent, ${T_DIM}, transparent)`,
        animation: "scanLine 8s linear 2s infinite",
      }} />
    </div>
  );
}
