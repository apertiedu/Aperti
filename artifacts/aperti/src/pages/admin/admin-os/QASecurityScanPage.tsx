import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Shield, RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  OK:          { label: "Protected",    color: "text-green-700", bg: "bg-green-50 border-green-200",  icon: CheckCircle },
  UNPROTECTED: { label: "Unprotected", color: "text-red-700",   bg: "bg-red-50 border-red-200",      icon: AlertTriangle },
  TIMEOUT:     { label: "Timeout",     color: "text-gray-600",  bg: "bg-gray-50 border-gray-200",    icon: Clock },
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  LOW:    { label: "Low Risk",    color: "text-green-700", bg: "bg-green-50 border-green-200",  icon: ShieldCheck },
  MEDIUM: { label: "Medium Risk", color: "text-orange-700",bg: "bg-orange-50 border-orange-200",icon: Shield },
  HIGH:   { label: "High Risk",   color: "text-red-700",   bg: "bg-red-50 border-red-200",      icon: ShieldAlert },
};

export default function QASecurityScanPage() {
  const [scanData, setScanData] = useState<any>(null);

  const runScan = useMutation({
    mutationFn: () => api("/api/admin/security/scan-routes", { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => setScanData(data),
  });

  const summary = scanData?.summary;
  const results = scanData?.results ?? [];
  const unprotected = results.filter((r: any) => r.risk === "UNPROTECTED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" /> Security Route Scan
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Verify all admin endpoints require authentication</p>
        </div>
        <Button
          onClick={() => runScan.mutate()}
          disabled={runScan.isPending}
          className="bg-teal-600 hover:bg-teal-700 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${runScan.isPending ? "animate-spin" : ""}`} />
          {runScan.isPending ? "Scanning…" : "Run Security Scan"}
        </Button>
      </div>

      {/* No scan yet */}
      {!scanData && !runScan.isPending && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No scan has been run yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Run Security Scan" to check all routes for authentication protection</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {runScan.isPending && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
              <p className="text-sm text-gray-600">Probing {13} endpoints without authentication…</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {scanData && summary && (
        <>
          {/* Summary banner */}
          {(() => {
            const cfg = LEVEL_CONFIG[summary.riskLevel] ?? LEVEL_CONFIG.LOW;
            const Icon = cfg.icon;
            return (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border flex items-center gap-3 ${cfg.bg}`}>
                <Icon className={`w-6 h-6 ${cfg.color} shrink-0`} />
                <div className="flex-1">
                  <p className={`font-bold ${cfg.color}`}>{cfg.label} — {summary.riskLevel}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {summary.protected}/{summary.total} routes protected ·
                    {summary.unprotected > 0
                      ? ` ${summary.unprotected} unprotected endpoint${summary.unprotected !== 1 ? "s" : ""} found`
                      : " No unprotected endpoints detected"}
                    {" "}· Scanned {new Date(summary.scannedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-900">{Math.round((summary.protected / summary.total) * 100)}%</p>
                  <p className="text-xs text-gray-400">Protected</p>
                </div>
              </motion.div>
            );
          })()}

          {/* Unprotected endpoints alert */}
          {unprotected.length > 0 && (
            <Card className="border border-red-200 bg-red-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {unprotected.length} Unprotected Endpoint{unprotected.length !== 1 ? "s" : ""} Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-red-100">
                  {unprotected.map((r: any) => (
                    <div key={r.path} className="flex items-center gap-4 px-4 py-2.5">
                      <Badge className="bg-gray-800 text-white text-xs shrink-0">{r.method}</Badge>
                      <code className="text-sm text-red-800 font-mono flex-1">{r.path}</code>
                      <span className="text-xs text-red-600 font-semibold">HTTP {r.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full results table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">All Scanned Routes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {results.map((r: any, i: number) => {
                  const cfg = RISK_CONFIG[r.risk] ?? RISK_CONFIG.OK;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={r.path + r.method}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <Badge variant="outline" className="text-xs font-mono shrink-0 w-12 justify-center">{r.method}</Badge>
                      <code className="text-sm text-gray-700 flex-1 font-mono">{r.path}</code>
                      <span className="text-xs text-gray-400 font-mono">HTTP {r.status}</span>
                      <div className={`flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-0.5 ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Info box */}
      <Card className="border-0 bg-blue-50 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">How This Works</p>
          <p className="text-xs text-blue-700">
            The scanner sends unauthenticated requests to each endpoint and checks if they return HTTP 401 (Unauthorized) or 403 (Forbidden).
            Any route returning 200 without a token is flagged as unprotected. Public routes (like /api/health, /api/auth/*) are expected to return 200.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
