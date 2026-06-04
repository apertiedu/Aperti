import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bell, Globe, Users, Shield, Link2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });

export default function ParentSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["parent-settings"],
    queryFn: () => authFetch("/api/parent/settings").then(r => r.json()),
  });

  const { data: dashData } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
  });

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState("en");
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setNotifPrefs(settings.notification_preferences || { attendance: true, grades: true, assignments: true, messages: true });
    setLanguage(settings.language || "en");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => authFetch("/api/parent/settings", {
      method: "PUT",
      body: JSON.stringify({ notification_preferences: notifPrefs, language }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-settings"] }); toast({ title: "Settings saved ✅" }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const children = dashData?.children || [];

  const notifItems = [
    { key: "attendance", label: "Attendance alerts", desc: "When your child is absent or late" },
    { key: "grades", label: "Grade updates", desc: "When assessments are graded" },
    { key: "assignments", label: "Assignment reminders", desc: "Upcoming and overdue homework" },
    { key: "messages", label: "Teacher messages", desc: "New messages from teachers" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
          <Settings className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your account preferences</p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {/* Profile */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-teal-500" />Profile</h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: TEAL }}>
                    {(user?.displayName || user?.username || "P").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user?.displayName || user?.username}</p>
                    <p className="text-xs text-gray-400">Parent account</p>
                  </div>
                  <Badge className="ml-auto bg-teal-100 text-teal-700 text-[10px] rounded-full">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Bell className="h-4 w-4 text-amber-500" />Notifications</h2>
                <div className="space-y-4">
                  {notifItems.map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifPrefs[item.key] ?? true}
                        onCheckedChange={v => setNotifPrefs(p => ({ ...p, [item.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Language */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Globe className="h-4 w-4 text-indigo-500" />Language</h2>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="rounded-xl text-sm w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="ur">Urdu</SelectItem>
                    <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </motion.div>

          {/* Linked children */}
          {children.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Link2 className="h-4 w-4 text-teal-500" />Linked Children</h2>
                  <div className="space-y-2">
                    {children.map((c: any) => (
                      <div key={c.studentId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: TEAL }}>
                          {(c.name || "S").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          <p className="text-[10px] text-gray-400">{c.studentCode}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] rounded-full gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Linked</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Privacy */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Shield className="h-4 w-4 text-gray-500" />Privacy & Data</h2>
                <p className="text-xs text-gray-400 mb-3">Your data is stored securely and only used to improve your child's educational experience on Aperti.</p>
                <p className="text-xs text-gray-500">To manage detailed data sharing permissions, visit <span className="text-teal-600 font-medium">/parent/link-student</span>.</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Save */}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-xl text-white" style={{ background: TEAL }}>
            {saveMutation.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}
