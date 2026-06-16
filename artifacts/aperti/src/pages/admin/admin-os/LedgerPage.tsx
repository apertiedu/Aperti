import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BookOpen, RefreshCw, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownLeft, RotateCcw } from "lucide-react";

type AccountType = "all" | "student_wallet" | "teacher_revenue" | "platform_revenue" | "refund_pool";
type EntryType = "all" | "debit" | "credit";

interface LedgerEntry {
  id: number;
  transaction_id: number;
  account_type: string;
  entry_type: "debit" | "credit";
  amount: string;
  currency: string;
  reference: string;
  is_reversal: boolean;
  created_at: string;
  user_name?: string;
  purpose?: string;
}

interface Balances {
  balances: Record<string, number>;
  platform_cut_percent: number;
  summary: { total_transactions: number; total_entries: number; total_debited: string; total_credited: string; reversal_entries: number };
}

interface ReconcileResult {
  status: string;
  is_clean: boolean;
  imbalances: Array<{ transaction_id: number; total_debit: number; total_credit: number; gap: number }>;
  missing_entries: Array<{ transaction_id: number; amount: string; status: string }>;
  totals: { total_debit: number; total_credit: number; net: number };
}

const ACCOUNT_COLORS: Record<string, string> = {
  student_wallet:   "bg-blue-50 text-blue-700",
  teacher_revenue:  "bg-emerald-50 text-emerald-700",
  platform_revenue: "bg-purple-50 text-purple-700",
  refund_pool:      "bg-amber-50 text-amber-700",
};

function BalanceCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground font-medium capitalize">{label.replace(/_/g, " ")}</p>
      <p className={cn("text-xl font-bold tabular-nums mt-1", value >= 0 ? "text-emerald-600" : "text-red-600")}>
        {value >= 0 ? "" : "–"}{Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP
      </p>
      <div className={cn("mt-2 h-0.5 rounded-full", accent)} />
    </div>
  );
}

