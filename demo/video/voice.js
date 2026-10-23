// Ghi âm lời thoại bằng giọng của bạn, từng câu một → voice/<id>.wav
// Cách dùng:
//   node voice.js            # ghi các câu chưa có file
//   node voice.js s07 s18    # ghi lại riêng các câu này
//   node voice.js --all      # ghi lại toàn bộ
//   MIC="MacBook Pro Microphone" node voice.js   # chọn micro cụ thể
import ffmpeg from "ffmpeg-static";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { SCENES } from "./scenes.js";

const DIR = import.meta.dirname;
const VOICE = path.join(DIR, "voice");
fs.mkdirSync(VOICE, { recursive: true });

function detectMic() {
  const out = spawnSync(ffmpeg, ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""]).stderr.toString();
  const audio = out.split("audio devices:")[1] ?? "";
  const names = [...audio.matchAll(/\[\d+\] (.+)/g)].map((m) => m[1].trim());
  return names.find((n) => /macbook|built-in|microphone/i.test(n) && !/teams|zoom|iphone/i.test(n)) ?? names[0];
}

const MIC = process.env.MIC ?? detectMic();
const args = process.argv.slice(2);
const all = SCENES.flatMap((s) => s.lines.map((l) => ({ ...l, step: s.step.replace(/<[^>]+>/g, "") })));
const todo = args.includes("--all")
  ? all
  : args.length
    ? all.filter((l) => args.includes(l.id))
    : all.filter((l) => !fs.existsSync(path.join(VOICE, l.id + ".wav")));

if (!todo.length) {
  console.log("Tất cả câu đã có file ghi âm. Dùng --all hoặc liệt kê id (vd: s07) để ghi lại.");
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`🎙  Micro: ${MIC}   ·   ${todo.length} câu cần ghi`);
console.log("Mẹo: đọc tự nhiên, ngắt nghỉ như khi thuyết trình. Khoảng lặng đầu/cuối sẽ được tự cắt.\n");

for (let i = 0; i < todo.length; i++) {
  const line = todo[i];
  const raw = path.join(VOICE, line.id + ".raw.wav");
  const out = path.join(VOICE, line.id + ".wav");
  for (;;) {
    console.log(`\n── [${i + 1}/${todo.length}] ${line.id} · ${line.step}`);
    console.log(`\n   ${line.text}\n`);
    await rl.question("   [Enter] bắt đầu ghi ");
    const rec = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "avfoundation", "-i", ":" + MIC, "-ac", "1", "-ar", "48000", raw]);
    const done = new Promise((r) => rec.on("close", r));
    await rl.question("   ● Đang ghi… [Enter] dừng ");
    rec.kill("SIGINT");
    await done;

    // Cắt khoảng lặng đầu/cuối và chuẩn hoá âm lượng
    spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", raw, "-af",
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1," +
      "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,areverse," +
      "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", out]);
    fs.rmSync(raw, { force: true });
    if (!fs.existsSync(out) || fs.statSync(out).size < 10_000) {
      console.log("   ⚠ Không thu được âm thanh. Kiểm tra quyền Microphone cho Terminal/VS Code (System Settings → Privacy & Security).");
      continue;
    }
    spawnSync("afplay", [out]);
    const a = (await rl.question("   [Enter] câu tiếp · r ghi lại · p nghe lại · q thoát ")).trim().toLowerCase();
    if (a === "p") { spawnSync("afplay", [out]); if ((await rl.question("   [Enter] câu tiếp · r ghi lại ")).trim() === "r") continue; }
    if (a === "r") continue;
    if (a === "q") { rl.close(); process.exit(0); }
    break;
  }
}
rl.close();
console.log("\n✅ Xong. Chạy `npm run record` để dựng video với giọng của bạn.");
