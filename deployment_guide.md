# Deployment Guide: Vercel Monorepo Setup

This guide walks you through deploying both the **Next.js Frontend** and the **Express Backend** of Advent CRM to Vercel as two separate projects linked to the same Git repository.

---

## Prerequisites
1. A **Vercel** account (linked to GitHub).
2. A **MongoDB Atlas** database cluster (configured to allow access from any IP: `0.0.0.0/0`, which is required for serverless platforms like Vercel).

---

## Step 1: Push Your Code to GitHub
Ensure all your local changes are committed and pushed to your remote repository on GitHub:
```bash
git add .
git commit -m "Configure Vercel monorepo deployment"
git push origin master
```

---

## Step 2: Deploy the Express Backend
First, we deploy the backend serverless API so we can get its live URL for the frontend.

1. Go to your **Vercel Dashboard** and click **Add New** → **Project**.
2. Select your repository from the list.
3. On the configuration screen:
   - **Project Name**: `advent-crm-api` (or similar)
   - **Framework Preset**: Select **Other** (do NOT select Next.js here)
   - **Root Directory**: Click "Edit" and choose the `server` folder.
4. Expand **Environment Variables** and add the following:
   - `MONGODB_URI`: *Your MongoDB connection string*
   - `JWT_SECRET`: *A secure random string (e.g. `advent_leads_super_secret_jwt_key_2026`)*
   - `NODE_ENV`: `production`
5. Click **Deploy**. Once completed, copy the generated deployment URL (e.g. `https://advent-crm-api.vercel.app`).

---

## Step 3: Deploy the Next.js Frontend
Now, we deploy the Next.js frontend, pointing it to the newly deployed backend API.

1. Return to your **Vercel Dashboard** and click **Add New** → **Project** again.
2. Select the same repository.
3. On the configuration screen:
   - **Project Name**: `advent-crm-client` (or similar)
   - **Framework Preset**: Auto-detected as **Next.js**
   - **Root Directory**: Click "Edit" and choose the `client` folder.
4. Expand **Environment Variables** and add the following:
   - `NEXT_PUBLIC_API_URL`: *The URL of your deployed Express backend from Step 2 (e.g. `https://advent-crm-api.vercel.app`)*
5. Click **Deploy**.

---

## Step 4: Verify the Deployment
Once the frontend is deployed, open the client URL. Try:
1. Accessing `/login`.
2. Logging in with your Admin credentials.
3. Testing page features like filtering, toggling the sidebar, and updating follow-up cards.
