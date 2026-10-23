// Tự động quay video demo: chạy wrangler dev + simulator, điều khiển "sân khấu" (stage.html) theo kịch bản,
// ghi màn hình qua Chrome DevTools screencast, rồi ghép lời thoại thành out/demo.mp4.
// Lời thoại: dùng voice/<id>.wav nếu có (giọng của bạn, ghi bằng `npm run voice`), nếu không thì giọng máy macOS.
import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawn, execFileSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { SCENES, ALL_LINES, DASH_QUERY } from "./scenes.js";
import { provider as cloud, providerLabel, synthesize } from "./tts.js";
import { cleanVoice } from "./audio.js";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");
const WORKER = path.join(ROOT, "worker");
const SIM = path.join(ROOT, "simulator", "simulator.js");
const OUT = path.join(DIR, "out");
const TTS = path.join(DIR, "tts");
const VOICE = path.join(DIR, "voice");
const BASE = "http://localhost:8787";
const STAGE_PORT = 9001;
const RESET_KEY = process.env.RESET_KEY ?? "demo123";
const TTS_VOICE = process.env.TTS_VOICE ?? "Linh";
const TTS_RATE = process.env.TTS_RATE ?? "180";
const W = 1600, H = 900, DPR = 1.2, FPS = 30; // 1600×900 × 1.2 = 1920×1080
const LINE_GAP = 0.35, SCENE_GAP = 0.8;      // giây

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
for (const d of [OUT, TTS]) fs.mkdirSync(d, { recursive: true });

// ---------- 1. Chuẩn bị âm thanh từng câu ----------
function duration(file) {
  return Number(/estimated duration: ([\d.]+)/.exec(execFileSync("afinfo", [file]).toString())[1]);
}
const audio = {};
let own = 0;
for (const l of ALL_LINES) {
  const mine = path.join(VOICE, l.id + ".wav");
  if (fs.existsSync(mine)) {
    const clean = cleanVoice(mine);
    audio[l.id] = { file: clean, dur: duration(clean) };
    own++;
    continue;
  }
  if (cloud) {
    const f = await synthesize(l);
    audio[l.id] = { file: f, dur: duration(f) };
    process.stdout.write(`  🔊 ${l.id}\r`);
    continue;
  }
  const f = path.join(TTS, l.id + ".aiff"), tf = f + ".txt";
  if (!fs.existsSync(f) || !fs.existsSync(tf) || fs.readFileSync(tf, "utf8") !== l.text) {
    execFileSync("say", ["-v", TTS_VOICE, "-r", TTS_RATE, "-o", f, l.text]);
    fs.writeFileSync(tf, l.text);
  }
  audio[l.id] = { file: f, dur: duration(f) };
}
console.log(`🎙  ${own}/${ALL_LINES.length} câu dùng giọng của bạn, còn lại dùng ${cloud ? "giọng neural " + providerLabel : "giọng máy macOS (" + TTS_VOICE + ")"}.`);

// ---------- 2. Khởi động Worker local ----------
const children = [];
const dev = spawn("npx", ["wrangler", "dev", "--test-scheduled", "--port", "8787"], {
  cwd: WORKER, detached: true, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
});
children.push(dev);
let page = null;
const st = (fn, ...args) =>
  page ? page.evaluate(([fn, args]) => window.stage[fn](...args), [fn, args]).catch(() => {}) : Promise.resolve();
for (const stream of [dev.stdout, dev.stderr]) {
  readline.createInterface({ input: stream }).on("line", (raw) => {
    const line = stripAnsi(raw).trim();
    if (line.startsWith("{")) st("line", "worker", line);
  });
}
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE + "/stats")).ok) break; } catch {}
  if (i > 90) throw new Error("wrangler dev không khởi động được");
  await sleep(1000);
}
await fetch(`${BASE}/reset?key=${RESET_KEY}`);
console.log("⚡ Worker local sẵn sàng, đã xoá dữ liệu cũ.");

// ---------- 3. Sân khấu + trình duyệt ----------
const server = http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(DIR, "stage.html")));
  })
  .listen(STAGE_PORT);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, locale: "vi-VN" });
page = await context.newPage();
await page.goto(`http://localhost:${STAGE_PORT}/`);
await page.evaluate(([b, q]) => window.stage.init(b, q), [BASE, DASH_QUERY]);

async function frame(match) {
  for (let i = 0; i < 100; i++) {
    const f = page.frames().find((f) => f.url().includes(match));
    if (f) { await f.waitForLoadState("load"); return f; }
    await sleep(100);
  }
  throw new Error("Không tìm thấy frame " + match);
}
const dash = await frame("/dashboard");
const shop = await frame(BASE + "/");
await dash.waitForFunction(() => typeof window.setNextBatch === "function");
await dash.evaluate(() => window.setNextBatch(3600e3)); // chưa cho batch chạy cho tới khi kịch bản hẹn giờ
await sleep(1500); // chờ chart & QR render

// Hiện request/response của các cú click trên điện thoại
page.on("request", (r) => {
  if (r.url().endsWith("/event") && r.method() === "POST") st("req", JSON.parse(r.postData()));
});
page.on("response", async (r) => {
  if (r.url().endsWith("/event")) { try { st("res", (await r.json()).event); } catch {} }
});

