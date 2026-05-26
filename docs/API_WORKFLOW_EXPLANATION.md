# API Workflow Explanation

This document explains what was implemented, how it was implemented, how the APIs connect to each other, and how to test the main AI and marketplace workflows.

## Project overview

The project is an Express + TypeScript backend for a secondhand device refurbishment, financing, and marketplace platform.

The API starts in `src/server.ts`, which:

- enables CORS and JSON request parsing,
- mounts all application routes under `/api`,
- exposes Swagger docs at `/api-docs`,
- exposes raw OpenAPI JSON at `/api-docs.json`,
- exposes a database-backed health check at `/health`.

The central route entry point is `src/routes/index.ts`. It connects feature route files like:

- `/api/auth` -> authentication and OTP verification,
- `/api/devices` -> intake, repair, QC, certification, passport, and trade-in,
- `/api/marketplace` -> listings, smart pricing, and checkout,
- `/api/payments` -> financing applications and repayments,
- `/api/ai` -> AI valuation, financing risk check, repair guidance, support chat, and interaction history.

Database access is handled through Prisma from `src/config/prisma.ts`, using the models defined in `prisma/schema.prisma`.

## What was done

### 1. AI layer was connected

The AI layer has two controller files:

- `src/controller/ai.controller.ts`
- `src/controller/ai-layer.controller.ts`

`ai.controller.ts` handles the active AI features:

- device valuation,
- financing risk checking,
- repair guidance,
- support chat.

`ai-layer.controller.ts` handles AI interaction history:

- listing saved AI interactions,
- filtering interactions by AI type,
- filtering interactions by user id,
- including related user and chat session information.

The actual AI logic is centralized in `src/services/ai.service.ts`.

### 2. AI service was implemented with fallback behavior

`AiService` tries to call the OpenAI Chat Completions API when `OPENAI_API_KEY` exists in `.env`.

If the key is missing, the API call fails, or OpenAI returns a non-success response, the service falls back to local rule-based logic. This keeps the app testable even without a real AI key.

The AI service currently supports:

- `evaluateDevice()` for resale and trade-in value estimates,
- `evaluateFinancing()` for repayment risk and fraud hints,
- `getRepairGuidance()` for repair diagnosis and steps,
- `handleSupportChat()` for customer support chat replies.

Every successful AI controller call stores an `AiInteraction` record in the database. This creates an audit trail of AI input and output.

### 3. AI interactions were persisted

The `AiInteraction` Prisma model stores:

- optional `userId`,
- optional `sessionId`,
- interaction `type`,
- request `input`,
- generated `output`,
- optional raw `response`,
- optional model information,
- creation timestamp.

This makes it possible for admins and support agents to review how the AI layer was used.

The history endpoint is:

```http
GET /api/ai/interactions
```

It requires a Bearer token and one of these roles:

- `ADMIN`
- `SUPPORT_AGENT`

### 4. Marketplace APIs were connected

Marketplace logic lives in `src/controller/marketplace.controller.ts` and is connected by `src/routes/marketplace.routes.ts`.

Implemented marketplace features include:

- public listing browsing,
- listing detail viewing,
- admin-only listing creation,
- admin-only smart price recalculation,
- authenticated checkout.

Marketplace listings are stored in the `MarketplaceListing` Prisma model and linked to a `Device`.

### 5. Smart pricing was added to marketplace listings

When an admin creates a listing, the backend calculates an optimized price using `runSmartPricingEngine()`.

The pricing engine:

- starts from the device `basePrice`,
- checks stock for devices with the same brand,
- increases price by 10% if supply is low,
- discounts price by 8% if supply is high,
- adds 3% premium for very high trust score,
- discounts 10% for low trust score.

The final price is saved in both:

- `MarketplaceListing.price`,
- `Device.price`.

This keeps the marketplace listing price and device price synchronized.

### 6. Checkout was connected to orders, devices, listings, passports, and audit logs

The checkout endpoint:

```http
POST /api/marketplace/checkout
```

accepts one or more `deviceIds`.

During checkout the backend:

