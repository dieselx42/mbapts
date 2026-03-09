# Lead Funnel Dashboard (Next.js + TypeScript + Tailwind)

Small web app that reads local CSV lead data, computes priority scoring, and shows:

- Today Queue (top 20 by priority with quick actions)
- Buyer timeline by month (purchase vs rental with monthly totals)
- Lead temperature bands (Hot/Warm/Cold/New) with thickness by % of leads
- Funnel visualization with bucket filters
- Lead filters
- Manual "Refresh Data" button in dashboard header
- Export prioritized CSV

## Local Run

1. Install dependencies

```bash
npm install
```

2. Create environment file (optional path override)

```bash
cp .env.local.example .env.local
```

3. Start dev server

```bash
npm run dev
```

Open:

- Main dashboard: `http://localhost:3000/`
- Sample screenshot route: `http://localhost:3000/sample`

## CSV Input

The API reads from these defaults (first available):

1. `/mnt/data/leads-2026-03-08.csv`
2. `/Users/felipegallego/Downloads/leads-2026-03-08.csv`
3. `/mnt/data/all-people-2026-03-08.csv`
4. `/Users/felipegallego/Downloads/all-people-2026-03-08.csv`
5. `/mnt/data/all-people-2026-03-07.csv`
6. `/Users/felipegallego/Downloads/all-people-2026-03-07.csv`
7. `/mnt/data/all-people-2026-03-05.csv`
8. `/Users/felipegallego/Downloads/all-people-2026-03-05.csv`

Override with env var:

`LEADS_CSV_PATH=/your/path/file.csv`

Expected columns:

- Date Added
- Name
- Stage
- Timeframe
- Is Contacted
- Listing Price
- Property Price
- Tags
- Assigned To
- Email 1
- Phone 1
- Property Address
- Property City
- Property MLS Number

## API

`GET /api/leads`

Returns parsed + scored JSON payload for the dashboard.
Also returns `refreshedAt` for UI refresh timestamp.

Data source selection:

- `LEADS_SOURCE=fub` -> Pull from Follow Up Boss API `/people`.
- `LEADS_SOURCE=csv` -> Pull from local CSV fallback chain.
- You can override per request with `/api/leads?source=fub` or `/api/leads?source=csv`.

Vercel production recommendation:

- Dashboard loader calls `/api/leads?source=fub`, so production requires a valid `FUB_API_KEY`.
- On Vercel, CSV mode is disabled and the API is forced to Follow Up Boss.
- Set these Vercel environment variables:
  - `FUB_API_KEY`
  - `FUB_BASE_URL=https://api.followupboss.com/v1`
  - `FUB_SYSTEM_NAME=lead-funnel-dashboard`
- Optional tuning:
  - `LEADS_FUB_PAGE_SIZE=100`
  - `LEADS_FUB_MAX_PAGES=20`

`GET /api/fub/ping`

Server-side Follow Up Boss connectivity check.

`GET /api/fub/people?page=1&limit=25`

Server-side Follow Up Boss people fetch (proxied).

If `FUB_PROXY_TOKEN` is set, call these with:

`Authorization: Bearer <token>`

## Scoring + Funnel Config

Adjust these files:

- `lib/leads/config.ts` (stage weights, timeframe weights, funnel stage mapping)
- `lib/leads/scoring.ts` (priority scoring formula, next-action rules, flags)

## Notes

- `DNC` / `Do Not Contact` tags subtract 50 and are excluded from default queue.
- `Bounced` tag sets `email_bounced` flag and email action is disabled.
- CSV parser handles quoted multiline fields in rows.
- Timeline month is inferred from `Estim. Moving Date`, `Move-in Date`, `Notes`/`Description`/`Message`, then timeframe fallback.
- Transaction type is inferred as `rental` vs `purchase` from notes/tags/lead source and value heuristics.
- Temperature bands support click-to-filter and purchase/rental toggles with total lead counts.
