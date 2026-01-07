# Deployment Guide

## Requirements
- Node.js 20+
- PostgreSQL 14+ (or a Neon account)
- Telegram Bot Token (from @BotFather)
- A cron scheduler for alerts

## Environment Variables
Required:
- DATABASE_URL: PostgreSQL connection string used by Prisma.
- NEXTAUTH_SECRET: secret for NextAuth JWT/signing (generate with `openssl rand -base64 32`).
- NEXTAUTH_URL: public base URL (example: `https://crm.example.com`).
- TELEGRAM_BOT_TOKEN: Telegram bot token.
- CRON_SECRET: bearer token for `/api/cron/check-alerts` (required; cron must send `Authorization: Bearer <secret>`).

Optional (Docker database):
- POSTGRES_PASSWORD: password for the `callwork_user` in `docker-compose.yml`.
- PGADMIN_DEFAULT_EMAIL: login email for pgAdmin (default `admin@callwork.local`).
- PGADMIN_DEFAULT_PASSWORD: password for pgAdmin.

Optional (seed/ops scripts):
- SEED_PASSWORD: plain password used by seed scripts.
- SEED_PASSWORD_HASH: bcrypt hash (overrides SEED_PASSWORD).
- MANAGER_PASSWORD: password for the first manager created by `scripts/create-manager.ts`.
- MANAGER_PASSWORD_HASH: bcrypt hash (overrides MANAGER_PASSWORD).
- EMPLOYEE_PASSWORD: password used by employee seed scripts.
- EMPLOYEE_PASSWORD_HASH: bcrypt hash (overrides EMPLOYEE_PASSWORD).
- CHECK_PASSWORD: password used by `scripts/check-password.ts`.
- CHECK_PASSWORD_HASH: bcrypt hash (overrides CHECK_PASSWORD).
- RESET_PASSWORD: password used by reset scripts.
- RESET_PASSWORD_HASH: bcrypt hash (overrides RESET_PASSWORD).

## Deployment Steps
1. Clone the repository.
2. Install dependencies:
   - `npm ci`
3. Create and fill `.env` from `.env.example`.
4. Run migrations:
   - `npx prisma migrate deploy`
5. Create the first manager account:
   - `npm run db:create-manager`
   - Uses `MANAGER_PASSWORD` or `MANAGER_PASSWORD_HASH` (falls back to `SEED_PASSWORD`).
6. Build and start the app:
   - `npm run build && npm start`
7. Start the Telegram bot:
   - `npm run bot:start`

## Vercel Deployment
1. Import the repo in Vercel.
2. Set required environment variables in Vercel (see list above).
3. Build command: `npm run vercel-build` (default is OK if unchanged).
4. Deploy.
5. Run the Telegram bot as a separate process (VM, container, or worker) because Vercel does not keep long-lived bot processes running.

## Docker Deployment
This repo ships a Docker Compose file for PostgreSQL + pgAdmin.
1. Set `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` in `.env`.
2. Start services:
   - `docker-compose up -d`
3. Set `DATABASE_URL` to use the Docker database (`postgresql://callwork_user:<POSTGRES_PASSWORD>@localhost:5432/callwork`).
4. Run migrations and start the app as shown above.

## First Admin Setup
- Run `npm run db:create-manager`.
- The script creates a manager with email `manager@callwork.com`.
- Set the password via `MANAGER_PASSWORD` or `MANAGER_PASSWORD_HASH`.
