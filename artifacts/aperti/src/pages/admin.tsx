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
import { Shield, UserPlus, Pencil, Trash2, Power, PowerOff, KeyRound, Users } from "lucide-react";
import { useLocation } from "wouter";

type AccountRow = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  status: string;
  teacherAccountId: number | null;
  createdAt: string;
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  teacher: "bg-blue-100 text-blue-700 border-blue-200",
  assistant: "bg-green-100 text-green-700 border-green-200",
};

function AccountFormDialog({
  mode,
  initial,
  accounts,
  onSave,
  trigger,
}: {
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
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Account" : "Edit Account"}</DialogTitle>
        </DialogHeader>
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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", { credentials: "include" });
      if (res.ok) setAccounts(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/accounts", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Account created" });
    load();
  };

  const handleEdit = async (id: number, data: any) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Account updated" });
    load();
  };

  const handleToggleStatus = async (account: AccountRow) => {
    const newStatus = account.status === "active" ? "suspended" : "active";
    await handleEdit(account.id, { status: newStatus });
    toast({ title: `Account ${newStatus === "active" ? "reactivated" : "suspended"}` });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast({ title: "Error", variant: "destructive" }); return; }
    toast({ title: "Account deleted" });
    load();
  };

  const stats = {
    admins: accounts.filter(a => a.role === "admin").length,
    teachers: accounts.filter(a => a.role === "teacher").length,
    assistants: accounts.filter(a => a.role === "assistant").length,
    suspended: accounts.filter(a => a.status === "suspended").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-600" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage all user accounts, roles, and access control.</p>
        </div>
        <AccountFormDialog
          mode="create"
          accounts={accounts}
          onSave={handleCreate}
          trigger={
            <Button className="gap-2"><UserPlus className="h-4 w-4" />Create Account</Button>
          }
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Admins", value: stats.admins, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Teachers", value: stats.teachers, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Assistants", value: stats.assistants, color: "text-green-600", bg: "bg-green-50" },
          { label: "Suspended", value: stats.suspended, color: "text-red-600", bg: "bg-red-50" },
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
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />All Accounts</CardTitle>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => {
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
                        {teacher ? teacher.displayName : account.role === "assistant" ? "—" : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${account.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {account.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <AccountFormDialog
                            mode="edit"
                            initial={account}
                            accounts={accounts}
                            onSave={(data) => handleEdit(account.id, data)}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost" size="icon"
                            className={`h-8 w-8 ${account.status === "active" ? "text-muted-foreground hover:text-amber-600" : "text-amber-600 hover:text-green-600"}`}
                            onClick={() => handleToggleStatus(account)}
                            title={account.status === "active" ? "Suspend" : "Reactivate"}
                            disabled={account.id === user.id}
                          >
                            {account.status === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(account.id)}
                            disabled={account.id === user.id}
                            title="Delete"
                          >
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
    </div>
  );
}
