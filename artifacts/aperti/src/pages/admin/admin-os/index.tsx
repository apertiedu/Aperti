import { Switch, Route, useLocation } from "wouter";
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

export default function AdminOS() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/os" component={Dashboard} />
        <Route path="/admin/os/users" component={UsersPage} />
        <Route path="/admin/os/organizations" component={OrgsPage} />
        <Route path="/admin/os/roles" component={RolesPage} />
        <Route path="/admin/os/courses" component={CoursesAdminPage} />
        <Route path="/admin/os/subscriptions" component={SubscriptionsPage} />
        <Route path="/admin/os/plans" component={SubscriptionsPage} />
        <Route path="/admin/os/payments" component={PaymentsPage} />
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
        <Route path="/admin/os/enrollments" component={SubscriptionsPage} />
        <Route component={Dashboard} />
      </Switch>
    </AdminLayout>
  );
}
