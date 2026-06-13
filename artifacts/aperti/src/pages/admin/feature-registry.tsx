import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Layers, CheckCircle2, FlaskConical, Clock, XCircle } from "lucide-react";
import {
  FEATURE_REGISTRY,
  FeatureStatus,
  STATUS_LABELS,
  getFeaturesByCategory,
} from "@/lib/feature-registry";
import { Link } from "wouter";

const STATUS_ICONS: Record<FeatureStatus, React.ReactNode> = {
  stable: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  beta: <FlaskConical className="h-3.5 w-3.5 text-amber-500" />,
  "coming-soon": <Clock className="h-3.5 w-3.5 text-blue-400" />,
  disabled: <XCircle className="h-3.5 w-3.5 text-gray-400" />,
};

const STATUS_BADGE: Record<FeatureStatus, string> = {
  stable: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  beta: "bg-amber-50 text-amber-700 border border-amber-200",
  "coming-soon": "bg-blue-50 text-blue-600 border border-blue-200",
  disabled: "bg-gray-100 text-gray-400 border border-gray-200",
};

const ALL_ROLES = ["admin", "teacher", "assistant", "student", "parent"];

export default function FeatureRegistryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const byCategory = useMemo(() => getFeaturesByCategory(), []);

  const filtered = FEATURE_REGISTRY.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    const matchRole = roleFilter === "all" || f.roles.includes(roleFilter);
    return matchSearch && matchStatus && matchRole;
  });

  const filteredByCategory = Object.entries(byCategory)
    .map(([cat, features]) => ({
      cat,
      features: features.filter((f) => filtered.includes(f)),
    }))
    .filter((g) => g.features.length > 0);

  const counts = {
    total: FEATURE_REGISTRY.length,
    stable: FEATURE_REGISTRY.filter((f) => f.status === "stable").length,
    beta: FEATURE_REGISTRY.filter((f) => f.status === "beta").length,
    comingSoon: FEATURE_REGISTRY.filter((f) => f.status === "coming-soon").length,
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Feature Registry
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All {counts.total} platform modules — their status, routes, and role access.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Stable", value: counts.stable, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Beta", value: counts.beta, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Coming Soon", value: counts.comingSoon, color: "text-blue-500", bg: "bg-blue-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border/30`}>
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search features..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FeatureStatus | "all")}
            className="px-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All statuses</option>
            {(["stable", "beta", "coming-soon", "disabled"] as FeatureStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Showing {filtered.length} of {FEATURE_REGISTRY.length} features
        </p>

        <div className="space-y-6">
          {filteredByCategory.map(({ cat, features }) => (
            <div key={cat}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
                {cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {features.map((f) => (
                  <Link key={f.id} href={f.route}>
                    <div className="group bg-card border border-border/40 rounded-xl p-4 hover:border-primary/20 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {f.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[f.status]}`}
                        >
                          {STATUS_ICONS[f.status]}
                          {STATUS_LABELS[f.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {f.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
                          {f.route}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          {f.roles.map((r) => (
                            <span
                              key={r}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                            >
                              {r.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {filteredByCategory.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No features match your filters</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
