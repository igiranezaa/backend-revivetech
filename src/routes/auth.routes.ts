import { Router } from "express";
import { register, verifyOtp, login, requestPasswordReset, resetPassword } from "../controller/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

export default router;
