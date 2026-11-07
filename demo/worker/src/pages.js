// Giao diện HTML được Worker trả về trực tiếp từ edge.
// Lưu ý: script bên trong không dùng backtick / ${} để tránh xung đột với template literal ngoài.

export const PRODUCTS = [
  { slug: "iphone-16", name: "iPhone 16 Pro", price: "28.990.000đ", emoji: "📱" },
  { slug: "airpods", name: "AirPods Pro 2", price: "4.990.000đ", emoji: "🎧" },
  { slug: "macbook", name: "MacBook Air M4", price: "24.490.000đ", emoji: "💻" },
  { slug: "ao-thun", name: "Áo thun 11/11", price: "99.000đ", emoji: "👕" },
  { slug: "tra-sua", name: "Trà sữa trân châu", price: "25.000đ", emoji: "🧋" },
  { slug: "banh-mi", name: "Bánh mì đặc biệt", price: "20.000đ", emoji: "🥖" },
];

export const shopPage = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flash Sale 11/11</title>
<style>
  :root { --bg:#fff7f2; --card:#fff; --text:#1f1b18; --muted:#7a6f68; --accent:#ee4d2d; --border:#f1e4dc; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); }
  header { background:var(--accent); color:#fff; padding:16px; text-align:center; }
  header h1 { margin:0; font-size:22px; }
  header p { margin:4px 0 0; opacity:.9; font-size:14px; }
  main { max-width:720px; margin:0 auto; padding:16px; display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; text-align:center; }
  .emoji { font-size:48px; }
  .name { font-weight:600; margin:6px 0 2px; }
  .price { color:var(--accent); font-weight:700; margin-bottom:10px; }
  button { width:100%; border:0; border-radius:10px; padding:12px; font-size:15px; font-weight:600;
           background:var(--accent); color:#fff; cursor:pointer; }
  button:active { transform:scale(.97); }
  #toast { position:fixed; left:50%; bottom:20px; transform:translateX(-50%); background:#1f1b18; color:#fff;
           padding:10px 16px; border-radius:999px; font-size:14px; opacity:0; transition:opacity .2s; white-space:nowrap; }
  #toast.show { opacity:1; }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:8px 16px 80px; }
</style>
</head>
<body>
<header><h1>⚡ Flash Sale 11/11</h1><p>Bấm "Mua ngay" và nhìn lên màn chiếu!</p></header>
<main>
${PRODUCTS.map((p) => `
  <div class="card">
    <div class="emoji">${p.emoji}</div>
    <div class="name">${p.name}</div>
    <div class="price">${p.price}</div>
    <button data-page="/product/${p.slug}">Mua ngay</button>
  </div>`).join("")}
</main>
<footer>Demo seminar: Event-driven pipeline với Cloudflare Workers · mỗi lần bấm là một sự kiện gửi tới edge</footer>
<div id="toast"></div>
<script>
  var userId;
  try { userId = localStorage.getItem("uid"); } catch (e) {}
  if (!userId) {
    userId = "u-" + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem("uid", userId); } catch (e) {}
  }
  var toast = document.getElementById("toast"), timer;
  function show(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(timer); timer = setTimeout(function () { toast.classList.remove("show"); }, 1500);
  }
  document.querySelectorAll("button[data-page]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var t0 = performance.now();
      fetch("/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "click", page: btn.dataset.page, userId: userId, sentAt: Date.now() })
      }).then(function (r) { return r.json(); }).then(function (res) {
        var ms = Math.round(performance.now() - t0);
        if (res.event && res.event.isBot) show("🤖 Bấm nhanh quá, bị đánh dấu là bot!");
        else show("✓ Edge " + res.event.colo + " (" + res.event.country + ") đã nhận · " + ms + "ms");
      }).catch(function () { show("Lỗi mạng, thử lại nhé"); });
    });
  });
