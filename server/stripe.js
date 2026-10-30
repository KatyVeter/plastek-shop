// Оплата через Stripe Checkout для шаблона PLASTEK (без npm-зависимостей).
// Цены всегда пересчитываются на сервере из data/catalog.xlsx — цене из браузера доверять нельзя.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("./vendor/xlsx.js");
const config = require("./payments.config.js");

const CATALOG = path.join(__dirname, "..", "data", "catalog.xlsx");
const ORDERS_LOG = path.join(__dirname, "orders.jsonl"); // папка server/ не отдаётся наружу (см. server.js)

/* ---------- Каталог: кэш до изменения файла ---------- */
let cache = { mtime: 0, bySku: new Map() };
function catalog() {
  const mtime = fs.statSync(CATALOG).mtimeMs;
  if (mtime !== cache.mtime) {
    const wb = XLSX.readFile(CATALOG);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Товары"], { defval: "" });
    const num = v => +String(v).replace(",", ".").replace(/[^\d.]/g, "") || 0;
    const bySku = new Map();
    rows.filter(r => r["Артикул"]).forEach(r => bySku.set(String(r["Артикул"]).trim(), {
      name: `${r["Товар"]}, ${String(r["Цвет"]).toLowerCase()}`,
      price: num(r["Цена, $"]), opt1: num(r["Опт от 10 шт., $"]), opt2: num(r["Опт от 50 шт., $"])
    }));
    cache = { mtime, bySku };
  }
  return cache.bySku;
}
function unitPrice(v, total) {
  const [t1, t2] = config.tiers;
  if (total >= t2 && v.opt2) return v.opt2;
  if (total >= t1 && v.opt1) return v.opt1;
  return v.price;
}

/* ---------- Вызов Stripe API ---------- */
function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}
async function stripe(method, endpoint, params) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? form(params) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ? data.error.message : `Stripe ${res.status}`);
  return data;
}

/* ---------- Публичные функции ---------- */
function enabled() {
  return config.mode === "checkout" && !!process.env.STRIPE_SECRET_KEY;
}
function publicConfig() {
  return {
    provider: config.provider,
    mode: enabled() ? "checkout" : "invoice",
    cardCountries: Object.keys(config.countries),
    shipping: Object.fromEntries(Object.entries(config.countries).map(([n, c]) => [n, { amount: c.shipping, days: c.days }]))
  };
}

// body: { orderId, email, country, items: [{ sku, qty }] } → { url }
async function createCheckout(body, siteUrl) {
  if (!enabled()) throw new Error("Онлайн-оплата не включена");
  const country = config.countries[body.country];
  if (!country) throw new Error("Для этой страны оплата картой недоступна — выберите банковский перевод");
  const bySku = catalog();
  const items = (Array.isArray(body.items) ? body.items : [])
    .map(i => ({ v: bySku.get(String(i.sku)), qty: Math.max(1, Math.min(999, parseInt(i.qty) || 0)) }))
    .filter(i => i.v);
  if (!items.length) throw new Error("Корзина пуста");
  const total = items.reduce((s, i) => s + i.qty, 0);
  const orderId = String(body.orderId || Date.now()).replace(/[^\w-]/g, "").slice(0, 32);

  const line_items = {};
  items.forEach((i, n) => {
    line_items[n] = {
      quantity: i.qty,
      price_data: { currency: config.currency, unit_amount: Math.round(unitPrice(i.v, total) * 100), product_data: { name: i.v.name } }
    };
  });
  const session = await stripe("POST", "checkout/sessions", {
    mode: "payment",
    customer_email: body.email || undefined,
    line_items,
    shipping_address_collection: { allowed_countries: { 0: country.code } },
    shipping_options: { 0: { shipping_rate_data: {
      type: "fixed_amount", display_name: `Доставка СДЭК, ${country.days}`,
      fixed_amount: { amount: Math.round(country.shipping * 100), currency: config.currency }
    } } },
    metadata: { order_id: orderId },
    success_url: `${siteUrl}/pay-success.html?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart.html?canceled=1`
  });
  return { url: session.url, orderId };
}

async function sessionStatus(id) {
  if (!enabled()) throw new Error("Онлайн-оплата не включена");
  const s = await stripe("GET", `checkout/sessions/${encodeURIComponent(id)}`);
  return { paid: s.payment_status === "paid", orderId: s.metadata && s.metadata.order_id, amount: s.amount_total / 100 };
}

// Вебхук: проверяем подпись Stripe и записываем оплаченные заказы
function handleWebhook(raw, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET не задан");
  const parts = Object.fromEntries(String(signature || "").split(",").map(p => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const ok = parts.v1 && parts.v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
  if (!ok || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw new Error("Неверная подпись вебхука");
  const event = JSON.parse(raw);
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    fs.appendFileSync(ORDERS_LOG, JSON.stringify({
      at: new Date().toISOString(), orderId: s.metadata && s.metadata.order_id, email: s.customer_details && s.customer_details.email,
      amount: s.amount_total / 100, currency: s.currency, session: s.id
    }) + "\n");
    // TODO: уведомить менеджера (почта / Telegram) и передать заказ в учётную систему
  }
}

module.exports = { publicConfig, createCheckout, sessionStatus, handleWebhook };
