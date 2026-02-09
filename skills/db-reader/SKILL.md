---
name: db-reader
description: Query business databases (avocode, avocodebo) with pre-approved queries OR free-form read-only SQL. Use when asked about subscriptions, trials, revenue, invoices, refunds, or any business metrics from the database.
---

# DB Reader Skill

Read-only access to business databases. Supports pre-approved query IDs and free-form SQL queries.

## Modes of Use

### 1. Free-form SQL (Recommended for ad-hoc questions)

Run any read-only SQL query against the database:

```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js sql "SELECT ..."
```

Only SELECT and WITH (CTEs) are allowed. INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE are blocked.

### 2. Schema Discovery

List all tables in the database:
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js schema
```

Describe a specific table's columns:
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js schema <table_name>
```

### 3. Pre-approved Queries

Run a pre-approved query by ID:
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js <query-id>
```

## Databases

The connection uses the configured core database (avocode). Tables from avocodebo can be referenced with the `avocodebo.` prefix.

### Key Tables (avocode)

| Table | Description |
|-------|-------------|
| `subscriptions` | All subscriptions (trials, active, cancelled) |
| `invoices` | Payment invoices (trials, rebills, refunds) |
| `customers` | Customer records |
| `currencies` | Currency definitions |
| `websites` | Website/brand definitions |
| `companies` | Company entities |
| `countries` | Country definitions |

### Key Tables (avocodebo)

| Table | Description |
|-------|-------------|
| `avocodebo.ad_costs` | Advertising spend data |
| `avocodebo.campaigns` | Marketing campaign definitions |

## Free-form SQL Examples

### Count active subscriptions
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js sql "SELECT COUNT(*) as total FROM subscriptions WHERE status = 'active'"
```

### Gross turnover last 30 days
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js sql "SELECT SUM(amount) as gross_turnover FROM invoices WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status = 1"
```

### Revenue by currency
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js sql "SELECT c.code as currency, SUM(i.amount) as total FROM invoices i JOIN currencies c ON i.currency_id = c.id WHERE i.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY c.code"
```

### Discover table structure
```bash
node /root/.openclaw/custom-skills/dist/skills/db-reader/cli.js schema subscriptions
```

## Workflow for Ad-hoc Questions

1. **Discover schema**: Use `schema` to list tables, then `schema <table>` to see columns
2. **Write query**: Craft a SELECT query based on the discovered schema
3. **Execute**: Run via `sql "SELECT ..."`
4. **Iterate**: Refine query based on results

## Available Pre-approved Query IDs

| Query ID | Description |
|----------|-------------|
| `active-subscriptions` | Count of active subscriptions by plan type |
| `trials-last-7-days` | New trials in the last 7 days, by day |
| `daily-revenue-7d` | Revenue breakdown last 7 days |
| `first-rebills-7d` | First rebills last 7 days |
| `second-rebills-7d` | Second rebills last 7 days |
| `ad-spend-7d` | Ad spend last 7 days |
| `ltv-30d` / `ltv-45d` / `ltv-90d` | LTV calculations |
| `campaign-performance` | Full metrics per campaign |
| `campaign-summary` | Lightweight campaign summary |
| `customer-counts` | Total and active customer counts |
| `chargeback-rate` | Chargeback rate |
| `base-instalada` | Customers with >1 rebill |

## Security

- **DB-level**: User `openclaw_reader` has SELECT-only permissions in MySQL
- **App-level**: SQL must start with SELECT or WITH; dangerous keywords are blocked
- **Audit**: All queries (successful and blocked) are logged to AuditLog

## Output Format

Results are returned as JSON with:
- `status`: "success" or "error"
- `results`: Query result rows
- `meta`: Execution time and row count