</script>
</body>
</html>`;

export const dashboardPage = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clickstream Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  :root { --bg:#0f1218; --panel:#181c25; --border:#262b37; --text:#e8eaf0; --muted:#8a91a3;
          --rt:#3ba0ff; --batch:#f5a524; --ok:#2fbf71; --bad:#ef5350; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); }
  header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 20px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
  header h1 { margin:0; font-size:20px; }
  .live { display:inline-flex; align-items:center; gap:6px; color:var(--ok); font-size:13px; font-weight:600; }
  .live i { width:9px; height:9px; border-radius:50%; background:var(--ok); animation:pulse 1.2s infinite; }
  .live.off { color:var(--bad); } .live.off i { background:var(--bad); animation:none; }
  @keyframes pulse { 50% { opacity:.3; } }
  .wrap { padding:16px 20px; display:grid; gap:16px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid-side { display:grid; grid-template-columns:2fr 1fr; gap:16px; }
  .panel { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:14px 16px; min-width:0; }
  .panel h2 { margin:0 0 10px; font-size:14px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .kpi .v { font-size:34px; font-weight:700; font-variant-numeric:tabular-nums; }
  .kpi .l { color:var(--muted); font-size:13px; }
  .tag { display:inline-block; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700; margin-left:6px; vertical-align:middle; }
  .tag.rt { background:rgba(59,160,255,.15); color:var(--rt); }
  .tag.batch { background:rgba(245,165,36,.15); color:var(--batch); }
  .chart { position:relative; height:260px; }
  .chart.small { height:180px; }
  .sub { color:var(--muted); font-size:13px; margin-top:8px; font-variant-numeric:tabular-nums; }
  #qr { background:#fff; padding:10px; border-radius:8px; width:max-content; margin:0 auto; }
  .url { text-align:center; margin-top:10px; font-size:13px; color:var(--muted); word-break:break-all; }
  table { width:100%; border-collapse:collapse; font-size:13px; font-variant-numeric:tabular-nums; }
  td { padding:5px 4px; border-bottom:1px solid var(--border); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
  th { padding:5px 4px; border-bottom:1px solid var(--border); text-align:left; font-size:11px; font-weight:600;
       color:var(--muted); text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; }
  td.colo b { font-weight:700; }
  td.colo span { color:var(--muted); }
  tr.bot td { color:var(--bad); }
  tr.new { animation:flash 1s; }
  @keyframes flash { from { background:rgba(59,160,255,.25); } to { background:transparent; } }
  .bar { height:8px; background:var(--rt); border-radius:4px; }
  @media (max-width:900px) { .kpis { grid-template-columns:repeat(2,1fr); } .grid2, .grid-side { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1>⚡ Edge Clickstream: Real-time vs Batch</h1>
  <span id="live" class="live"><i></i><span>LIVE</span></span>
</header>
<div class="wrap">
  <div class="kpis">
    <div class="panel kpi"><div class="v" id="k-total">0</div><div class="l">Tổng sự kiện đã nhận</div></div>
    <div class="panel kpi"><div class="v" id="k-rate">0</div><div class="l">Sự kiện / giây (TB 5 giây)</div></div>
    <div class="panel kpi"><div class="v" id="k-lat">–</div><div class="l">Độ trễ edge → database (ms)</div></div>
    <div class="panel kpi"><div class="v" id="k-bots">0</div><div class="l">Sự kiện bot bị lọc tại edge</div></div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h2>Click theo sản phẩm <span class="tag rt">REAL-TIME</span></h2>
      <div class="chart"><canvas id="c-rt"></canvas></div>
      <div class="sub">Cập nhật mỗi giây ngay khi sự kiện tới</div>
    </div>
    <div class="panel">
      <h2>Click theo sản phẩm <span class="tag batch">BATCH · cron 2 phút</span></h2>
      <div class="chart"><canvas id="c-batch"></canvas></div>
      <div class="sub" id="batch-info">Chưa chạy lần nào</div>
    </div>
  </div>

  <div class="grid-side">
    <div class="panel">
      <h2>Lưu lượng 60 giây gần nhất</h2>
      <div class="chart small"><canvas id="c-line"></canvas></div>
    </div>
    <div class="panel">
      <h2>Quét để tham gia</h2>
      <div id="qr"></div>
      <div class="url" id="shop-url"></div>
    </div>
  </div>

  <div class="grid-side">
    <div class="panel">
      <h2>Sự kiện mới nhất</h2>
      <table>
        <thead><tr><th>Giờ</th><th>Loại</th><th>Trang</th><th>User</th><th>Nơi gửi</th><th>Edge xử lý</th><th>Độ trễ</th></tr></thead>
        <tbody id="feed"></tbody>
      </table>
    </div>
    <div class="panel">
      <h2>Nơi gửi (req.cf.country)</h2>
      <table><tbody id="countries"></tbody></table>
    </div>
  </div>
</div>

<script>
  var shopUrl = location.origin + "/";
  document.getElementById("shop-url").textContent = shopUrl;
  if (window.QRCode) new QRCode(document.getElementById("qr"), { text: shopUrl, width: 180, height: 180 });

  var RT = "#3ba0ff", BATCH = "#f5a524", GRID = "rgba(255,255,255,.06)", TICK = "#8a91a3";
  if (window.Chart) { Chart.defaults.color = TICK; Chart.defaults.font.family = "system-ui, sans-serif"; }
  function barChart(id, color) {
    return new Chart(document.getElementById(id), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: color, borderRadius: 4, maxBarThickness: 48 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 } } } }
    });
  }
  var rtChart = barChart("c-rt", RT), batchChart = barChart("c-batch", BATCH);
  var lineChart = new Chart(document.getElementById("c-line"), {
    type: "line",
    data: { labels: [], datasets: [{ data: [], borderColor: RT, backgroundColor: "rgba(59,160,255,.15)", fill: true, tension: .3, pointRadius: 0, borderWidth: 2 }] },
    options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } }, y: { beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 } } } }
  });

  function short(p) { return p.replace("/product/", ""); }
  function toMap(rows) { var m = {}; rows.forEach(function (r) { m[r.page] = r.count; }); return m; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Mã colo (mã sân bay) → tên thành phố, cho các data center hay gặp
  var COLO = { SIN:"Singapore", SGN:"TP.HCM", HAN:"Hà Nội", HKG:"Hồng Kông", NRT:"Tokyo", KIX:"Osaka", ICN:"Seoul",
    TPE:"Đài Bắc", BKK:"Bangkok", KUL:"Kuala Lumpur", CGK:"Jakarta", MNL:"Manila", BOM:"Mumbai", DEL:"New Delhi",
    SYD:"Sydney", MEL:"Melbourne", FRA:"Frankfurt", LHR:"London", CDG:"Paris", AMS:"Amsterdam", MAD:"Madrid",
    ORD:"Chicago", IAD:"Washington", EWR:"Newark", LAX:"Los Angeles", SJC:"San Jose", SEA:"Seattle", DFW:"Dallas",
    ATL:"Atlanta", MIA:"Miami", PIT:"Pittsburgh", YYZ:"Toronto", YUL:"Montréal", GRU:"São Paulo", JNB:"Johannesburg" };
  function colo(c) { return "<b>" + esc(c) + "</b>" + (COLO[c] ? " <span>" + COLO[c] + "</span>" : ""); }
  function time(ms) { return new Date(ms).toLocaleTimeString("vi-VN"); }

  var lastFeedTop = null, lastBatchRun = null, serverOffset = 0;

  function render(s) {
    serverOffset = s.now - Date.now();
    document.getElementById("k-total").textContent = s.total.toLocaleString("vi-VN");
    document.getElementById("k-bots").textContent = s.bots.toLocaleString("vi-VN");
    document.getElementById("k-lat").textContent = s.pipelineMs == null ? "–" : s.pipelineMs;

    // Cùng thứ tự nhãn & cùng trục Y cho 2 biểu đồ để so sánh trực quan
    var rt = toMap(s.pages), bt = toMap(s.batch);
    var labels = Object.keys(Object.assign({}, bt, rt)).sort(function (a, b) { return (rt[b] || 0) - (rt[a] || 0); });
    var max = Math.max(1, Math.max.apply(null, labels.map(function (l) { return Math.max(rt[l] || 0, bt[l] || 0); })));
    [[rtChart, rt], [batchChart, bt]].forEach(function (pair) {
      pair[0].data.labels = labels.map(short);
      pair[0].data.datasets[0].data = labels.map(function (l) { return pair[1][l] || 0; });
      pair[0].options.scales.y.suggestedMax = Math.ceil(max * 1.1);
      pair[0].update();
    });

    // Lưu lượng theo giây, điền 0 cho giây trống
    var nowSec = Math.floor(s.now / 1000), per = {};
    s.perSecond.forEach(function (r) { per[r.sec] = r.count; });
    var ls = [], vs = [];
    for (var t = nowSec - 59; t <= nowSec; t++) { ls.push(time(t * 1000).slice(-5)); vs.push(per[t] || 0); }
    lineChart.data.labels = ls; lineChart.data.datasets[0].data = vs; lineChart.update();
    var last5 = vs.slice(-6, -1).reduce(function (a, b) { return a + b; }, 0) / 5;
    document.getElementById("k-rate").textContent = last5.toFixed(1);

    lastBatchRun = s.batchLastRun;

    var feed = s.recent.map(function (e, i) {
      var isNew = lastFeedTop !== null && e.received_ms > lastFeedTop;
      return "<tr class='" + (e.is_bot ? "bot " : "") + (isNew ? "new" : "") + "'>" +
        "<td>" + time(e.received_ms) + "</td><td>" + esc(e.type) + "</td><td>" + esc(short(e.page)) + "</td>" +
        "<td>" + esc(e.user_id) + "</td><td>" + esc(e.country) + "</td><td class='colo'>" + colo(e.colo) + "</td>" +
        "<td>" + (e.is_bot ? "🤖 bot" : (e.stored_ms - e.received_ms) + "ms") + "</td></tr>";
    }).join("");
    document.getElementById("feed").innerHTML = feed || "<tr><td colspan='7'>Chưa có sự kiện</td></tr>";
    if (s.recent.length) lastFeedTop = s.recent[0].received_ms;

    var cmax = Math.max.apply(null, s.countries.map(function (c) { return c.count; }).concat([1]));
    document.getElementById("countries").innerHTML = s.countries.map(function (c) {
      return "<tr><td style='width:44px'>" + esc(c.country) + "</td><td><div class='bar' style='width:" +
        Math.max(4, c.count / cmax * 100) + "%'></div></td><td style='width:60px;text-align:right'>" + c.count + "</td></tr>";
    }).join("") || "<tr><td>–</td></tr>";
  }

  // Đếm ngược tới lần chạy cron kế tiếp (*/2 phút theo giờ UTC).
  // Khi chạy local (wrangler dev), cron không tự chạy → dashboard tự kích hoạt qua route test-scheduled.
  // Có thể rút ngắn chu kỳ khi quay video: /dashboard?batch=30
  var isLocal = /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname);
  var batchEvery = (isLocal && Number(new URLSearchParams(location.search).get("batch"))) || 120;
  if (batchEvery !== 120) document.querySelector(".tag.batch").textContent = "BATCH · mỗi " + batchEvery + " giây (demo)";
  var nextBatchAt = Math.ceil(Date.now() / (batchEvery * 1000)) * batchEvery * 1000;
  window.setNextBatch = function (ms) { nextBatchAt = Date.now() + ms; }; // để script quay video căn thời điểm

  function tickBatch() {
    var now = Date.now() + serverOffset;
    if (isLocal && Date.now() >= nextBatchAt) {
      nextBatchAt += batchEvery * 1000;
      fetch("/cdn-cgi/handler/scheduled").then(function (r) { if (!r.ok) return fetch("/__scheduled"); });
    }
    // Cron thật trên Cloudflare chạy trễ vài chục giây so với mốc phút chẵn → tính từ lần chạy thực tế gần nhất
    var next = isLocal ? nextBatchAt + serverOffset
      : lastBatchRun ? lastBatchRun + 120000 : Math.ceil(now / 120000) * 120000;
    var left = Math.round((next - now) / 1000);
    var txt = lastBatchRun ? "Lần chạy cuối: " + time(lastBatchRun) : "Chưa chạy lần nào";
    document.getElementById("batch-info").textContent = left > 0
      ? txt + " · lần tới sau " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0")
      : txt + " · cron đang chạy…";
  }

  var busy = false, live = document.getElementById("live");
  function poll() {
    if (busy) return;
    busy = true;
    fetch("/stats", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      render(s); live.classList.remove("off"); live.lastChild.textContent = "LIVE";
    }).catch(function () {
      live.classList.add("off"); live.lastChild.textContent = "MẤT KẾT NỐI";
    }).finally(function () { busy = false; });
  }
  poll(); setInterval(poll, 1000); setInterval(tickBatch, 1000); tickBatch();
</script>
</body>
</html>`;
