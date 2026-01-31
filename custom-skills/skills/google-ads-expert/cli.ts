#!/usr/bin/env node
/**
 * Google Ads Expert CLI
 * Usage: 
 *   node cli.js latest
 *   node cli.js date <YYYY-MM-DD>
 */

import { getLatestRecord, readRecords } from "./ingest.js";

const command = process.argv[2];

if (!command) {
  console.error("Usage:");
  console.error("  node cli.js latest           - Get latest ingested data");
  console.error("  node cli.js date <YYYY-MM-DD> - Get data for specific date");
  process.exit(1);
}

if (command === "latest") {
  const record = getLatestRecord();
  if (!record) {
    console.log(JSON.stringify({ error: "No data ingested yet" }));
    process.exit(1);
  }
  console.log(JSON.stringify(record, null, 2));
  process.exit(0);
}

if (command === "date") {
  const date = process.argv[3];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Error: Invalid date format. Use YYYY-MM-DD");
    process.exit(1);
  }
  const records = readRecords(date);
  console.log(JSON.stringify({ date, records }, null, 2));
  process.exit(0);
}

console.error("Unknown command: " + command);
process.exit(1);
