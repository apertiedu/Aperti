import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder, Download, FileText, Award, CreditCard, Filter } from "lucide-react";

const TEAL = "#0D9488";
const authFetch = (url: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}` } });

const typeConfig: Record<string, { icon: any; colour: string; bg: string }> = {
  report:      { icon: FileText, colour: "#6366f1", bg: "bg-indigo-50" },
  certificate: { icon: Award,    colour: "#f59e0b", bg: "bg-amber-50"  },
  invoice:     { icon: CreditCard, colour: "#0D9488", bg: "bg-teal-50"  },
};

function typeLabel(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ParentDocuments() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterChild, setFilterChild] = useState<string>("all");

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ["parent-documents"],
    queryFn: () => authFetch("/api/parent/documents").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: dashData } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
    staleTime: 60000,
  });
  const children = (dashData as any)?.children || [];

  const filtered = docs.filter(d => {
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterChild !== "all" && String(d.student_id) !== filterChild) return false;
    return true;
  });

  const handleDownload = async (doc: any) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank");
      return;
    }
    // For auto-generated reports, download via the PDF endpoint
    if (doc.type === "report" && doc.student_id) {
      const token = localStorage.getItem("aperti_token") || "";
      const res = await fetch(`/api/parent/child/${doc.student_id}/report-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.title || "report"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#EEF2FF" }}>
          <Folder className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Document Centre</h1>
          <p className="text-sm text-gray-500">Reports, certificates and invoices</p>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-gray-400" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 rounded-xl text-sm h-8">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="report">Reports</SelectItem>
            <SelectItem value="certificate">Certificates</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
          </SelectContent>
        </Select>
        {children.length > 1 && (
          <Select value={filterChild} onValueChange={setFilterChild}>
            <SelectTrigger className="w-40 rounded-xl text-sm h-8">
              <SelectValue placeholder="All children" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All children</SelectItem>
              {children.map((c: any) => (
                <SelectItem key={c.studentId} value={String(c.studentId)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="h-14 w-14 mx-auto mb-4 text-gray-200" />
          <h3 className="text-base font-bold text-gray-600 mb-1">No documents yet</h3>
          <p className="text-sm text-gray-400">Generate a PDF report from the Reports page — it will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc, i) => {
            const cfg = typeConfig[doc.type] || typeConfig.report;
            const Icon = cfg.icon;
            const childName = doc.student_display_name || doc.student_name;
            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-4 p-3.5 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className="h-5 w-5" style={{ color: cfg.colour }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge className="text-[9px] rounded-full px-2" style={{ background: `${cfg.colour}15`, color: cfg.colour }}>
                        {typeLabel(doc.type)}
                      </Badge>
                      {childName && <span className="text-[10px] text-gray-400">for {childName}</span>}
                      <span className="text-[10px] text-gray-400">{timeAgo(doc.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs rounded-xl shrink-0"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {doc.file_url ? "Open" : "Download"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
