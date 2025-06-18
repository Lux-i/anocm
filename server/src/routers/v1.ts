// src/routers/v1.ts
import { Router } from "express";
import userRouter from "../routes/v1/user";
import chatRouter from "../routes/v1/chat";
import { createUserLimiter } from "../index";
const router = Router();

router.use("/user", createUserLimiter, userRouter());
router.use("/chat", chatRouter());

export default router;