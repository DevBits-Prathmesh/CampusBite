# CampusBite

Campus canteen pre-ordering. Students reserve a pickup slot and pay a 20% advance; the kitchen prepares the order and the remaining 80% is paid before pickup.

The app is a Next.js server-rendered web app wrapped in a Capacitor Android shell. The Android WebView loads the live server (or a development server) through `CAPACITOR_SERVER_URL`.

## Stack

- Next.js 16 (App Router, route handlers) + React 19 + TypeScript
- Tailwind CSS 4
- Neon Postgres through `pg`
- Capacitor 8 Android shell
- Razorpay Standard Checkout through `capacitor-razorpay` (native SDK) with Razorpay Checkout.js as the browser fallback

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL` and (for payments) the Razorpay keys described below, then:

```bash
npm run dev
```

The database schema is created automatically on the first API request.

### Android

1. Set `CAPACITOR_SERVER_URL` in `.env` to the server the phone/emulator should load (`http://10.0.2.2:3000` for the Android emulator, or your computer's LAN IP for a physical device).
2. Run `npm run cap:sync` to copy the Capacitor config and register native plugins.
3. Run `npm run cap:open` to open the project in Android Studio.

`capacitor.config.ts` uses `capacitor-web/` as the local web shell. The shell is only shown when `CAPACITOR_SERVER_URL` is missing; normal builds load the Next.js server directly.

## Deploy to Vercel

1. Import the repository into Vercel. The default Next.js build settings work as-is.
2. Add `DATABASE_URL`, `SESSION_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` under **Project → Settings → Environment Variables** (Production, and Preview if you use preview deployments).
3. After deploying, update the Razorpay webhook URL to `https://YOUR_DOMAIN/api/payments/razorpay/webhook/` (keep the trailing slash).
4. Point the Android shell at the deployment copy of `https://YOUR_DOMAIN` in `CAPACITOR_SERVER_URL`, then run `npm run cap:sync` and rebuild the app.

`CAPACITOR_SERVER_URL` is only read locally by `capacitor.config.ts` during `cap sync`; it is not needed in Vercel's environment variables.

### CORS

CORS headers are handled in `src/proxy.ts` for every `/api/*` route:

- Capacitor WebView origins (`https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`) and local dev hosts are always allowed.
- Vercel production, preview, and branch hostnames are allowed automatically through `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`.
- For a custom domain or a frontend hosted on a different domain, set `ALLOWED_ORIGINS` to a comma-separated list (include the scheme) both locally and on Vercel:

```dotenv
ALLOWED_ORIGINS=https://campusbite.example.com,https://staging.example.com
```

When the Android app loads the Vercel URL directly, its API calls are same-origin, so CORS is not involved. The allowlist matters when the WebView uses the local Capacitor origin or when the frontend and API are separate deployments.

## Razorpay payments

Both the 20% advance and the 80% balance are paid through Razorpay. The app never trusts an amount or a payment result sent by the client.

### 1. Add keys

Create test keys in the Razorpay Dashboard under **Account & Settings → API Keys**, then add them to `.env`:

```dotenv
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
```

`RAZORPAY_KEY_ID` is public (it is sent to Checkout). The other two are server-only. Restart the dev server after changing them.

### 2. Configure the webhook

In **Account & Settings → Webhooks**, add:

```text
https://YOUR_DOMAIN/api/payments/razorpay/webhook/
```

Keep the trailing slash (`trailingSlash: true` is enabled in `next.config.ts`). Subscribe to:

- `payment.captured`
- `payment.authorized`
- `payment.failed`
- `order.paid`

Copy the webhook signing secret into `RAZORPAY_WEBHOOK_SECRET`. The webhook is the safety net when the app is closed mid-payment. For local development, expose the dev server with a tunnel (for example `ngrok http 3000`) and use that URL.

Also enable **auto-capture** for Orders API payments in the Razorpay Dashboard, or capture each authorized payment manually before delivery.

### 3. Test a payment

- UPI: use `success@razorpay` (failure: `failure@razorpay`)
- Card: `4100 2800 0000 1007`, any future expiry, random CVV

Test keys never move real money. Swap in live keys and a live webhook to go live.

### How the flow works

1. `POST /api/payments/razorpay/order` validates the signed-in student, order state, and amount from Postgres. It creates a Razorpay Order and stores a local payment row.
2. The client opens Checkout with `capacitor-razorpay` on Android (Checkout.js in a desktop browser).
3. `POST /api/payments/razorpay/verify` checks the Razorpay signature with `RAZORPAY_KEY_SECRET`, fetches the payment from Razorpay, confirms the amount/currency, and marks the order paid.
4. The Razorpay webhook repeats the same idempotent update if the app never reaches step 3.
5. The old "verify payment" demo endpoints were removed; there is no way to mark an order paid without Razorpay.

Refunds are not automated. If a payment arrives for an order that was cancelled just before verification, the server records it but leaves the order cancelled; refund it from the Razorpay Dashboard.
