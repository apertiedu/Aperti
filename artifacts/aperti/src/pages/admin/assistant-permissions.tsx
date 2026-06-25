import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, User, ChevronDown, ChevronUp, Check, AlertCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`/api${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers as object) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const PERMISSION_META: Record<string, { label: string; desc: string; icon: string; group: string }> = {
  can_manage_courses:    { label: "Manage Courses",       desc: "Create, edit, and delete courses",               icon: "📚", group: "Course Management" },
  can_manage_materials:  { label: "Manage Materials",     desc: "Upload and manage course materials",             icon: "📎", group: "Course Management" },
  can_grade_exams:       { label: "Grade Exams",          desc: "Enter marks and grade exam submissions",         icon: "📊", group: "Assessment" },
  can_approve_grades:    { label: "Approve Grades",       desc: "Approve or override student grade results",      icon: "✅", group: "Assessment" },
  can_manage_enrollments:{ label: "Manage Enrollments",   desc: "Approve, reject, or transition enrollments",     icon: "🎓", group: "Students" },
  can_view_students:     { label: "View Students",        desc: "Access and view student records and profiles",   icon: "👨‍🎓", group: "Students" },
  can_view_reports:      { label: "View Reports",         desc: "Access analytics dashboards and reports",        icon: "📈", group: "Visibility" },
  can_view_revenue:      { label: "View Revenue",         desc: "See financial data, payments, and revenue",      icon: "💰", group: "Visibility" },
  can_manage_assistants: { label: "Manage Assistants",    desc: "Invite and configure other assistant accounts",  icon: "👥", group: "Administration" },
  manage_students:       { label: "Student Records",      desc: "Add, edit, and archive student records",         icon: "📋", group: "Legacy" },
  approve_enrollments:   { label: "Approve Enrollments",  desc: "Approve or reject student enrolments (legacy)",  icon: "✅", group: "Legacy" },
  manage_attendance:     { label: "Mark Attendance",      desc: "Mark and edit attendance records",               icon: "📋", group: "Legacy" },
  manage_flashcards:     { label: "Manage Flashcards",    desc: "Create and edit flashcard decks",                icon: "🗂️", group: "Legacy" },
  manage_homework:       { label: "Set Homework",         desc: "Create and grade homework assignments",          icon: "📝", group: "Legacy" },
  manage_exams:          { label: "Manage Exams",         desc: "Create exams and enter marks",                   icon: "📊", group: "Legacy" },
  view_analytics:        { label: "View Analytics",       desc: "Access student and class analytics",             icon: "📈", group: "Legacy" },
  manage_sessions:       { label: "Manage Sessions",      desc: "Create and edit session slots",                  icon: "🗓️", group: "Legacy" },
  mark_payments:         { label: "Mark Payments",        desc: "Record student payment receipts",                icon: "💳", group: "Legacy" },
};

interface Assistant {
  id: number;
  username: string;
  displayName: string;
  status: string;
  teacherAccountId: number | null;
  permissions: string[];
}

function AssistantCard({ assistant, allPerms }: { assistant: Assistant; allPerms: string[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [localPerms, setLocalPerms] = useState<string[]>(assistant.permissions);
  const [dirty, setDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => fetchJSON(`/assistants/${assistant.id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: localPerms }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistants"] });
      toast({ title: `Permissions saved for ${assistant.displayName}` });
      setDirty(false);
    },
    onError: () => toast({ title: "Failed to save permissions", variant: "destructive" }),
  });

  const togglePerm = (perm: string) => {
    setLocalPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
    setDirty(true);
  };

  return (
    <motion.div
      layout
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}>

      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 bg-primary">
          {assistant.displayName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{assistant.displayName}</p>
          <p className="text-xs text-gray-400">@{assistant.username}{assistant.teacherAccountId ? ` · Teacher #${assistant.teacherAccountId}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs border-0 ${assistant.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
            {assistant.status}
          </Badge>
          <span className="text-xs text-gray-400 font-medium">{localPerms.length} / {allPerms.length}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Permission grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100">
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {allPerms.map(perm => {
                  const meta = PERMISSION_META[perm];
                  const enabled = localPerms.includes(perm);
                  return (
                    <button
                      key={perm}
                      onClick={() => togglePerm(perm)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left ${
                        enabled
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border bg-card"
                      }`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        enabled ? "bg-primary border-primary" : "border-gray-300"
                      }`}>
                        {enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{meta?.icon} {meta?.label ?? perm}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{meta?.desc ?? ""}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => { setLocalPerms(allPerms); setDirty(true); }}
                    className="text-xs text-primary font-semibold hover:underline">Grant all</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={() => { setLocalPerms([]); setDirty(true); }}
                    className="text-xs text-red-400 font-semibold hover:underline">Revoke all</button>
                </div>
                {dirty && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Unsaved
                    </span>
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="h-7 text-xs px-3 text-white bg-primary text-primary-foreground">
                      {saveMutation.isPending ? "Saving…" : "Save Permissions"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AssistantPermissionsPage() {
  const { data: assistants, isLoading } = useQuery<Assistant[]>({
    queryKey: ["assistants"],
    queryFn: () => fetchJSON("/assistants"),
  });

  const { data: allPerms = [] } = useQuery<string[]>({
    queryKey: ["assistant-perms-list"],
    queryFn: () => fetchJSON("/assistants/permissions/all"),
  });

  const activeAssistants = assistants?.filter(a => a.status === "active") ?? [];
  const suspendedAssistants = assistants?.filter(a => a.status !== "active") ?? [];

  return (
    <div className="min-h-screen p-6" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/8">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assistant Permissions</h1>
            <p className="text-sm text-gray-500">Control what each assistant can access and do within the platform</p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : !assistants?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-gray-300" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">No Assistants Yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Create assistant accounts in the Account Management section, then configure their permissions here.
            </p>
            <Button
              className="mt-4 text-white text-sm bg-primary text-primary-foreground"
              onClick={() => window.location.href = "/admin/command"}>
              Go to Account Management
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeAssistants.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Active ({activeAssistants.length})</p>
              <div className="space-y-3">
                {activeAssistants.map(a => (
                  <AssistantCard key={a.id} assistant={a} allPerms={allPerms} />
                ))}
              </div>
            </div>
          )}
          {suspendedAssistants.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Suspended ({suspendedAssistants.length})</p>
              <div className="space-y-3 opacity-60">
                {suspendedAssistants.map(a => (
                  <AssistantCard key={a.id} assistant={a} allPerms={allPerms} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
