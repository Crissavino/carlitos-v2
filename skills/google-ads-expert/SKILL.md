---
name: google-ads-expert
description: Google Ads metrics observer. Use when asked about ad campaigns, clicks, impressions, cost, conversions, or Google Ads performance. Read-only mode - cannot modify campaigns.
---

# Google Ads Expert Skill

Observer mode access to Google Ads metrics via Google Ads Scripts webhook.

## Capabilities

- View campaign metrics (cost, clicks, impressions, conversions)
- Read historical data ingested from Google Ads Scripts
- Analyze campaign performance

## Limitations (Observer Mode)

- Cannot modify campaigns
- Cannot change budgets
- Cannot pause/enable campaigns
- Read-only access only

## Data Source

Data is ingested via webhook from Google Ads Scripts. The script runs on schedule and POSTs metrics to the webhook endpoint.

## Usage

### View latest ingested data
```bash
node /root/.openclaw/custom-skills/dist/skills/google-ads-expert/cli.js latest
```

### View data for specific date
```bash
node /root/.openclaw/custom-skills/dist/skills/google-ads-expert/cli.js date 2026-01-31
```

## Metrics Available

| Metric | Description |
|--------|-------------|
| cost | Total ad spend in account currency |
| clicks | Number of ad clicks |
| impressions | Number of ad views |
| conversions | Conversion events |
| conversionValue | Monetary value of conversions |
| ctr | Click-through rate (clicks/impressions) |
| cpc | Cost per click (cost/clicks) |
| conversionRate | Conversions per click |

## Output Format

Results include:
- Account info (ID, name, currency)
- Date range of metrics
- Campaign-level breakdown
- Calculated metrics (CTR, CPC, conversion rate)
