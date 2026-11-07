import { shopPage, dashboardPage } from "./pages.js";

const VALID_TYPES = new Set(["click", "view", "add_to_cart"]);

// Lọc bot đơn giản: một userId gửi quá BOT_MAX sự kiện trong BOT_WINDOW_MS.
// Bộ nhớ này chỉ sống trong một isolate (edge là stateless) → chỉ là best-effort.
// Muốn chính xác toàn cục cần Durable Objects (xem Slide 12, 15).
const BOT_WINDOW_MS = 5000;
const BOT_MAX = 10;
const recentByUser = new Map();

function isBot(userId, now) {
  const times = (recentByUser.get(userId) ?? []).filter((t) => now - t < BOT_WINDOW_MS);
  times.push(now);
  recentByUser.set(userId, times);
  if (recentByUser.size > 5000) recentByUser.clear();
  return times.length > BOT_MAX;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/":
        return html(shopPage);
      case "/dashboard":
        return html(dashboardPage);
      case "/event":
        return handleEvent(req, env, ctx);
      case "/ping":
        return handlePing(req, url, env, ctx);
      case "/stats":
        return Response.json(await getStats(env), { headers: { "Cache-Control": "no-store" } });
      case "/reset":
        return reset(url, env);
      case "/batch":
        if (url.searchParams.get("key") !== env.RESET_KEY) return new Response("Forbidden", { status: 403 });
        await runBatchJob(env);
        return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },

  // Tầng xử lý: consumer nhận sự kiện từ Queue theo lô nhỏ
  async queue(batch, env) {
    await storeEvents(env, batch.messages.map((m) => m.body));
  },

  // Tầng batch truyền thống để so sánh: cron chạy định kỳ
  async scheduled(controller, env) {
    await runBatchJob(env);
  },
};

