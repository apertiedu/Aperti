import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import changePasswordRouter from "./change-password";
import accountsRouter from "./accounts";
import subjectsRouter from "./subjects";
import { studentsRouter } from "./students";
import sessionsRouter from "./sessions";
import { attendanceRouter } from "./attendance";
import { dashboardRouter } from "./dashboard";
import examsRouter from "./exams";
import { analyticsRouter } from "./analytics";
import notificationsRouter from "./notifications";
import { questionBankRouter } from "./question-bank";
import studentProfileRouter from "./student-profile";
import { homeworkRouter } from "./homework";
import resourcesRouter from "./resources";
import studentPortalRouter from "./student-portal";
import reportsRouter from "./reports";
import paymentsRouter from "./payments";
import recordingsRoutesRouter from "./recordings-routes";
import publicRouter from "./public";
import adminSettingsRouter from "./admin-settings";
import { flashcardsRouter } from "./flashcards";
import centersRouter from "./centers";
import trialsRouter from "./trials";
import { pastPapersRouter } from "./past-papers";
import examGeneratorRouter from "./exam-generator";
import goalsRouter from "./goals";
import achievementsRouter from "./achievements";
import riskEngineRouter from "./risk-engine";
import onlineExamsRouter from "./online-exams";
import inventoryRouter from "./inventory";
import tutorialRouter from "./tutorial";
import timetableRouter from "./timetable";
import calendarRouter from "./calendar";
import gradebookRouter from "./gradebook";
import notifyBroadcastRouter from "./notify-broadcast";
import { lessonsRouter } from "./lessons";
import { subscriptionsRouter } from "./subscriptions";
import { mentorRouter } from "./mentor";
import { revisitRouter } from "./revisit";
import { ascendRouter } from "./ascend";
import { echoEvolveRouter } from "./echo-evolve";
import absenceNotifyRouter from "./absence-notify";
import { assistantsRouter } from "./assistants";
import { couponsRouter } from "./coupons";
import { landingSettingsRouter } from "./landing-settings";
import { teacherVerificationRouter } from "./teacher-verification";
import { workspaceRouter } from "./workspace";
import { onboardingRouter } from "./onboarding";
import { settingsRouter } from "./settings";
import { semanticSearchRouter } from "./semantic-search";
import { autopilotRouter } from "./autopilot";
import { teacherCoursesRouter } from "./teacher-courses";
import { coursesRouter } from "./courses";
import { rubricsRouter } from "./rubrics";
import { messagesRouter } from "./messages";
import { tutorcraftRouter } from "./tutorcraft";
import { classforgeRouter } from "./classforge";
import studentFeedRouter from "./student-feed";
import focusCoachRouter from "./focus-coach";
import echoProfileRouter from "./echo-profile";
import peakRankingsRouter from "./peak-rankings";
import studyGroupsRouter from "./study-groups";
import studentMessagesThreadedRouter from "./student-messages-threaded";
import studentCalendarRouter from "./student-calendar";
import snapgradeRouter from "./snapgrade";
import trialVaultRouter from "./trial-vault";
import examVaultRouter from "./exam-vault";
import studentAnalyticsRouter from "./student-analytics";
import studentHomeSummaryRouter from "./student-home-summary";
import aiStatusRouter from "./ai-status";
import safetyRouter from "./safety";
import { weaveRouter } from "./weave";
import { coremindRouter } from "./coremind";
import { misconceptionsRouter } from "./misconceptions";
import { gradingRouter } from "./grading";
import { coremindAnalyticsRouter } from "./coremind-analytics";
import { parentAiRouter } from "./parent-ai";
import { parentRouter } from "./parent";
import { parentDashboardRouter } from "./parent-dashboard";
import { parentPhase4Router } from "./parent-phase4";
import { assessmentHubRouter } from "./assessment-hub";
import { examSessionRouter } from "./exam-session";
import { assessmentGradingRouter } from "./assessment-grading";
import { certificationsRouter } from "./certifications";
import { assessmentExtrasRouter } from "./assessment-extras";
import { commThreadsRouter } from "./comm-threads";
import { commRoomsRouter } from "./comm-rooms";
import { commSupportRouter } from "./comm-support";
import { learningExperienceRouter } from "./learning-experience";
import { qaRouter } from "./qa";
import { phase14Router } from "./phase14";
import { contentEcosystemRouter } from "./content-ecosystem";
import { commerceRouter } from "./commerce";
import { revisionNotesRouter } from "./revision-notes";
import { mobileRouter } from "./mobile";
import { adminAuditRouter } from "./admin-audit";
import { adminHealthRouter } from "./admin-health";
import { adminDocsRouter } from "./admin-docs";
import { adminKbRouter } from "./admin-kb";
import { adminComplianceRouter } from "./admin-compliance";
import { adminLaunchAuditRouter } from "./admin-launch-audit";
import { i18nRouter } from "./i18n";
import { userExportRouter } from "./user-export";
import { contentCraftRouter } from "./content-craft";
import { contentcraftStudioRouter } from "./contentcraft-studio";
import { problemReportsRouter } from "./problem-reports";
import { phase25Router } from "./phase25";
import { aiGatewayRouter } from "./ai-gateway";
import { aiStudioRouter } from "./ai-studio";
import { adminDebugRouter } from "./admin-debug";
import businessOpsRouter from "./business-ops";
import { contentCalendarRouter } from "./content-calendar";
import { aiGovernanceRouter } from "./ai-governance";
import { aiExamGeneratorRouter } from "./ai-exam-generator";
import { weaknessDetectionRouter } from "./weakness-detection";
import { anomalyDetectionRouter } from "./anomaly-detection";
import { billingInvoicesRouter } from "./billing-invoices";
import { disputesRouter } from "./disputes";
import { aiAnomalyRouter } from "./ai-anomaly";
import { architectureRouter } from "./architecture";
import { migrationSafetyRouter } from "./migration-safety";
import { deploymentReadinessRouter } from "./deployment-readiness";
import { loadSimulationRouter } from "./load-simulation";
import { securePaymentsRouter } from "./secure-payments";
import { secureDiscountsRouter } from "./secure-discounts";
import { assistantAssignmentsRouter } from "./assistant-assignments";
import { subscriptionEngineRouter } from "./subscription-engine";
import { subscriptionAnalyticsRouter } from "./subscription-analytics";
import { planChangeRouter } from "./plan-change";
import { billingEventsRouter } from "./billing-events";
import { paymentRecoveryRouter } from "./payment-recovery";
import { pricingExperimentsRouter } from "./pricing-experiments";
import { roleBasedPlansRouter } from "./role-based-plans";
import { gradeForecastPdfRouter } from "./grade-forecast-pdf";
import { referralRouter } from "./referral";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use(changePasswordRouter);
router.use(healthRouter);
router.use(accountsRouter);
router.use(subjectsRouter);
router.use("/students", studentsRouter);
router.use(sessionsRouter);
router.use("/attendance", attendanceRouter);
router.use("/dashboard", dashboardRouter);
router.use(examsRouter);
router.use(analyticsRouter);
router.use(notificationsRouter);
router.use("/question-bank", questionBankRouter);
router.use(studentProfileRouter);
router.use("/homework", homeworkRouter);
router.use(resourcesRouter);
router.use(studentPortalRouter);
router.use(reportsRouter);
router.use(paymentsRouter);
router.use(recordingsRoutesRouter);
router.use(publicRouter);
router.use(adminSettingsRouter);
router.use("/flashcards", flashcardsRouter);
router.use(centersRouter);
router.use(trialsRouter);
router.use("/past-papers", pastPapersRouter);
router.use(examGeneratorRouter);
router.use(goalsRouter);
router.use(achievementsRouter);
router.use(riskEngineRouter);
router.use(onlineExamsRouter);
router.use(inventoryRouter);
router.use(tutorialRouter);
router.use(timetableRouter);
router.use(calendarRouter);
router.use(gradebookRouter);
router.use(notifyBroadcastRouter);
router.use("/lessons", lessonsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/mentor", mentorRouter);
router.use("/revisit", revisitRouter);
router.use("/ascend", ascendRouter);
router.use("/echo-evolve", echoEvolveRouter);
router.use("/absence-notify", absenceNotifyRouter);
router.use("/assistants", assistantsRouter);
router.use("/coupons", couponsRouter);
router.use(landingSettingsRouter);
router.use("/teacher-verification", teacherVerificationRouter);
router.use("/workspace", workspaceRouter);
router.use("/onboarding", onboardingRouter);
router.use("/settings", settingsRouter);
router.use("/search", semanticSearchRouter);
router.use("/autopilot", autopilotRouter);
router.use("/courses", coursesRouter);
router.use(teacherCoursesRouter);
router.use(rubricsRouter);
router.use(messagesRouter);
router.use(tutorcraftRouter);
router.use(classforgeRouter);
router.use(studentFeedRouter);
router.use(focusCoachRouter);
router.use(echoProfileRouter);
router.use(peakRankingsRouter);
router.use(studyGroupsRouter);
router.use(studentCalendarRouter);
router.use(snapgradeRouter);
router.use(trialVaultRouter);
router.use(examVaultRouter);
router.use(studentAnalyticsRouter);
router.use(studentHomeSummaryRouter);
router.use(aiStatusRouter);
router.use(safetyRouter);
router.use("/weave", weaveRouter);
router.use("/coremind", coremindRouter);
router.use(misconceptionsRouter);
router.use("/grading", gradingRouter);
router.use("/coremind", coremindAnalyticsRouter);
router.use(parentAiRouter);
router.use("/parent", parentRouter);
router.use("/parent", parentDashboardRouter);
router.use("/parent", parentPhase4Router);

// Phase 7 — Communication, Collaboration & Community Ecosystem
// commThreadsRouter must come BEFORE studentMessagesThreadedRouter to avoid
// the student-only guard shadowing teacher/admin access to /messages/threads
router.use(commThreadsRouter);
router.use(studentMessagesThreadedRouter);
router.use(commRoomsRouter);
router.use(commSupportRouter);

// Phase 8 — Learning Experience, Content Delivery & Adaptive Personalization
router.use(learningExperienceRouter);

// Phase 6 — Assessment, Examination & Certification Ecosystem
router.use(assessmentHubRouter);
router.use("/exam-session", examSessionRouter);
router.use(assessmentGradingRouter);
router.use(certificationsRouter);
router.use(assessmentExtrasRouter);

// Phase 13 — Quality Assurance, Validation, Testing & Launch Readiness
router.use(qaRouter);

// Phase 14 — Platform Authenticity, Trust & Content Governance
router.use(phase14Router);

// Phase 15 — Educational Content Ecosystem
router.use(contentEcosystemRouter);

// Phase 16 — Commercialization & Business Operations
router.use(commerceRouter);
router.use(revisionNotesRouter);

// Phase 17 — Mobile Ecosystem
router.use(mobileRouter);

// Phase 18 — Enterprise Readiness & Master Governance
router.use("/admin/audit-logs", adminAuditRouter);
router.use("/admin/health", adminHealthRouter);
router.use("/admin/docs-articles", adminDocsRouter);
router.use("/admin/kb", adminKbRouter);
router.use("/admin/compliance", adminComplianceRouter);
router.use("/admin/launch-audit", adminLaunchAuditRouter);
router.use(i18nRouter);
router.use(userExportRouter);
router.use("/content-craft", contentCraftRouter);
router.use("/contentcraft", contentcraftStudioRouter);

// Phase 24 — Production Hardening
router.use(problemReportsRouter);

// Phase 25 — Product Excellence
router.use(phase25Router);

// Phase 38 — AI Gateway & Admin Debug
router.use("/ai", aiGatewayRouter);
router.use("/ai-studio", aiStudioRouter);
router.use("/admin/debug", adminDebugRouter);

// Phase 15 — Business Operations & No-Code Admin Control Center
router.use(businessOpsRouter);

// Content Calendar
router.use(contentCalendarRouter);

// AI Governance v2
router.use("/ai-governance", aiGovernanceRouter);

// Phase 48 — AI Intelligence Platform
router.use(aiExamGeneratorRouter);
router.use("/weakness", weaknessDetectionRouter);
router.use("/shield", anomalyDetectionRouter);

router.use("/system", systemRouter);

router.use("/secure-payments", securePaymentsRouter);
router.use("/secure-discounts", secureDiscountsRouter);
router.use("/assistant-assignments", assistantAssignmentsRouter);

// Features 18–21 — Billing, Disputes, AI Financial Anomaly, Multi-school
router.use("/billing", billingInvoicesRouter);
router.use("/disputes", disputesRouter);
router.use("/ai-anomaly", aiAnomalyRouter);

// Subscription Engine — hardened FSM billing system
router.use("/sub-engine", subscriptionEngineRouter);

// Features 26–34 — Subscription billing intelligence layer
router.use("/sub-analytics", subscriptionAnalyticsRouter);
router.use("/plan-change", planChangeRouter);
router.use("/billing-events", billingEventsRouter);
router.use("/payment-recovery", paymentRecoveryRouter);
router.use("/pricing-experiments", pricingExperimentsRouter);
router.use("/role-plans", roleBasedPlansRouter);
router.use(gradeForecastPdfRouter);

// Features 22–25 — Architecture, Migration Safety, Deployment Readiness, Load Simulation
router.use("/architecture", architectureRouter);
router.use("/migration-safety", migrationSafetyRouter);
router.use("/deployment", deploymentReadinessRouter);
router.use("/load-sim", loadSimulationRouter);

router.use("/referrals", referralRouter);

export default router;

// Phase 11 governance router is registered in app.ts under /api/admin/governance
