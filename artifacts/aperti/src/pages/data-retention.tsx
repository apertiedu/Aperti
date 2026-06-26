import { Link } from "wouter";
import { motion } from "framer-motion";
import { Database, Clock, Shield, Trash2, Download, ArrowRight, FileText } from "lucide-react";

const POLICY_VERSION = "v2026.06";
const LAST_UPDATED = "26 June 2026";
const EFFECTIVE_DATE = "26 June 2026";

interface RetentionCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  retention: string;
  description: string;
  examples: string[];
  legal_basis: string;
}

const RETENTION_CATEGORIES: RetentionCategory[] = [
  {
    name: "Account & Identity Data",
    icon: Shield,
    retention: "Duration of account + 90 days after deletion",
    description: "Core identity information required to operate your account and maintain platform integrity.",
    examples: ["Username and display name", "Email address", "Phone number (if provided)", "Role and permissions", "Account creation date", "Country and timezone"],
    legal_basis: "Contract performance; Legitimate interest (fraud prevention)",
  },
  {
    name: "Academic Records",
    icon: FileText,
    retention: "5 years from creation",
    description: "Educational records including grades, submissions, and attendance are kept to provide a complete academic history and comply with educational data obligations.",
    examples: ["Attendance records", "Homework submissions and scores", "Exam results and marks", "Course enrolment history", "Teacher feedback and notes", "Assignment grades"],
    legal_basis: "Legitimate interest (educational continuity); Legal obligation",
  },
  {
    name: "Financial & Billing Data",
    icon: Database,
    retention: "7 years from transaction date",
    description: "Financial records are retained for the period required by Egyptian tax law and accounting regulations.",
    examples: ["Subscription history", "Payment transaction records", "Invoice data", "Coupon usage", "Refund records", "Billing address"],
    legal_basis: "Legal obligation (Egyptian tax law No. 91/2005)",
  },
  {
    name: "AI Interaction Data",
    icon: Clock,
    retention: "90 days",
    description: "Queries and responses from AI features (The Mentor, SnapGrade, TutorCraft) are retained briefly for quality and safety review, then automatically purged.",
    examples: ["AI chat messages and responses", "Tutoring session transcripts", "AI-generated feedback", "Prompt and completion pairs"],
    legal_basis: "Legitimate interest (service quality, safety monitoring)",
  },
  {
    name: "Audit & Security Logs",
    icon: Shield,
    retention: "12 months rolling",
    description: "Security and access logs are retained to detect and investigate security incidents, then purged on a rolling basis.",
    examples: ["Login and logout events", "Failed authentication attempts", "Permission changes", "Admin actions", "API access patterns"],
    legal_basis: "Legitimate interest (security); Legal obligation",
  },
  {
    name: "Communication Data",
    icon: FileText,
    retention: "2 years from message date",
    description: "In-platform messages between teachers, students, and parents are retained to support ongoing educational relationships and dispute resolution.",
    examples: ["Direct messages", "Announcement history", "Notification logs", "Support ticket conversations"],
    legal_basis: "Legitimate interest (service continuity, dispute resolution)",
  },
  {
    name: "Analytics & Usage Data",
    icon: Database,
    retention: "24 months, then aggregated",
    description: "Anonymised usage metrics are retained to improve the platform. Raw event data is aggregated after 24 months and identifiers removed.",
    examples: ["Page views and feature usage", "Session duration", "Feature adoption rates", "Error reports (anonymised)"],
    legal_basis: "Legitimate interest (product improvement)",
  },
  {
    name: "Consent Records",
    icon: Shield,
    retention: "5 years",
    description: "Records of consent granted or withdrawn are retained to demonstrate lawful processing under data protection law.",
    examples: ["Terms acceptance timestamps", "Privacy policy consent", "Marketing opt-in/out", "Cookie preferences"],
    legal_basis: "Legal obligation (data protection accountability principle)",
  },
];

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

