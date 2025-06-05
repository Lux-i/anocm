// src/routers/v1.ts
import { Router } from "express";
import userRouter from "../routes/v2/user";
import chatRouter from "../routes/v2/chat";
import { createUserLimiter } from "../index";
const router = Router();

router.use("/user", userRouter());
router.use("/chat", chatRouter());

export default router;