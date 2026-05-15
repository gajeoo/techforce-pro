import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import employeesRouter from "./employees";
import customersRouter from "./customers";
import jobsRouter from "./jobs";
import openJobsRouter from "./open-jobs";
import schedulesRouter from "./schedules";
import timeOffRouter from "./timeoff";
import invoicesRouter from "./invoices";
import dashboardRouter from "./dashboard";
import recurringSchedulesRouter from "./recurring-schedules";
import invoiceScanRouter from "./invoice-scan";
import appointmentsRouter from "./appointments";
import openaiRouter from "./openai-chat";
import tasksRouter from "./tasks";
import serviceRequestsRouter from "./service-requests";
import vansRouter from "./vans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(dashboardRouter);
router.use(employeesRouter);
router.use(customersRouter);
// open-jobs and returns/reschedules BEFORE /:id
router.use(openJobsRouter);
router.use(jobsRouter);
router.use(schedulesRouter);
router.use(timeOffRouter);
router.use(invoicesRouter);
router.use(recurringSchedulesRouter);
router.use(invoiceScanRouter);
router.use(appointmentsRouter);
router.use(openaiRouter);
router.use(tasksRouter);
router.use(serviceRequestsRouter);
// vans/locations BEFORE vans/:id
router.use(vansRouter);

export default router;
