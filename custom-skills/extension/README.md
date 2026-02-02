# OpenClaw Browser Context Extension

Read-only context provider for OpenClaw. **Eyes only - no hands, no mouth.**

## Restrictions

- NO clicks
- NO form filling
- NO navigation
- NO DOM modification
- NO script execution
- NO data persistence (TTL: 30 min)

## Installation

### Chrome (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repository

### Verify Installation

1. The extension icon should appear in Chrome toolbar
2. Visit an allowed domain (e.g., localhost, carlitos-bot.com)
3. Badge should show green checkmark `✓`

## Allowed Domains

| Domain | Access |
|--------|--------|
| carlitos-bot.com | dom, tables, screenshot |
| avocode-bo.online | dom, tables, screenshot |
| conversie-pdf.com | dom, tables, screenshot |
| convierte-pdf.com | dom, tables, screenshot |
| device-finder.com | dom, tables, screenshot |
| noxtools.com | dom, tables, screenshot |
| github.com/crissavino/* | dom, tables |
| localhost | dom, tables, screenshot |
| 127.0.0.1 | dom, tables, screenshot |

## Blocked Domains

- Google Ads UI (ads.google.com, adwords.google.com)
- Gmail (mail.google.com)
- Banking sites
- PayPal, Stripe Dashboard

## How It Works

1. Extension injects content script on allowed domains
2. Content script extracts page data (text, tables, headings, links)
3. Data is sanitized (sensitive patterns redacted)
4. Context sent to OpenClaw server (localhost:3847)
5. Context expires after 30 minutes (no persistence)

## Files

```
extension/
├── manifest.json           # Chrome Extension Manifest V3
├── config/
│   └── allowlist.json     # Domain allowlist + permissions
├── background/
│   └── service-worker.js  # Allowlist validation, server comm
├── content/
│   ├── extractor.js       # Page content extraction
│   └── sanitizer.js       # Sensitive data redaction
└── icons/                  # Extension icons (to create)
```

## Development

```bash
# Watch for changes (Chrome auto-reloads)
# Just save files and click refresh on chrome://extensions/
```

## Security

- Sensitive data (passwords, API keys, credit cards, SSN) is automatically redacted
- Only localhost communication (no external servers)
- Content expires after 30 minutes
- Screenshot requires explicit invocation
