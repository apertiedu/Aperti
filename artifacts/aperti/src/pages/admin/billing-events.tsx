import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, CreditCard, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

const EVENT_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  invoice_created:          { icon: CreditCard,    color: "text-blue-600",    bg: "bg-blue-100" },
  payment_submitted:        { icon: Activity,      color: "text-amber-600",   bg: "bg-amber-100" },
  payment_confirmed:        { icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-100" },
  subscription_activated:   { icon: Zap,           color: "text-teal-600",    bg: "bg-teal-100" },
  subscription_expired:     { icon: XCircle,       color: "text-red-600",     bg: "bg-red-100" },
  subscription_cancelled:   { icon: XCircle,       color: "text-rose-600",    bg: "bg-rose-100" },
  subscription_suspended:   { icon: AlertTriangle, color: "text-orange-600",  bg: "bg-orange-100" },
  subscription_restored:    { icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-100" },
  plan_upgraded:            { icon: Zap,           color: "text-purple-600",  bg: "bg-purple-100" },
  plan_downgraded:          { icon: Activity,      color: "text-slate-600",   bg: "bg-slate-100" },
  refund_issued:            { icon: CreditCard,    color: "text-rose-600",    bg: "bg-rose-100" },
  fraud_detected:           { icon: AlertTriangle, color: "text-red-700",     bg: "bg-red-200" },
  recovery_scheduled:       { icon: RefreshCw,     color: "text-blue-600",    bg: "bg-blue-100" },
  recovery_succeeded:       { icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-100" },
  recovery_failed:          { icon: XCircle,       color: "text-red-600",     bg: "bg-red-100" },
  grace_period_started:     { icon: AlertTriangle, color: "text-orange-600",  bg: "bg-orange-100" },
  experiment_assigned:      { icon: Activity,      color: "text-purple-600",  bg: "bg-purple-100" },
};

function EventRow({ event }: { event: any }) {
  const cfg = EVENT_ICONS[event.type] ?? { icon: Activity, color: "text-gray-500", bg: "bg-gray-100" };
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[11px] font-bold ${cfg.color}`}>{event.type}</span>
          <span className="text-[10px] text-gray-300">#{event.entity_id} · {event.entity_type}</span>
        </div>
        {event.user_name && <p className="text-xs text-gray-600">{event.user_name}</p>}
        {event.payload && Object.keys(event.payload).length > 0 && (
          <p className="text-[10px] text-gray-400 truncate">{JSON.stringify(event.payload).slice(0, 80)}</p>
        )}
      </div>
      <p className="text-[10px] text-gray-300 flex-shrink-0 pt-0.5">{new Date(event.created_at).toLocaleTimeString()}</p>
    </motion.div>
  );
}

export default function BillingEventsPage() {
  const [filterType, setFilterType] = useState("all");
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["billing-events-recent", filterType],
    queryFn: async () => {
      const qs = filterType !== "all" ? `?type=${filterType}` : "";
      const r = await fetch(`/api/billing-events/recent${qs}&limit=100`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: counts } = useQuery<any>({
    queryKey: ["billing-events-counts"],
    queryFn: async () => {
      const r = await fetch("/api/billing-events/counts", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const es = new EventSource("/api/billing-events/stream");
    sseRef.current = es;
    es.onopen = () => setSseConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.events?.length > 0) {
          setLiveEvents(data.events.slice(0, 5));
        }
      } catch {}
    };
    es.onerror = () => setSseConnected(false);
    return () => { es.close(); setSseConnected(false); };
  }, []);

  const events: any[] = data?.events ?? [];
  const eventCounts: any[] = counts?.counts ?? [];
  const topTypes = Object.keys(EVENT_ICONS);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing Event Stream</h1>
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              Append-only · Stripe-style
              <span className={`inline-block h-2 w-2 rounded-full ${sseConnected ? "bg-emerald-500" : "bg-gray-300"}`} />
              <span className="text-[11px]">{sseConnected ? "Live" : "Polling"}</span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </motion.div>

      {/* Live strip */}
      {liveEvents.length > 0 && (
        <Card className="border-0 shadow-sm mb-4 border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Live Events (SSE)</p>
            {liveEvents.map((e: any) => (
              <div key={e.id} className="text-xs text-gray-700 py-0.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-semibold">{e.type}</span>
                <span className="text-gray-400">{e.user_name ?? ""} · {new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Event type counts */}
      {eventCounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {eventCounts.map((c: any) => {
            const cfg = EVENT_ICONS[c.type];
            return (
              <button
                key={c.type}
                onClick={() => setFilterType(filterType === c.type ? "all" : c.type)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  filterType === c.type ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                {cfg?.icon && <cfg.icon className="h-3 w-3" />}
                {c.type.replace(/_/g, " ")}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${filterType === c.type ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{c.count}</span>
              </button>
            );
          })}
          {filterType !== "all" && (
            <button onClick={() => setFilterType("all")} className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold bg-gray-100 text-gray-500 border-gray-200">
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Events list */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />)}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No billing events yet</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {events.map((event: any) => <EventRow key={event.id} event={event} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
