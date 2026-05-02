import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, UserPlus, Pencil, Trash2, Power, PowerOff, Users, BarChart3,
  Activity, Database, BookOpen, Clock, CheckCircle2, AlertTriangle,
  GraduationCap, School, Search, ChevronRight, Eye
} from "lucide-react";

type AccountRow = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  status: string;
  teacherAccountId: number | null;
  createdAt: string;
};

type SystemStats = {
  totals: {
    students: number;
    teachers: number;
    assistants: number;
    studentAccounts: number;
    sessions: number;
    exams: number;
    totalAttendance: number;
  };
  overallAttendanceRate: number;
  topTeachers: { teacherId: number | null; teacherName: string; username: string; studentCount: number; status: string }[];
  accounts: AccountRow[];
  recentAuditLogs: {
    id: number;
    action: string;
    resource: string;
    resourceId: number | null;
    actorName: string;
    actorRole: string;
    ipAddress: string | null;
    createdAt: string;
  }[];
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  teacher: "bg-blue-100 text-blue-700 border-blue-200",
  assistant: "bg-green-100 text-green-700 border-green-200",
  student: "bg-orange-100 text-orange-700 border-orange-200",
};

const ACTION_COLOR: Record<string, string> = {
  create: "text-emerald-600 bg-emerald-50",
  update: "text-blue-600 bg-blue-50",
  delete: "text-red-600 bg-red-50",
  login: "text-purple-600 bg-purple-50",
  logout: "text-gray-600 bg-gray-50",
};