export default function DataRetention() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl tracking-tight text-primary">
            Aperti.
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
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
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Legal Document</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {POLICY_VERSION}
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Data Retention Policy</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground mb-8">
            <span>Last updated: {LAST_UPDATED}</span>
            <span>Effective: {EFFECTIVE_DATE}</span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-10 text-sm text-amber-800 dark:text-amber-300">
            This policy forms part of our Privacy Policy. It does not constitute legal advice. For formal data requests, please visit our{" "}
            <Link href="/legal" className="underline font-semibold hover:opacity-80">Legal Contact page</Link>.
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <section className="space-y-4 mb-12">
            <h2 className="text-xl font-bold">Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aperti retains personal data only as long as necessary to fulfil the purpose for which it was collected,
              comply with our legal obligations under Egyptian law (Law No. 151 of 2020) and other applicable regulations,
              resolve disputes, and enforce our agreements. This policy sets out specific retention periods for each
              category of data we process.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When data reaches the end of its retention period, it is either permanently deleted or anonymised so that
              it can no longer be linked to any individual. We conduct automated retention reviews on a monthly schedule.
            </p>
          </section>
        </Reveal>

        <div className="space-y-6 mb-14">
          {RETENTION_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <Reveal key={cat.name} delay={0.05 * i}>
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                        <h3 className="font-bold text-foreground text-base">{cat.name}</h3>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full flex-shrink-0">
                          <Clock className="h-3 w-3" /> {cat.retention}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{cat.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Examples</p>
                          <ul className="space-y-1">
                            {cat.examples.map(ex => (
                              <li key={ex} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Legal Basis</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{cat.legal_basis}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="space-y-10">
          <Reveal>
            <section>
              <h2 className="text-lg font-bold mb-3">Deletion Process</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                When you request account deletion through Settings → Privacy & Data, the following process is initiated:
              </p>
              <div className="space-y-3">
                {[
                  { step: "01", title: "Request received", desc: "Your deletion request is logged and our team is notified within 24 hours." },
                  { step: "02", title: "Verification period", desc: "We check for active subscriptions or obligations that must be resolved before deletion can proceed." },
                  { step: "03", title: "Staged deletion", desc: "Personal identifiers are removed from active systems within 7 days. Financial records are anonymised but retained for 7 years as required by law." },
                  { step: "04", title: "Backup purge", desc: "Data is removed from all backup systems within 30 days of the request." },
                  { step: "05", title: "Confirmation", desc: "You receive written confirmation that your deletion has been completed." },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-md flex-shrink-0">{item.step}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal>
            <section>
              <h2 className="text-lg font-bold mb-3">Your Rights</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: "Right of Access", desc: "Request a copy of all personal data we hold about you (Article 17, Law 151/2020)." },
                  { title: "Right to Rectification", desc: "Correct inaccurate or incomplete personal data through Settings." },
                  { title: "Right to Erasure", desc: "Request deletion of your personal data, subject to legal retention obligations." },
                  { title: "Right to Portability", desc: "Receive your data in a machine-readable format via Settings → Export My Data." },
                  { title: "Right to Object", desc: "Object to processing based on legitimate interests, including direct marketing." },
                  { title: "Right to Restrict", desc: "Request that we restrict processing while a dispute is being resolved." },
                ].map(r => (
                  <div key={r.title} className="p-4 bg-card border border-border rounded-xl">
                    <p className="text-sm font-semibold text-foreground mb-1">{r.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                To exercise any of these rights, visit <Link href="/settings" className="text-primary underline">Settings → Privacy & Data</Link> or
                submit a formal request via our <Link href="/legal" className="text-primary underline">Legal Contact page</Link>.
                We respond to all requests within 30 calendar days.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <h2 className="text-base font-bold mb-4 text-foreground">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm">
                    <Download className="h-4 w-4" /> Export My Data
                  </motion.button>
                </Link>
                <Link href="/settings">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-semibold">
                    <Trash2 className="h-4 w-4" /> Request Deletion
                  </motion.button>
                </Link>
                <Link href="/legal">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-semibold">
                    <ArrowRight className="h-4 w-4" /> Submit Legal Request
                  </motion.button>
                </Link>
              </div>
            </section>
          </Reveal>
        </div>
      </main>

      <footer className="border-t border-border py-8 px-4 mt-16">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <span>© 2026 Aperti. Policy {POLICY_VERSION}.</span>
          <div className="flex gap-5">
            <Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></Link>
            <Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms</span></Link>
            <Link href="/legal"><span className="hover:text-foreground transition-colors cursor-pointer">Legal Contact</span></Link>
            <Link href="/trust"><span className="hover:text-foreground transition-colors cursor-pointer">Trust Center</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
