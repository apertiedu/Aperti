import { Link } from "wouter";

export default function Terms() {
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
          <h1 className="text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 self-start mt-2">v2026.06</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground mb-8">
          <span>Last updated: 26 June 2026</span>
          <span>·</span>
          <a href="/privacy" className="text-primary underline hover:opacity-80 text-sm">Privacy Policy</a>
          <span>·</span>
          <a href="/legal" className="text-primary underline hover:opacity-80 text-sm">Legal Contact</a>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-10 text-sm text-amber-800 dark:text-amber-300">
          This document is provided for informational purposes only and does not constitute legal advice.
          Consult a qualified attorney for guidance specific to your situation.
        </div>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using the Aperti platform ("Platform", "Service", "we", "us"), you agree
              to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not
              agree with any part of these Terms, you must not use the Platform. These Terms apply to
              all users, including administrators, teachers, students, parents, and guardians.
              Use of the Platform by a student constitutes acceptance on behalf of the student and,
              where applicable, their guardian.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">2. Description of Service</h2>
            <p className="text-muted-foreground mb-3">
              Aperti is an educational management platform designed for IGCSE and IB tutors and their
              students. The Platform provides:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Lesson planning, timetable management, and course content tools</li>
              <li>Attendance tracking via QR code scanning and manual entry</li>
              <li>Homework assignment, submission, and AI-assisted grading</li>
              <li>Student analytics, progress reporting, and risk identification</li>
              <li>AI-powered learning tools (The Mentor, SnapGrade, TutorCraft, Flashcards)</li>
              <li>Parent and guardian monitoring portals</li>
              <li>Examination management and question bank tools</li>
              <li>Live communication and messaging between teachers, students, and parents</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Features are subject to change as the Platform evolves. We will endeavour to give
              30 days' prior notice for material removals of features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">3. Account Registration and Security</h2>
            <p className="text-muted-foreground mb-3">
              Accounts may be created by administrators or self-registered by teachers and students
              where permitted. You agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your password and not share credentials with others.</li>
              <li>Notify your administrator or contact us immediately of any unauthorised access.</li>
              <li>Accept responsibility for all activity that occurs under your account.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Users must be at least 13 years of age to register independently. Students under 13
              may use the Platform only under the supervision and with the consent of a parent,
              guardian, or the educational institution administering their account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-3">You agree not to use the Platform to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Violate any applicable local, national, or international law or regulation.</li>
              <li>Upload, transmit, or distribute harmful, obscene, defamatory, or harassing content.</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or its servers.</li>
              <li>Interfere with or disrupt the integrity, performance, or security of the Platform.</li>
              <li>Scrape, harvest, or systematically collect data from the Platform without written consent.</li>
              <li>Use AI features to generate plagiarised, academically dishonest, or deceptive content.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Platform's software.</li>
              <li>Use the Platform for commercial purposes not authorised by us, including reselling access.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Violations may result in immediate suspension or termination of your account and,
              where applicable, referral to relevant authorities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">5. Educational Disclaimer — AI Features</h2>
            <p className="text-muted-foreground">
              AI-powered features within the Platform — including The Mentor, SnapGrade, TutorCraft,
              and AI-generated revision plans — are provided as educational support tools only.
              They do not constitute professional tutoring, academic counselling, or psychological
              advice. AI-generated marks, feedback, or recommendations may contain errors and should
              always be reviewed by a qualified teacher. Aperti expressly disclaims any responsibility
              for academic outcomes based solely on AI-generated output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">6. Intellectual Property</h2>
            <p className="text-muted-foreground mb-3">
              All software, design, branding, logos, and Platform infrastructure are the exclusive
              property of Aperti and its licensors, protected by applicable intellectual property laws.
            </p>
            <p className="text-muted-foreground">
              Content you create within the Platform — including lessons, homework assignments, exam
              questions, and course materials — remains your intellectual property. You grant Aperti
              a limited, non-exclusive, royalty-free licence to store, process, and display your
              content solely for the purpose of providing the Service. This licence terminates when
              your account is closed and your data is deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">7. Subscriptions and Billing</h2>
            <p className="text-muted-foreground mb-3">
              Access to premium features requires an active paid subscription. The following terms
              apply to all paid plans:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong className="text-foreground">Billing:</strong> Fees are charged monthly at the rate displayed on your active plan at time of subscription.</li>
              <li><strong className="text-foreground">Payment:</strong> Currently processed via InstaPay. You must submit a valid payment reference within 24 hours of subscribing. Access is granted upon manual verification by an administrator.</li>
              <li><strong className="text-foreground">Price changes:</strong> We will give at least 30 days' notice of any price increases. Continued use after the notice period constitutes acceptance of the new price.</li>
              <li><strong className="text-foreground">Cancellation:</strong> You may cancel your subscription at any time. Your access continues until the end of the current billing period. No pro-rata refunds are issued for unused days.</li>
              <li><strong className="text-foreground">Refunds:</strong> Refunds are not provided for subscription fees already paid, except where required by applicable Egyptian consumer protection law.</li>
              <li><strong className="text-foreground">Free tier:</strong> A free plan is available with limited features and no time restriction. We reserve the right to modify free tier limitations with 15 days' notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">8. Data and Privacy</h2>
            <p className="text-muted-foreground">
              We take the privacy of all users — particularly students — with the utmost seriousness.
              Our collection, use, and protection of your personal data is governed by our{" "}
              <Link href="/privacy" className="text-primary underline hover:opacity-80">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. Educational institutions using
              the Platform are responsible for obtaining appropriate parental or guardian consents
              before creating accounts for students under 18 in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">9. Service Availability</h2>
            <p className="text-muted-foreground">
              We aim for high availability but do not guarantee uninterrupted or error-free operation.
              Scheduled maintenance will be communicated in advance where possible. We are not liable
              for any loss caused by temporary unavailability of the Platform, including during
              examinations or assessments scheduled through the Platform. We recommend that teachers
              maintain offline backup procedures for critical assessments.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">10. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-3">
              To the fullest extent permitted by applicable law:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>The Platform is provided "as is" and "as available" without warranties of any kind, express or implied.</li>
              <li>Aperti shall not be liable for any indirect, incidental, special, punitive, or consequential damages, including loss of data, loss of revenue, or loss of educational opportunity.</li>
              <li><strong className="text-foreground">Aggregate liability cap:</strong> Our total aggregate liability for any claim arising out of or related to your use of the Platform shall not exceed the total fees you paid to us in the 12 months preceding the event giving rise to the claim, or EGP 500, whichever is greater.</li>
              <li>This limitation applies even if we have been advised of the possibility of such damages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">11. Termination</h2>
            <p className="text-muted-foreground mb-3">
              <strong className="text-foreground">By you:</strong> You may close your account at any time
              through account settings or by contacting us at{" "}
              <a href="mailto:legal@aperti.ai" className="text-primary underline hover:opacity-80">legal@aperti.ai</a>.
              Upon closure, your data will be retained for 30 days to allow for data export, then
              permanently deleted in accordance with our Privacy Policy.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">By us:</strong> We may suspend or terminate your access
              immediately upon a material breach of these Terms, or with 30 days' notice for any other
              reason. Upon termination for breach, your right to use the Platform ceases immediately.
              We will make reasonable efforts to allow you to export your data before termination
              unless the termination is due to illegal activity or fraud.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">12. Governing Law and Disputes</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the
              Arab Republic of Egypt, including the Egyptian Consumer Protection Law (Law No. 181 of 2018)
              and applicable provisions of the Egyptian Civil Code. Any disputes arising under these
              Terms shall be subject to the exclusive jurisdiction of the courts of Cairo, Egypt.
              Before initiating legal proceedings, both parties agree to attempt good-faith resolution
              through written notice and a 30-day negotiation period.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">13. Changes to These Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms at any time. For material changes — those affecting your
              rights, obligations, or payment terms — we will provide at least 15 days' notice via
              the Platform or email before the changes take effect. Minor updates (corrections,
              clarifications) take effect immediately upon posting. Continued use of the Platform
              after the effective date constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">14. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, please contact us at:{" "}
              <a href="mailto:legal@aperti.ai" className="text-primary underline hover:opacity-80">legal@aperti.ai</a>
              {" "}or visit our{" "}
              <Link href="/contact" className="text-primary underline hover:opacity-80">contact page</Link>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors text-foreground font-medium">Terms of Service</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <span>·</span>
          <a href="mailto:legal@aperti.ai" className="hover:text-foreground transition-colors">legal@aperti.ai</a>
        </div>
      </footer>
    </div>
  );
}
