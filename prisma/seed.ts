import bcrypt from "bcryptjs";
import {
  AiInteractionType,
  DeviceCondition,
  DeviceStatus,
  FinancingStatus,
  ListingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefurbishmentStatus,
  RepaymentStatus,
  SustainabilityJobStatus,
  SustainabilityJobType,
  TradeInStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";

const findOrCreateDevice = async (serial: string, data: Prisma.DeviceUncheckedCreateInput) => {
  const existing = await prisma.device.findFirst({ where: { originalSerialNumber: serial } });
  if (existing) return existing;

  return prisma.device.create({ data });
};

const ensureListing = async (
  device: { id: string; price: number },
  title: string,
  description: string,
) => {
  const existing = await prisma.marketplaceListing.findFirst({ where: { deviceId: device.id } });
  if (existing) {
    await prisma.marketplaceListing.update({
      where: { id: existing.id },
      data: { title, description, price: device.price, status: ListingStatus.ACTIVE },
    });
    return existing;
  }
  return prisma.marketplaceListing.create({
    data: {
      deviceId: device.id,
      title,
      description,
      price: device.price,
      status: ListingStatus.ACTIVE,
    },
  });
};

type CatalogEntry = {
  serial: string;
  brand: string;
  model: string;
  condition: DeviceCondition;
  basePrice: number;
  price: number;
  batteryHealth: number;
  trustScore: number;
  title: string;
  description: string;
};

const MARKETPLACE_CATALOG: CatalogEntry[] = [
  { serial: "SN-SEED-IPHONE-13", brand: "Apple", model: "iPhone 13", condition: DeviceCondition.EXCELLENT, basePrice: 420, price: 520, batteryHealth: 91, trustScore: 96, title: "Certified iPhone 13", description: "Excellent condition, certified and ready to ship." },
  { serial: "SN-SEED-IPHONE-14", brand: "Apple", model: "iPhone 14", condition: DeviceCondition.EXCELLENT, basePrice: 520, price: 649, batteryHealth: 93, trustScore: 95, title: "iPhone 14 — 128GB", description: "Sharp display, strong battery, fully tested." },
  { serial: "SN-SEED-IPHONE-12", brand: "Apple", model: "iPhone 12", condition: DeviceCondition.GOOD, basePrice: 340, price: 429, batteryHealth: 86, trustScore: 90, title: "iPhone 12", description: "Reliable daily driver at a great price." },
  { serial: "SN-SEED-IPHONE-SE", brand: "Apple", model: "iPhone SE", condition: DeviceCondition.GOOD, basePrice: 220, price: 289, batteryHealth: 82, trustScore: 88, title: "iPhone SE (2022)", description: "Compact powerhouse with Touch ID." },
  { serial: "SN-SEED-MACBOOK-AIR", brand: "Apple", model: "MacBook Air M2", condition: DeviceCondition.EXCELLENT, basePrice: 680, price: 799, batteryHealth: 94, trustScore: 94, title: "MacBook Air M2 (13-inch)", description: "Certified refurbished MacBook Air with M2 chip." },
  { serial: "SN-SEED-MACBOOK-PRO", brand: "Apple", model: "MacBook Pro 14", condition: DeviceCondition.EXCELLENT, basePrice: 1100, price: 1299, batteryHealth: 92, trustScore: 96, title: "MacBook Pro 14\" M1 Pro", description: "Pro performance for creators and developers." },
  { serial: "SN-SEED-IPAD-AIR", brand: "Apple", model: "iPad Air", condition: DeviceCondition.GOOD, basePrice: 380, price: 459, batteryHealth: 90, trustScore: 89, title: "iPad Air — Wi-Fi", description: "Lightweight tablet for media and notes." },
  { serial: "SN-SEED-IPAD-PRO", brand: "Apple", model: "iPad Pro 11", condition: DeviceCondition.EXCELLENT, basePrice: 620, price: 749, batteryHealth: 91, trustScore: 93, title: "iPad Pro 11\" (2022)", description: "Liquid Retina, Apple Pencil ready." },
  { serial: "SN-SEED-PIXEL-7", brand: "Google", model: "Pixel 7", condition: DeviceCondition.GOOD, basePrice: 320, price: 399, batteryHealth: 88, trustScore: 87, title: "Google Pixel 7", description: "Pure Android flagship, fully tested and warrantied." },
  { serial: "SN-SEED-PIXEL-8", brand: "Google", model: "Pixel 8", condition: DeviceCondition.EXCELLENT, basePrice: 480, price: 579, batteryHealth: 92, trustScore: 91, title: "Google Pixel 8", description: "Tensor G3, outstanding camera, like new." },
  { serial: "SN-SEED-PIXEL-6A", brand: "Google", model: "Pixel 6a", condition: DeviceCondition.GOOD, basePrice: 240, price: 299, batteryHealth: 85, trustScore: 86, title: "Google Pixel 6a", description: "Affordable Pixel with flagship software." },
  { serial: "SN-SEED-SAMSUNG-S22", brand: "Samsung", model: "Galaxy S22", condition: DeviceCondition.EXCELLENT, basePrice: 380, price: 469, batteryHealth: 89, trustScore: 90, title: "Samsung Galaxy S22", description: "Compact flagship with vivid AMOLED display." },
  { serial: "SN-SEED-SAMSUNG-S23", brand: "Samsung", model: "Galaxy S23", condition: DeviceCondition.EXCELLENT, basePrice: 520, price: 629, batteryHealth: 91, trustScore: 92, title: "Samsung Galaxy S23", description: "Snapdragon power, excellent battery life." },
  { serial: "SN-SEED-SAMSUNG-A54", brand: "Samsung", model: "Galaxy A54", condition: DeviceCondition.GOOD, basePrice: 260, price: 319, batteryHealth: 87, trustScore: 85, title: "Samsung Galaxy A54 5G", description: "Mid-range favorite with solid cameras." },
  { serial: "SN-SEED-SAMSUNG-TAB", brand: "Samsung", model: "Galaxy Tab S9", condition: DeviceCondition.EXCELLENT, basePrice: 520, price: 619, batteryHealth: 93, trustScore: 91, title: "Galaxy Tab S9", description: "Premium Android tablet with S Pen support." },
  { serial: "SN-SEED-SAMSUNG-FLIP", brand: "Samsung", model: "Galaxy Z Flip 5", condition: DeviceCondition.EXCELLENT, basePrice: 620, price: 749, batteryHealth: 90, trustScore: 89, title: "Galaxy Z Flip 5", description: "Foldable style meets flagship specs." },
  { serial: "SN-SEED-ONEPLUS-11", brand: "OnePlus", model: "11", condition: DeviceCondition.EXCELLENT, basePrice: 420, price: 499, batteryHealth: 90, trustScore: 88, title: "OnePlus 11", description: "Fast charging, smooth 120Hz display." },
  { serial: "SN-SEED-XIAOMI-13", brand: "Xiaomi", model: "13", condition: DeviceCondition.GOOD, basePrice: 360, price: 429, batteryHealth: 88, trustScore: 87, title: "Xiaomi 13", description: "Leica-tuned cameras, flagship speed." },
  { serial: "SN-SEED-DELL-XPS", brand: "Dell", model: "XPS 13", condition: DeviceCondition.GOOD, basePrice: 580, price: 699, batteryHealth: 86, trustScore: 88, title: "Dell XPS 13", description: "Ultraportable Windows laptop, business ready." },
  { serial: "SN-SEED-LENOVO-TB", brand: "Lenovo", model: "ThinkPad X1 Carbon", condition: DeviceCondition.EXCELLENT, basePrice: 720, price: 849, batteryHealth: 88, trustScore: 90, title: "ThinkPad X1 Carbon Gen 10", description: "Legendary keyboard, enterprise durability." },
  { serial: "SN-SEED-APPLE-WATCH", brand: "Apple", model: "Watch Series 8", condition: DeviceCondition.GOOD, basePrice: 280, price: 349, batteryHealth: 84, trustScore: 87, title: "Apple Watch Series 8", description: "Health tracking and seamless iPhone sync." },
  { serial: "SN-SEED-SWITCH", brand: "Nintendo", model: "Switch OLED", condition: DeviceCondition.GOOD, basePrice: 260, price: 319, batteryHealth: 80, trustScore: 86, title: "Nintendo Switch OLED", description: "Vibrant handheld gaming with dock included." },
  { serial: "SN-SEED-HP-LAPTOP", brand: "HP", model: "Pavilion 15", condition: DeviceCondition.FAIR, basePrice: 380, price: 449, batteryHealth: 78, trustScore: 82, title: "HP Pavilion 15", description: "Everyday laptop for study and remote work." },
  { serial: "SN-SEED-IPHONE-15", brand: "Apple", model: "iPhone 15", condition: DeviceCondition.EXCELLENT, basePrice: 620, price: 749, batteryHealth: 95, trustScore: 97, title: "iPhone 15", description: "USB-C, Dynamic Island, pristine condition." },
];

const main = async () => {
  const password = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password, role: UserRole.ADMIN, isVerified: true, otpCode: null, otpExpiresAt: null },
    create: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      phone: "+250788100001",
      password,
      role: UserRole.ADMIN,
      isVerified: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "aline@example.com" },
    update: { password, role: UserRole.CUSTOMER, isVerified: true, otpCode: null, otpExpiresAt: null },
    create: {
      firstName: "Aline",
      lastName: "Uwase",
      email: "aline@example.com",
      phone: "+250788000001",
      password,
      role: UserRole.CUSTOMER,
      isVerified: true,
    },
  });

  const technician = await prisma.user.upsert({
    where: { email: "tech@example.com" },
    update: { password, role: UserRole.TECHNICIAN, isVerified: true, otpCode: null, otpExpiresAt: null },
    create: {
      firstName: "Technician",
      lastName: "One",
      email: "tech@example.com",
      phone: "+250788100002",
      password,
      role: UserRole.TECHNICIAN,
      isVerified: true,
    },
  });

  const financeOfficer = await prisma.user.upsert({
    where: { email: "finance@example.com" },
    update: { password, role: UserRole.FINANCE_OFFICER, isVerified: true, otpCode: null, otpExpiresAt: null },
    create: {
      firstName: "Finance",
      lastName: "Officer",
      email: "finance@example.com",
      phone: "+250788100003",
      password,
      role: UserRole.FINANCE_OFFICER,
      isVerified: true,
    },
  });

  const supportAgent = await prisma.user.upsert({
    where: { email: "support@example.com" },
    update: { password, role: UserRole.SUPPORT_AGENT, isVerified: true, otpCode: null, otpExpiresAt: null },
    create: {
      firstName: "Support",
      lastName: "Agent",
      email: "support@example.com",
      phone: "+250788100004",
      password,
      role: UserRole.SUPPORT_AGENT,
      isVerified: true,
    },
  });

  const seededDevices = [];
  for (const entry of MARKETPLACE_CATALOG) {
    let device = await findOrCreateDevice(entry.serial, {
      brand: entry.brand,
      model: entry.model,
      originalSerialNumber: entry.serial,
      condition: entry.condition,
      status: DeviceStatus.READY,
      batteryHealth: entry.batteryHealth,
      basePrice: entry.basePrice,
      price: entry.price,
      trustScore: entry.trustScore,
      eWasteSavedKg: 0.35,
      carbonSavedKg: 55,
      ...(entry.serial === "SN-SEED-IPHONE-13" ? { ownerId: customer.id } : {}),
    });
    if (device.status !== DeviceStatus.READY && entry.serial !== "SN-SEED-IPHONE-13") {
      device = await prisma.device.update({
        where: { id: device.id },
        data: { status: DeviceStatus.READY, price: entry.price },
      });
    }
    await ensureListing(device, entry.title, entry.description);
    seededDevices.push(device);
  }

  const iphone = seededDevices.find(d => d.originalSerialNumber === "SN-SEED-IPHONE-13")!;

  const samsung = await findOrCreateDevice("SN-SEED-SAMSUNG-S21", {
    brand: "Samsung",
    model: "Galaxy S21",
    originalSerialNumber: "SN-SEED-SAMSUNG-S21",
    condition: DeviceCondition.GOOD,
    status: DeviceStatus.INTAKE,
    batteryHealth: 84,
    basePrice: 260,
    price: 340,
    trustScore: 83,
    eWasteSavedKg: 0.35,
    carbonSavedKg: 60,
  });

  await prisma.devicePassport.upsert({
    where: { deviceId: iphone.id },
    update: {},
    create: {
      deviceId: iphone.id,
      repairHistory: JSON.stringify([{ note: "Seed certification check passed" }]),
      batteryHealthHistory: JSON.stringify([{ health: iphone.batteryHealth, date: new Date() }]),
      ownershipHistory: JSON.stringify([{ owner: "Seed inventory", date: new Date() }]),
      certificationDetails: "Seed certified refurbished device.",
    },
  });

  const repairLog = await prisma.repairLog.findFirst({ where: { deviceId: samsung.id, technicianId: technician.id } })
    ?? await prisma.repairLog.create({
      data: {
        deviceId: samsung.id,
        technicianId: technician.id,
        diagnostics: "Battery and screen inspection",
        stepsTaken: "Cleaned ports and verified diagnostics",
        partsUsed: JSON.stringify(["Screen protector"]),
        status: DeviceStatus.DIAGNOSTIC,
      },
    });

  const listing = await prisma.marketplaceListing.findFirst({ where: { deviceId: iphone.id } })!;

  const financing = await prisma.financingApplication.findFirst({
    where: { customerId: customer.id, deviceId: iphone.id },
  }) ?? await prisma.financingApplication.create({
    data: {
      customerId: customer.id,
      deviceId: iphone.id,
      status: FinancingStatus.APPROVED,
      totalAmount: iphone.price,
      interestRate: 0.12,
      installmentMonths: 12,
      monthlyRepayment: 48.53,
      riskSummary: "Seed profile approved.",
      fraudFlags: "None",
      paymentAbilityScore: 82,
      officerRecommendation: "Approved for 12 months.",
      approvedById: financeOfficer.id,
    },
  });

  const repaymentCount = await prisma.installmentRepayment.count({ where: { financingId: financing.id } });
  if (repaymentCount === 0) {
    await prisma.installmentRepayment.createMany({
      data: [1, 2, 3].map(month => {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + month);

        return {
          financingId: financing.id,
          dueDate,
          amountDue: financing.monthlyRepayment,
          amountPaid: month === 1 ? financing.monthlyRepayment : 0,
          paidAt: month === 1 ? new Date() : null,
          status: month === 1 ? RepaymentStatus.PAID : RepaymentStatus.UNPAID,
        };
      }),
    });
  }

  const order = await prisma.order.findFirst({ where: { customerId: customer.id, financingId: financing.id } })
    ?? await prisma.order.create({
      data: {
        customerId: customer.id,
        totalAmount: iphone.price,
        status: OrderStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        financingId: financing.id,
        orderItems: {
          create: [{ deviceId: iphone.id, price: iphone.price, quantity: 1 }],
        },
      },
    });

  await prisma.payment.findFirst({ where: { orderId: order.id, userId: customer.id } })
    ?? await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: customer.id,
        amount: 48.53,
        method: PaymentMethod.MOBILE_MONEY,
        status: TransactionStatus.PAID,
        paidAt: new Date(),
      },
    });

  await prisma.tradeInRequest.findFirst({ where: { userId: customer.id, brand: "Tecno", model: "Camon 19" } })
    ?? await prisma.tradeInRequest.create({
      data: {
        userId: customer.id,
        brand: "Tecno",
        model: "Camon 19",
        condition: DeviceCondition.GOOD,
        estimatedValue: 95,
        status: TradeInStatus.PENDING,
      },
    });

  const supportSession = await prisma.supportChatSession.findFirst({ where: { customerId: customer.id } })
    ?? await prisma.supportChatSession.create({ data: { customerId: customer.id } });

  await prisma.supportChatMessage.findFirst({ where: { sessionId: supportSession.id, sender: "USER" } })
    ?? await prisma.supportChatMessage.create({
      data: {
        sessionId: supportSession.id,
        sender: "USER",
        content: "Can you recommend a reliable phone under $550?",
      },
    });

  await prisma.aiInteraction.findFirst({ where: { userId: supportAgent.id, type: AiInteractionType.SUPPORT_CHAT } })
    ?? await prisma.aiInteraction.create({
      data: {
        userId: supportAgent.id,
        sessionId: supportSession.id,
        type: AiInteractionType.SUPPORT_CHAT,
        input: { message: "Recommend a phone under $550" },
        output: { recommendation: listing.title },
        prompt: "Seed support prompt",
        response: "The certified iPhone 13 is a strong option.",
        modelUsed: "seed-model",
      },
    });

  await prisma.trustScore.upsert({
    where: { deviceId: iphone.id },
    update: { score: 96, repairReliability: 92, feedbackScore: 95 },
    create: {
      deviceId: iphone.id,
      score: 96,
      repairReliability: 92,
      feedbackScore: 95,
    },
  });

  await prisma.refurbishment.findFirst({ where: { deviceId: samsung.id } })
    ?? await prisma.refurbishment.create({
      data: {
        deviceId: samsung.id,
        technicianId: technician.id,
        status: RefurbishmentStatus.DIAGNOSING,
        diagnostics: repairLog.diagnostics,
        repairNotes: "Seed refurbishment in progress.",
        partsUsed: JSON.stringify(["Screen protector"]),
      },
    });

  await prisma.sustainabilityJob.findFirst({ where: { title: "Seed battery recycling batch" } })
    ?? await prisma.sustainabilityJob.create({
      data: {
        title: "Seed battery recycling batch",
        description: "Collect and recycle damaged batteries.",
        type: SustainabilityJobType.RECYCLING,
        status: SustainabilityJobStatus.OPEN,
        deviceId: samsung.id,
        assignedToId: technician.id,
        eWasteSavedKg: 2.5,
        carbonSavedKg: 20,
      },
    });

  const cart = await prisma.cart.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });

  await prisma.cartItem.upsert({
    where: { cartId_deviceId: { cartId: cart.id, deviceId: iphone.id } },
    update: { quantity: 1 },
    create: { cartId: cart.id, deviceId: iphone.id, quantity: 1 },
  });

  await prisma.wishlist.upsert({
    where: { userId_deviceId: { userId: customer.id, deviceId: iphone.id } },
    update: {},
    create: { userId: customer.id, deviceId: iphone.id },
  });

  await prisma.notification.findFirst({ where: { userId: customer.id, type: "SEED" } })
    ?? await prisma.notification.create({
      data: {
        userId: customer.id,
        type: "SEED",
        message: "Welcome to the seeded refurbishment marketplace.",
      },
    });

  await prisma.systemLog.create({
    data: {
      action: "DATABASE_SEED",
      details: "Seed data inserted or refreshed.",
      userId: admin.id,
    },
  });

  const activeListings = await prisma.marketplaceListing.count({
    where: { status: ListingStatus.ACTIVE, device: { status: DeviceStatus.READY } },
  });

  console.log("Seed completed.");
  console.log(`Marketplace listings (active): ${activeListings}`);
  console.log("Admin login: admin@example.com / Password123!");
  console.log("Customer login: aline@example.com / Password123!");
};

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
