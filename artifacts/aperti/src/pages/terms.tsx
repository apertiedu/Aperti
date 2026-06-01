export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-10">Last updated: 1 June 2026</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using Aperti ("the Platform"), you agree to be bound by these Terms of
            Service and our Privacy Policy. If you do not agree with any part of these terms, you
            may not use the Platform. These terms apply to all users including administrators,
            teachers, students, and parents.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
          <p className="text-muted-foreground leading-relaxed">
            Aperti is an educational management platform providing tools for lesson planning,
            attendance tracking, homework management, student analytics, AI-assisted learning,
            live classes, and educator-student-parent communication. Features are subject to change
            as the platform evolves.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Accounts are created by school administrators. You are responsible for maintaining the
            confidentiality of your credentials and for all activity that occurs under your account.
            You must notify your administrator immediately of any unauthorised use or security breach.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Accounts may only be used by the individual to whom they are assigned. Sharing
            credentials with others is prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Use the Platform for any unlawful purpose or in violation of applicable laws.</li>
            <li>Upload or transmit harmful, offensive, or inappropriate content.</li>
            <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure.</li>
            <li>Interfere with or disrupt the integrity or performance of the Platform.</li>
            <li>Scrape, harvest, or collect data from the Platform without prior written consent.</li>
            <li>Use AI features to generate plagiarised or academically dishonest content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            All content, features, and functionality — including software, design, logos, and text
            — are the exclusive property of Aperti and its licensors. Content you create within the
            Platform (lessons, homework, exam questions) remains your intellectual property, and you
            grant Aperti a non-exclusive licence to store and display it solely to provide the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Subscription and Billing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Access to premium features requires an active subscription. Fees are billed per student
            per month as shown on the pricing page. FlexSeats are charged at the rate specified in
            your active plan. We reserve the right to modify pricing with 30 days' prior notice. No
            refunds are issued for partial months unless required by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Data and Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We take the privacy of students seriously, especially minors. Please review our{" "}
            <a href="/privacy" className="text-primary underline hover:opacity-80">Privacy Policy</a>{" "}
            for details on how we collect, use, and protect your data. Schools are responsible for
            obtaining appropriate parental or guardian consents before creating student accounts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Disclaimers and Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Platform is provided "as is" without warranty of any kind. We do not guarantee
            uninterrupted or error-free operation. To the fullest extent permitted by law, Aperti
            shall not be liable for any indirect, incidental, special, or consequential damages
            arising from your use of the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may suspend or terminate your access at any time for breach of these Terms or at
            our discretion. Upon termination, your right to use the Platform ceases immediately.
            Data export requests must be submitted before account closure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms shall be governed by and construed in accordance with the applicable laws
            of the jurisdiction in which Aperti operates. Disputes shall be resolved through binding
            arbitration or in the courts of the relevant jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Changes to These Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update these Terms from time to time. We will notify you of material changes
            via the Platform or by email. Continued use after changes are posted constitutes
            your acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For questions about these Terms, visit our{" "}
            <a href="/contact" className="text-primary underline hover:opacity-80">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
