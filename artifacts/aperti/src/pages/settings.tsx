import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Shield, Bell, Palette, Monitor, Eye, EyeOff, LogOut, Accessibility, Bot, Download, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/auth";

const TEAL = "#0D9488";

const TABS = [
  { id: "profile",       label: "Profile",        icon: User },
  { id: "security",      label: "Security",        icon: Shield },
  { id: "notifications", label: "Notifications",   icon: Bell },
  { id: "appearance",    label: "Appearance",      icon: Palette },
  { id: "devices",       label: "Devices",         icon: Monitor },
  { id: "accessibility", label: "Accessibility",   icon: Accessibility },
  { id: "ai",            label: "AI Preferences",  icon: Bot },
  { id: "privacy",       label: "Privacy & Data",  icon: Shield },
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
  const [privacyExporting, setPrivacyExporting] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  useEffect(() => {
    const fontSizeMap: Record<string, string> = {
      small: "13px",
      medium: "15px",
      large: "17px",
      "x-large": "19px",
    };
    const size = settingsMap["font_size"] || "medium";
    document.documentElement.style.setProperty("--app-font-size", fontSizeMap[size] || "15px");
    document.documentElement.style.fontSize = fontSizeMap[size] || "15px";

    if (settingsMap["dyslexia_font"] === "true") {
      document.documentElement.style.fontFamily = "OpenDyslexic, Arial, sans-serif";
    } else {
      document.documentElement.style.fontFamily = "";
    }

    if (settingsMap["high_contrast"] === "true") {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }

    if (settingsMap["reduce_motion"] === "true") {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
  }, [settingsMap]);

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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your account, preferences, and security.</p>
        </div>
        {/* Mobile horizontal tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4 md:hidden scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${tab === t.id ? "bg-teal-50" : "text-gray-600 hover:bg-gray-100"}`}
              style={tab === t.id ? { color: TEAL } : {}}>
              <t.icon className="w-3.5 h-3.5 flex-shrink-0" />{t.label}
            </button>
          ))}
          <button onClick={() => logout()} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-all duration-150">
            <LogOut className="w-3.5 h-3.5" />Sign out
          </button>
        </div>

        <div className="flex gap-6">
          {/* Sidebar — desktop only */}
          <nav className="hidden md:block w-44 flex-shrink-0 space-y-1">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {tab === "accessibility" && (
                <motion.div key="accessibility" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <h2 className="text-base font-semibold text-gray-900">Accessibility & Reading</h2>

                    {/* Font size */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Font size</p>
                      <p className="text-xs text-gray-400 mb-3">Adjust the base text size across the platform.</p>
                      <div className="flex gap-2">
                        {["small", "medium", "large", "x-large"].map(size => (
                          <button key={size} onClick={() => saveSetting("font_size", size)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all capitalize ${
                              (settingsMap["font_size"] || "medium") === size
                                ? "border-teal-600 text-teal-700 bg-teal-50"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                            style={(settingsMap["font_size"] || "medium") === size ? { borderColor: TEAL, color: TEAL } : {}}>
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dyslexia-friendly font */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Dyslexia-friendly font</p>
                        <p className="text-xs text-gray-400 mt-0.5">Use OpenDyslexic font throughout the app</p>
                      </div>
                      <Toggle
                        value={settingsMap["dyslexia_font"] === "true"}
                        onChange={() => saveSetting("dyslexia_font", settingsMap["dyslexia_font"] === "true" ? "false" : "true")}
                      />
                    </div>

                    {/* Reduced motion */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Reduce motion</p>
                        <p className="text-xs text-gray-400 mt-0.5">Disable animations and transitions</p>
                      </div>
                      <Toggle
                        value={settingsMap["reduce_motion"] === "true"}
                        onChange={() => saveSetting("reduce_motion", settingsMap["reduce_motion"] === "true" ? "false" : "true")}
                      />
                    </div>

                    {/* High contrast */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">High contrast mode</p>
                        <p className="text-xs text-gray-400 mt-0.5">Increase contrast for better visibility</p>
                      </div>
                      <Toggle
                        value={settingsMap["high_contrast"] === "true"}
                        onChange={() => saveSetting("high_contrast", settingsMap["high_contrast"] === "true" ? "false" : "true")}
                      />
                    </div>

                    {/* Screen reader support */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Screen reader optimised</p>
                        <p className="text-xs text-gray-400 mt-0.5">Enhanced ARIA labels and keyboard navigation</p>
                      </div>
                      <Toggle
                        value={settingsMap["screen_reader"] !== "false"}
                        onChange={() => saveSetting("screen_reader", settingsMap["screen_reader"] !== "false" ? "false" : "true")}
                      />
                    </div>

                    {/* Colour blindness */}
                    <div className="border-t border-gray-50 pt-4">
                      <p className="text-sm font-medium text-gray-900 mb-1">Colour blindness mode</p>
                      <p className="text-xs text-gray-400 mb-3">Adjust colours for colour vision deficiency</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "none", label: "None" },
                          { id: "protanopia", label: "Protanopia" },
                          { id: "deuteranopia", label: "Deuteranopia" },
                          { id: "tritanopia", label: "Tritanopia" },
                        ].map(({ id, label }) => (
                          <button key={id} onClick={() => saveSetting("color_blindness", id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                              (settingsMap["color_blindness"] || "none") === id
                                ? "border-teal-600 text-teal-700 bg-teal-50"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                            style={(settingsMap["color_blindness"] || "none") === id ? { borderColor: TEAL, color: TEAL } : {}}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Safety */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-900">Safety & Wellbeing</h2>
                    <div className="flex items-center justify-between py-3 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Content safety filter</p>
                        <p className="text-xs text-gray-400 mt-0.5">Filter potentially distressing content</p>
                      </div>
                      <Toggle
                        value={settingsMap["content_filter"] !== "false"}
                        onChange={() => saveSetting("content_filter", settingsMap["content_filter"] !== "false" ? "false" : "true")}
                      />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Focus mode</p>
                        <p className="text-xs text-gray-400 mt-0.5">Hide non-essential UI elements during study sessions</p>
                      </div>
                      <Toggle
                        value={settingsMap["focus_mode"] === "true"}
                        onChange={() => saveSetting("focus_mode", settingsMap["focus_mode"] === "true" ? "false" : "true")}
                      />
                    </div>
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-xs text-amber-700 font-medium">
                        🛡️ If you're concerned about your safety or someone else's, please speak to a trusted adult or contact your school's counsellor.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === "ai" && (
                <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                  className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <h2 className="text-base font-semibold text-gray-900">AI Tutor Preferences</h2>

                    {/* Explanation style */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Explanation style</p>
                      <p className="text-xs text-gray-400 mb-3">How should your AI Mentor explain things?</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { id: "conceptual", label: "Conceptual", desc: "Big picture, why it matters" },
                          { id: "step-by-step", label: "Step-by-step", desc: "Methodical and detailed" },
                          { id: "visual", label: "Visual", desc: "Diagrams and analogies" },
                          { id: "exam-focused", label: "Exam-focused", desc: "Past paper style answers" },
                        ].map(({ id, label, desc }) => (
                          <button key={id} onClick={() => saveSetting("ai_explanation_style", id)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              (settingsMap["ai_explanation_style"] || "conceptual") === id
                                ? "border-teal-600 bg-teal-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            style={(settingsMap["ai_explanation_style"] || "conceptual") === id ? { borderColor: TEAL } : {}}>
                            <p className="text-xs font-semibold text-gray-900">{label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Response detail */}
                    <div className="border-t border-gray-50 pt-4">
                      <p className="text-sm font-medium text-gray-900 mb-1">Response detail level</p>
                      <p className="text-xs text-gray-400 mb-3">How much detail should the AI include?</p>
                      <div className="flex gap-2">
                        {["brief", "balanced", "detailed"].map(level => (
                          <button key={level} onClick={() => saveSetting("ai_detail_level", level)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-medium capitalize transition-all ${
                              (settingsMap["ai_detail_level"] || "balanced") === level
                                ? "border-teal-600 text-teal-700 bg-teal-50"
                                : "border-gray-200 text-gray-600"
                            }`}
                            style={(settingsMap["ai_detail_level"] || "balanced") === level ? { borderColor: TEAL, color: TEAL } : {}}>
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hints vs answers */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Hints first mode</p>
                        <p className="text-xs text-gray-400 mt-0.5">Give hints before full answers to encourage thinking</p>
                      </div>
                      <Toggle
                        value={settingsMap["ai_hints_first"] !== "false"}
                        onChange={() => saveSetting("ai_hints_first", settingsMap["ai_hints_first"] !== "false" ? "false" : "true")}
                      />
                    </div>

                    {/* Exam mode */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Exam prep mode</p>
                        <p className="text-xs text-gray-400 mt-0.5">Focus responses on exam technique and mark schemes</p>
                      </div>
                      <Toggle
                        value={settingsMap["ai_exam_mode"] === "true"}
                        onChange={() => saveSetting("ai_exam_mode", settingsMap["ai_exam_mode"] === "true" ? "false" : "true")}
                      />
                    </div>

                    {/* Language */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Encouragement messages</p>
                        <p className="text-xs text-gray-400 mt-0.5">Show motivational messages during study sessions</p>
                      </div>
                      <Toggle
                        value={settingsMap["ai_encouragement"] !== "false"}
                        onChange={() => saveSetting("ai_encouragement", settingsMap["ai_encouragement"] !== "false" ? "false" : "true")}
                      />
                    </div>
                  </div>

                  <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
                    <p className="text-xs text-teal-700 font-medium">
                      🤖 These preferences personalise how your AI Mentor interacts with you. Changes take effect on your next conversation.
                    </p>
                  </div>
                </motion.div>
              )}

              {tab === "privacy" && (
                <motion.div key="privacy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Privacy & Data</h2>

                  {/* Data Export */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0"><Download size={16} className="text-blue-600" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">Export My Data</p>
                        <p className="text-xs text-gray-400 mt-0.5">Download a copy of all your Aperti data including profile, submissions, grades, messages, and subscription history.</p>
                      </div>
                    </div>
                    <button
                      disabled={privacyExporting}
                      onClick={async () => {
                        setPrivacyExporting(true);
                        try {
                          const res = await apiFetch("/api/user/export", { method: "POST" });
                          if (res.ok) {
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = "aperti-data-export.json"; a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: "Export ready", description: "Your data file has been downloaded." });
                          } else { toast({ title: "Export failed", variant: "destructive" }); }
                        } finally { setPrivacyExporting(false); }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <Download size={14} />
                      {privacyExporting ? "Preparing export…" : "Download my data"}
                    </button>
                  </div>

                  {/* Account Deletion */}
                  <div className="bg-white rounded-2xl border border-red-100 p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0"><Trash2 size={16} className="text-red-500" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">Request Account Deletion</p>
                        <p className="text-xs text-gray-400 mt-0.5">Submit a deletion request. Your account and data will be permanently removed within 30 days. Active subscriptions must be cancelled first.</p>
                      </div>
                    </div>

                    {deletionRequested ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        <AlertTriangle size={14} /> Your deletion request has been submitted and is under review.
                      </div>
                    ) : showDeleteConfirm ? (
                      <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm font-medium text-red-700 flex items-center gap-2"><AlertTriangle size={14} /> This action cannot be undone. Please confirm.</p>
                        <textarea value={deletionReason} onChange={e => setDeletionReason(e.target.value)}
                          placeholder="Optional: reason for leaving…"
                          className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 bg-white resize-none" rows={2} />
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            try {
                              const res = await apiFetch("/api/user/deletion-request", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ reason: deletionReason }),
                              });
                              if (res.ok) { setDeletionRequested(true); setShowDeleteConfirm(false); toast({ title: "Request submitted", description: "We'll process your deletion within 30 days." }); }
                              else toast({ title: "Failed to submit request", variant: "destructive" });
                            } catch { toast({ title: "Error", variant: "destructive" }); }
                          }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Confirm deletion request</button>
                          <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors">
                        <Trash2 size={14} /> Request account deletion
                      </button>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Your privacy is important to us. Data exports include all personal data associated with your account. Deletion requests are reviewed by our team and fulfilled within 30 days in accordance with applicable data protection regulations.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