// ---------- 4. Ghi hình (CFR 30fps theo timestamp của từng frame) ----------
const silent = path.join(OUT, "demo_silent.mp4");
const enc = spawn(ffmpeg, [
  "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-movflags", "+faststart", silent,
]);
const encDone = new Promise((r) => enc.on("close", r));
let t0 = null, last = null, written = 0;
function writeUntil(t) {
  const target = Math.round((t - t0) * FPS);
  while (last && written < target) { enc.stdin.write(last); written++; }
}
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  const ts = metadata.timestamp ?? now();
  if (t0 === null) t0 = ts;
  writeUntil(ts);
  last = Buffer.from(data, "base64");
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080 });
while (t0 === null) await sleep(50);

// ---------- 5. Chạy kịch bản ----------
let normalSim = null, batchSeen = null;
function runSim(extra) {
  const p = spawn("node", [SIM, BASE, ...extra]);
  readline.createInterface({ input: p.stdout }).on("line", (l) => st("line", "sim", l));
  children.push(p);
  return p;
}
const api = {
  clickProduct: (i) => shop.locator("button[data-page]").nth(i).click(),
  async sim(mode) {
    if (mode === "stop") { normalSim?.kill(); normalSim = null; return; }
    if (mode === "normal") { if (!normalSim) normalSim = runSim(["--interval", "500"]); return; }
    runSim(["--" + mode]); // burst / spam chạy song song, tự kết thúc
  },
  async scheduleBatchAfter(ids) {
    const ms = ids.reduce((s, id) => s + (audio[id].dur + LINE_GAP) * 1000, 0) + SCENE_GAP * 1000 + 1500;
    batchSeen = (await (await fetch(BASE + "/stats")).json()).batchLastRun;
    await dash.evaluate((ms) => window.setNextBatch(ms), ms);
  },
  async waitBatch() {
    for (let i = 0; i < 100; i++) {
      const s = await (await fetch(BASE + "/stats")).json();
      if (s.batchLastRun && s.batchLastRun !== batchSeen) break;
      await sleep(200);
    }
    await sleep(2200); // dashboard poll + hiệu ứng cột
  },
  dashScroll: async (y) => { await dash.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y); await sleep(700); },
  showOutro: async () => st("outro", await (await fetch(BASE + "/stats")).json()),
};

const cues = [];
for (const scene of SCENES) {
  await st("mode", scene.mode);
  await st("step", scene.step);
  if (scene.setup) await scene.setup(api);
  for (const line of scene.lines) {
    const start = now();
    await st("cap", line.text);
    cues.push({ ...line, step: scene.step.replace(/<[^>]+>/g, ""), start: start - t0, dur: audio[line.id].dur });
    const action = line.do ? Promise.resolve(line.do(api)).catch((e) => console.error(e.message)) : null;
    await sleep(Math.max(0, (start + audio[line.id].dur + LINE_GAP - now()) * 1000));
    await action;
    if (line.after) await line.after(api);
    process.stdout.write(`  ✓ ${line.id} ${line.text.slice(0, 60)}…\n`);
  }
  await sleep(SCENE_GAP * 1000);
}
await sleep(1500);

// ---------- 6. Kết thúc ghi hình ----------
await cdp.send("Page.stopScreencast");
writeUntil(now());
enc.stdin.end();
await encDone;
await browser.close();
server.close();
for (const c of children) { try { c.pid && process.kill(c === dev ? -c.pid : c.pid); } catch {} }

// ---------- 7. Ghép lời thoại ----------
const voiceTrack = path.join(OUT, "voice.m4a");
const inputs = cues.flatMap((c) => ["-i", audio[c.id].file]);
const filters = cues.map((c, i) => {
  const ms = Math.round(c.start * 1000);
  return `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}|${ms}[a${i}]`;
});
const mix = cues.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${cues.length}:normalize=0:dropout_transition=0[out]`;
execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", [...filters, mix].join(";"),
  "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "-ac", "2", voiceTrack]);
const final = path.join(OUT, "demo.mp4");
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", silent, "-i", voiceTrack, "-map", "0:v", "-map", "1:a",
  "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", final]);

// Phụ đề + kịch bản có mốc thời gian
const ts = (s, sep = ",") => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
};
fs.writeFileSync(path.join(OUT, "demo.srt"),
  cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.start + c.dur)}\n${c.text}\n`).join("\n"));
let md = "# Kịch bản video demo (có mốc thời gian)\n\n";
let prev = null;
for (const c of cues) {
  if (c.step !== prev) { md += `\n## ${c.step}\n\n`; prev = c.step; }
  md += `- \`${ts(c.start).slice(3, 8)}\` **${c.id}**: ${c.text}\n`;
}
fs.writeFileSync(path.join(OUT, "script.md"), md);

const total = written / FPS;
console.log(`\n✅ Xong: ${final} (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})`);
console.log(`   Kèm: demo_silent.mp4, demo.srt, script.md trong ${OUT}`);
process.exit(0);
