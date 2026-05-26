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

const main = async () => {
  const password = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: UserRole.ADMIN, isVerified: true },
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
    update: { role: UserRole.CUSTOMER, isVerified: true },
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
    update: { role: UserRole.TECHNICIAN, isVerified: true },
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
    update: { role: UserRole.FINANCE_OFFICER, isVerified: true },
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
    update: { role: UserRole.SUPPORT_AGENT, isVerified: true },
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

  const iphone = await findOrCreateDevice("SN-SEED-IPHONE-13", {
    brand: "Apple",
    model: "iPhone 13",
    originalSerialNumber: "SN-SEED-IPHONE-13",
    condition: DeviceCondition.EXCELLENT,
    status: DeviceStatus.READY,
    batteryHealth: 91,
    basePrice: 420,
    price: 520,
    ownerId: customer.id,
    trustScore: 96,
    eWasteSavedKg: 0.35,
    carbonSavedKg: 70,
  });

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

  const listing = await prisma.marketplaceListing.findFirst({ where: { deviceId: iphone.id } })
    ?? await prisma.marketplaceListing.create({
      data: {
        deviceId: iphone.id,
        title: "Certified iPhone 13",
        description: "Excellent condition, certified and ready.",
        price: iphone.price,
        status: ListingStatus.ACTIVE,
      },
    });

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

  console.log("Seed completed.");
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
