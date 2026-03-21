const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function serveFile(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalized = path.normalize(path.join(ROOT, safePath));

  if (!normalized.startsWith(ROOT)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(normalized, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      sendJson(response, 500, { error: "Failed to read file" });
      return;
    }

    const ext = path.extname(normalized).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    response.end(content);
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleChat(request, response) {
  if (!GEMINI_API_KEY) {
    sendJson(response, 500, {
      error: "Missing GEMINI_API_KEY on the server. Add it to your environment before starting the app."
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "Invalid JSON request body" });
    return;
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";

  if (!prompt) {
    sendJson(response, 400, { error: "Prompt is required" });
    return;
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nStudent request:\n${prompt}`.trim()
              }
            ]
          }
        ]
      })
    });
  } catch (error) {
    sendJson(response, 502, {
      error: `Network error while contacting Gemini: ${error.message}`
    });
    return;
  }

  const rawText = await upstreamResponse.text();
  let data = null;

  try {
    data = JSON.parse(rawText);
  } catch {
    data = null;
  }

  if (!upstreamResponse.ok) {
    sendJson(response, upstreamResponse.status, {
      error: data?.error?.message || rawText || "Gemini request failed"
    });
    return;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    sendJson(response, 502, { error: "Gemini returned an empty response" });
    return;
  }

  sendJson(response, 200, { text });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      provider: "gemini",
      configured: Boolean(GEMINI_API_KEY)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  if (request.method === "GET") {
    serveFile(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