export default function LedgerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accountType, setAccountType] = useState<AccountType>("all");
  const [entryType, setEntryType] = useState<EntryType>("all");
  const [showReversals, setShowReversals] = useState<"all" | "normal" | "reversal">("all");
  const [tab, setTab] = useState<"entries" | "reconcile" | "settings">("entries");
  const [newCutPercent, setNewCutPercent] = useState("");

  const { data: balanceData, isLoading: balLoading, refetch: refetchBal } = useQuery<Balances>({
    queryKey: ["ledger-balances"],
    queryFn: () => apiFetch("/api/ledger/balances").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: entriesData, isLoading: entLoading, refetch: refetchEntries, isFetching } = useQuery<{ entries: LedgerEntry[]; total: number }>({
    queryKey: ["ledger-entries", accountType, entryType, showReversals],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (accountType !== "all") params.set("account_type", accountType);
      if (entryType !== "all") params.set("entry_type", entryType);
      if (showReversals === "reversal") params.set("is_reversal", "true");
      if (showReversals === "normal") params.set("is_reversal", "false");
      return apiFetch(`/api/ledger/entries?${params}`).then((r) => r.json());
    },
  });

  const { data: reconcileData } = useQuery<ReconcileResult>({
    queryKey: ["ledger-reconcile"],
    queryFn: () => apiFetch("/api/ledger/reconcile").then((r) => r.json()),
    enabled: tab === "reconcile",
  });

  const settingsMutation = useMutation({
    mutationFn: (percent: number) =>
      apiFetch("/api/ledger/settings", { method: "PATCH", body: JSON.stringify({ platform_cut_percent: percent }) }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Platform cut updated", description: `Now ${d.platform_cut_percent}%` });
      qc.invalidateQueries({ queryKey: ["ledger-balances"] });
      setNewCutPercent("");
    },
  });

  const s = balanceData?.summary;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Double-Entry Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Immutable financial truth engine · every debit has a matching credit</p>
        </div>
        <button onClick={() => { refetchBal(); refetchEntries(); }} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {balLoading ? (
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BalanceCard label="student_wallet"   value={balanceData?.balances.student_wallet   ?? 0} accent="bg-blue-400" />
          <BalanceCard label="teacher_revenue"  value={balanceData?.balances.teacher_revenue  ?? 0} accent="bg-emerald-400" />
          <BalanceCard label="platform_revenue" value={balanceData?.balances.platform_revenue ?? 0} accent="bg-purple-400" />
          <BalanceCard label="refund_pool"      value={balanceData?.balances.refund_pool      ?? 0} accent="bg-amber-400" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Transactions",   value: s?.total_transactions ?? "—" },
          { label: "Entries",        value: s?.total_entries ?? "—" },
          { label: "Total Debited",  value: s ? `${parseFloat(s.total_debited ?? "0").toLocaleString()} EGP` : "—" },
          { label: "Total Credited", value: s ? `${parseFloat(s.total_credited ?? "0").toLocaleString()} EGP` : "—" },
          { label: "Reversals",      value: s?.reversal_entries ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-xl px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["entries", "reconcile", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 text-sm font-medium capitalize transition-colors", tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "entries" && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex gap-1 items-center">
              <span className="text-muted-foreground">Account:</span>
              {(["all","student_wallet","teacher_revenue","platform_revenue","refund_pool"] as AccountType[]).map((a) => (
                <button key={a} onClick={() => setAccountType(a)} className={cn("px-2.5 py-1 rounded-full border capitalize", accountType === a ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {a === "all" ? "all" : a.split("_")[0]}
                </button>
              ))}
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-muted-foreground">Type:</span>
              {(["all","debit","credit"] as EntryType[]).map((t) => (
                <button key={t} onClick={() => setEntryType(t)} className={cn("px-2.5 py-1 rounded-full border capitalize", entryType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-muted-foreground">Show:</span>
              {(["all","normal","reversal"] as const).map((r) => (
                <button key={r} onClick={() => setShowReversals(r)} className={cn("px-2.5 py-1 rounded-full border capitalize", showReversals === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["ID","Tx#","Account","Type","Amount","Reference","Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">Loading…</td></tr>
                ) : (entriesData?.entries ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No ledger entries yet. Record a payment to begin.</td></tr>
                ) : (entriesData?.entries ?? []).map((e) => (
                  <tr key={e.id} className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors", e.is_reversal && "opacity-60")}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{e.id}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">#{e.transaction_id}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", ACCOUNT_COLORS[e.account_type] ?? "bg-muted text-muted-foreground")}>
                        {e.account_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.entry_type === "debit" ? (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                          <ArrowUpRight className="h-3 w-3" /> DEBIT
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <ArrowDownLeft className="h-3 w-3" /> CREDIT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold tabular-nums">
                      {parseFloat(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {e.currency}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground max-w-32 truncate">
                      {e.is_reversal && <RotateCcw className="h-2.5 w-2.5 inline mr-1 text-amber-500" />}
                      {e.reference}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "reconcile" && reconcileData && (
        <div className="space-y-4">
          <div className={cn("rounded-xl border p-4 flex items-center gap-3", reconcileData.is_clean ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
            {reconcileData.is_clean
              ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              : <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />}
            <div>
              <p className={cn("text-sm font-semibold", reconcileData.is_clean ? "text-emerald-800" : "text-red-800")}>
                {reconcileData.is_clean ? "Ledger is balanced" : `Issues detected — ${reconcileData.imbalances.length} imbalances, ${reconcileData.missing_entries.length} missing entries`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total debited: {reconcileData.totals.total_debit.toLocaleString()} EGP · Total credited: {reconcileData.totals.total_credit.toLocaleString()} EGP · Net: {reconcileData.totals.net.toLocaleString()} EGP
              </p>
            </div>
          </div>
          {reconcileData.imbalances.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <p className="px-5 py-3 text-sm font-semibold border-b border-border text-red-700">Imbalanced Transactions</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Transaction","Debit","Credit","Gap"].map((h) => (
                      <th key={h} className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reconcileData.imbalances.map((im) => (
                    <tr key={im.transaction_id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs">#{im.transaction_id}</td>
                      <td className="px-5 py-2.5 text-xs tabular-nums text-red-600">{im.total_debit.toLocaleString()} EGP</td>
                      <td className="px-5 py-2.5 text-xs tabular-nums text-emerald-600">{im.total_credit.toLocaleString()} EGP</td>
                      <td className="px-5 py-2.5 text-xs tabular-nums font-bold text-red-700">{im.gap.toLocaleString()} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reconcileData.missing_entries.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <p className="px-5 py-3 text-sm font-semibold border-b border-border text-amber-700">Transactions Without Ledger Entries</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Transaction","Amount","Status"].map((h) => (
                      <th key={h} className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reconcileData.missing_entries.map((m) => (
                    <tr key={m.transaction_id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs">#{m.transaction_id}</td>
                      <td className="px-5 py-2.5 text-xs tabular-nums">{parseFloat(m.amount).toLocaleString()} EGP</td>
                      <td className="px-5 py-2.5 text-xs capitalize">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="max-w-sm space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Platform Revenue Split</p>
            <p className="text-xs text-muted-foreground">Current cut: <strong>{balanceData?.platform_cut_percent ?? 15}%</strong> platform / <strong>{100 - (balanceData?.platform_cut_percent ?? 15)}%</strong> teacher</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={newCutPercent}
                onChange={(e) => setNewCutPercent(e.target.value)}
                placeholder="New % (0–50)"
                min={0} max={50}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={() => settingsMutation.mutate(parseFloat(newCutPercent))}
                disabled={settingsMutation.isPending || !newCutPercent}
                className="bg-primary text-primary-foreground text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {settingsMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Changes apply to all new payments. Existing entries are unaffected.</p>
          </div>
        </div>
      )}
    </div>
  );
}
