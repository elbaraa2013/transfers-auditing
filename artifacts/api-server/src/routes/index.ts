import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transfersRouter from "./transfers";
import agentsRouter from "./agents";
import messagesRouter from "./messages";
import scanRouter from "./scan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transfersRouter);
router.use(agentsRouter);
router.use(messagesRouter);
router.use(scanRouter);

export default router;
