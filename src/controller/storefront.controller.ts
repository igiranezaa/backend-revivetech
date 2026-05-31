import type { Response } from "express";
import { DeviceStatus, ListingStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { parseOptionalString } from "../utils/request.js";

const getOrCreateCart = async (userId: string) => {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
};

export const compareDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawIds = parseOptionalString(req.query["deviceIds"]);
    const deviceIds = [...new Set(rawIds?.split(",").map(id => id.trim()).filter(Boolean) || [])];

    if (deviceIds.length < 2 || deviceIds.length > 4) {
      res.status(400).json({ message: "Provide between 2 and 4 comma-separated deviceIds" });
      return;
    }

    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds }, status: DeviceStatus.READY },
      select: {
        id: true,
        brand: true,
        model: true,
        condition: true,
        batteryHealth: true,
        price: true,
        trustScore: true,
        eWasteSavedKg: true,
        carbonSavedKg: true,
        passport: { select: { certificationDetails: true, certifiedAt: true } },
      },
    });

    if (devices.length !== deviceIds.length) {
      res.status(400).json({ message: "Every compared device must exist and be ready for sale" });
      return;
    }

    res.status(200).json({ devices });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to compare devices", error: error.message });
  }
};

export const getCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cart = await getOrCreateCart(req.user!.id);
    const populatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { device: { include: { listings: { where: { status: ListingStatus.ACTIVE } } } } } } },
    });
    const totalAmount = populatedCart?.items.reduce((sum, item) => sum + item.device.price, 0) || 0;

    res.status(200).json({ cart: populatedCart, totalAmount });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve cart", error: error.message });
  }
};

export const addCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      res.status(400).json({ message: "Required fields: deviceId" });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.status !== DeviceStatus.READY) {
      res.status(400).json({ message: "Device is not available for purchase" });
      return;
    }

    const cart = await getOrCreateCart(req.user!.id);
    const item = await prisma.cartItem.upsert({
      where: { cartId_deviceId: { cartId: cart.id, deviceId } },
      update: { quantity: 1 },
      create: { cartId: cart.id, deviceId, quantity: 1 },
      include: { device: true },
    });

    res.status(201).json({ message: "Device added to cart", item });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to add device to cart", error: error.message });
  }
};

export const removeCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deviceId = parseOptionalString(req.params["deviceId"]);
    const cart = await getOrCreateCart(req.user!.id);
    if (!deviceId) {
      res.status(400).json({ message: "Device id is required" });
      return;
    }

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, deviceId } });
    res.status(200).json({ message: "Device removed from cart" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to remove device from cart", error: error.message });
  }
};

export const clearCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cart = await getOrCreateCart(req.user!.id);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to clear cart", error: error.message });
  }
};

export const listWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const wishlist = await prisma.wishlist.findMany({
      where: { userId: req.user!.id },
      include: { device: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ wishlist });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve wishlist", error: error.message });
  }
};

export const addWishlistItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      res.status(400).json({ message: "Required fields: deviceId" });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    const item = await prisma.wishlist.upsert({
      where: { userId_deviceId: { userId: req.user!.id, deviceId } },
      update: {},
      create: { userId: req.user!.id, deviceId },
      include: { device: true },
    });
    res.status(201).json({ message: "Device added to wishlist", item });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to add device to wishlist", error: error.message });
  }
};

export const removeWishlistItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deviceId = parseOptionalString(req.params["deviceId"]);
    if (!deviceId) {
      res.status(400).json({ message: "Device id is required" });
      return;
    }

    await prisma.wishlist.deleteMany({ where: { userId: req.user!.id, deviceId } });
    res.status(200).json({ message: "Device removed from wishlist" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to remove device from wishlist", error: error.message });
  }
};

export const listOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user!.id },
      include: { orderItems: { include: { device: true } }, payments: true, financing: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ orders });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve order history", error: error.message });
  }
};

export const getOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Order id is required" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: { include: { device: true } }, payments: true, financing: { include: { repayments: true } } },
    });

    if (!order || order.customerId !== req.user!.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.status(200).json({ order });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve order", error: error.message });
  }
};
