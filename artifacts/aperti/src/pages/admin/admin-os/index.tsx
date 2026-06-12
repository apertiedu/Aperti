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
import ContentGovernancePage from "./ContentGovernancePage";
import AiUsagePage from "./AiUsagePage";
import LaunchAuditPage from "./LaunchAuditPage";
// Phase 19 — Founder Control Center
import FounderControlPage from "./FounderControlPage";
import FounderRevenuePage from "./FounderRevenuePage";
import FounderGrowthPage from "./FounderGrowthPage";
import ContentQualityPage from "./ContentQualityPage";
import AiCostsPage from "./AiCostsPage";
import NotificationRulesPage from "./NotificationRulesPage";
import FounderAlertsPage from "./FounderAlertsPage";
import LaunchCommandPage from "./LaunchCommandPage";
import ProblemReportsPage from "./ProblemReportsPage";
import LaunchBlockersPage from "./LaunchBlockersPage";
import LaunchCertificationPage from "./LaunchCertificationPage";
// Phase 30 — Error Intelligence & Learning Efficiency
import ErrorIntelligencePage from "./ErrorIntelligencePage";
import LearningEfficiencyPage from "./LearningEfficiencyPage";
import AiContentValidationPage from "./AiContentValidationPage";
import ResourceRelationshipPage from "./ResourceRelationshipPage";
// Phase 32 — Zero-Defect Initiative
import RouteHealthPage from "./RouteHealthPage";
import LaunchDashboardPage from "./LaunchDashboardPage";
import PlatformConfigPage from "./PlatformConfigPage";
// Phase 32 Intelligence — Stability, Slow Queries, Friction, Weekly Audit
import StabilityScorePage from "./StabilityScorePage";
import SlowQueriesPage from "./SlowQueriesPage";
import FrictionAnalyticsPage from "./FrictionAnalyticsPage";
import WeeklyAuditPage from "./WeeklyAuditPage";
import NoMockDataPage from "./NoMockDataPage";
// Phase 33 — Platform Perfection
import DBHealthPage from "./DBHealthPage";
import AnalyticsExtendedPage from "./AnalyticsExtendedPage";
import ErrorLogsPage from "./ErrorLogsPage";

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

        {/* Phase 14 — Trust & Content Governance */}
        <Route path="/admin/os/content-governance" component={ContentGovernancePage} />

        {/* Phase 18 — Enterprise Readiness & Governance */}
        <Route path="/admin/os/ai-usage" component={AiUsagePage} />
        <Route path="/admin/os/launch-audit" component={LaunchAuditPage} />

        {/* Phase 19 — Founder Control Center & Operational Layer */}
        <Route path="/admin/os/founder" component={FounderControlPage} />
        <Route path="/admin/os/founder-revenue" component={FounderRevenuePage} />
        <Route path="/admin/os/founder-growth" component={FounderGrowthPage} />
        <Route path="/admin/os/content-quality" component={ContentQualityPage} />
        <Route path="/admin/os/ai-costs" component={AiCostsPage} />
        <Route path="/admin/os/notification-rules" component={NotificationRulesPage} />
        <Route path="/admin/os/founder-alerts" component={FounderAlertsPage} />
        <Route path="/admin/os/launch-command" component={LaunchCommandPage} />
        <Route path="/admin/os/releases" component={ReleaseNotesAdminPage} />

        {/* Phase 24 — Production Hardening */}
        <Route path="/admin/os/problem-reports" component={ProblemReportsPage} />
        <Route path="/admin/os/launch-blockers" component={LaunchBlockersPage} />
        <Route path="/admin/os/launch-certification" component={LaunchCertificationPage} />

        {/* Phase 30 — Error Intelligence & Production Readiness */}
        <Route path="/admin/os/error-intelligence" component={ErrorIntelligencePage} />
        <Route path="/admin/os/learning-efficiency" component={LearningEfficiencyPage} />
        <Route path="/admin/os/ai-content-validation" component={AiContentValidationPage} />
        <Route path="/admin/os/resource-relationships" component={ResourceRelationshipPage} />

        {/* Phase 32 — Zero-Defect Initiative */}
        <Route path="/admin/os/route-health" component={RouteHealthPage} />
        <Route path="/admin/os/launch-dashboard" component={LaunchDashboardPage} />
        <Route path="/admin/os/platform-config" component={PlatformConfigPage} />

        {/* Phase 32 Intelligence — Stability, Slow Queries, Friction, Weekly Audit */}
        <Route path="/admin/os/stability-score" component={StabilityScorePage} />
        <Route path="/admin/os/slow-queries" component={SlowQueriesPage} />
        <Route path="/admin/os/friction-analytics" component={FrictionAnalyticsPage} />
        <Route path="/admin/os/weekly-audit" component={WeeklyAuditPage} />
        <Route path="/admin/os/no-mock-data" component={NoMockDataPage} />

        {/* Phase 33 — Platform Perfection */}
        <Route path="/admin/os/db-health" component={DBHealthPage} />
        <Route path="/admin/os/analytics-extended" component={AnalyticsExtendedPage} />
        <Route path="/admin/os/error-logs" component={ErrorLogsPage} />

        <Route component={Dashboard} />
      </Switch>
    </AdminLayout>
  );
}
