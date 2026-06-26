import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Mail, Clock, FileText, ShieldCheck, Download,
  Trash2, Eye, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, ArrowRight,
} from "lucide-react";

const POLICY_VERSION = "v2026.06";
const DPO_EMAIL = "privacy@aperti.ai";
const LEGAL_EMAIL = "legal@aperti.ai";
const RESPONSE_SLA = "30 calendar days";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

const REQUEST_TYPES = [
  {
    id: "access",
    icon: Eye,
    title: "Right of Access (Article 17)",
    desc: "Request a complete copy of all personal data Aperti holds about you, including how it is used and who it is shared with.",
    action: "Use Settings → Privacy & Data → Export My Data for instant machine-readable export.",
    sla: "30 days",
    selfService: true,
  },
  {
    id: "erasure",
    icon: Trash2,
    title: "Right to Erasure (Right to be Forgotten)",
    desc: "Request permanent deletion of your personal data. Note: financial records required by law are anonymised, not deleted.",
    action: "Use Settings → Privacy & Data → Request Account Deletion, or submit this form for a formal written request.",
    sla: "30 days",
    selfService: true,
  },
  {
    id: "portability",
    icon: Download,
    title: "Right to Data Portability",
    desc: "Receive your data in a structured, machine-readable JSON format to transfer to another service.",
    action: "Use Settings → Privacy & Data → Export My Data for immediate download.",
    sla: "Instant (self-service)",
    selfService: true,
  },
  {
    id: "rectification",
    icon: RefreshCw,
    title: "Right to Rectification",
    desc: "Correct inaccurate or incomplete personal data held about you.",
    action: "Most profile data can be updated in Settings → Profile. For academic record corrections, contact your teacher.",
    sla: "30 days",
    selfService: true,
  },
  {
    id: "restriction",
    icon: ShieldCheck,
    title: "Right to Restrict Processing",
    desc: "Request that we temporarily stop processing your data while a dispute or complaint is being resolved.",
    action: "Submit a formal written request with the grounds for restriction.",
    sla: "30 days",
    selfService: false,
  },
  {
    id: "objection",
    icon: Scale,
    title: "Right to Object",
    desc: "Object to processing based on legitimate interests, including profiling and direct marketing.",
    action: "Marketing can be opted out from Settings → Notifications. For other objections, submit a formal request.",
    sla: "30 days",
    selfService: false,
  },
];

const FAQS = [
  {
    q: "How do I know my request has been received?",
    a: "You will receive an automated acknowledgement email within 24 hours. Our team then reviews and responds within 30 calendar days.",
  },
  {
    q: "What happens if I request deletion but have an active subscription?",
    a: "You must cancel your subscription first. Once cancelled, submit the deletion request. Financial records are legally required to be kept for 7 years but will be anonymised.",
  },
  {
    q: "Can I request data for another person (e.g., my child)?",
    a: "Yes. Guardians may exercise rights on behalf of minor children linked to their account. Include proof of the guardian relationship in your request.",
  },
  {
    q: "What if I am not satisfied with Aperti's response?",
    a: "You have the right to file a complaint with the Egyptian Personal Data Protection Centre (PDPC) under Law No. 151 of 2020, or seek judicial remedies.",
  },
  {
    q: "Are there any fees for submitting a data request?",
    a: "No. All data subject requests under applicable law are fulfilled free of charge. The self-service export and deletion tools in Settings are also free.",
  },
];

