import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountsRouter from "./accounts";
import subjectsRouter from "./subjects";
import studentsRouter from "./students";
import sessionsRouter from "./sessions";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";
import examsRouter from "./exams";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(accountsRouter);
router.use(subjectsRouter);
router.use(studentsRouter);
router.use(sessionsRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);
router.use(examsRouter);
router.use(analyticsRouter);

export default router;
