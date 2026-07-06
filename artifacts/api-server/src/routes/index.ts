import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transfersRouter from "./transfers";
import agentsRouter from "./agents";
import messagesRouter from "./messages";
import scanRouter from "./scan";
import backupRouter from "./backup";
import accountsRouter from "./accounts";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveTenant } from "../middlewares/resolveTenant";

const router: IRouter = Router();

router.use(healthRouter);
// Account routes act on the caller's real identity — mounted before resolveTenant.
router.use(requireAuth, accountsRouter);
router.use(requireAuth, resolveTenant, transfersRouter);
router.use(requireAuth, resolveTenant, agentsRouter);
router.use(requireAuth, resolveTenant, messagesRouter);
router.use(requireAuth, resolveTenant, scanRouter);
router.use(requireAuth, resolveTenant, backupRouter);

export default router;