- verifies all devices exist,
- verifies all devices are `READY`,
- calculates the total amount from device prices,
- optionally verifies an approved financing application,
- creates an `Order`,
- creates related `OrderItem` records,
- marks devices as `SOLD`,
- marks related marketplace listings as `SOLD`,
- updates digital passport ownership history,
- writes an audit log using `writeAuditLog()`.

## How the APIs are connected

### Main request path

Most API calls follow this structure:

```text
HTTP request
  -> src/server.ts
  -> /api route mount
  -> src/routes/index.ts
  -> feature route file
  -> controller function
  -> Prisma database query or service call
  -> JSON response
```

For example, marketplace listing creation flows like this:

```text
POST /api/marketplace
  -> marketplace.routes.ts
  -> requireAuth
  -> requireRoles([ADMIN])
  -> createListing()
  -> runSmartPricingEngine()
  -> prisma.marketplaceListing.create()
  -> prisma.device.update()
  -> response with created listing
```

AI valuation flows like this:

```text
POST /api/ai/valuation
  -> ai.routes.ts
  -> requireAuth
  -> evaluateDeviceValuation()
  -> AiService.evaluateDevice()
  -> OpenAI call or local fallback
  -> prisma.aiInteraction.create()
  -> response with valuation
```

Support chat flows like this:

```text
POST /api/ai/support-chat
  -> ai.routes.ts
  -> sendSupportMessage()
  -> create or reuse SupportChatSession
  -> AiService.handleSupportChat()
  -> save user chat message
  -> generate AI reply
  -> save AI chat message
  -> save AiInteraction
  -> response with sessionId and reply
```

## Authentication and roles

Authentication uses JWT Bearer tokens.

The middleware is in `src/middleware/auth.ts`.

Protected endpoints require:

```http
Authorization: Bearer <token>
```

The token is created by:

```http
POST /api/auth/login
```

Role checks are handled by `requireRoles()`.

Important protected routes:

- `POST /api/ai/valuation` requires a logged-in user.
- `POST /api/ai/finance-check` requires a logged-in user.
- `POST /api/ai/repair-guidance` requires a logged-in user.
- `GET /api/ai/interactions` requires `ADMIN` or `SUPPORT_AGENT`.
- `POST /api/marketplace` requires `ADMIN`.
- `POST /api/marketplace/smart-pricing` requires `ADMIN`.
- `POST /api/marketplace/checkout` requires a logged-in user.

## How to test the APIs

### 1. Start the server

Install dependencies if needed:

```bash
npm install
```

Generate Prisma client if needed:

```bash
npx prisma generate
```

Run the development server:

```bash
npm run dev
```

By default the server runs on:

```text
http://localhost:5000
```

### 2. Check server and database health

```bash
curl http://localhost:5000/health
```

Expected result:

```json
{
  "status": "UP",
  "services": {
    "database": "CONNECTED",
    "api": "HEALTHY"
  }
}
```

### 3. Register a test admin user

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@example.com",
    "password": "Password123!",
    "role": "ADMIN"
  }'
```

The response includes an `otpCode` for testing.

### 4. Verify the account

Replace `123456` with the `otpCode` from registration.

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "otpCode": "123456"
  }'
```

### 5. Login and copy the token

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123!"
  }'
```

Save the `token` value. Use it in protected API tests:

```http
Authorization: Bearer <token>
```

## AI API testing

### Test support chat

This endpoint does not require authentication.

```bash
curl -X POST http://localhost:5000/api/ai/support-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you recommend a refurbished phone?"
  }'
```

Expected response includes:

- `sessionId`
- `reply`

Use the returned `sessionId` for follow-up messages.

### Test AI valuation

```bash
curl -X POST http://localhost:5000/api/ai/valuation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "brand": "Apple",
    "model": "iPhone 13",
    "condition": "GOOD",
    "batteryHealth": 88
  }'
```

Expected response:

```json
{
  "valuation": {
    "estimatedResaleValue": 386,
    "tradeInRecommendation": 309,
    "conditionPricingLogic": "...",
    "reasoning": "..."
  }
}
```

Exact values may differ if OpenAI is configured and returns a different valid JSON result.

### Test AI financing risk check

```bash
curl -X POST http://localhost:5000/api/ai/finance-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "monthlyIncome": 1000,
    "existingDebts": 100,
    "requestedAmount": 500,
    "creditScore": 680,
    "employmentStatus": "employed"
  }'
