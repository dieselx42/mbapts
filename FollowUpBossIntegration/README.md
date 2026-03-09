# Follow Up Boss Custom API Integration

This service receives newsletter delivery/open/click events from your email platform, creates (or reuses) Follow Up Boss email campaigns, and forwards engagement as `emEvents`.

It also supports your rule:

- If a contact clicks 3 preconstruction emails in 14 days -> apply tag `Preconstruction Active`.

## What this service does

1. `POST /webhooks/email-events`
- Validates payload.
- Resolves/creates `emCampaign` in Follow Up Boss.
- Sends event batches to `/v1/emEvents`.
- Optionally tags qualifying contacts in Follow Up Boss.

2. `GET /health`
- Liveness check.

## Files

- `src/index.js` - HTTP server and request flow.
- `src/fubClient.js` - Follow Up Boss API client.
- `src/services/campaignRegistry.js` - campaign deduping by `origin + originId`.
- `src/services/eventForwarder.js` - event normalization and batch forwarding.
- `src/services/engagementScorer.js` - threshold logic (3 clicks / 14 days).
- `src/services/tagger.js` - person lookup and tag merge.
- `examples/email-events.payload.json` - sample webhook payload.

## Setup

1. Create environment file:

```bash
cd /Users/felipegallego/Documents/MBAPTS/FollowUpBossIntegration
cp .env.example .env
```

2. Edit `.env`:
- `FUB_API_KEY` (required)
- `INGEST_TOKEN` (recommended)
- Optional campaign/tag settings.

3. Run service:

```bash
node --env-file=.env src/index.js
```

## Test locally

```bash
curl -X POST http://localhost:8787/webhooks/email-events \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: replace-with-random-token" \
  --data @examples/email-events.payload.json
```

## Input payload contract

```json
{
  "campaign": {
    "originId": "unique-campaign-id-from-your-ESP",
    "type": "new_construction",
    "name": "Campaign Name",
    "subject": "Subject line",
    "bodyHtml": "<html>...</html>",
    "sentAt": "2026-03-05T16:00:00Z"
  },
  "events": [
    {
      "type": "delivered|open|click|unsubscribe|bounce",
      "recipient": "lead@example.com",
      "occurredAt": "2026-03-05T16:11:10Z",
      "url": "https://optional-click-url.example"
    }
  ]
}
```

## ESP mapping guide

Map your provider webhook fields to this payload:

1. `campaign.originId`: provider campaign id.
2. `campaign.type`: use `new_construction`, `market_intelligence`, `miami_lifestyle`, or `weekly_brief`.
3. `events[].recipient`: recipient email.
4. `events[].type`: normalize to delivered/open/click/unsubscribe/bounce.
5. `events[].occurredAt`: ISO timestamp.

## Recommended production hardening

1. Put service behind HTTPS and a reverse proxy.
2. Validate webhook signatures from your ESP.
3. Store `campaign-map.json` and `engagement.json` on persistent storage.
4. Add retry queue for temporary Follow Up Boss API errors.
5. Add alerting on non-200 responses from Follow Up Boss.

## Notes

- Follow Up Boss API responses can vary by endpoint version/account settings. This service includes fallback parsing and logs API errors with payload details.
- If person lookup by email does not match your account setup, disable auto-tagging (`ENABLE_PRECONSTRUCTION_TAG=false`) and handle tags in your own CRM workflow while still syncing campaign engagement.
