import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ShieldCheck, Activity, Map, FileText, Scale, Mail, Lock,
  ArrowRight, ChevronRight, Eye, KeyRound, Users, Database,
} from "lucide-react";


function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

const TRUST_LINKS = [
  {
    href: "/status",
    icon: Activity,
    title: "Platform Status",
    description: "Live uptime and incident history for all Aperti services.",
    badge: "Live",
    badgeColor: "#22C55E",
  },
  {
    href: "/release-notes",
    icon: FileText,
    title: "Release Notes",
    description: "Every product update, fix, and improvement we have shipped.",
    badge: null,
    badgeColor: null,
  },
  {
    href: "/roadmap",
    icon: Map,
    title: "Public Roadmap",
    description: "What we are building next and our development priorities.",
    badge: null,
    badgeColor: null,
  },
  {
    href: "/terms",
    icon: Scale,
    title: "Terms of Service",
    description: "The legal agreement that governs your use of Aperti.",
    badge: null,
    badgeColor: null,
  },
  {
    href: "/privacy",
    icon: Eye,
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal data.",
    badge: null,
    badgeColor: null,
  },
  {
    href: "/contact",
    icon: Mail,
    title: "Contact Us",
    description: "Reach our team directly — we respond within 48 hours.",
    badge: null,
    badgeColor: null,
  },
];

const SECURITY_PILLARS = [
  {
    icon: KeyRound,
    title: "End-to-End Encryption",
    description: "All data is encrypted at rest with AES-256 and in transit with TLS 1.3. Your student records, exam data, and messages are never exposed in plaintext.",
  },
  {
    icon: Users,
    title: "Role-Based Access Control",
    description: "Teachers can only see their own students. Parents are scoped strictly to their linked child. Admins have full audit trails. No role can exceed its defined boundary.",
  },
  {
    icon: ShieldCheck,
    title: "Teacher Isolation",
    description: "Each teacher workspace is completely isolated. One teacher cannot access another teacher's students, courses, or materials — by design, at the database level.",
  },
  {
    icon: Database,
    title: "Audit Logs",
    description: "Every login, data access, and permission change is immutably logged with timestamps and actor IDs. Full audit trails are available to administrators at any time.",
  },
  {
    icon: Lock,
    title: "Parent Safety Layer",
    description: "Parent accounts link to children via secure pairing codes that expire. Parents receive notifications for any account activity and can revoke access at any time.",
  },
  {
    icon: Activity,
    title: "Continuous Monitoring",
    description: "Our infrastructure is monitored 24/7 with automated incident detection. Security scans run on every deployment to catch vulnerabilities before they reach production.",
  },
];

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-white font-sans" style={{ color: "#121212" }}>
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-lg font-extrabold cursor-pointer tracking-tight">
              Aperti<span style={{ color: "hsl(var(--primary))" }}>.</span>
            </span>
          </Link>
          <Link href="/">
            <button className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
              ← Back to Home
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-5 bg-primary/8">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${"hsl(var(--primary))"}, #0F766E)` }}>
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: "#121212" }}>
              Aperti Trust Center
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
              Transparency, security, and accountability are core to everything we build. This page
              gives you direct access to our policies, platform health, and security practices.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Trust Links Grid */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-10 text-center">
              Platform resources
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TRUST_LINKS.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.href} delay={i * 0.07}>
                  <Link href={item.href}>
                    <motion.div
                      whileHover={{ y: -6, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", transition: { duration: 0.2 } }}
                      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm cursor-pointer h-full flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/8">
                          <Icon className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ background: item.badgeColor! }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2 text-sm">{item.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed flex-1">{item.description}</p>
                      <div className="flex items-center gap-1 mt-4 text-xs font-semibold transition-colors group-hover:opacity-80"
                        style={{ color: "hsl(var(--primary))" }}>
                        View <ChevronRight className="h-3 w-3" />
                      </div>
                    </motion.div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="py-20 px-5" style={{ background: "#F9FAFB" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))", borderColor: `${"hsl(var(--primary))"}25` }}>
                <Lock className="h-3 w-3" /> Security Architecture
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                Built secure from the ground up.
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
                Security is not an afterthought at Aperti. Every architectural decision prioritises
                the protection of student data and teacher privacy.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SECURITY_PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <Reveal key={pillar.title} delay={i * 0.07}>
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-primary/8">
                      <Icon className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 text-sm">{pillar.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{pillar.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5 bg-primary/8">
                <Mail className="h-6 w-6" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">Security question or concern?</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                If you have found a vulnerability or have a security question, please contact our team
                directly. We take all reports seriously and respond within 24 hours.
              </p>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-sm"
                  style={{ background: "hsl(var(--primary))" }}>
                  Contact Security Team <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-5 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <span>© 2026 Aperti. All rights reserved.</span>
          <div className="flex gap-5">
            <Link href="/terms"><span className="hover:text-gray-700 transition-colors cursor-pointer">Terms</span></Link>
            <Link href="/privacy"><span className="hover:text-gray-700 transition-colors cursor-pointer">Privacy</span></Link>
            <Link href="/contact"><span className="hover:text-gray-700 transition-colors cursor-pointer">Contact</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
