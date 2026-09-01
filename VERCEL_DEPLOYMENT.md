# Rise On AI — Vercel Deployment Guide

**Platform:** Vercel (free Hobby tier)
**Next.js version:** 14.2.18
**Estimated time to deploy:** 15–20 minutes

---

## What works on Vercel (free tier)

| Feature | Status |
|---|---|
| Next.js frontend (all pages) | ✅ Full support |
| Supabase authentication | ✅ Works (Supabase is external) |
| Journal CRUD | ✅ Works |
| Behavioral Analytics | ✅ Works (pure computation) |
| Wellness Assessment | ✅ Works |
| Distress Risk Indicator | ✅ Works |
| Adaptive Conversational Intelligence | ✅ Works |
| Mood Trend Visualization | ✅ Works |
| Admin / Counselor dashboards | ✅ Works |
| XLM-RoBERTa AI inference | ⚠️ Falls back to keyword analysis (Python server not on Vercel) |
| Integrated Gradients explainability | ⚠️ Requires Python server (optional feature) |

> The keyword-based fallback in `lib/xlm-roberta-sentiment.ts` activates automatically when the Python server is unreachable. All other features work normally.

---

## Prerequisites

Before deploying you need:

1. **GitHub account** with this project pushed to a repository
2. **Vercel account** — free at [vercel.com](https://vercel.com) (sign in with GitHub)
3. Your **Supabase project URL and keys** (already in `.env.local`)
4. Your **reCAPTCHA keys** (already in `.env.local`)

---

## Step 1 — Push your project to GitHub

If not already done:

```bash
# In the project folder
git init
git add .
git commit -m "Rise On AI — Capstone deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rise-on-ai.git
git push -u origin main
```

> Make sure `.env.local` is listed in `.gitignore` (it already is). **Never push your keys to GitHub.**

---

## Step 2 — Import project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `rise-on-ai` repository
4. Vercel auto-detects Next.js — no framework changes needed
5. **Do NOT click Deploy yet** — add environment variables first (Step 3)

---

## Step 3 — Add Environment Variables

In the Vercel project settings → **Environment Variables**, add each of these:

### Required — App will not work without these

| Variable Name | Where to find the value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your `.env.local` file | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your `.env.local` file | Production, Preview, Development |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Your `.env.local` file | Production, Preview, Development |
| `RECAPTCHA_SECRET_KEY` | Your `.env.local` file | Production only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key | Production only |

### Optional — Only needed if you run the Python AI server separately

| Variable Name | Value | Environment |
|---|---|---|
| `SENTIMENT_MODEL_API_URL` | `http://YOUR_AI_SERVER_IP:8000/predict` | Production only |

> If `SENTIMENT_MODEL_API_URL` is not set, the app uses the keyword-based fallback automatically. This is fine for a capstone demo.

### How to get `SUPABASE_SERVICE_ROLE_KEY`

1. Go to [app.supabase.com](https://app.supabase.com)
2. Open your project
3. Click **Settings** (gear icon) → **API**
4. Under **Project API keys**, copy the **service_role** key (labeled "secret")
5. Paste it as `SUPABASE_SERVICE_ROLE_KEY` in Vercel

---

## Step 4 — Deploy

After adding all environment variables:

1. Click **"Deploy"** on Vercel
2. Wait 2–4 minutes for the build to complete
3. Vercel provides a URL like: `https://rise-on-ai-abc123.vercel.app`

You can also trigger a deploy anytime by:
```bash
git push origin main
```
Vercel automatically redeploys on every push to `main`.

---

## Step 5 — Run the Supabase SQL setup

The database tables must exist before users can log in. If you haven't already:

1. Go to [app.supabase.com](https://app.supabase.com) → your project → **SQL Editor**
2. Open the file `combined-supabase-setup.sql` from this project
3. Copy and paste the entire contents into the SQL editor
4. Click **Run**

This creates all tables, RLS policies, indexes, and triggers. It is safe to run multiple times (uses `IF NOT EXISTS`).

---

## Step 6 — Verify the deployment

Open your Vercel URL and check:

| Test | Expected result |
|---|---|
| `/` (landing page) | Loads without error |
| `/register` | Registration form appears with reCAPTCHA |
| `/login` | Login form appears |
| `/api/health` | Returns `{"status":"ok","service":"Rise On AI"}` |
| Register a new account | Email confirmation sent, profile created |
| Log in → Dashboard | Dashboard loads with mood chart |
| Write a journal entry | Entry saved, sentiment analysis runs (keyword fallback) |

---

## Vercel Free Tier Limits

| Limit | Free Tier | This project |
|---|---|---|
| Deployments | Unlimited | ✅ |
| Bandwidth | 100 GB/month | ✅ (capstone usage is minimal) |
| Serverless function execution | 100 GB-hours/month | ✅ |
| Function timeout | 10 seconds | ✅ (most routes <1s) |
| Team members | 1 (Hobby) | ✅ |
| Custom domain | Free | Optional |

> **Function timeout note:** The `/api/sentiment/analyze` route calls the Python server which may take 1–3 seconds. With the keyword fallback (no Python server), it completes in <100ms — well within the 10s limit.

---

## Custom Domain (optional)

If you have a domain name (e.g., from Namecheap or Google Domains):

1. Vercel project → **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `rise-on-ai.com`)
4. Copy the DNS records Vercel shows you
5. Add those records in your domain registrar's DNS settings
6. Wait 5–30 minutes for DNS propagation

HTTPS is automatically provisioned by Vercel — no extra steps.

---

## Updating the deployment

Every `git push` to `main` triggers an automatic redeploy:

```bash
# Make changes to your code, then:
git add .
git commit -m "your message"
git push origin main
# Vercel rebuilds automatically (takes ~2 minutes)
```

---

## Troubleshooting

### "Application error: a server-side exception has occurred"
- Check Vercel → **Deployments** → your latest deploy → **Functions** tab for logs
- Most common cause: missing environment variable

### "Invalid API key" or Supabase errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
- Make sure there are no extra spaces when pasting keys

### reCAPTCHA shows "invalid site key"
- Verify `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is the **Site Key** (not the Secret Key)
- Make sure the reCAPTCHA domain list includes your Vercel URL (`.vercel.app`)

### Admin operations fail (counselor assign, distress alerts)
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set under **Production** environment only

### Build fails on Vercel
- Run `npm run build` locally first — if it fails locally, it will fail on Vercel
- Check that all environment variables listed in Step 3 are added

---

## After deployment — add your Vercel URL to Supabase

1. Go to [app.supabase.com](https://app.supabase.com) → your project
2. **Authentication** → **URL Configuration**
3. Add your Vercel URL to **Site URL**: `https://rise-on-ai-abc123.vercel.app`
4. Add to **Redirect URLs**: `https://rise-on-ai-abc123.vercel.app/**`
5. Click **Save**

Without this, email confirmation links and password reset links will not redirect correctly.

---

## Notes for your Capstone documentation

You can state in your documentation:

> The Rise On AI system is deployed on **Vercel** (Next.js hosting) with **Supabase** providing the database and authentication services. The XLM-RoBERTa AI inference service is architected for deployment on **AWS EC2** (see `AWS_DEPLOYMENT.md`) — a keyword-based sentiment fallback is active in the current demo deployment. The production architecture diagram and AWS deployment plan are provided as appendices.

This is accurate, honest, and shows the full intended architecture without misrepresenting what is live.
