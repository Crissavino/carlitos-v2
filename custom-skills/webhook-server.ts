/**
 * Webhook Server for Google Ads Ingest
 *
 * Expone POST /ingest/google-ads para recibir datos de Google Ads Scripts
 */

import http from "http";
import { handleIngest } from "./skills/google-ads-expert/ingest.js";

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

  // Only handle POST /ingest/google-ads
  if (req.method === "POST" && req.url?.startsWith("/ingest/google-ads")) {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const authHeader = req.headers.authorization;

        console.log("[webhook] Received ingest request");

        const result = await handleIngest(authHeader, payload);

        res.writeHead(result.success ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result));

        console.log("[webhook] Ingest result:", result.success ? "success" : "failed");
      } catch (error) {
        console.error("[webhook] Error:", error);
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
  console.log(`[webhook] Endpoint: POST /ingest/google-ads`);
});