function AccountFormDialog({ mode, initial, accounts, onSave, trigger }: {
  mode: "create" | "edit";
  initial?: AccountRow;
  accounts: AccountRow[];
  onSave: (data: any) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: initial?.username ?? "",
    displayName: initial?.displayName ?? "",
    password: "",
    role: initial?.role ?? "assistant",
    teacherAccountId: initial?.teacherAccountId?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v && initial) setForm({ username: initial.username, displayName: initial.displayName, password: "", role: initial.role, teacherAccountId: initial.teacherAccountId?.toString() ?? "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, teacherAccountId: form.teacherAccountId ? parseInt(form.teacherAccountId, 10) : null });
      setOpen(false);
    } finally { setSaving(false); }
  };

  const teachers = accounts.filter(a => a.role === "teacher");

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Account" : "Edit Account"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input placeholder="e.g. Ahmed Hassan" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input placeholder="e.g. ahmed" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} required disabled={mode === "edit"} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{mode === "edit" ? "New Password (leave blank to keep)" : "Password"}</Label>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={mode === "create"} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v, teacherAccountId: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === "assistant" && (
            <div className="space-y-1.5">
              <Label>Assigned Teacher</Label>
              <Select value={form.teacherAccountId} onValueChange={v => setForm({ ...form, teacherAccountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.displayName} (@{t.username})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Create Account" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "accounts" | "audit">("overview");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", { credentials: "include" });
      if (res.ok) setAccounts(await res.json());
    } finally { setLoading(false); }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/reports/system-stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } finally { setStatsLoading(false); }
  };

  useEffect(() => { loadAccounts(); loadStats(); }, []);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/accounts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Account created" });
    loadAccounts(); loadStats();
  };

  const handleEdit = async (id: number, data: any) => {
    const res = await fetch(`/api/accounts/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Account updated" });
    loadAccounts(); loadStats();
  };

  const handleToggle = async (account: AccountRow) => {
    const newStatus = account.status === "active" ? "suspended" : "active";
    await handleEdit(account.id, { status: newStatus });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account permanently?")) return;
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast({ title: "Error", variant: "destructive" }); return; }
    toast({ title: "Account deleted" });
    loadAccounts(); loadStats();
  };

  const filteredAccounts = accounts.filter(a =>
    a.displayName.toLowerCase().includes(accountSearch.toLowerCase()) ||
    a.username.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const filteredAuditLogs = (stats?.recentAuditLogs ?? []).filter(l =>
    l.actorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
    l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    l.resource.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const overviewKpis = stats ? [
    { label: "Total Students", value: stats.totals.students, icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Teachers", value: stats.totals.teachers, icon: School, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Assistants", value: stats.totals.assistants, icon: Users, color: "text-green-600", bg: "bg-green-50" },
    { label: "Student Accounts", value: stats.totals.studentAccounts, icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Total Sessions", value: stats.totals.sessions, icon: Clock, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Exams Created", value: stats.totals.exams, icon: BookOpen, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Attendance Records", value: stats.totals.totalAttendance, icon: Database, color: "text-slate-600", bg: "bg-slate-50" },
    { label: "Platform Attendance Rate", value: `${stats.overallAttendanceRate}%`, icon: Activity, color: stats.overallAttendanceRate >= 80 ? "text-emerald-600" : stats.overallAttendanceRate >= 60 ? "text-amber-600" : "text-red-600", bg: stats.overallAttendanceRate >= 80 ? "bg-emerald-50" : "bg-amber-50" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-600" />
            Admin Control Center
          </h1>
          <p className="text-muted-foreground mt-1">System overview, account management, and platform analytics.</p>
        </div>
        {tab === "accounts" && (
          <AccountFormDialog mode="create" accounts={accounts} onSave={handleCreate}
            trigger={<Button className="gap-2"><UserPlus className="h-4 w-4" />Create Account</Button>} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit border border-border/50">
        {[
          { key: "overview", label: "System Overview", icon: BarChart3 },
          { key: "accounts", label: "Accounts", icon: Users },
          { key: "audit", label: "Activity Log", icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* KPI Grid */}
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {overviewKpis.map((kpi, i) => (
                  <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="border-border/50 shadow-sm">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">{kpi.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                          </div>
                          <div className={`${kpi.bg} p-2 rounded-lg`}>
                            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Top Teachers Table */}
            {stats && stats.topTeachers.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <School className="h-4 w-4 text-primary" />Teacher Workspaces
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Teacher</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topTeachers.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{t.teacherName}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">@{t.username}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">{t.studentCount}</span>
                            <span className="text-muted-foreground text-xs ml-1">student{t.studentCount !== 1 ? "s" : ""}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {t.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity Preview */}
            {stats && stats.recentAuditLogs.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />Recent Activity
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => setTab("audit")}>
                      View all <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {stats.recentAuditLogs.slice(0, 8).map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${ACTION_COLOR[log.action] ?? "text-gray-600 bg-gray-50"}`}>
                          {log.action}
                        </span>
                        <span className="text-sm flex-1 truncate">
                          <span className="font-medium">{log.actorName}</span>
                          <span className="text-muted-foreground"> · {log.resource}</span>
                          {log.resourceId && <span className="text-muted-foreground text-xs"> #{log.resourceId}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {tab === "accounts" && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Admins", value: accounts.filter(a => a.role === "admin").length, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Teachers", value: accounts.filter(a => a.role === "teacher").length, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Assistants", value: accounts.filter(a => a.role === "assistant").length, color: "text-green-600", bg: "bg-green-50" },
                { label: "Suspended", value: accounts.filter(a => a.status === "suspended").length, color: "text-red-600", bg: "bg-red-50" },
              ].map(s => (
                <Card key={s.label} className="border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />All Accounts</CardTitle>
                  <div className="relative w-52">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search accounts..." className="pl-8 h-8 text-sm bg-muted/50 border-none" value={accountSearch} onChange={e => setAccountSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map(account => {
                        const teacher = account.teacherAccountId ? accounts.find(a => a.id === account.teacherAccountId) : null;
                        return (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.displayName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">@{account.username}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${ROLE_BADGE[account.role] ?? "bg-muted text-muted-foreground"}`}>
                                {account.role}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {teacher ? teacher.displayName : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${account.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {account.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(account.createdAt).toLocaleDateString("en-GB")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <AccountFormDialog mode="edit" initial={account} accounts={accounts} onSave={(data) => handleEdit(account.id, data)}
                                  trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></Button>} />
                                <Button variant="ghost" size="icon"
                                  className={`h-8 w-8 ${account.status === "active" ? "text-muted-foreground hover:text-amber-600" : "text-amber-600 hover:text-green-600"}`}
                                  onClick={() => handleToggle(account)} disabled={account.id === user.id}>
                                  {account.status === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(account.id)} disabled={account.id === user.id}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {tab === "audit" && (
          <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Platform Activity Log
                    <span className="text-xs font-normal text-muted-foreground ml-1">Last 100 events</span>
                  </CardTitle>
                  <div className="relative w-56">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search logs..." className="pl-8 h-8 text-sm bg-muted/50 border-none" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading activity log...</div>
                ) : filteredAuditLogs.length === 0 ? (
                  <div className="p-12 text-center">
                    <Activity className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{auditSearch ? "No matching log entries." : "No activity recorded yet."}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
                    {filteredAuditLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex-shrink-0 ${ACTION_COLOR[log.action] ?? "text-gray-600 bg-gray-100"}`}>
                          {log.action}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{log.actorName}</span>
                            {log.actorRole && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ROLE_BADGE[log.actorRole] ?? "bg-muted text-muted-foreground"}`}>
                                {log.actorRole}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {log.resource}{log.resourceId ? ` #${log.resourceId}` : ""}
                            </span>
                          </div>
                          {log.ipAddress && (
                            <p className="text-xs text-muted-foreground mt-0.5">IP: {log.ipAddress}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
