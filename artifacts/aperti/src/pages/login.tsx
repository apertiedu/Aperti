import { useState } from "react";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, GraduationCap, School, UserPlus, ChevronLeft } from "lucide-react";

type Tab = "signin" | "activate";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("signin");

  // Sign-in state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signinError, setSigninError] = useState("");
  const [signinLoading, setSigninLoading] = useState(false);

  // Activation state
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateLoading, setActivateLoading] = useState(false);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigninError("");
    setSigninLoading(true);
    try { await login(username.trim(), password); navigate("/"); }
    catch (err: any) { setSigninError(err.message || "Invalid username or password"); }
    finally { setSigninLoading(false); }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivateError("");
    if (newPass !== confirmPass) { setActivateError("Passwords do not match"); return; }
    if (newPass.length < 6) { setActivateError("Password must be at least 6 characters"); return; }
    setActivateLoading(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode: code.trim().toUpperCase(), studentName: fullName.trim().toUpperCase(), password: newPass, confirmPassword: confirmPass }),
      });
      const data = await res.json();
      if (!res.ok) { setActivateError(data.message || "Activation failed"); return; }
      await login(code.trim().toLowerCase(), newPass);
      navigate("/");
    } catch (err: any) {
      setActivateError(err.message || "Activation failed");
    } finally { setActivateLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 flex items-center justify-center p-4">
      <motion.div className="w-full max-w-sm space-y-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <School className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight">Aperti <span className="text-indigo-600">Nexus</span></h1>
            <p className="text-sm text-muted-foreground mt-0.5">Education Operating System</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/40">
          {([["signin", "Sign In", LogIn], ["activate", "Activate Account", GraduationCap]] as [Tab, string, any][]).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "signin" ? (
            <motion.div key="signin" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              className="bg-white border border-border/60 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Welcome back</h2>
                <p className="text-xs text-muted-foreground">Sign in with your teacher, admin, or student credentials.</p>
              </div>
              <form onSubmit={handleSignin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" type="text" autoComplete="username" placeholder="e.g. ahmed_ali" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="pr-10" />
                    <button type="button" className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {signinError && <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{signinError}</p>}
                <Button type="submit" className="w-full gap-2" disabled={signinLoading}>
                  <LogIn className="h-4 w-4" />{signinLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                First time as a student?{" "}
                <button onClick={() => setTab("activate")} className="text-indigo-600 hover:underline font-medium">Activate your account</button>
              </p>
            </motion.div>
          ) : (
            <motion.div key="activate" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold flex items-center gap-2"><GraduationCap className="h-4 w-4 text-indigo-600" />Student Activation</h2>
                <p className="text-xs text-muted-foreground">Use the code your teacher gave you to create your account for the first time.</p>
              </div>
              <form onSubmit={handleActivate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Student Code</Label>
                  <Input id="code" type="text" placeholder="e.g. STU001" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required autoFocus className="font-mono uppercase" />
                  <p className="text-xs text-muted-foreground">Your teacher gave you this code.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input id="fullname" type="text" placeholder="YOUR FULL NAME (UPPERCASE)" value={fullName} onChange={e => setFullName(e.target.value.toUpperCase())} required className="uppercase" />
                  <p className="text-xs text-muted-foreground">Enter exactly as registered by your teacher.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newpass">Choose Password</Label>
                  <div className="relative">
                    <Input id="newpass" type={showNewPass ? "text" : "password"} placeholder="Min. 6 characters" value={newPass} onChange={e => setNewPass(e.target.value)} required className="pr-10" />
                    <button type="button" className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPass(v => !v)} tabIndex={-1}>
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmpass">Confirm Password</Label>
                  <Input id="confirmpass" type="password" placeholder="Repeat your password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                </div>
                {activateError && <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{activateError}</p>}
                <Button type="submit" className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700" disabled={activateLoading}>
                  <UserPlus className="h-4 w-4" />{activateLoading ? "Activating..." : "Activate & Sign In"}
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Already activated?{" "}
                <button onClick={() => setTab("signin")} className="text-indigo-600 hover:underline font-medium">Sign in instead</button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
