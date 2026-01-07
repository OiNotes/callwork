# Business Rules Documentation

## Sales Funnel
Stages (default labels):
1. zoomBooked - Booked for Zoom
2. zoom1Held - 1st Zoom held
3. zoom2Held - 2nd Zoom held
4. contractReview - Contract review
5. push - Push/objection handling
6. deal - Payment

Default benchmarks (percent):
- BOOKED_TO_ZOOM1: 60
- ZOOM1_TO_ZOOM2: 50
- ZOOM2_TO_CONTRACT: 40
- CONTRACT_TO_PUSH: 60
- PUSH_TO_DEAL: 70
- ZOOM1_TO_DEAL_KPI (North Star): 5

Benchmarks are configurable in ROP Settings.

## Commission Calculation
Commission is based on turnover tiers (default):
- 0 to 600,000: 0%
- 600,000 to 1,000,000: 5%
- 1,000,000 to 2,000,000: 7%
- 2,000,000 to 3,500,000: 8%
- 3,500,000 to 4,000,000: 9%
- 4,000,000 and above: 10%

Formula:
- factTurnover = sum of monthlySalesAmount for the period.
- hotTurnover = pipeline/hot deals (from reports).
- forecastTurnover = hotTurnover * forecastWeight (default 0.5).
- totalPotentialTurnover = factTurnover + forecastTurnover.
- factRate = commission rate for factTurnover.
- forecastRate = commission rate for totalPotentialTurnover.
- salaryFact = factTurnover * factRate.
- salaryForecast = totalPotentialTurnover * forecastRate.

Commission tiers are configurable in ROP Settings.

## Forecasting
Monthly forecast is a linear projection based on the current pace:
- dailyAverage = currentSales / daysPassed
- projectedTotal = dailyAverage * daysInMonth
- completion = projectedTotal / goal * 100
- expectedByNow = goal / daysInMonth * daysPassed
- pacing = (currentSales - expectedByNow) / expectedByNow * 100
- dailyRequired = (goal - currentSales) / daysRemaining

## Alerts
Alerts are created by the cron job and are idempotent (alertKey).
Rules (all configurable in ROP Settings):
- No report days: employee has no reports in the last N days -> WARNING.
- No deals days: employee has reports but zero deals in the last N days -> CRITICAL.
- Conversion drop: week-over-week drop in (deals / VZM) above threshold -> WARNING.

## Activity Score
Activity score is calculated per user:
- expectedActivity = 100 if there is at least one booking, else 0.
- actualActivity = min(100, (zoom1Held / max(1, zoomBooked)) * 100).
- activityScore = round((expectedActivity + actualActivity) / 2).

The target score is configurable in ROP Settings (default 80).
