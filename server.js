// Сервер шаблона: node server.js → http://localhost:5500
// Отдаёт сайт и API оплаты Stripe (server/stripe.js). Ключи — только в переменных окружения.
const http = require("http");
const fs = require("fs");
const path = require("path");
const pay = require("./server/stripe.js");

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
// служебные папки и файлы, которые нельзя отдавать в браузер
const DENY = /^\/(server|\.claude|node_modules)(\/|$)|^\/server\.js$|\/\./;

const json = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
const readBody = req => new Promise((resolve, reject) => {
  let raw = "";
  req.on("data", c => { raw += c; if (raw.length > 1e6) { reject(new Error("Слишком большой запрос")); req.destroy(); } });
  req.on("end", () => resolve(raw));
});
const siteUrl = req => process.env.SITE_URL || `http://${req.headers.host}`;

async function api(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/payment-config") return json(res, 200, pay.publicConfig());
    if (req.method === "POST" && url.pathname === "/api/checkout") {
      return json(res, 200, await pay.createCheckout(JSON.parse(await readBody(req) || "{}"), siteUrl(req)));
    }
    if (req.method === "GET" && url.pathname === "/api/checkout-status") {
      return json(res, 200, await pay.sessionStatus(url.searchParams.get("session_id") || ""));
    }
    if (req.method === "POST" && url.pathname === "/api/stripe-webhook") {
      pay.handleWebhook(await readBody(req), req.headers["stripe-signature"]);
      return json(res, 200, { received: true });
    }
    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 400, { error: e.message });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) return api(req, res, url);

  let file = decodeURIComponent(url.pathname);
  if (file.endsWith("/")) file += "index.html";
  if (DENY.test(file)) { res.writeHead(404); return res.end("Not found"); }
  const full = path.join(ROOT, path.normalize(file));
  if (!full.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    // no-cache: при разработке браузер всегда берёт свежие файлы
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
