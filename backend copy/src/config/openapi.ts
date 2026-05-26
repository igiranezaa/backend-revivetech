export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Secondhand Device Refurbishment & Financing Platform API",
    version: "1.0.0",
    description: "API documentation for authentication, marketplace, refurbishment, financing, AI, trade-in, and sustainability workflows.",
  },
  servers: [
    {
      url: "http://localhost:5001",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Auth" },
    { name: "Users" },
    { name: "Devices" },
    { name: "Marketplace" },
    { name: "Payments" },
    { name: "Refurbishments" },
    { name: "Sustainability Jobs" },
    { name: "AI Layer" },
    { name: "Admin" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Admin"],
        summary: "Health check",
        responses: { "200": { description: "API and database status" } },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                firstName: "Aline",
                lastName: "Uwase",
                email: "aline@example.com",
                phone: "+250788000001",
                password: "Password123!",
                role: "CUSTOMER",
              },
            },
          },
        },
        responses: { "201": { description: "Registered user and OTP" } },
      },
    },
    "/api/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "aline@example.com", otpCode: "123456" } } },
        },
        responses: { "200": { description: "Account verified" } },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and get JWT",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "aline@example.com", password: "Password123!" } } },
        },
        responses: { "200": { description: "JWT token and user profile" } },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset OTP",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "aline@example.com" } } },
        },
        responses: { "200": { description: "Password reset OTP generated" } },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "aline@example.com", otpCode: "123456", newPassword: "NewPassword123!" } } },
        },
        responses: { "200": { description: "Password reset" } },
      },
    },
    "/api/users/profile": {
      get: {
        tags: ["Users"],
        summary: "Get authenticated user profile",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "User profile" } },
      },
      put: {
        tags: ["Users"],
        summary: "Update authenticated user profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { firstName: "Aline", lastName: "Uwase", phone: "+250788000002" } } },
        },
        responses: { "200": { description: "Updated profile" } },
      },
    },
    "/api/users/admin/users": {
      get: {
        tags: ["Users"],
        summary: "Admin list users",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Users list" } },
      },
    },
    "/api/users/admin/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Admin get user",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "User details" } },
      },
      put: {
        tags: ["Users"],
        summary: "Admin update user",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { firstName: "Aline", role: "TECHNICIAN", status: "ACTIVE", isVerified: true } } },
        },
        responses: { "200": { description: "User updated" } },
      },
      delete: {
        tags: ["Users"],
        summary: "Admin delete user",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "User deleted" } },
      },
    },
    "/api/users/admin/role": {
      put: {
        tags: ["Users"],
        summary: "Admin update user role",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { userId: "uuid", role: "TECHNICIAN" } } },
        },
        responses: { "200": { description: "Role updated" } },
      },
    },
    "/api/devices": {
      get: {
        tags: ["Devices"],
        summary: "List devices",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "brand", in: "query", schema: { type: "string" } },
          { name: "condition", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Devices" } },
      },
    },
    "/api/devices/intake": {
      post: {
        tags: ["Devices"],
        summary: "Register device intake",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                brand: "Apple",
                model: "iPhone 13",
                originalSerialNumber: "SN12345",
                condition: "GOOD",
                batteryHealth: 88,
                basePrice: 420,
                price: 520,
              },
            },
          },
        },
        responses: { "201": { description: "Device registered" } },
      },
    },
    "/api/devices/repair": {
      post: {
        tags: ["Devices"],
        summary: "Update repair status",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceId: "uuid", status: "REPAIRING", diagnostics: "Battery issue", stepsTaken: "Replaced battery", partsUsed: ["Battery"] } } },
        },
        responses: { "200": { description: "Repair status updated" } },
      },
    },
    "/api/devices/qc": {
      post: {
        tags: ["Devices"],
        summary: "Submit quality control check",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceId: "uuid", checklistPassed: true } } },
        },
        responses: { "200": { description: "QC status updated" } },
      },
    },
    "/api/devices/certify": {
      post: {
        tags: ["Devices"],
        summary: "Certify device and issue passport",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceId: "uuid", certificationDetails: "Certified refurbished" } } },
        },
        responses: { "200": { description: "Device certified" } },
      },
    },
    "/api/devices/passport/{deviceId}": {
      get: {
        tags: ["Devices"],
        summary: "Get digital passport",
        parameters: [{ name: "deviceId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Device passport" } },
      },
    },
    "/api/devices/trade-in": {
      get: {
        tags: ["Devices"],
        summary: "List trade-in requests",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Trade-in requests" } },
      },
      post: {
        tags: ["Devices"],
        summary: "Submit trade-in request",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { brand: "Samsung", model: "Galaxy S21", condition: "GOOD", batteryHealth: 82 } } },
        },
        responses: { "201": { description: "Trade-in submitted" } },
      },
      put: {
        tags: ["Devices"],
        summary: "Review trade-in request",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { tradeInId: "uuid", status: "APPROVED" } } },
        },
        responses: { "200": { description: "Trade-in updated" } },
      },
    },
    "/api/devices/trade-in/{id}": {
      get: {
        tags: ["Devices"],
        summary: "Get trade-in request",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Trade-in request" } },
      },
      put: {
        tags: ["Devices"],
        summary: "Review trade-in request",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { status: "APPROVED" } } },
        },
        responses: { "200": { description: "Trade-in updated" } },
      },
      delete: {
        tags: ["Devices"],
        summary: "Delete trade-in request",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Trade-in deleted" } },
      },
    },
    "/api/devices/{id}": {
      get: {
        tags: ["Devices"],
        summary: "Get device",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Device details" } },
      },
      put: {
        tags: ["Devices"],
        summary: "Update device",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { status: "READY", price: 520, batteryHealth: 90 } } },
        },
        responses: { "200": { description: "Device updated" } },
      },
      delete: {
        tags: ["Devices"],
        summary: "Delete device",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Device deleted" } },
      },
    },
    "/api/marketplace": {
      get: {
        tags: ["Marketplace"],
        summary: "List marketplace devices",
        parameters: [
          { name: "brand", in: "query", schema: { type: "string" } },
          { name: "condition", in: "query", schema: { type: "string" } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Listings" } },
      },
      post: {
        tags: ["Marketplace"],
        summary: "Create marketplace listing",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceId: "uuid", title: "iPhone 13 refurbished", description: "Certified and ready" } } },
        },
        responses: { "201": { description: "Listing created" } },
      },
    },
    "/api/marketplace/{id}": {
      get: {
        tags: ["Marketplace"],
        summary: "Get listing details",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Listing details" } },
      },
      put: {
        tags: ["Marketplace"],
        summary: "Update listing",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { title: "iPhone 13 refurbished", price: 499, status: "ACTIVE" } } },
        },
        responses: { "200": { description: "Listing updated" } },
      },
      delete: {
        tags: ["Marketplace"],
        summary: "Delete listing",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Listing deleted" } },
      },
    },
    "/api/marketplace/smart-pricing": {
      post: {
        tags: ["Marketplace"],
        summary: "Recalculate smart pricing",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { listingId: "uuid" } } },
        },
        responses: { "200": { description: "Price updated" } },
      },
    },
    "/api/marketplace/checkout": {
      post: {
        tags: ["Marketplace"],
        summary: "Checkout devices",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceIds: ["uuid"], financingApplicationId: "uuid" } } },
        },
        responses: { "201": { description: "Order created" } },
      },
    },
    "/api/payments/financing": {
      get: {
        tags: ["Payments"],
        summary: "List financing applications",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "customerId", in: "query", schema: { type: "string" } },
          { name: "deviceId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Financing applications" } },
      },
      post: {
        tags: ["Payments"],
        summary: "Submit financing application",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                deviceId: "uuid",
                monthlyIncome: 1000,
                existingDebts: 100,
                installmentMonths: 12,
                creditScore: 680,
                employmentStatus: "employed",
              },
            },
          },
        },
        responses: { "201": { description: "Financing submitted" } },
      },
    },
    "/api/payments/financing/{id}": {
      get: {
        tags: ["Payments"],
        summary: "Get financing application details",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Financing details" } },
      },
      put: {
        tags: ["Payments"],
        summary: "Update financing application",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { status: "APPROVED", officerRecommendation: "Approved for 12 months" } } },
        },
        responses: { "200": { description: "Financing updated" } },
      },
      delete: {
        tags: ["Payments"],
        summary: "Delete financing application",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Financing deleted" } },
      },
    },
    "/api/payments/financing/review": {
      post: {
        tags: ["Payments"],
        summary: "Review financing application",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { applicationId: "uuid", status: "APPROVED" } } },
        },
        responses: { "200": { description: "Financing reviewed" } },
      },
    },
    "/api/payments/repay": {
      post: {
        tags: ["Payments"],
        summary: "Make installment repayment",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { repaymentId: "uuid", amount: 50 } } },
        },
        responses: { "200": { description: "Repayment processed" } },
      },
    },
    "/api/refurbishments": {
      get: {
        tags: ["Refurbishments"],
        summary: "List refurbishments",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Refurbishment records" } },
      },
      post: {
        tags: ["Refurbishments"],
        summary: "Create refurbishment record",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { deviceId: "uuid", status: "RECEIVED", diagnostics: "Initial inspection", partsUsed: [] } } },
        },
        responses: { "201": { description: "Refurbishment created" } },
      },
    },
    "/api/refurbishments/{id}": {
      get: {
        tags: ["Refurbishments"],
        summary: "Get refurbishment",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Refurbishment record" } },
      },
      put: {
        tags: ["Refurbishments"],
        summary: "Update refurbishment",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { status: "CERTIFIED", qcPassed: true, repairNotes: "Passed QC" } } },
        },
        responses: { "200": { description: "Refurbishment updated" } },
      },
      delete: {
        tags: ["Refurbishments"],
        summary: "Delete refurbishment",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Refurbishment deleted" } },
      },
    },
    "/api/sustainability-jobs": {
      get: {
        tags: ["Sustainability Jobs"],
        summary: "List sustainability jobs",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Sustainability jobs" } },
      },
      post: {
        tags: ["Sustainability Jobs"],
        summary: "Create sustainability job",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                title: "Recycle damaged batteries",
                description: "Collect and dispose safely",
                type: "RECYCLING",
                eWasteSavedKg: 2.5,
                carbonSavedKg: 20,
              },
            },
          },
        },
        responses: { "201": { description: "Sustainability job created" } },
      },
    },
    "/api/sustainability-jobs/{id}": {
      get: {
        tags: ["Sustainability Jobs"],
        summary: "Get sustainability job",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Sustainability job" } },
      },
      put: {
        tags: ["Sustainability Jobs"],
        summary: "Update sustainability job",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { status: "COMPLETED", eWasteSavedKg: 3, carbonSavedKg: 25 } } },
        },
        responses: { "200": { description: "Sustainability job updated" } },
      },
      delete: {
        tags: ["Sustainability Jobs"],
        summary: "Delete sustainability job",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Sustainability job deleted" } },
      },
    },
    "/api/ai/support-chat": {
      post: {
        tags: ["AI Layer"],
        summary: "Send support chat message",
        requestBody: {
          required: true,
          content: { "application/json": { example: { sessionId: "uuid", message: "Recommend a refurbished phone" } } },
        },
        responses: { "200": { description: "AI support reply" } },
      },
    },
    "/api/ai/valuation": {
      post: {
        tags: ["AI Layer"],
        summary: "Evaluate device value",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { brand: "Apple", model: "iPhone 13", condition: "GOOD", batteryHealth: 88 } } },
        },
        responses: { "200": { description: "Valuation" } },
      },
    },
    "/api/ai/finance-check": {
      post: {
        tags: ["AI Layer"],
        summary: "Run AI financing risk check",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { monthlyIncome: 1000, existingDebts: 100, requestedAmount: 500, creditScore: 680, employmentStatus: "employed" } } },
        },
        responses: { "200": { description: "Financing risk check" } },
      },
    },
    "/api/ai/repair-guidance": {
      post: {
        tags: ["AI Layer"],
        summary: "Get AI repair guidance",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { brand: "Apple", model: "iPhone 13", symptoms: "Battery drains quickly" } } },
        },
        responses: { "200": { description: "Repair guidance" } },
      },
    },
    "/api/ai/interactions": {
      get: {
        tags: ["AI Layer"],
        summary: "List AI interactions",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "AI interaction history" } },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Get dashboard statistics",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Dashboard statistics" } },
      },
    },
    "/api/admin/predictions": {
      get: {
        tags: ["Admin"],
        summary: "Get inventory predictions",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Inventory predictions" } },
      },
    },
    "/api/admin/sustainability": {
      get: {
        tags: ["Admin"],
        summary: "Get sustainability report",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Sustainability report" } },
      },
    },
    "/api/data/models": {
      get: {
        tags: ["Admin"],
        summary: "List readable Prisma models",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Available model keys for generic data reads" } },
      },
    },
    "/api/data/{model}": {
      get: {
        tags: ["Admin"],
        summary: "Get all records for any model",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "model",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "users",
                "devices",
                "device-passports",
                "repair-logs",
                "marketplace-listings",
                "financing-applications",
                "installment-repayments",
                "orders",
                "order-items",
                "trade-in-requests",
                "support-chat-sessions",
                "support-chat-messages",
                "trust-scores",
                "refurbishments",
                "ai-interactions",
                "sustainability-jobs",
                "carts",
                "cart-items",
                "wishlists",
                "payments",
                "notifications",
                "system-logs",
              ],
            },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { "200": { description: "Model records" } },
      },
    },
    "/api/data/{model}/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Get one record by id for any model",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "model", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Model record" } },
      },
    },
  },
} as const;

export const getOpenApiSpec = (baseUrl: string) => ({
  ...openApiSpec,
  servers: [
    {
      url: baseUrl,
      description: "Current server",
    },
  ],
});

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api-docs.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
      });
    </script>
  </body>
</html>`;
