# Deployment Guide

## Stack
- **Backend** — NestJS (Docker) → Render Web Service
- **Frontend** — Angular → Vercel
- **Database** — PostgreSQL → Supabase (free forever)
- **Redis** — Redis Cloud ✅ already configured
- **Media** — Cloudinary ✅ already configured

---

## Prerequisites

- GitHub account (both Render and Vercel deploy from git)
- Render account → [render.com](https://render.com)
- Vercel account → [vercel.com](https://vercel.com)
- Supabase account → [supabase.com](https://supabase.com) ✅ already created
- Redis Cloud database already set up ✅
- Cloudinary account already set up ✅

Push both `SOCIAL-MEDIA-BACKEND` and `SOCIAL-MEDIA-FRONTEND` to GitHub before starting.

---

## Step 1 — Supabase is already set up ✅

Your Supabase project `social-media` is already provisioned. Connection details:

- **Host (Session Pooler):** `aws-1-ap-southeast-2.pooler.supabase.com`
- **Port:** `5432`
- **Database:** `postgres`
- **Username:** `postgres.mrmqqwtbjgnncjcarhtf`
- **Password:** your Supabase DB password

> **Why Session Pooler?** Render's free tier is IPv4-only. Supabase Direct connections
> default to IPv6. Session Pooler works on IPv4 for free.

> Tables will be created automatically when the backend first starts in production
> because `synchronize` runs once via the initial deploy. After that, use migrations
> for schema changes.

---

## Step 2 — Deploy Backend on Render

1. Go to Render dashboard → **New** → **Web Service**
2. Connect your GitHub repo → select `SOCIAL-MEDIA-BACKEND`
3. Fill in:
   - Name: `social-media-backend`
   - Region: **Singapore** (closest to your Supabase ap-southeast-2 region)
   - Branch: `main`
   - Runtime: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Plan: **Free** (or Starter $7/mo to avoid cold starts permanently)
4. Under **Environment Variables**, add all of the following:

```
NODE_ENV=production

# Database — Supabase Session Pooler
DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
DB_PORT=5432
DB_USERNAME=postgres.mrmqqwtbjgnncjcarhtf
DB_PASSWORD=<your-supabase-db-password>
DB_NAME=postgres

# JWT — generate two strong random strings at https://generate-secret.vercel.app/64
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=<strong-random-secret>
JWT_REFRESH_EXPIRATION=7d

# Redis Cloud
REDIS_HOST=redis-18545.crce179.ap-south-1-1.ec2.cloud.redislabs.com
REDIS_PORT=18545
REDIS_PASSWORD=<your-redis-cloud-password>
REDIS_DB=0

# App URLs — fill these in after both services are deployed
APP_PORT=3000
APP_URL=https://<your-backend>.onrender.com
CORS_ORIGIN=https://<your-frontend>.vercel.app
FRONTEND_URL=https://<your-frontend>.vercel.app

# Cookie — must be 'none' when frontend and backend are on different domains
COOKIE_SAME_SITE=none

# Cloudinary
STORAGE_TYPE=cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail>
SMTP_PASS=<your-gmail-app-password>
SMTP_FROM="Social Media App" <noreply@app.com>

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://<your-backend>.onrender.com/api/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=<your-app-id>
FACEBOOK_APP_SECRET=<your-app-secret>
FACEBOOK_CALLBACK_URL=https://<your-backend>.onrender.com/api/auth/facebook/callback
```

5. Click **Create Web Service**
6. Wait for the build and deploy to finish (~3-5 minutes)
7. Test it: `https://<your-backend>.onrender.com/api/health` should return `{ "status": "ok" }`

> **After deploying**, go back to Render env vars and update:
> `APP_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL`, `FACEBOOK_CALLBACK_URL`
> with the real deployed URLs. Then click **Manual Deploy** to apply.

> **OAuth callbacks**: After updating callback URLs in env vars, also register them in:
> - Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs
> - Facebook Developer Portal → App → Facebook Login → Valid OAuth Redirect URIs

---

## Step 3 — Run Database Migrations

The tables are created by `synchronize` on first boot in production, but the indexes
migration still needs to be run manually once.

Use Render's **Shell** tab on your web service (available after deploy):

```bash
npm run migration:run
```

Verify indexes were created in **Supabase dashboard → Database → Indexes**.

> Note: `npm run migration:run` uses `typeorm-cli.config.ts` which reads from `.env`.
> On Render's Shell, env vars are already injected so it will connect to Supabase automatically.

---

## Step 4 — Deploy Frontend on Vercel

1. Open `SOCIAL-MEDIA-FRONTEND/src/environments/environment.prod.ts`
2. Update with your real backend URL:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://<your-backend>.onrender.com/api',
  wsUrl: 'wss://<your-backend>.onrender.com',
};
```

3. Commit and push to GitHub
4. Go to [vercel.com](https://vercel.com) → **Add New Project**
5. Import your `SOCIAL-MEDIA-FRONTEND` GitHub repo
6. Vercel auto-detects Angular — verify these settings:
   - Framework Preset: **Angular**
   - Build Command: `npm run build`
   - Output Directory: `dist/social-media-frontend/browser`
7. Click **Deploy**
8. Once deployed (~1 minute), visit your Vercel URL and test login/register

> **After getting your Vercel URL**, go back to Render and update `CORS_ORIGIN` and
> `FRONTEND_URL` env vars to your Vercel URL (e.g. `https://your-app.vercel.app`).
> Then trigger a **Manual Deploy** on Render for the changes to take effect.

> **`vercel.json`** is already in the frontend root — it handles Angular client-side
> routing so direct URL access and page refreshes don't return 404.

---

## Step 5 — Prevent Cold Starts (UptimeRobot)

Render free tier spins down after 15 minutes of inactivity causing a ~30s cold start.
UptimeRobot pings your backend every 5 minutes to keep it warm — completely free.

1. Go to [uptimerobot.com](https://uptimerobot.com) → create a free account
2. Click **Add New Monitor**
3. Fill in:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Social Media Backend`
   - URL: `https://<your-backend>.onrender.com/api/health`
   - Monitoring Interval: **5 minutes**
4. Click **Create Monitor**

Your backend stays warm 24/7 and you get email alerts if it ever goes down.

---

## Quick Reference — All URLs After Deployment

| Service | URL |
|---|---|
| Backend API | `https://<your-backend>.onrender.com/api` |
| Swagger Docs | `https://<your-backend>.onrender.com/api/docs` |
| Health Check | `https://<your-backend>.onrender.com/api/health` |
| Frontend | `https://<your-app>.vercel.app` |
| Database UI | Supabase dashboard → Table Editor |

---

## Checklist

- [x] Supabase project created
- [ ] Backend repo pushed to GitHub
- [ ] Frontend repo pushed to GitHub
- [ ] Backend deployed on Render and `/api/health` returns 200
- [ ] `APP_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, OAuth callback URLs updated on Render
- [ ] Migrations run — indexes visible in Supabase dashboard
- [ ] `environment.prod.ts` updated with real backend URL and pushed
- [ ] Frontend deployed on Vercel and login works
- [ ] `CORS_ORIGIN` and `FRONTEND_URL` on Render updated with Vercel URL + redeployed
- [ ] OAuth callback URLs registered in Google + Facebook consoles
- [ ] UptimeRobot monitor set up
