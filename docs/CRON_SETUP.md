# CRON Job Setup

## Purpose
Automatic alerts for:
- Missing daily reports
- No deals in X days
- Conversion drops

## Setup Options

### Option 1: Vercel Cron
- Ensure the project is deployed on Vercel.
- Use the schedule in `vercel.json` (default: daily at 09:00).
- Set `CRON_SECRET` in the environment and configure the cron request to send:
  - `Authorization: Bearer YOUR_CRON_SECRET`
- If your Vercel plan does not support custom headers for cron, use an external cron service instead.

### Option 2: External Service (cron-job.org, EasyCron)
1. Set `CRON_SECRET` in the environment.
2. Configure a GET request to:
   - `https://your-domain/api/cron/check-alerts`
3. Add header:
   - `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: Self-hosted (Linux crontab)
Example (runs daily at 09:00):
```
0 9 * * * curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron/check-alerts
```

## Testing
```
curl -X GET "https://your-domain/api/cron/check-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
