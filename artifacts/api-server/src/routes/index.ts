import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import sessionsRouter from "./sessions";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(studentsRouter);
router.use(sessionsRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);

export default router;
