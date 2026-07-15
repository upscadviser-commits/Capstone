# Deployment Guide: Render & Vercel Hosting

This guide outlines how to deploy the Market Intelligence & Corporate Analysis Dashboard to production. Since the application is split into a **Vite React frontend** and a **Flask backend**, we will deploy them as two separate services.

---

## 1. Render Free Tier Limitations & Solutions

Render offers a generous **Free Tier**, but it has two key limitations:
1. **Sleep Inactivity**: Free web services automatically spin down (go to sleep) after 15 minutes of inactivity. The first request after a spin-down will take ~50 seconds to boot up.
2. **Ephemeral Disk**: The storage is non-persistent. Every time the Flask backend redeploys or restarts, the SQLite database (`market_intelligence.db`) and ChromaDB vector store (`chroma_db/`) are deleted.

### How to Persist Data on Render:
- **Option A (Recommended for Free Tier)**: Use remote databases.
  - **Relational DB**: Swap SQLite for a free serverless PostgreSQL database on **Neon** (https://neon.tech).
  - **Vector DB**: Use a free hosted database instance like **Pinecone** or **Supabase (pgvector)** instead of a local ChromaDB folder.
- **Option B (Paid Tier)**: Attach a **Render Persistent Disk** (requires a paid Starter web service, ~$7/month) mounted at `/data` and update your database paths in code to point to `/data/market_intelligence.db` and `/data/chroma_db/`.

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Prepare the Code
1. In `client/src/App.tsx`, ensure the API base URL points to your deployed backend instead of `http://localhost:5000`. You can handle this dynamically using Vite environment variables:
   ```typescript
   const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
   ```
2. Make sure you have `gunicorn` in your Python dependencies to serve the Flask app in production. In [requirements.txt](file:///Users/vidushikaushik/Desktop/Lab/Capstone/server/requirements.txt), add:
   ```text
   gunicorn==22.0.0
   ```

### Step 2: Deploy the Flask Backend (Render Web Service)
1. Log in to the [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your GitHub repository and choose the `feature/improved-capstone` branch.
3. Configure the service settings:
   - **Name**: `market-intelligence-api`
   - **Root Directory**: `server`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
4. Add the following **Environment Variables** in the service settings:
   - `GEMINI_API_KEY`: *Your Google Gemini API Key*
   - `SECRET_KEY`: *A secure random string for JWT signing*
   - `DATABASE_URL`: *(If using PostgreSQL/Neon instead of SQLite)*
5. Click **Deploy Web Service**.

### Step 3: Deploy the React Frontend (Vercel or Render)
We recommend deploying the frontend on **Vercel** because it is completely free, features global CDN delivery, and has **zero sleep time**.

#### Option A: Deploying on Vercel (Recommended)
1. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Connect your GitHub repository and select the `client` directory as the root.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add an **Environment Variable**:
   - `VITE_API_URL`: *The URL of your deployed Render backend web service (e.g. `https://market-intelligence-api.onrender.com`)*
5. Click **Deploy**.

#### Option B: Deploying on Render (Static Site)
1. On the Render dashboard, click **New > Static Site**.
2. Configure settings:
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. Add the `VITE_API_URL` environment variable.
4. Under **Redirects/Rewrites**, add a rule to support client-side routing:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
