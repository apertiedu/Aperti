export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-10">Last updated: 1 June 2026</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
          <p className="text-muted-foreground leading-relaxed">
            Aperti ("we", "us", "our") is committed to protecting the privacy of everyone who uses
            our platform — especially students. This Privacy Policy explains what data we collect,
            how we use it, how we protect it, and your rights regarding your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">We collect the following categories of information:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>
              <strong className="text-foreground">Account Information:</strong> Name, email address,
              role (admin, teacher, student, parent), and school affiliation.
            </li>
            <li>
              <strong className="text-foreground">Academic Data:</strong> Attendance records,
              homework submissions, exam scores, grades, and lesson progress.
            </li>
            <li>
              <strong className="text-foreground">Usage Data:</strong> Pages visited, features used,
              session durations, and device/browser information.
            </li>
            <li>
              <strong className="text-foreground">Communications:</strong> Messages sent through the
              platform's helpdesk or notification system.
            </li>
            <li>
              <strong className="text-foreground">AI Interactions:</strong> Queries submitted to
              The Mentor AI feature, used to improve response quality.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>To provide, maintain, and improve the Platform's features and services.</li>
            <li>To generate academic analytics, reports, and risk assessments for educators.</li>
            <li>To personalise the learning experience for students.</li>
            <li>To send important notifications about accounts, subscriptions, or platform updates.</li>
            <li>To detect and prevent fraudulent or unauthorised access.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Student Data and COPPA / FERPA Compliance</h2>
          <p className="text-muted-foreground leading-relaxed">
            We treat student data with the highest level of care. Student personal data is collected
            on behalf of and under the direction of the educational institution (the "school"). We do
            not sell, rent, or use student data for advertising purposes. Schools are responsible
            for obtaining appropriate parental consent before enrolling students under 13.
            We provide schools with tools to access, correct, and delete student records upon request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Data Sharing</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We do not sell your personal information. We may share data only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>
              <strong className="text-foreground">Within the school:</strong> Administrators and
              teachers can view student academic data relevant to their role.
            </li>
            <li>
              <strong className="text-foreground">Service providers:</strong> We use trusted
              third-party vendors (hosting, AI providers) under strict data processing agreements.
            </li>
            <li>
              <strong className="text-foreground">Legal requirements:</strong> We may disclose data
              if required by law or to protect the rights and safety of users.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement industry-standard security measures including encrypted data transmission
            (TLS), hashed password storage, role-based access control, and audit logging. While we
            strive to protect your data, no system is completely immune to breaches, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain personal data for as long as the account is active or as needed to provide
            services. Schools may request deletion of student records at any time. Upon account
            termination, data is retained for 30 days before permanent deletion unless otherwise
            required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data ("right to be forgotten").</li>
            <li>Object to or restrict certain processing of your data.</li>
            <li>Request a portable copy of your data.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            To exercise any of these rights, please contact your school administrator or reach us
            via our <a href="/contact" className="text-primary underline hover:opacity-80">contact page</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use session cookies to keep you signed in and functional cookies to remember your
            preferences. We do not use third-party advertising cookies. You can control cookie
            behaviour through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes via the Platform or email. Continued use of the Platform after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            For privacy-related questions or requests, please visit our{" "}
            <a href="/contact" className="text-primary underline hover:opacity-80">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
