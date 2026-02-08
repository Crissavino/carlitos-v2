---
name: db-reader
description: Query business databases (avocode, avocodebo) with pre-defined queries or arbitrary SELECT SQL. Use when asked about subscriptions, trials, revenue, invoices, refunds, or any business metrics from the database.
---

# DB Reader Skill

Read-only access to business databases. Supports both pre-defined queries and arbitrary SELECT SQL.

## Arbitrary SQL Queries

Run any SELECT query directly against the business databases:

```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js sql "SELECT * FROM avocode.subscriptions LIMIT 10"
```

### Rules
- Only `SELECT` statements are allowed
- `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE` are blocked
- All queries are logged to AuditLog
- Use `avocode.table_name` or `avocodebo.table_name` to reference tables

### Available Databases & Tables

**avocode** (billing, subscriptions, customers):
- subscriptions, invoices, customers, payments, payment_status
- products, currencies, companies, websites
- bo_periodicals, bo_periodical_transactions, bo_periodical_statuses
- bo_stripe_customers, bo_payu_customers, bo_revolut_customers, bo_tap_customers

**avocodebo** (backoffice, ads, campaigns):
- campaigns, ads, fixed_expenses
- zoho_customers, zoho_invoices, zoho_payments, zoho_organizations

### Show Schema

```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js schema
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js schema avocode
```

## Pre-defined Queries

| Query ID | Description |
|----------|-------------|
| `active-subscriptions` | Count of active subscriptions by plan type |
| `trials-last-7-days` | New trials in the last 7 days, by day |
| `daily-revenue-7d` | Revenue breakdown (subscriptions, trials, refunds) last 7 days |
| `first-rebills-7d` | First rebills in the last 7 days |
| `second-rebills-7d` | Second rebills in the last 7 days |
| `ad-spend-7d` | Ad spend last 7 days |
| `campaign-performance` | Full metrics per campaign |
| `customer-counts` | Total and active customer counts |
| `customer-cohort-distribution` | M1, M2, M3 distribution |
| And more... | Run without arguments to see all available query IDs |

### Run a pre-defined query

```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js <query-id>
```

## Security

- Write operations (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE) are blocked
- Connection uses read-only database credentials
- All executions (including arbitrary SQL) are logged to AuditLog

## Output Format

Results are returned as JSON with:
- `queryId`: The executed query or "sql" for arbitrary queries
- `status`: "success", "error", or "blocked"
- `results`: Query results (raw rows for arbitrary SQL, formatted for pre-defined queries)
- `meta`: Execution time and row count
