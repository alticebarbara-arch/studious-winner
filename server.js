/**
 * Optimum PM Hiring Hub — Resume Parsing Proxy Server
 * 
 * Holds your Anthropic API key securely server-side.
 * Peers upload resumes through the hub HTML → this server → Claude API.
 * 
 * Deploy to Railway / Render / Fly.io in ~5 minutes (see README.md).
 */

const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // Set to your hub's origin in production

// ── Startup check ─────────────────────────────────────────────────────────────
if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY environment variable is not set.");
  console.error("    Set it in your hosting platform's environment variables.");
  process.exit(1);
}

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCORSHeaders(res, origin) {
  const allow = ALLOWED_ORIGIN === "*" ? "*" : (origin || "*");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ── Read full request body ─────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Forward to Anthropic API ──────────────────────────────────────────────────
function callAnthropic(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Validate incoming payload ─────────────────────────────────────────────────
function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Invalid request body";
  if (!Array.isArray(payload.messages) || !payload.messages.length) return "Missing messages";
  if (payload.model && !payload.model.startsWith("claude-")) return "Invalid model";
  // Strip any api_key field if someone tries to send one
  delete payload.api_key;
  return null;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const { pathname } = url.parse(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    setCORSHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && pathname === "/health") {
    setCORSHeaders(res, origin);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "Optimum Resume Proxy is running" }));
    return;
  }

  // Resume parse endpoint
  if (req.method === "POST" && pathname === "/parse-resume") {
    setCORSHeaders(res, origin);

    // Size limit — 20MB (base64 encoded PDF/DOCX)
    const contentLength = parseInt(req.headers["content-length"] || "0");
    if (contentLength > 20 * 1024 * 1024) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File too large. Maximum size is 20MB." }));
      return;
    }

    let payload;
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw.toString());
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
      return;
    }

    const validationError = validatePayload(payload);
    if (validationError) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: validationError }));
      return;
    }

    // Force the correct model and safe max_tokens
    payload.model = "claude-sonnet-4-20250514";
    payload.max_tokens = Math.min(payload.max_tokens || 1000, 1000);

    console.log(`[${new Date().toISOString()}] Parsing resume — ${payload.messages?.[0]?.content?.find?.(c => c.type === "document") ? "document" : "text"} content`);

    try {
      const result = await callAnthropic(payload);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(result.body);
    } catch (e) {
      console.error("Anthropic API error:", e.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach Anthropic API", detail: e.message }));
    }
    return;
  }

  // 404 for everything else
  setCORSHeaders(res, origin);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. POST to /parse-resume" }));
});

server.listen(PORT, () => {
  console.log(`✅  Optimum Resume Proxy running on port ${PORT}`);
  console.log(`    Health check: http://localhost:${PORT}/health`);
  console.log(`    Parse endpoint: POST http://localhost:${PORT}/parse-resume`);
});
