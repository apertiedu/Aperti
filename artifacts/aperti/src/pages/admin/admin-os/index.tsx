import { Switch, Route } from "wouter";
import AdminLayout from "./AdminLayout";
import Dashboard from "./Dashboard";
import UsersPage from "./UsersPage";
import OrgsPage from "./OrgsPage";
import RolesPage from "./RolesPage";
import SubscriptionsPage from "./SubscriptionsPage";
import PaymentsPage from "./PaymentsPage";
import AnalyticsPage from "./AnalyticsPage";
import HealthPage from "./HealthPage";
import FeaturesPage from "./FeaturesPage";
import AuditPage from "./AuditPage";
import SecurityPage from "./SecurityPage";
import SupportPage from "./SupportPage";
import KBPage from "./KBPage";
import CompliancePage from "./CompliancePage";
import CoursesAdminPage from "./CoursesAdminPage";
import QueuePage from "./QueuePage";
import PerformancePage from "./PerformancePage";
import DocsPage from "./DocsPage";
import BackupsPage from "./BackupsPage";
import EnrollmentsPage from "./EnrollmentsPage";
import AssistantsPage from "./AssistantsPage";
import FeaturesMatrixPage from "./FeaturesMatrixPage";
import ConflictPage from "./ConflictPage";
import IntegrityPage from "./IntegrityPage";
import UserAccessPage from "./UserAccessPage";
import FeatureRegistryPage from "./FeatureRegistryPage";
import WaitlistPage from "./WaitlistPage";
import BetaPage from "./BetaPage";
import ReleaseNotesAdminPage from "./ReleaseNotesAdminPage";
import RoadmapAdminPage from "./RoadmapAdminPage";
import LandingCMSPage from "./LandingCMSPage";
import TestimonialsAdminPage from "./TestimonialsAdminPage";
import FAQsAdminPage from "./FAQsAdminPage";
import EventsAdminPage from "./EventsAdminPage";
import DemoBrandingPage from "./DemoBrandingPage";
import CampaignsPage from "./CampaignsPage";
import GrowthDashboardPage from "./GrowthDashboardPage";
import ConversionAnalyticsPage from "./ConversionAnalyticsPage";
import PlatformStatusPage from "./PlatformStatusPage";
import AnnouncementsAdminPage from "./AnnouncementsAdminPage";
import FeatureAdoptionPage from "./FeatureAdoptionPage";
import QABugsPage from "./QABugsPage";
import QATestCasesPage from "./QATestCasesPage";
import QATestRunsPage from "./QATestRunsPage";
import QAReadinessPage from "./QAReadinessPage";
import QASecurityScanPage from "./QASecurityScanPage";

export default function AdminOS() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/os" component={Dashboard} />

        {/* Users & Access */}
        <Route path="/admin/os/users" component={UsersPage} />
        <Route path="/admin/os/user-access" component={UserAccessPage} />
        <Route path="/admin/os/assistants" component={AssistantsPage} />

        {/* Governance */}
        <Route path="/admin/os/roles" component={RolesPage} />
        <Route path="/admin/os/enrollments" component={EnrollmentsPage} />
        <Route path="/admin/os/features-matrix" component={FeaturesMatrixPage} />
        <Route path="/admin/os/conflicts" component={ConflictPage} />
        <Route path="/admin/os/integrity" component={IntegrityPage} />

        {/* Platform */}
        <Route path="/admin/os/organizations" component={OrgsPage} />
        <Route path="/admin/os/courses" component={CoursesAdminPage} />
        <Route path="/admin/os/subscriptions" component={SubscriptionsPage} />
        <Route path="/admin/os/plans" component={SubscriptionsPage} />
        <Route path="/admin/os/payments" component={PaymentsPage} />

        {/* Operations */}
        <Route path="/admin/os/analytics" component={AnalyticsPage} />
        <Route path="/admin/os/health" component={HealthPage} />
        <Route path="/admin/os/features" component={FeaturesPage} />
        <Route path="/admin/os/audit" component={AuditPage} />
        <Route path="/admin/os/security" component={SecurityPage} />
        <Route path="/admin/os/tickets" component={SupportPage} />
        <Route path="/admin/os/kb" component={KBPage} />
        <Route path="/admin/os/compliance" component={CompliancePage} />
        <Route path="/admin/os/backups" component={BackupsPage} />
        <Route path="/admin/os/queue" component={QueuePage} />
        <Route path="/admin/os/performance" component={PerformancePage} />
        <Route path="/admin/os/docs" component={DocsPage} />
        <Route path="/admin/os/settings" component={CompliancePage} />
        <Route path="/admin/os/moderation" component={UsersPage} />

        {/* Phase 12 — Growth & Launch */}
        <Route path="/admin/os/growth" component={GrowthDashboardPage} />
        <Route path="/admin/os/feature-registry" component={FeatureRegistryPage} />
        <Route path="/admin/os/waitlists" component={WaitlistPage} />
        <Route path="/admin/os/beta" component={BetaPage} />
        <Route path="/admin/os/release-notes" component={ReleaseNotesAdminPage} />
        <Route path="/admin/os/roadmap-admin" component={RoadmapAdminPage} />
        <Route path="/admin/os/landing-cms" component={LandingCMSPage} />
        <Route path="/admin/os/testimonials" component={TestimonialsAdminPage} />
        <Route path="/admin/os/faqs" component={FAQsAdminPage} />
        <Route path="/admin/os/events" component={EventsAdminPage} />
        <Route path="/admin/os/demo-branding" component={DemoBrandingPage} />
        <Route path="/admin/os/campaigns" component={CampaignsPage} />
        <Route path="/admin/os/conversion" component={ConversionAnalyticsPage} />
        <Route path="/admin/os/platform-status" component={PlatformStatusPage} />
        <Route path="/admin/os/announcements" component={AnnouncementsAdminPage} />
        <Route path="/admin/os/adoption" component={FeatureAdoptionPage} />

        {/* Phase 13 — Quality Assurance, Testing & Launch Readiness */}
        <Route path="/admin/os/qa/bugs" component={QABugsPage} />
        <Route path="/admin/os/qa/test-cases" component={QATestCasesPage} />
        <Route path="/admin/os/qa/test-runs" component={QATestRunsPage} />
        <Route path="/admin/os/qa/readiness" component={QAReadinessPage} />
        <Route path="/admin/os/qa/security" component={QASecurityScanPage} />

        <Route component={Dashboard} />
      </Switch>
    </AdminLayout>
  );
}
