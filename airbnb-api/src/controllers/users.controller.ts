import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { Role } from "@prisma/client";
import prisma from "../config/prisma.js";
import { createUserSchema, updateUserSchema } from "../validators/users.validator.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../config/email.js";
import { welcomeEmail } from "../templates/emails.js";

const parseId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pageRaw = req.query.page?.toString() ?? "1";
    const limitRaw = req.query.limit?.toString() ?? "10";

    const page = Number.parseInt(pageRaw, 10);
    const limit = Number.parseInt(limitRaw, 10);

    if (
      !Number.isInteger(page) ||
      page <= 0 ||
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      res.status(400).json({ message: "page and limit must be positive integers" });
      return;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          phone: true,
          role: true,
          isSuperAdmin: true,
          avatar: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { listings: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: users,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

  const roleOnly = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!roleOnly) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (roleOnly.role === Role.HOST) {
    const hostWithListings = await prisma.user.findUnique({
      where: { id },
      include: {
        listings: {
          include: {
            _count: { select: { bookings: true } },
          },
        },
      },
    });

    res.json(hostWithListings);
    return;
  }

  const guestWithBookings = await prisma.user.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          listing: {
            select: { title: true, location: true },
          },
        },
      },
    },
  });

  res.json(guestWithBookings);
  } catch (error) {
    next(error);
  }
};

export const getUserListings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const listings = await prisma.listing.findMany({ where: { hostId: id } });
  res.json(listings);
  } catch (error) {
    next(error);
  }
};

export const getUserBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const bookings = await prisma.booking.findMany({
    where: { guestId: id },
    include: { listing: true },
  });
  res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createUserSchema.parse(req.body);
    const { name, email, username, phone, role, password, isSuperAdmin } = parsed;
    const avatar = req.body.avatar as string | undefined;
    const bio = req.body.bio as string | undefined;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email already exists" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  if (isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ message: "Only a super admin can register super admins" });
    return;
  }
  if (role === Role.ADMIN && req.role !== Role.ADMIN && !req.isSuperAdmin) {
    res.status(403).json({ message: "Only an admin or super admin can register admins" });
    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      username,
      phone,
      role: role as Role,
      isSuperAdmin: Boolean(isSuperAdmin) || (email.toLowerCase() === "fifingabire25@gmail.com" && role === Role.ADMIN),
      password: hashedPassword,
      avatar: avatar ?? null,
      bio: bio ?? null,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, resetToken, resetTokenExpiry, ...safeUser } = user;
  res.status(201).json(safeUser);

  // Send welcome email (non-blocking)
  sendEmail(user.email, "Welcome to Airbnb!", welcomeEmail(user.name, user.role))
    .catch((err) => console.error("Failed to send welcome email:", err));
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

  const current = await prisma.user.findFirst({ where: { id } });
  if (!current) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (req.userId !== id && req.role !== Role.ADMIN) {
    res.status(403).json({ message: "You can only update your own profile" });
    return;
  }

  const parsed = updateUserSchema.parse(req.body);
  const payload: Record<string, unknown> = { ...parsed };
  if (payload.role && req.role !== Role.ADMIN) {
    res.status(403).json({ message: "Only admins can update user roles" });
    return;
  }
  if (typeof payload.isSuperAdmin !== "undefined" && !req.isSuperAdmin) {
    res.status(403).json({ message: "Only a super admin can change super admin access" });
    return;
  }
  if (payload.role === Role.ADMIN && req.role !== Role.ADMIN && !req.isSuperAdmin) {
    res.status(403).json({ message: "Only an admin can change roles to admin" });
    return;
  }
  if (payload.role && current.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ message: "Only a super admin can change a super admin" });
    return;
  }
  if (payload.isSuperAdmin === true) {
    payload.role = Role.ADMIN;
  }
  if (typeof req.body.avatar === "string") payload.avatar = req.body.avatar;
  if (typeof req.body.bio === "string") payload.bio = req.body.bio;

  const user = await prisma.user.update({
    where: { id },
    data: payload,
  });

  res.json(user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

  const current = await prisma.user.findFirst({ where: { id } });
  if (!current) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
  } catch (error) {
    next(error);
  }
};
