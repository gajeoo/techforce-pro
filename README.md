# TechForce Pro

Workforce management platform for **Multicorp Fire Protection Services** — scheduling, profit tracking, invoicing, and multi-role portals.

[![Deploy to Convex + Vercel](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/actions/workflows/deploy.yml)

> **Setup:** Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` in the badge above with your actual GitHub owner and repository name once this repo is pushed to GitHub.

## Overview

TechForce Pro is an internal web application for managing field technicians, job scheduling, customer relationships, van fleet GPS tracking, and financial reporting. It supports four role-based portals:

- **Manager/Admin** — Command center dashboard, scheduling, invoicing, profit engine, time-off approvals
- **Supervisor** — Today's schedule and live status updates
- **Technician** — Personal schedule, shop day tracker, time-off requests
- **Customer** — Upcoming visits, open invoices, service history

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express 5 + Drizzle ORM + PostgreSQL
- **Deployment**: Convex (functions) + Vercel (frontend)
- **Tooling**: pnpm workspaces, TypeScript, Zod, React Query

## GitHub Actions Secrets

The following secrets must be configured in the GitHub repository (Settings → Secrets and variables → Actions) before the deploy pipeline will work:

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal access token (create at vercel.com/account/tokens) |
| `VERCEL_TEAM_ID` | Vercel team ID (e.g. `team_xxxxxxxxxxxxxxxxxxxx`) — found in the team's Settings page |
| `VERCEL_PROJECT_ID` | Vercel project ID (e.g. `prj_xxxxxxxxxxxxxxxxxxxx`) — found in the project's Settings page |
| `CONVEX_DEPLOY_KEY` | Convex deploy key for the production deployment |
| `VITE_CONVEX_URL` | Convex deployment URL (e.g. `https://<name>.convex.cloud`) — found in the Convex dashboard |

## Development

See `replit.md` for full stack details, run commands, and architecture decisions.

## Getting Started

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API on port 8080
pnpm --filter @workspace/techforce-pro run dev # Frontend (Vite)
```

Required environment variables: `DATABASE_URL`, `SESSION_SECRET`