// ---------- Edge ingest ----------
async function handleEvent(req, env, ctx) {
  if (req.method !== "POST") return new Response("Only POST", { status: 405 });

  let e;
  try {
    e = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return ingest(e, req, env, ctx);
}

// GET /ping?page=...&userId=... – cùng đường ingest như /event, nhưng dùng GET để các
// probe đo lường toàn cầu (Globalping, chỉ gửi được GET) bắn từ nhiều quốc gia.
function handlePing(req, url, env, ctx) {
  const q = url.searchParams;
  return ingest(
    {
      type: q.get("type") ?? "view",
      page: q.get("page") ?? "/product/iphone-16",
      userId: q.get("userId") ?? "probe-" + Math.random().toString(36).slice(2, 8),
    },
    req,
    env,
    ctx
  );
}

async function ingest(e, req, env, ctx) {
  const type = e.type ?? "click";
  if (!VALID_TYPES.has(type)) return bad("type không hợp lệ");
  if (typeof e.page !== "string" || !e.page.startsWith("/") || e.page.length > 100) return bad("page không hợp lệ");
  if (typeof e.userId !== "string" || e.userId.length < 1 || e.userId.length > 64) return bad("userId không hợp lệ");

  const now = Date.now();
  const event = {
    type,
    page: e.page,
    userId: e.userId,
    country: req.cf?.country ?? "??", // Edge tự biết vị trí người gửi
    colo: req.cf?.colo ?? "local",    // Data center Cloudflare đã xử lý request
    isBot: isBot(e.userId, now),
    sentAt: Number.isFinite(e.sentAt) ? e.sentAt : null,
    receivedAt: new Date(now).toISOString(),
    receivedMs: now,
  };

  console.log(JSON.stringify({ ...event, receivedMs: undefined })); // xem real-time bằng `wrangler tail`

  let via = "queue";
  try {
    if (!env.EVENTS_QUEUE) throw new Error("no queue binding");
    await env.EVENTS_QUEUE.send(event);
  } catch (err) {
    // Không có Queue hoặc Queue lỗi (vd. hết hạn mức gói Free) → ghi thẳng DB, không làm mất sự kiện
    via = "direct";
    console.log(JSON.stringify({ queueFallback: String(err?.message ?? err) }));
    ctx.waitUntil(storeEvents(env, [event]));
  }
  return Response.json({ ok: true, via, event });
}

// ---------- Xử lý + lưu trữ (streaming aggregation) ----------
async function storeEvents(env, events) {
  const now = Date.now();
  const pages = {}, countries = {}, seconds = {};
  let bots = 0;

  const stmts = events.map((ev) => {
    const sec = Math.floor(ev.receivedMs / 1000);
    seconds[sec] = (seconds[sec] ?? 0) + 1;
    if (ev.isBot) {
      bots++;
    } else {
      pages[ev.page] = (pages[ev.page] ?? 0) + 1;
      countries[ev.country] = (countries[ev.country] ?? 0) + 1;
    }
    return env.DB.prepare(
      `INSERT INTO events (type, page, user_id, country, colo, is_bot, sent_ms, received_ms, stored_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ev.type, ev.page, ev.userId, ev.country, ev.colo, ev.isBot ? 1 : 0, ev.sentAt, ev.receivedMs, now);
  });

  const upsert = (table, key, k, n) =>
    env.DB.prepare(
      `INSERT INTO ${table} (${key}, count) VALUES (?, ?)
       ON CONFLICT(${key}) DO UPDATE SET count = count + excluded.count`
    ).bind(k, n);
  const counter = (name, n) =>
    env.DB.prepare(
      `INSERT INTO counters (name, value) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET value = value + excluded.value`
    ).bind(name, n);

  for (const [k, n] of Object.entries(pages)) stmts.push(upsert("page_counts", "page", k, n));
  for (const [k, n] of Object.entries(countries)) stmts.push(upsert("country_counts", "country", k, n));
  for (const [k, n] of Object.entries(seconds)) stmts.push(upsert("per_second", "sec", Number(k), n));
  stmts.push(counter("total", events.length));
  if (bots) stmts.push(counter("bots", bots));
  stmts.push(env.DB.prepare("DELETE FROM per_second WHERE sec < ?").bind(Math.floor(now / 1000) - 120));

  await env.DB.batch(stmts);
}

// ---------- Batch job: quét lại toàn bộ dữ liệu thô ----------
async function runBatchJob(env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM batch_snapshot"),
    env.DB.prepare(
      "INSERT INTO batch_snapshot (page, count) SELECT page, COUNT(*) FROM events WHERE is_bot = 0 GROUP BY page"
    ),
    env.DB.prepare("INSERT INTO batch_runs (ran_ms) VALUES (?)").bind(Date.now()),
  ]);
  console.log(JSON.stringify({ batchJob: "done", at: new Date().toISOString() }));
}

// ---------- Dashboard API ----------
async function getStats(env) {
  const nowSec = Math.floor(Date.now() / 1000);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);
  const [pages, countries, perSecond, counters, batch, lastRun, recent] = await env.DB.batch([
    q("SELECT page, count FROM page_counts ORDER BY count DESC"),
    q("SELECT country, count FROM country_counts ORDER BY count DESC LIMIT 8"),
    q("SELECT sec, count FROM per_second WHERE sec > ? ORDER BY sec", nowSec - 60),
    q("SELECT name, value FROM counters"),
    q("SELECT page, count FROM batch_snapshot ORDER BY count DESC"),
    q("SELECT ran_ms FROM batch_runs ORDER BY id DESC LIMIT 1"),
    q(`SELECT type, page, user_id, country, colo, is_bot, received_ms, stored_ms
       FROM events ORDER BY id DESC LIMIT 12`),
  ]);

  const c = Object.fromEntries(counters.results.map((r) => [r.name, r.value]));
  const lat = recent.results.filter((r) => !r.is_bot).map((r) => r.stored_ms - r.received_ms);
  return {
    now: Date.now(),
    total: c.total ?? 0,
    bots: c.bots ?? 0,
    pipelineMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
    pages: pages.results,
    countries: countries.results,
    perSecond: perSecond.results,
    batch: batch.results,
    batchLastRun: lastRun.results[0]?.ran_ms ?? null,
    recent: recent.results,
  };
}

async function reset(url, env) {
  if (url.searchParams.get("key") !== env.RESET_KEY) return new Response("Forbidden", { status: 403 });
  await env.DB.batch(
    ["events", "page_counts", "country_counts", "per_second", "counters", "batch_snapshot", "batch_runs"].map((t) =>
      env.DB.prepare(`DELETE FROM ${t}`)
    )
  );
  recentByUser.clear();
  return Response.json({ ok: true, message: "Đã xoá toàn bộ dữ liệu" });
}

const bad = (error) => Response.json({ ok: false, error }, { status: 400 });
const html = (body) => new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
