---
name: db-reader
description: Query business databases (avocode, avocodebo) with pre-approved read-only queries. Use when asked about subscriptions, trials, revenue, invoices, refunds, or any business metrics from the database.
---

# DB Reader Skill

Read-only access to business databases via whitelisted queries.

## Available Queries

| Query ID | Description |
|----------|-------------|
| `active-subscriptions` | Count of active subscriptions by plan type |
| `trials-last-7-days` | New trials in the last 7 days, by day |
| `daily-revenue-7d` | Revenue breakdown (subscriptions, trials, refunds) last 7 days |

## Usage

Run the query script with the query ID:

```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js <query-id>
```

## Examples

### Get active subscriptions
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js active-subscriptions
```

### Get trials last 7 days
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js trials-last-7-days
```

### Get daily revenue
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js daily-revenue-7d
```

## Security

- All queries are read-only (SELECT only)
- Queries must be pre-approved in the whitelist
- All executions are logged to AuditLog
- No raw SQL allowed - only query IDs

## Output Format

Results are returned as JSON with:
- `queryId`: The executed query
- `status`: "success" or "error"
- `results`: Query-specific formatted data
- `meta`: Execution time and row count
