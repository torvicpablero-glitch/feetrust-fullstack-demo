# feetrust — Full-Stack Web Application (Sanitized Demo)

This is a full-stack web application with a Node/TypeScript backend and a Vite frontend.
The original project contained sensitive data and API keys; they have been removed or
replaced with dummy values for public sharing.

## Overview
A web app that demonstrates full-stack development skills: backend API routes in
TypeScript (`server.ts`), frontend UI built with Vite/TypeScript, and deployment to
Vercel (configuration in `vercel.json`).

## Tech stack
- Node.js
- TypeScript
- Vite
- Vercel (serverless functions + static site)
- JSON-based data storage (placeholder files)

## How to run locally
1. Install Node.js (>=18 recommended).
2. `npm install`
3. Copy `.env.example` to `.env` if you want to test API keys (leave empty or add dummy keys for local testing).
4. `npm run dev` (starts Vite dev server; backend runs via Vercel CLI or `ts-node server.ts` depending on setup).
5. Build for production: `npm run build` then `vercel --prod` or serve the `dist/` folder.

## Notes
- The original `.env.local`, `users.json`, and `data.json` files have been removed for privacy.
- Placeholder empty JSON files exist so the app can start without errors.
- To see real functionality, you would need to populate the data files and add valid API keys to `.env` (not committed).