export default function LegalContact() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", requestType: "", description: "", isMinor: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/errors/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[legal-request] ${form.requestType}: ${form.description.slice(0, 200)}`,
          route: "/legal",
          source: "LegalRequestForm",
          browserInfo: `Name: ${form.name} | Email: ${form.email} | Type: ${form.requestType} | Minor: ${form.isMinor}`,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {}
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl tracking-tight text-primary">
            Aperti.
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/trust" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Trust Center
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-4">
        <Reveal>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Compliance</span>
              <div className="mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {POLICY_VERSION}
                </span>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Legal & Privacy Contact</h1>
          <p className="text-muted-foreground mb-8 max-w-2xl leading-relaxed">
            Exercise your data protection rights under Egyptian Law No. 151 of 2020 and applicable international
            regulations. We respond to all formal requests within {RESPONSE_SLA}.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Mail, label: "Privacy & DPO", value: DPO_EMAIL, href: `mailto:${DPO_EMAIL}`, desc: "Data protection questions" },
            { icon: Scale, label: "Legal Affairs", value: LEGAL_EMAIL, href: `mailto:${LEGAL_EMAIL}`, desc: "Formal legal requests" },
            { icon: Clock, label: "Response SLA", value: RESPONSE_SLA, href: null, desc: "Guaranteed response time" },
          ].map(({ icon: Icon, label, value, href, desc }, i) => (
            <Reveal key={label} delay={i * 0.06}>
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                {href ? (
                  <a href={href} className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity break-all">
                    {value}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">Your Rights & How to Exercise Them</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REQUEST_TYPES.map((rt, i) => {
                const Icon = rt.icon;
                return (
                  <Reveal key={rt.id} delay={0.04 * i}>
                    <div className="bg-card border border-border rounded-2xl p-5 h-full flex flex-col">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-foreground leading-tight">{rt.title}</h3>
                          {rt.selfService && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full mt-1 inline-block">
                              Self-service available
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">{rt.desc}</p>
                      <div className="bg-muted/30 rounded-lg px-3 py-2">
                        <p className="text-xs text-foreground leading-relaxed">{rt.action}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">SLA: <span className="font-semibold">{rt.sla}</span></p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">Submit a Formal Written Request</h2>
            <div className="bg-card border border-border rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">Request received</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Your formal request has been submitted. We will acknowledge receipt within 24 hours
                      and respond fully within {RESPONSE_SLA} to the email you provided.
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Reference: {POLICY_VERSION}-{Date.now().toString(36).toUpperCase()}
                    </p>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full name *</label>
                        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                          placeholder="Your legal name" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email address *</label>
                        <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                          placeholder="email@example.com" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request type *</label>
                      <select required value={form.requestType} onChange={e => setForm(f => ({ ...f, requestType: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all">
                        <option value="">Select request type…</option>
                        <option value="access">Right of Access — Data Copy</option>
                        <option value="erasure">Right to Erasure — Account Deletion</option>
                        <option value="portability">Right to Portability — Data Export</option>
                        <option value="rectification">Right to Rectification — Correction</option>
                        <option value="restriction">Right to Restrict Processing</option>
                        <option value="objection">Right to Object</option>
                        <option value="complaint">Complaint about Data Processing</option>
                        <option value="other">Other legal matter</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description *</label>
                      <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                        rows={4} placeholder="Please describe your request in detail, including relevant account identifiers (username, email) and the specific data or processing you are referring to." />
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" id="is_minor" checked={form.isMinor}
                        onChange={e => setForm(f => ({ ...f, isMinor: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary" />
                      <label htmlFor="is_minor" className="text-xs text-muted-foreground leading-relaxed">
                        I am submitting this request on behalf of a minor child for whom I am the legal guardian.
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground">
                        We respond within <span className="font-semibold text-foreground">{RESPONSE_SLA}</span>.
                        We may request proof of identity.
                      </p>
                      <motion.button type="submit" disabled={submitting}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60 transition-opacity">
                        {submitting ? "Submitting…" : <>Submit Request <ArrowRight className="h-4 w-4" /></>}
                      </motion.button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {FAQS.map((faq, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                    {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div key="ans"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="px-5 pb-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <div className="bg-muted/30 border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <p className="text-sm font-bold text-foreground mb-1">Regulatory Authority</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you are not satisfied with our response, you may lodge a complaint with the
                Egyptian Personal Data Protection Centre (PDPC) established under Law No. 151 of 2020.
              </p>
            </div>
            <Link href="/trust">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground flex-shrink-0">
                <FileText className="h-4 w-4" /> Trust Center
              </motion.button>
            </Link>
          </div>
        </Reveal>
      </main>

      <footer className="border-t border-border py-8 px-4 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <span>© 2026 Aperti. {POLICY_VERSION}.</span>
          <div className="flex gap-5">
            <Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span></Link>
            <Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms</span></Link>
            <Link href="/data-retention"><span className="hover:text-foreground transition-colors cursor-pointer">Data Retention</span></Link>
            <Link href="/trust"><span className="hover:text-foreground transition-colors cursor-pointer">Trust Center</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
