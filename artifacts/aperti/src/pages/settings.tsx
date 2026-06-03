import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Shield, Bell, Palette, Monitor, Eye, EyeOff, LogOut } from "lucide-react";
import { useAuth } from "@/context/auth";

const TEAL = "#0D9488";

const TABS = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "security",      label: "Security",       icon: Shield },
  { id: "notifications", label: "Notifications",  icon: Bell },
  { id: "appearance",    label: "Appearance",     icon: Palette },
  { id: "devices",       label: "Devices",        icon: Monitor },
];

const COUNTRIES = ["Egypt","Saudi Arabia","UAE","United Kingdom","United States","Canada","Australia","Germany","France","Other"];

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className="w-11 h-6 rounded-full relative transition-all duration-200 flex-shrink-0"
      style={{ background: value ? TEAL : "#d1d5db" }}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("profile");
  const [account, setAccount] = useState<any>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        const acct = d.account || {};
        setAccount(acct);
        setSettingsMap(d.settings || {});
        setDisplayName(acct.display_name || "");
        setFirstName(acct.first_name || "");
        setLastName(acct.last_name || "");
        setBio(acct.bio || "");
        setPhone(acct.phone || "");
        setCountry(acct.country || "");
        setAvatarUrl(acct.avatar_url || "");
      })
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "devices") {
      apiFetch("/api/settings/sessions").then(r => r.json()).then(setSessions).catch(() => setSessions([]));
    }
  }, [tab]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, firstName, lastName, bio, phone, country, avatarUrl }),
      });
      if (res.ok) toast({ title: "Profile updated", description: "Your changes have been saved." });
      else toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveSetting = async (key: string, value: string) => {
    setSettingsMap(p => ({ ...p, [key]: value }));
    await apiFetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => {});
  };

  const changePassword = async () => {
    if (!currentPw || !newPw) { toast({ title: "Error", description: "Fill in all password fields.", variant: "destructive" }); return; }
    if (newPw !== confirmPw) { toast({ title: "Error", description: "New passwords don't match.", variant: "destructive" }); return; }
    if (newPw.length < 8) { toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" }); return; }
    setPwSaving(true);
    try {
      const res = await apiFetch("/api/settings/password", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const d = await res.json();
      if (res.ok) { toast({ title: "Password changed successfully" }); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } finally { setPwSaving(false); }
  };

  const notifKey = (key: string) => settingsMap[key] !== "false";

  if (pageLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your account, preferences, and security.</p>
        </div>
        <div className="flex gap-6">
          {/* Sidebar */}
          <nav className="w-44 flex-shrink-0 space-y-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-medium transition-all duration-150 ${tab === t.id ? "bg-teal-50" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
                style={tab === t.id ? { color: TEAL } : {}}>
                <t.icon className="w-4 h-4 flex-shrink-0" />{t.label}
              </button>
            ))}
            <div className="pt-4 border-t border-gray-100">
              <button onClick={() => logout()} className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-150">
                <LogOut className="w-4 h-4" />Sign out
              </button>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {tab === "profile" && (
                <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  <h2 className="text-base font-semibold text-gray-900">Profile information</h2>
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold text-white" style={{ background: TEAL }}>
                      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarUrl("")} /> : (displayName || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Avatar URL</Label>
                      <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="h-9 rounded-xl border-gray-200 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">First name</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" className="h-10 rounded-xl border-gray-200" /></div>
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Last name</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" className="h-10 rounded-xl border-gray-200" /></div>
                  </div>
                  <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Display name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jane Smith" className="h-10 rounded-xl border-gray-200" /></div>
                  <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Email address</Label>
                    <Input value={account?.email || ""} disabled className="h-10 rounded-xl border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">Contact support to change your email.</p></div>
                  <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Bio</Label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us a bit about yourself..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20..." className="h-10 rounded-xl border-gray-200" /></div>
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Country</Label>
                      <select value={country} onChange={e => setCountry(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-teal-600 bg-white">
                        <option value="">Select…</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button onClick={saveProfile} disabled={saving} className="rounded-xl px-6 h-10" style={{ background: TEAL }}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {tab === "security" && (
                <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-900">Change password</h2>
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Current password</Label>
                      <div className="relative"><Input type={showPw ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="h-10 rounded-xl border-gray-200 pr-10" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">New password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="h-10 rounded-xl border-gray-200" /></div>
                    <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm new password</Label><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="h-10 rounded-xl border-gray-200" /></div>
                    <div className="flex justify-end">
                      <Button onClick={changePassword} disabled={pwSaving || !currentPw || !newPw} className="rounded-xl px-6 h-10" style={{ background: TEAL }}>
                        {pwSaving ? "Changing…" : "Change password"}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-1">Two-factor authentication</h2>
                    <p className="text-sm text-gray-500 mb-3">Add an extra layer of protection to your account.</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Coming Soon</span>
                  </div>
                </motion.div>
              )}

              {tab === "notifications" && (
                <motion.div key="notifs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-1">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Notification preferences</h2>
                  {[
                    { key: "notify_assignments", label: "Assignment notifications", desc: "New assignments and due date reminders" },
                    { key: "notify_attendance", label: "Attendance alerts", desc: "Absence confirmations and late marks" },
                    { key: "notify_grades", label: "Grade updates", desc: "New marks and published results" },
                    { key: "notify_classes", label: "Class reminders", desc: "Upcoming class and schedule changes" },
                    { key: "notify_payments", label: "Payment notifications", desc: "Invoices and payment reminders" },
                    { key: "notify_messages", label: "Message notifications", desc: "New messages from teachers or students" },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
                      <div><p className="text-sm font-medium text-gray-900">{n.label}</p><p className="text-xs text-gray-400 mt-0.5">{n.desc}</p></div>
                      <Toggle value={notifKey(n.key)} onChange={() => saveSetting(n.key, notifKey(n.key) ? "false" : "true")} />
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 pt-3">Email, SMS and WhatsApp notifications — <span className="font-medium text-amber-600">Coming Soon</span></p>
                </motion.div>
              )}

              {tab === "appearance" && (
                <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                  <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div><p className="text-sm font-medium text-gray-900">Dark mode</p><p className="text-xs text-gray-400 mt-0.5">Switch to a darker colour scheme</p></div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Coming Soon</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div><p className="text-sm font-medium text-gray-900">Interface language</p><p className="text-xs text-gray-400 mt-0.5">Choose your preferred language</p></div>
                    <select value={settingsMap["language"] || "en"} onChange={e => saveSetting("language", e.target.value)}
                      className="h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-teal-600 bg-white">
                      <option value="en">English</option>
                      <option value="ar" disabled>العربية (Coming Soon)</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {tab === "devices" && (
                <motion.div key="devices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Active sessions</h2>
                  <p className="text-sm text-gray-500 mb-4">Devices currently logged in to your account.</p>
                  {sessions.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">No active device sessions found.</div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(s => (
                        <div key={s.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                          <Monitor className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.user_agent || "Unknown device"}</p>
                            <p className="text-xs text-gray-500 mt-0.5">IP: {s.ip || "Unknown"} · Last active: {new Date(s.last_active_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
