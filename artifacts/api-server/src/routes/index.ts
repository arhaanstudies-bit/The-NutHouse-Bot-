import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import mediaRouter from "./media";
import broadcastsRouter from "./broadcasts";
import settingsRouter from "./settings";
import telegramRouter from "./telegram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(mediaRouter);
router.use(broadcastsRouter);
router.use(settingsRouter);
router.use(telegramRouter);

export default router;
