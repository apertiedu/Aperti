import React from "react";

const T = "#0D9488";

const SHAPES: {
  w: number; h: number; top: string; left: string;
  da: string; dr: string; r: number; op: number;
  t: "oct" | "torus" | "box" | "ico";
}[] = [
  { w: 52, h: 52, top: "12%", left: "8%",  da: "0s",   dr: "8s",   r: 45, op: 0.18, t: "oct"   },
  { w: 38, h: 38, top: "22%", left: "82%", da: "1.2s", dr: "11s",  r: 0,  op: 0.14, t: "torus" },
  { w: 30, h: 30, top: "65%", left: "88%", da: "0.5s", dr: "9s",   r: 30, op: 0.16, t: "box"   },
  { w: 60, h: 60, top: "72%", left: "5%",  da: "2s",   dr: "13s",  r: 60, op: 0.12, t: "ico"   },
  { w: 22, h: 22, top: "40%", left: "90%", da: "0.8s", dr: "7s",   r: 20, op: 0.15, t: "oct"   },
  { w: 26, h: 26, top: "55%", left: "75%", da: "3s",   dr: "10s",  r: 75, op: 0.13, t: "box"   },
  { w: 44, h: 44, top: "15%", left: "55%", da: "1.8s", dr: "12s",  r: 15, op: 0.10, t: "torus" },
  { w: 18, h: 18, top: "80%", left: "45%", da: "0.3s", dr: "6s",   r: 50, op: 0.17, t: "oct"   },
  { w: 34, h: 34, top: "30%", left: "2%",  da: "2.5s", dr: "14s",  r: 90, op: 0.11, t: "ico"   },
  { w: 20, h: 20, top: "5%",  left: "38%", da: "1.5s", dr: "8.5s", r: 35, op: 0.14, t: "box"   },
  { w: 16, h: 16, top: "48%", left: "18%", da: "1s",   dr: "7.5s", r: 55, op: 0.13, t: "oct"   },
  { w: 28, h: 28, top: "88%", left: "68%", da: "2.2s", dr: "9.5s", r: 10, op: 0.12, t: "torus" },
];

function ShapeEl({ s }: { s: typeof SHAPES[number] }) {
  const base: React.CSSProperties = {
    position: "absolute",
    top: s.top,
    left: s.left,
    width: s.w,
    height: s.h,
    opacity: s.op,
    animation: `heroGeoFloat ${s.dr} ease-in-out ${s.da} infinite`,
    transform: `rotate(${s.r}deg)`,
  };

  if (s.t === "torus") {
    return <div style={{ ...base, borderRadius: "50%", border: `2.5px solid ${T}`, background: "transparent" }} />;
  }
  if (s.t === "ico") {
    return (
      <svg viewBox="0 0 100 100" style={{ ...base }}>
        <polygon points="50,0 100,25 100,75 50,100 0,75 0,25" fill="none" stroke={T} strokeWidth="3.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke={T} strokeWidth="1" opacity="0.4" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={T} strokeWidth="1" opacity="0.4" />
      </svg>
    );
  }
  if (s.t === "box") {
    return (
      <svg viewBox="0 0 100 100" style={{ ...base }}>
        <rect x="15" y="15" width="70" height="70" fill="none" stroke={T} strokeWidth="3.5" />
        <line x1="15" y1="15" x2="30" y2="0" stroke={T} strokeWidth="2" opacity="0.5" />
        <line x1="85" y1="15" x2="100" y2="0" stroke={T} strokeWidth="2" opacity="0.5" />
        <line x1="100" y1="0" x2="30" y2="0" stroke={T} strokeWidth="2" opacity="0.5" />
        <line x1="100" y1="0" x2="100" y2="70" stroke={T} strokeWidth="2" opacity="0.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" style={{ ...base }}>
      <polygon points="50,0 100,50 50,100 0,50" fill="none" stroke={T} strokeWidth="3.5" />
    </svg>
  );
}

export function Landing3DHeroCanvas() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{`
        @keyframes heroGeoFloat {
          0%   { transform: translateY(0px)   rotate(var(--r, 0deg)); }
          50%  { transform: translateY(-16px) rotate(calc(var(--r, 0deg) + 7deg)); }
          100% { transform: translateY(0px)   rotate(var(--r, 0deg)); }
        }
      `}</style>
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="hero-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill={T} opacity="0.055" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
      {SHAPES.map((s, i) => <ShapeEl key={i} s={s} />)}
    </div>
  );
}
