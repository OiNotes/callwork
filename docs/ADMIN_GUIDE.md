# Administrator Guide

## User Management
- Open the admin users page: `/dashboard/admin/users`.
- Create employees or managers using the create form.
- Edit a user to update name, email, role, or password.
- Deactivate/reactivate users by toggling "Active" (deactivated users cannot sign in).
- Use bulk actions to deactivate multiple employees at once.

## Monthly Goals
- Open `/dashboard/admin/goals`.
- Enter a monthly goal for each user and click Save.
- Goal history is tracked and visible on the same page.
- Import goals from CSV/XLSX via the import button:
  - Required columns: `email`, `monthlyGoal`.

## Settings
Open `/dashboard/settings/rop` to configure business rules:
- Department goal and manager plans.
- Funnel conversion benchmarks.
- Alert thresholds (warning/critical levels in analytics).
- Alert rules:
  - No report days.
  - No deals days.
  - Conversion drop percent.
- Telegram settings:
  - Registration code TTL (minutes).
  - Report session TTL (minutes).
- Period start day.
- Activity score target.
- Commission tiers (motivation grades).

Changes apply immediately after saving.

## Telegram Bot
- Set `TELEGRAM_BOT_TOKEN` and start the bot: `npm run bot:start`.
- Employee connection flow:
  1. User signs in to the web app.
  2. Go to Profile and generate a code.
  3. In Telegram, send `/register` to the bot and enter the code.
  4. The code is valid for the configured TTL.
- Report flow:
  1. Send `/report`.
  2. Follow the steps to submit daily metrics.
  3. The session expires after the configured TTL.

## Reports and Export
- Manual report entry: `/dashboard/report`.
- Export reports (manager only):
  - `/api/export/reports?format=xlsx&startDate=YYYY-MM-DDT00:00:00.000Z&endDate=YYYY-MM-DDT23:59:59.999Z`
- Export leaderboard (manager only):
  - `/api/export/leaderboard?format=xlsx&period=month`

## Troubleshooting
- Login issues: verify `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and database connectivity.
- Bot not responding: confirm `TELEGRAM_BOT_TOKEN` and that the bot process is running.
- No alerts: verify cron scheduler is calling `/api/cron/check-alerts` with the correct secret.
- Missing data: check that reports exist for the selected date range.
