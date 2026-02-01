#!/usr/bin/env node
/**
 * Google Ads Expert CLI
 * Usage:
 *   node cli.js latest           - Get latest campaign spend data (7d)
 *   node cli.js spend30d         - Get 30d campaign spend data
 *   node cli.js check            - Check if there's any campaign data
 */

import { getCampaignSpend, hasCampaignData } from "./ingest.js";

const command = process.argv[2];

async function main() {
  if (!command) {
    console.error("Usage:");
    console.error("  node cli.js latest    - Get latest campaign spend data (7d)");
    console.error("  node cli.js spend30d  - Get 30d campaign spend data");
    console.error("  node cli.js check     - Check if there's any campaign data");
    process.exit(1);
  }

  if (command === "latest") {
    const data = await getCampaignSpend('7d');
    if (data.length === 0) {
      console.log(JSON.stringify({ error: "No campaign data found" }));
      process.exit(1);
    }
    console.log(JSON.stringify({ count: data.length, campaigns: data }, null, 2));
    process.exit(0);
  }

  if (command === "spend30d") {
    const data = await getCampaignSpend('30d');
    if (data.length === 0) {
      console.log(JSON.stringify({ error: "No 30d campaign data found" }));
      process.exit(1);
    }
    console.log(JSON.stringify({ count: data.length, campaigns: data }, null, 2));
    process.exit(0);
  }

  if (command === "check") {
    const hasData = await hasCampaignData();
    console.log(JSON.stringify({ hasData }));
    process.exit(hasData ? 0 : 1);
  }

  console.error("Unknown command: " + command);
  process.exit(1);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
