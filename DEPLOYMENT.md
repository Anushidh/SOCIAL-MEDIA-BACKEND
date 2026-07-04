# Backend Deployment — Render

## Stack
- **Runtime** — Node.js on Render Web Service
- **Database** — Supabase PostgreSQL ✅ already configured
- **Redis** — Redis Cloud ✅ already configured
- **Media** — Cloudinary ✅ already configured

---

## Prerequisites

- GitHub account
- Render account → [render.com](https://render.com)
- Supabase project already created ✅
- Redis Cloud database already set up ✅
- Cloudinary already set up ✅

Push `SOCIAL-MEDIA-BACKEND` to GitHub before starting.

---

## Step 1 — Supabase connection details

Your Supabase project `social-media` is already provisioned:

- **Host (Session Pooler):** `aws-1-ap-southeast-2.pooler.supabase.com`
- **Port:** `5432`
- **Database:** `postgres`
- **Username:** `postgres.mrmqqwtbjgnncjcarhtf`
- **Password:** your Supabase DB password

> **Why Session Pooler?** Render's free tier is IPv4-only. Supabase Direct connections
> use IPv6 by default. Session Pooler works on IPv4 for free.

---

## Step 2 — Deploy on Render

1. Go to Render dashboard → **New** → **Web Service**
2. Connect your GitHub repo → select `SOCIAL-MEDIA-BACKEND`
3. Fill in:
   - Name: `social-media-backend`
   - Region: **Singapore** (closest to Supabase ap-southeast-2)
   - Branch: `main`
   - Runtime: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Plan: **Free** (or Starter $7/mo for always-on)
4. Under **Environment Variables** add all of the following:

```
NODE_ENV=production

# Database — Supabase Session Pooler
DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
DB_PORT=5432
DB_USERNAME=postgres.mrmqqwtbjgnncjcarhtf
DB_PASSWORD=<your-supabase-db-password>
DB_NAME=postgres

# JWT — generate at https://generate-secret.vercel.app/64
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=<strong-random-secret>
JWT_REFRESH_EXPIRATION=7d

# Redis Cloud
REDIS_HOST=redis-18545.crce179.ap-south-1-1.ec2.cloud.redislabs.com
REDIS_PORT=18545
REDIS_PASSWORD=<your-redis-cloud-password>
REDIS_DB=0

# App URLs — update after frontend is deployed on Vercel
APP_PORT=3000
APP_URL=https://<your-backend>.onrender.com
CORS_ORIGIN=https://<your-frontend>.vercel.app
FRONTEND_URL=https://<your-frontend>.vercel.app

# Cookie — must be 'none' for cross-domain (Render + Vercel)
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
6. Wait for build + deploy to finish (~3-5 minutes)
7. Test: `https://<your-backend>.onrender.com/api/health` → should return `{ "status": "ok" }`

> After the frontend is deployed, come back and update `CORS_ORIGIN`, `FRONTEND_URL`,
> `GOOGLE_CALLBACK_URL`, and `FACEBOOK_CALLBACK_URL` with real URLs.
> Then click **Manual Deploy** to apply.

> **OAuth callbacks** — also register the production callback URLs in:
> - Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs
> - Facebook Developer Portal → App → Facebook Login → Valid OAuth Redirect URIs

---

## Step 3 — Run Database Migrations

Tables are created automatically on first boot via `synchronize`.
The indexes migration still needs to be run once manually.

Use Render's **Shell** tab on your web service:

```bash
npm run migration:run
```

Verify in **Supabase dashboard → Database → Indexes**.

---

## Step 4 — Prevent Cold Starts (UptimeRobot)

Render free tier spins down after 15 minutes of inactivity — ~30s cold start on next request.
UptimeRobot pings every 5 minutes to keep it warm. Free forever.

1. Go to [uptimerobot.com](https://uptimerobot.com) → sign up → **Add New Monitor**
2. Fill in:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Social Media Backend`
   - URL: `https://<your-backend>.onrender.com/api/health`
   - Monitoring Interval: **5 minutes**
3. Click **Create Monitor**

---

## Quick Reference

| Service | URL |
|---|---|
| Backend API | `https://<your-backend>.onrender.com/api` |
| Swagger Docs | `https://<your-backend>.onrender.com/api/docs` |
| Health Check | `https://<your-backend>.onrender.com/api/health` |

---

## Checklist

- [x] Supabase project created
- [ ] Repo pushed to GitHub
- [ ] Deployed on Render — `/api/health` returns 200
- [ ] Migrations run — indexes visible in Supabase
- [ ] `CORS_ORIGIN`, `FRONTEND_URL`, OAuth URLs updated after frontend deploy
- [ ] OAuth callback URLs registered in Google + Facebook consoles
- [ ] UptimeRobot monitor set up
