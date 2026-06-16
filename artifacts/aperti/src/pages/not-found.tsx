import { motion } from "framer-motion";
import { Link } from "wouter";
import { Home, ArrowLeft, Search } from "lucide-react";
import { useState, KeyboardEvent } from "react";


function OrbitRing({ radius, duration, delay, opacity }: { radius: number; duration: number; delay: number; opacity: number }) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{
        width: radius * 2,
        height: radius * 2,
        borderColor: `${"hsl(var(--primary))"}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
        left: "50%",
        top: "50%",
        marginLeft: -radius,
        marginTop: -radius,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

function FloatingDot({ x, y, delay, size }: { x: string; y: string; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{ left: x, top: y, width: size, height: size, background: "hsl(var(--primary))" }}
      animate={{ y: [0, -12, 0], opacity: [0.35, 0.7, 0.35] }}
      transition={{ duration: 3.5, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function NotFound() {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{ background: "white" }}
    >
      {/* Grid dot background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="nf-dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="hsl(var(--primary))" opacity="0.07" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#nf-dots)" />
        </svg>

        {/* Large ambient blobs */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{ width: 500, height: 500, background: "hsl(var(--primary))", opacity: 0.03, top: "-20%", right: "-10%" }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{ width: 350, height: 350, background: "hsl(var(--primary))", opacity: 0.025, bottom: "-10%", left: "-8%" }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-md mx-auto w-full">
        {/* Orbit + 404 central animation */}
        <div className="relative flex items-center justify-center mb-10" style={{ height: 220 }}>
          {/* Orbit rings */}
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <OrbitRing radius={85}  duration={14} delay={0}   opacity={0.20} />
            <OrbitRing radius={110} duration={22} delay={0.5} opacity={0.12} />
            <OrbitRing radius={100} duration={18} delay={1}   opacity={0.16} />
          </div>

          {/* Orbiting dots */}
          <FloatingDot x="10%"  y="18%" delay={0}   size={6} />
          <FloatingDot x="80%"  y="12%" delay={0.8} size={4} />
          <FloatingDot x="72%"  y="78%" delay={1.6} size={5} />
          <FloatingDot x="15%"  y="75%" delay={0.4} size={3} />
          <FloatingDot x="50%"  y="5%"  delay={1.2} size={4} />

          {/* 404 */}
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="text-[96px] font-black leading-none tracking-tighter"
              style={{ color: "transparent", WebkitTextStroke: `2px ${"hsl(var(--primary))"}` }}
              aria-label="Error 404"
            >
              404
            </div>
          </motion.div>
        </div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-xl font-bold text-gray-900 mb-2">This chapter doesn't exist</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            The page you're looking for may have moved, or the link may be outdated.
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.5 }}
        >
          <Link href="/">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
              style={{ background: "hsl(var(--primary))", boxShadow: `0 4px 18px ${"hsl(var(--primary))"}30` }}
            >
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </motion.div>

        {/* Search bar */}
        <motion.div
          className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.45 }}
        >
          <div className="flex items-center px-4 py-3 gap-3">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search Aperti..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            {query && (
              <button
                onClick={handleSearch}
                className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition-all hover:opacity-90 bg-primary"
              >
                Search
              </button>
            )}
          </div>
        </motion.div>

        {/* Quick links */}
        <motion.div
          className="mt-6 flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          {[
            { label: "Dashboard", href: "/" },
            { label: "Courses", href: "/course-hub" },
            { label: "Sign In", href: "/login" },
            { label: "Help", href: "/helpdesk" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs text-gray-400 hover:text-gray-700 hover:underline transition-colors cursor-pointer px-1">
                {label}
              </span>
            </Link>
          ))}
        </motion.div>

        {/* Brand */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Link href="/">
            <span className="text-lg font-extrabold cursor-pointer tracking-tight" style={{ color: "#121212" }}>
              Aperti<span className="text-primary">.</span>
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
