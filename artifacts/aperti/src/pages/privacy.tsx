import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl tracking-tight text-primary">
            Aperti.
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-12 px-4">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 self-start mt-2">v2026.06</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground mb-8">
          <span>Last updated: 26 June 2026</span>
          <span>·</span>
          <a href="/data-retention" className="text-primary underline hover:opacity-80 text-sm">Data Retention Policy</a>
          <span>·</span>
          <a href="/legal" className="text-primary underline hover:opacity-80 text-sm">Legal Contact / DPO</a>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-10 text-sm text-amber-800 dark:text-amber-300">
          This document is provided for informational purposes only and does not constitute legal advice.
          Consult a qualified attorney for guidance specific to your situation.
        </div>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">1. Who We Are</h2>
            <p className="text-muted-foreground">
              Aperti ("we", "us", "our") is an educational operating system for IGCSE and IB tutors
              and their students, operating under Egyptian law. We are committed to protecting the
              privacy of everyone who uses our Platform — especially students and minors. This
              Privacy Policy explains what personal data we collect, how we use it, who we share it
              with, and your rights under the Egyptian Personal Data Protection Law
              (Law No. 151 of 2020) and other applicable regulations.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">Privacy contact:</strong>{" "}
              <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">2. Data We Collect</h2>
            <p className="text-muted-foreground mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong className="text-foreground">Account information:</strong> Full name, email
                address, username, phone number (optional), role (admin, teacher, student, parent),
                and school or centre affiliation.
              </li>
              <li>
                <strong className="text-foreground">Academic data:</strong> Attendance records,
                homework submissions and scores, exam results and marks, lesson progress, course
                enrolment history, and teacher-assigned notes or feedback.
              </li>
              <li>
                <strong className="text-foreground">AI interaction data:</strong> Queries submitted
                to AI features (The Mentor, TutorCraft, SnapGrade) and generated responses.
                These are stored to provide continuity of service and to improve AI quality.
                No AI query content is used for advertising.
              </li>
              <li>
                <strong className="text-foreground">Payment data:</strong> InstaPay reference numbers
                submitted as proof of payment. We do not store credit card or bank account details.
              </li>
              <li>
                <strong className="text-foreground">Usage and technical data:</strong> Pages visited,
                features used, session duration, device type, browser version, and IP address.
                Collected to maintain security and improve the Platform.
              </li>
              <li>
                <strong className="text-foreground">Communications:</strong> Messages sent through
                the helpdesk, in-platform notifications, or support ticket system.
              </li>
              <li>
                <strong className="text-foreground">Uploaded files:</strong> Homework submissions,
                answer sheets, profile photos, and course materials you upload to the Platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">2b. Lawful Basis for Processing (GDPR Art. 6)</h2>
            <p className="text-muted-foreground mb-3">
              For users in the European Economic Area or where GDPR applies, the following table maps each
              processing activity to its lawful basis under Article 6 of the GDPR:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2.5 font-semibold text-foreground">Processing activity</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-foreground">Lawful basis</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden sm:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Account creation & management", "Contract (Art. 6(1)(b))", "Necessary to provide the Platform service"],
                    ["Academic records & grade tracking", "Contract (Art. 6(1)(b))", "Core educational service delivery"],
                    ["AI feature responses (Mentor, TutorCraft)", "Contract (Art. 6(1)(b))", "Anonymised queries; integral to service"],
                    ["Payment verification (InstaPay)", "Contract (Art. 6(1)(b))", "Required for subscription processing"],
                    ["Security logging & fraud detection", "Legitimate interest (Art. 6(1)(f))", "Protecting platform integrity and users"],
                    ["System uptime and performance monitoring", "Legitimate interest (Art. 6(1)(f))", "Maintaining reliable service"],
                    ["Analytics (usage patterns)", "Consent (Art. 6(1)(a))", "Opt-in via privacy preferences"],
                    ["Marketing communications", "Consent (Art. 6(1)(a))", "Explicit opt-in required"],
                    ["AI model improvement", "Consent (Art. 6(1)(a))", "Optional — anonymised only"],
                    ["Financial record retention (5 years)", "Legal obligation (Art. 6(1)(c))", "Egyptian financial regulations"],
                    ["Audit log retention (12 months)", "Legal obligation (Art. 6(1)(c))", "Security & compliance requirements"],
                  ].map(([activity, basis, details]) => (
                    <tr key={activity} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 text-foreground">{activity}</td>
                      <td className="px-3 py-2 text-muted-foreground font-medium">{basis}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">2c. Data Protection Officer (DPO)</h2>
            <p className="text-muted-foreground">
              Aperti has designated a Data Protection Officer responsible for overseeing compliance with data protection
              law and acting as the primary contact for data subjects and supervisory authorities.
            </p>
            <div className="mt-3 bg-muted/40 border border-border rounded-lg px-4 py-3 text-sm space-y-1">
              <p><strong className="text-foreground">DPO Contact:</strong> <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a></p>
              <p><strong className="text-foreground">Privacy team:</strong> <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a></p>
              <p><strong className="text-foreground">Legal matters:</strong> <a href="mailto:legal@aperti.ai" className="text-primary underline hover:opacity-80">legal@aperti.ai</a></p>
              <p><strong className="text-foreground">Response SLA:</strong> 30 days for data subject requests; 72 hours for breach notifications</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">3. How We Use Your Data</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>To create and manage your account and provide the Platform's core services.</li>
              <li>To generate academic analytics, progress reports, and risk assessments for educators.</li>
              <li>To personalise the learning experience — recommending revision topics, generating flashcards, and adapting AI tutor responses.</li>
              <li>To process and verify subscription payments via InstaPay reference verification.</li>
              <li>To send notifications about homework, attendance, exam schedules, and platform updates.</li>
              <li>To detect, investigate, and prevent fraudulent, abusive, or illegal activity.</li>
              <li>To operate, maintain, and improve the Platform's features and security.</li>
              <li>To comply with our legal obligations under Egyptian law.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not use personal data for advertising, profiling for commercial purposes, or
              sell your data to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">4. Third-Party Data Processors</h2>
            <p className="text-muted-foreground mb-3">
              We work with the following third-party services that may process your data as part of
              delivering the Platform. Each is bound by a data processing agreement and appropriate
              security standards:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>
                <strong className="text-foreground">Replit (platform hosting):</strong> The Platform
                is hosted on Replit infrastructure. Your data is stored on Replit-managed PostgreSQL
                servers. Replit processes infrastructure-level data (server logs, uptime metrics)
                but does not access application-level user data.{" "}
                <a href="https://replit.com/privacy" className="text-primary underline hover:opacity-80" target="_blank" rel="noopener noreferrer">Replit Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">NVIDIA AI (artificial intelligence):</strong> AI
                features (The Mentor, TutorCraft, SnapGrade, flashcard generation) are powered by
                NVIDIA's language model API (<code>openai/gpt-oss-20b</code> via NVIDIA NIM).
                When you use an AI feature, your query text is transmitted to NVIDIA for processing.
                We do not transmit your name, email, or account identifiers alongside AI queries.{" "}
                <a href="https://www.nvidia.com/en-us/about-nvidia/privacy-policy/" className="text-primary underline hover:opacity-80" target="_blank" rel="noopener noreferrer">NVIDIA Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-foreground">PostgreSQL / Neon (database):</strong> All
                application data — accounts, academic records, attendance, homework — is stored in
                a PostgreSQL database. Data at rest is encrypted. Access is restricted to
                authenticated backend processes only.
              </li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not use Google Analytics, Facebook Pixel, advertising networks, or session
              recording tools (e.g. Hotjar, FullStory).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">5. Student Data and Minors</h2>
            <p className="text-muted-foreground mb-3">
              We treat student data — particularly data relating to minors — with the highest level
              of care and apply the following specific protections:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Student personal data is collected on behalf of and under the direction of the educational institution or teacher administering their account.</li>
              <li>We do not sell, rent, or use student data for advertising, commercial profiling, or any purpose unrelated to the educational service.</li>
              <li>AI features only receive anonymised query content — never a student's name, ID, or contact details.</li>
              <li>Educational institutions and teachers are responsible for obtaining appropriate parental or guardian consent before enrolling students under 18.</li>
              <li>Parents and guardians may request access to, correction of, or deletion of their child's data by contacting us at <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">6. Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>TLS encryption for all data in transit between your browser and our servers.</li>
              <li>Bcrypt password hashing — plaintext passwords are never stored.</li>
              <li>JWT-based authentication with short-lived session tokens stored in httpOnly cookies (not accessible to JavaScript).</li>
              <li>Role-based access control — users can only access data they are authorised to view.</li>
              <li>Comprehensive audit logging of all sensitive data access and modifications.</li>
              <li>Multi-factor authentication (TOTP) available for all accounts.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              While we employ robust security measures, no system is completely immune to breaches.
              In the event of a data breach affecting your personal data, we will notify affected
              users within 72 hours of becoming aware, as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain personal data for as long as your account is active or as necessary to
              provide the Service. Specific retention periods:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong className="text-foreground">Active accounts:</strong> Data retained for the lifetime of the account.</li>
              <li><strong className="text-foreground">Closed accounts:</strong> Data retained for 30 days to allow export requests, then permanently deleted.</li>
              <li><strong className="text-foreground">Payment records:</strong> Retained for 5 years as required by Egyptian financial regulations.</li>
              <li><strong className="text-foreground">Audit logs:</strong> Retained for 12 months for security purposes.</li>
              <li><strong className="text-foreground">AI interaction logs:</strong> Retained for 90 days, then purged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">8. Your Rights</h2>
            <p className="text-muted-foreground mb-3">
              Under the Egyptian Personal Data Protection Law (Law No. 151 of 2020) and applicable
              regulations, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong className="text-foreground">Deletion:</strong> Request deletion of your personal data ("right to erasure"), subject to legal retention obligations.</li>
              <li><strong className="text-foreground">Portability:</strong> Request your data in a structured, machine-readable format (available via the data export feature in account settings).</li>
              <li><strong className="text-foreground">Objection:</strong> Object to processing of your data for purposes other than providing the Service.</li>
              <li><strong className="text-foreground">Restriction:</strong> Request that we restrict processing of your data in certain circumstances.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a>.
              We will respond within 30 days. Students and minors may exercise these rights through
              their parent, guardian, or school administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">9. Cookies</h2>
            <p className="text-muted-foreground">
              We use only the following types of cookies:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li><strong className="text-foreground">Authentication cookies (essential):</strong> Secure, httpOnly session tokens required to keep you signed in. These expire when you sign out or after 7 days of inactivity.</li>
              <li><strong className="text-foreground">Preference cookies (functional):</strong> Store your UI preferences such as dark/light mode. These are stored in localStorage, not transmitted to servers.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not use advertising cookies, third-party tracking pixels, or any cookies that
              track your activity across other websites. No cookie consent banner is required for
              strictly essential cookies under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. For material changes — those
              that affect how we collect, use, or share your data — we will provide at least 15
              days' notice via the Platform or email before the changes take effect. The "Last
              updated" date at the top of this page reflects the most recent revision.
              Continued use of the Platform after the effective date constitutes acceptance of
              the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">11. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related questions, data requests, or complaints, contact our Privacy team:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Email: <a href="mailto:privacy@aperti.ai" className="text-primary underline hover:opacity-80">privacy@aperti.ai</a></li>
              <li>Legal matters: <a href="mailto:legal@aperti.ai" className="text-primary underline hover:opacity-80">legal@aperti.ai</a></li>
              <li>General support: <Link href="/contact" className="text-primary underline hover:opacity-80">Contact page</Link></li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors text-foreground font-medium">Privacy Policy</Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <span>·</span>
          <a href="mailto:privacy@aperti.ai" className="hover:text-foreground transition-colors">privacy@aperti.ai</a>
        </div>
      </footer>
    </div>
  );
}