```

Expected response includes:

- `riskSummary`
- `paymentAbilityEstimate`
- `installmentRecommendation`
- `fraudFlagHints`
- `paymentAbilityScore`

### Test AI repair guidance

```bash
curl -X POST http://localhost:5000/api/ai/repair-guidance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "brand": "Apple",
    "model": "iPhone 13",
    "symptoms": "Battery drains quickly and phone gets hot"
  }'
```

Expected response includes:

- diagnosis,
- repair steps,
- quality checklist,
- recommended parts.

### Test AI interaction history

This requires an admin or support agent token.

```bash
curl "http://localhost:5000/api/ai/interactions?type=VALUATION" \
  -H "Authorization: Bearer <token>"
```

Expected response:

```json
{
  "interactions": []
}
```

After running AI endpoints, this array should contain saved interaction records.

## Marketplace API testing

### List public marketplace listings

```bash
curl "http://localhost:5000/api/marketplace"
```

Optional filters:

```bash
curl "http://localhost:5000/api/marketplace?brand=Apple&condition=GOOD&minPrice=200&maxPrice=900&search=iPhone"
```

### Create a marketplace listing

This requires an admin token and a `deviceId` for a device with status `READY`.

```bash
curl -X POST http://localhost:5000/api/marketplace \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "deviceId": "<ready-device-id>",
    "title": "Certified refurbished iPhone 13",
    "description": "Passed QC, battery checked, digital passport available."
  }'
```

The response should include:

- success message,
- created listing,
- optimized price calculated by the smart pricing engine.

### Get listing details

```bash
curl http://localhost:5000/api/marketplace/<listing-id>
```

The response includes listing details, device information, and the device passport if one exists.

### Recalculate smart pricing

This requires an admin token.

```bash
curl -X POST http://localhost:5000/api/marketplace/smart-pricing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "listingId": "<listing-id>"
  }'
```

The response includes:

- previous price,
- new price,
- updated listing.

### Checkout

This requires a logged-in user token.

```bash
curl -X POST http://localhost:5000/api/marketplace/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "deviceIds": ["<ready-device-id>"]
  }'
```

If financing was approved separately, include:

```json
{
  "deviceIds": ["<ready-device-id>"],
  "financingApplicationId": "<approved-financing-application-id>"
}
```

## Testing through Swagger UI

The backend also exposes interactive API documentation:

```text
http://localhost:5000/api-docs
```

Use Swagger UI to:

- inspect all available endpoints,
- view request examples,
- authorize with a Bearer token,
- send requests directly from the browser.

## Important notes

- `OPENAI_API_KEY` is optional for local testing because AI service methods have fallback responses.
- AI responses may differ when a real OpenAI key is configured.
- Authenticated APIs require a verified account.
- Admin-only APIs require a user with role `ADMIN`.
- Marketplace listing creation requires a device that already exists and has status `READY`.
- Checkout changes device and listing status to `SOLD`, so do not reuse the same device id for repeated checkout tests.
- AI interaction history only shows records after AI endpoints have been called successfully.

## Main files involved

- `src/server.ts` - Express app setup and route mounting.
- `src/routes/index.ts` - main API route registry.
- `src/routes/ai.routes.ts` - AI endpoint definitions.
- `src/routes/marketplace.routes.ts` - marketplace endpoint definitions.
- `src/controller/ai.controller.ts` - AI feature controllers.
- `src/controller/ai-layer.controller.ts` - AI interaction history controller.
- `src/controller/marketplace.controller.ts` - marketplace listing, pricing, and checkout controllers.
- `src/services/ai.service.ts` - AI logic, OpenAI integration, and fallback logic.
- `src/middleware/auth.ts` - JWT authentication and role authorization.
- `prisma/schema.prisma` - database models and relationships.
- `src/config/openapi.ts` - Swagger/OpenAPI documentation.
