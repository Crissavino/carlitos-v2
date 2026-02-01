/**
 * Webhook Server for Google Ads Ingest
 *
 * Expone POST /ingest/google-ads para recibir datos de Google Ads Scripts
 */

import http from "http";
import { handleIngest, handleKeywordsIngest, handleSearchTermsIngest } from "./skills/google-ads-expert/ingest.js";

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Log incoming request for debugging
  console.log(`[webhook] ${req.method} ${req.url}`);

  // Handle POST /ingest/google-ads/search-terms (Search Terms - Phase 8B)
  if (req.method === "POST" && req.url === "/ingest/google-ads/search-terms") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const authHeader = req.headers.authorization;

        console.log("[webhook] Received search terms ingest request");

        const result = await handleSearchTermsIngest(authHeader, payload);

        res.writeHead(result.success ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result));

        console.log("[webhook] Search terms ingest result:", result.success ? "success" : "failed");
      } catch (error) {
        console.error("[webhook] Search terms error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Internal server error" }));
      }
    });

    return;
  }

  // Handle POST /ingest/google-ads/keywords (Keywords - Phase 8A)
  if (req.method === "POST" && req.url === "/ingest/google-ads/keywords") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const authHeader = req.headers.authorization;

        console.log("[webhook] Received keywords ingest request");

        const result = await handleKeywordsIngest(authHeader, payload);

        res.writeHead(result.success ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result));

        console.log("[webhook] Keywords ingest result:", result.success ? "success" : "failed");
      } catch (error) {
        console.error("[webhook] Keywords error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Internal server error" }));
      }
    });

    return;
  }

  // Handle POST /ingest/google-ads (Campaigns)
  if (req.method === "POST" && req.url?.startsWith("/ingest/google-ads")) {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const authHeader = req.headers.authorization;

        console.log("[webhook] Received campaigns ingest request");

        const result = await handleIngest(authHeader, payload);

        res.writeHead(result.success ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result));

        console.log("[webhook] Campaigns ingest result:", result.success ? "success" : "failed");
      } catch (error) {
        console.error("[webhook] Campaigns error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Internal server error" }));
      }
    });

    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "webhook-server" }));
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[webhook] Server listening on http://0.0.0.0:${PORT}`);
  console.log(`[webhook] Endpoints:`);
  console.log(`[webhook]   POST /ingest/google-ads              (Campaigns)`);
  console.log(`[webhook]   POST /ingest/google-ads/keywords     (Keywords)`);
  console.log(`[webhook]   POST /ingest/google-ads/search-terms (Search Terms)`);
});
