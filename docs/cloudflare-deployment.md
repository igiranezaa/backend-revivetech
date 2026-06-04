# Cloudflare Deployment

This backend is configured for Cloudflare Workers with Wrangler.

## Project Files

- `wrangler.jsonc` is the Worker deployment config.
- `src/worker.ts` is the Cloudflare Worker entrypoint.
- `src/server.ts` remains the local Node/Render entrypoint.
- `src/app.ts` contains the shared Express app.
- `.dev.vars.example` lists the secrets needed for local Wrangler development.

## Local Development

Copy `.dev.vars.example` to `.dev.vars` and fill in real values. Do not commit `.dev.vars`.

```sh
npm run dev:cloudflare
```

## Production Secrets

Set secrets in Cloudflare before deploying:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put EMAIL_HOST
npx wrangler secret put EMAIL_PORT
npx wrangler secret put EMAIL_USER
npx wrangler secret put EMAIL_PASS
npx wrangler secret put EMAIL_FROM
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put OPENAI_API_KEY
```

Deploy:

```sh
npm run deploy:cloudflare
```

## Runtime Notes

Cloudflare Workers runs this API through `cloudflare:node` and `nodejs_compat`.
The Express app can run on Workers, but database and email behavior should be tested carefully after deployment.

For Postgres, Cloudflare recommends `node-postgres` with `nodejs_compat`, and Hyperdrive is recommended for production database performance.

For OTP email, SMTP through Nodemailer may require a provider/runtime-compatible path on Workers. If Gmail SMTP fails after deployment, replace it with an HTTP-based email provider such as Cloudflare Email Service, Resend, SendGrid, Mailersend, or Postmark.
