import type { NextFunction, Response } from "express";
import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

const p = (v: unknown): string =>
    Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");

/** GET /messages/conversations */
export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
        const uid = req.userId;

        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: uid }, { receiverId: uid }] },
            orderBy: { createdAt: "desc" },
            include: {
                sender: { select: { id: true, name: true, avatar: true, role: true } },
                receiver: { select: { id: true, name: true, avatar: true, role: true } },
                booking: { select: { id: true, listing: { select: { title: true } } } },
            },
        });

        const seen = new Set<string>();
        const conversations = messages
            .filter((m) => {
                const pid = m.senderId === uid ? m.receiverId : m.senderId;
                if (seen.has(pid)) return false;
                seen.add(pid);
                return true;
            })
            .map((m) => {
                const partner = m.senderId === uid ? m.receiver : m.sender;
                const unread = messages.filter(
                    (msg) => msg.senderId === partner.id && msg.receiverId === uid && !msg.read
                ).length;
                return { partner, lastMessage: m, unread };
            });

        res.json(conversations);
    } catch (err) { next(err); }
};

/** GET /messages/:partnerId */
export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
        const uid = req.userId;
        const partnerId = p(req.params["partnerId"]);

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: uid, receiverId: partnerId },
                    { senderId: partnerId, receiverId: uid },
                ],
            },
            orderBy: { createdAt: "asc" },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
                receiver: { select: { id: true, name: true, avatar: true } },
            },
        });

        await prisma.message.updateMany({
            where: { senderId: partnerId, receiverId: uid, read: false },
            data: { read: true },
        });

        res.json(messages);
    } catch (err) { next(err); }
};

/** POST /messages */
export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
        const { receiverId, content, bookingId } = req.body as {
            receiverId?: string; content?: string; bookingId?: string;
        };

        if (!receiverId || !content?.trim()) {
            res.status(400).json({ message: "receiverId and content are required" }); return;
        }

        if (bookingId) {
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { listing: { select: { hostId: true } } },
            });
            if (!booking) { res.status(404).json({ message: "Booking not found" }); return; }
            const allowed = booking.guestId === req.userId || booking.listing.hostId === req.userId;
            if (!allowed) { res.status(403).json({ message: "Not part of this booking" }); return; }
        }

        const message = await prisma.message.create({
            data: {
                content: content.trim(),
                senderId: req.userId,
                receiverId,
                bookingId: bookingId ?? null,
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
                receiver: { select: { id: true, name: true, avatar: true } },
            },
        });

        res.status(201).json(message);
    } catch (err) { next(err); }
};

/** PATCH /messages/:id/read */
export const markRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
        const id = p(req.params["id"]);
        const msg = await prisma.message.findUnique({ where: { id } });
        if (!msg) { res.status(404).json({ message: "Message not found" }); return; }
        if (msg.receiverId !== req.userId) { res.status(403).json({ message: "Forbidden" }); return; }
        const updated = await prisma.message.update({ where: { id }, data: { read: true } });
        res.json(updated);
    } catch (err) { next(err); }
};
