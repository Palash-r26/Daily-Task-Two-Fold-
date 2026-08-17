import { Router, type IRouter } from "express";
import healthRouter from "./health";
import importantUpdatesRouter from "./important-updates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(importantUpdatesRouter);

export default router;
