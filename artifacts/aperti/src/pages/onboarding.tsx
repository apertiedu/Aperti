import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";


const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","English Language","English Literature","Arabic","History","Geography","Computer Science","Economics","Business Studies","Statistics","Further Mathematics","ICT"];
const BOARDS = ["CAIE (Cambridge A-Level / IGCSE)","Edexcel / Pearson","IB (International Baccalaureate)","AQA","OCR","Egyptian National Curriculum","American Curriculum","Other"];
const EXAM_SESSIONS = ["May/June 2026","October/November 2026","February/March 2027","May/June 2027","October/November 2027","Not applicable"];
const COUNTRIES = ["Egypt","Saudi Arabia","UAE","United Kingdom","United States","Canada","Australia","Germany","France","Other"];
const GOAL_OPTIONS = ["Get an A*","Improve my grade","Build strong foundations","Prepare for university","Pass a retake","Self-improvement","Follow a structured plan"];
const TEACHING_TYPES = [
  { id: "online", label: "Online", desc: "Teach students remotely via the platform." },
  { id: "physical", label: "In-Person / Centre", desc: "Teach at a physical location." },
  { id: "hybrid", label: "Hybrid", desc: "Combination of online and in-person." },
];

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${i + 1 < current ? "w-6 h-2" : i + 1 === current ? "w-8 h-2" : "w-2 h-2"}`}
          style={{ background: i + 1 <= current ? "hsl(var(--primary))" : "#e5e7eb" }} />
      ))}
    </div>
  );
}

function ChipSelect({ options, selected, onSelect }: { options: string[]; selected: string[]; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onSelect(o)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${selected.includes(o) ? "border-primary text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          style={selected.includes(o) ? { background: "#f0fdfa" } : {}}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className="w-11 h-6 rounded-full relative transition-all duration-200 flex-shrink-0"
        style={{ background: value ? "hsl(var(--primary))" : "#d1d5db" }}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function TeacherWizard({ onDone }: { onDone: () => void }) {
  const TOTAL = 5;
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState(""); const [phone, setPhone] = useState(""); const [country, setCountry] = useState(""); const [exp, setExp] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [teachType, setTeachType] = useState("");
  const [wsName, setWsName] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleArr = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const save = async () => {
    await apiFetch("/api/onboarding/save-step", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data: { bio, phone, country, exp, subjects, boards, teachType, wsName } }),
    }).catch(() => {});
  };

  const next = async () => {
    setLoading(true);
    await save();
    if (step === TOTAL) {
      if (wsName.trim()) {
        await apiFetch("/api/workspace", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: wsName.trim(), type: "teacher" }),
        }).catch(() => {});
      }
      await apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {});
      onDone();
    } else { setStep(s => s + 1); }
    setLoading(false);
  };
  const skip = () => { if (step < TOTAL) setStep(s => s + 1); else { apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {}); onDone(); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <StepDots total={TOTAL} current={step} />
        <span className="text-xs text-gray-400 font-medium">Step {step} of {TOTAL}</span>
      </div>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="t1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Set up your profile</h2><p className="text-gray-500 text-sm">Let students know who you are.</p></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Short bio</Label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="e.g. Cambridge-qualified Maths tutor with 8 years of experience..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20..." className="h-10 rounded-xl border-gray-200" /></div>
              <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Country</Label>
                <select value={country} onChange={e => setCountry(e.target.value)} className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:border-primary bg-card">
                  <option value="">Select…</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Years of experience</Label>
              <select value={exp} onChange={e => setExp(e.target.value)} className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:border-primary bg-card">
                <option value="">Select…</option><option>Less than 1 year</option><option>1–3 years</option><option>3–5 years</option><option>5–10 years</option><option>10+ years</option></select></div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="t2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Select your subjects</h2><p className="text-gray-500 text-sm">Pick all subjects you teach.</p></div>
            <ChipSelect options={SUBJECTS} selected={subjects} onSelect={v => toggleArr(subjects, setSubjects, v)} />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="t3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Curriculum & exam boards</h2><p className="text-gray-500 text-sm">Which boards do you prepare students for?</p></div>
            <ChipSelect options={BOARDS} selected={boards} onSelect={v => toggleArr(boards, setBoards, v)} />
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="t4" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">How do you teach?</h2><p className="text-gray-500 text-sm">Choose your primary delivery method.</p></div>
            <div className="space-y-3">
              {TEACHING_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setTeachType(t.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${teachType === t.id ? "border-primary" : "border-gray-200 hover:border-gray-300"}`}
                  style={teachType === t.id ? { background: "#f0fdfa" } : {}}>
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold text-gray-900">{t.label}</p><p className="text-sm text-gray-500 mt-0.5">{t.desc}</p></div>
                    {teachType === t.id && <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-primary"><Check className="w-3 h-3 text-white" /></div>}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {step === 5 && (
          <motion.div key="t5" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Create your workspace</h2><p className="text-gray-500 text-sm">Your workspace is where you manage all your classes and students.</p></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Workspace name</Label>
              <Input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="e.g. Jane's Physics Academy" className="h-11 rounded-xl border-gray-200" />
              <p className="text-xs text-gray-400 mt-1.5">You can rename this anytime in workspace settings.</p></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-1.5 text-gray-600"><ArrowLeft className="w-4 h-4" />Back</Button> : <div />}
        <div className="flex items-center gap-3">
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600">Skip</button>
          <Button onClick={next} disabled={loading} className="gap-1.5 rounded-xl px-6 bg-primary">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : step === TOTAL ? "Launch dashboard" : "Continue"}
            {!loading && step < TOTAL && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentWizard({ onDone }: { onDone: () => void }) {
  const TOTAL = 4;
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState(""); const [country, setCountry] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [session, setSession] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const toggleArr = (arr: string[], setArr: (v: string[]) => void, v: string) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const next = async () => {
    setLoading(true);
    await apiFetch("/api/onboarding/save-step", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data: { bio, country, subjects, session, goals } }),
    }).catch(() => {});
    if (step === TOTAL) { await apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {}); onDone(); }
    else setStep(s => s + 1);
    setLoading(false);
  };
  const skip = () => { if (step < TOTAL) setStep(s => s + 1); else { apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {}); onDone(); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <StepDots total={TOTAL} current={step} />
        <span className="text-xs text-gray-400 font-medium">Step {step} of {TOTAL}</span>
      </div>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about yourself</h2><p className="text-gray-500 text-sm">This helps personalise your learning experience.</p></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Short bio (optional)</Label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="e.g. Year 12 student preparing for Cambridge A-Levels..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary" /></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Country</Label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:border-primary bg-card">
                <option value="">Select country</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">What subjects do you study?</h2><p className="text-gray-500 text-sm">Select all that apply.</p></div>
            <ChipSelect options={SUBJECTS} selected={subjects} onSelect={v => toggleArr(subjects, setSubjects, v)} />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">When is your exam?</h2><p className="text-gray-500 text-sm">We'll tailor revision plans around your timeline.</p></div>
            <div className="space-y-2">
              {EXAM_SESSIONS.map(s => (
                <button key={s} type="button" onClick={() => setSession(s)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${session === s ? "border-primary text-primary" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}
                  style={session === s ? { background: "#f0fdfa" } : {}}>{s}</button>
              ))}
            </div>
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">What are your learning goals?</h2><p className="text-gray-500 text-sm">Optional — select all that apply.</p></div>
            <ChipSelect options={GOAL_OPTIONS} selected={goals} onSelect={v => toggleArr(goals, setGoals, v)} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-1.5 text-gray-600"><ArrowLeft className="w-4 h-4" />Back</Button> : <div />}
        <div className="flex items-center gap-3">
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600">Skip</button>
          <Button onClick={next} disabled={loading} className="gap-1.5 rounded-xl px-6 bg-primary">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : step === TOTAL ? "Go to dashboard" : "Continue"}
            {!loading && step < TOTAL && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ParentWizard({ onDone }: { onDone: () => void }) {
  const TOTAL = 3;
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(""); const [country, setCountry] = useState(""); const [childEmail, setChildEmail] = useState("");
  const [notifyAtt, setNotifyAtt] = useState(true); const [notifyGrades, setNotifyGrades] = useState(true); const [notifyPay, setNotifyPay] = useState(false);
  const [loading, setLoading] = useState(false);

  const next = async () => {
    setLoading(true);
    await apiFetch("/api/onboarding/save-step", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data: { phone, country, childEmail, notifyAtt, notifyGrades, notifyPay } }),
    }).catch(() => {});
    if (step === TOTAL) { await apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {}); onDone(); }
    else setStep(s => s + 1);
    setLoading(false);
  };
  const skip = () => { if (step < TOTAL) setStep(s => s + 1); else { apiFetch("/api/onboarding/complete", { method: "POST" }).catch(() => {}); onDone(); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <StepDots total={TOTAL} current={step} />
        <span className="text-xs text-gray-400 font-medium">Step {step} of {TOTAL}</span>
      </div>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="p1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Your profile</h2><p className="text-gray-500 text-sm">A few quick details to personalise your experience.</p></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone (optional)</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20..." className="h-10 rounded-xl border-gray-200" /></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Country</Label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:border-primary bg-card">
                <option value="">Select country</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="p2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Link your child's account</h2><p className="text-gray-500 text-sm">Enter their email or pairing code. You can do this later too.</p></div>
            <div><Label className="text-sm font-medium text-gray-700 mb-1.5 block">Child's email or pairing code</Label><Input value={childEmail} onChange={e => setChildEmail(e.target.value)} placeholder="child@email.com or code" className="h-10 rounded-xl border-gray-200" /></div>
            <div className="bg-blue-50 text-blue-700 rounded-xl p-3 text-sm flex items-start gap-2"><span>ℹ️</span><span>Child linking will be confirmed once approved by the teacher managing their account.</span></div>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="p3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-3">
            <div><h2 className="text-xl font-bold text-gray-900 mb-1">Notification preferences</h2><p className="text-gray-500 text-sm">Choose what you'd like to be notified about.</p></div>
            <Toggle value={notifyAtt} onChange={setNotifyAtt} label="Attendance alerts" desc="When your child misses a class" />
            <Toggle value={notifyGrades} onChange={setNotifyGrades} label="Grade updates" desc="New marks and published results" />
            <Toggle value={notifyPay} onChange={setNotifyPay} label="Payment reminders" desc="Upcoming and overdue fees" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-1.5 text-gray-600"><ArrowLeft className="w-4 h-4" />Back</Button> : <div />}
        <div className="flex items-center gap-3">
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600">Skip</button>
          <Button onClick={next} disabled={loading} className="gap-1.5 rounded-xl px-6 bg-primary">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : step === TOTAL ? "Go to dashboard" : "Continue"}
            {!loading && step < TOTAL && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { user } = useAuth();

  const handleDone = () => { window.location.href = "/"; };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: "hsl(var(--primary))", filter: "blur(120px)" }} />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: "hsl(var(--primary))", filter: "blur(80px)" }} />
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-lg bg-card rounded-2xl shadow-sm border border-border p-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xl font-bold text-primary">Aperti.</span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#f0fdfa", color: "hsl(var(--primary))" }}>Account setup</span>
        </div>
        {user?.displayName && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-muted/40">
            <p className="text-sm font-semibold text-foreground">Welcome, {user.displayName}!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Let&apos;s set up your account in a few quick steps.</p>
          </div>
        )}
        {user?.role === "teacher" || user?.role === "admin" || user?.role === "assistant" ? (
          <TeacherWizard onDone={handleDone} />
        ) : user?.role === "parent" ? (
          <ParentWizard onDone={handleDone} />
        ) : (
          <StudentWizard onDone={handleDone} />
        )}
      </motion.div>
    </div>
  );
}
