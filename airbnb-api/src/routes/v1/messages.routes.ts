import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
    getConversations,
    getMessages,
    sendMessage,
    markRead,
} from "../../controllers/messages.controller.js";

const router = Router();

router.use(authenticate); // all message routes require auth

router.get("/conversations", getConversations);
router.get("/:partnerId", getMessages);
router.post("/", sendMessage);
router.patch("/:id/read", markRead);

export default router;
