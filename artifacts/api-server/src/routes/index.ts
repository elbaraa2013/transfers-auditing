import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transfersRouter from "./transfers";
import agentsRouter from "./agents";
import messagesRouter from "./messages";
import scanRouter from "./scan";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth, transfersRouter);
router.use(requireAuth, agentsRouter);
router.use(requireAuth, messagesRouter);
router.use(requireAuth, scanRouter);

export default router;
