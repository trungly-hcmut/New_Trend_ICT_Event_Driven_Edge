// Giả lập người dùng click sản phẩm, gửi sự kiện tới Worker.
// Cách dùng:
//   node simulator.js <URL> [--interval 500] [--users 20] [--spam]
// Ví dụ:
//   node simulator.js http://localhost:8787
//   node simulator.js https://edge-clickstream.<subdomain>.workers.dev --interval 200
//   node simulator.js https://... --spam      # một "bot" bắn 40 click liên tục để thấy bộ lọc hoạt động
//   node simulator.js https://... --burst     # flash sale: ~60 người cùng bấm trong 10 giây

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:8787").replace(/\/$/, "");
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const interval = opt("--interval", 500);
const userCount = opt("--users", 20);
const spam = args.includes("--spam");
const burst = args.includes("--burst");

// Trọng số khác nhau để biểu đồ có "sản phẩm hot"
const PAGES = [
  ["/product/iphone-16", 5],
  ["/product/ao-thun", 4],
  ["/product/tra-sua", 3],
  ["/product/airpods", 2],
  ["/product/banh-mi", 2],
  ["/product/macbook", 1],
];
const TYPES = ["click", "click", "click", "view", "add_to_cart"];
const totalWeight = PAGES.reduce((s, [, w]) => s + w, 0);

function pickPage() {
  let r = Math.random() * totalWeight;
  for (const [page, w] of PAGES) if ((r -= w) < 0) return page;
  return PAGES[0][0];
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let sent = 0, failed = 0;
async function send(event) {
  const t0 = performance.now();
  try {
    const res = await fetch(base + "/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, sentAt: Date.now() }),
    });
    const body = await res.json();
    sent++;
    const ms = Math.round(performance.now() - t0);
    const e = body.event ?? {};
    console.log(
      `#${String(sent).padStart(4)} ${res.status} ${ms.toString().padStart(4)}ms  ${event.type.padEnd(11)} ${event.page.padEnd(20)} ${event.userId}` +
        (e.colo ? `  → edge ${e.colo}/${e.country}` : "") +
        (e.isBot ? "  🤖 BOT" : "") +
        (body.error ? `  ✗ ${body.error}` : "")
    );
  } catch (err) {
    failed++;
    console.error(`✗ lỗi gửi: ${err.message}`);
  }
}

if (spam) {
  console.log(`🤖 Spam mode: 1 user bắn 40 click liên tục tới ${base}`);
  for (let i = 0; i < 40; i++) await send({ type: "click", page: "/product/iphone-16", userId: "bot-007" });
  console.log("Xong. Xem ô 'bot bị lọc' trên dashboard.");
} else if (burst) {
  console.log(`🔥 Burst mode: ~60 người cùng bấm trong 10 giây tới ${base}`);
  const end = Date.now() + 10_000;
  const pending = [];
  while (Date.now() < end) {
    const n = Math.floor(Math.random() * 4); // 0–3 request song song mỗi 100ms
    for (let i = 0; i < n; i++)
      pending.push(send({ type: "click", page: pickPage(), userId: "fan-" + Math.ceil(Math.random() * 60) }));
    await new Promise((r) => setTimeout(r, 100));
  }
  await Promise.all(pending);
  console.log(`Xong: ${sent} sự kiện, lỗi ${failed}.`);
} else {
  console.log(`▶ Gửi sự kiện tới ${base}/event mỗi ${interval}ms, ${userCount} user giả lập. Ctrl+C để dừng.`);
  setInterval(() => {
    send({ type: pick(TYPES), page: pickPage(), userId: "sim-" + Math.ceil(Math.random() * userCount) });
  }, interval);
  process.on("SIGINT", () => {
    console.log(`\nĐã gửi ${sent}, lỗi ${failed}.`);
    process.exit(0);
  });
}
