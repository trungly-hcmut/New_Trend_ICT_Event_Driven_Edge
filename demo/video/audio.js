// Làm sạch file ghi âm giọng thật trước khi ghép: lọc tiếng phì hơi (b/p) và rung tần số thấp,
// khử click, giảm ồn nền, fade ngắn ở đầu/cuối câu để không còn tiếng "bụp" khi chuyển câu.
// Kết quả được cache trong tts/clean/, file gốc trong voice/ giữ nguyên.
import ffmpeg from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CLEAN = path.join(import.meta.dirname, "tts", "clean");
const VERSION = "v1"; // đổi khi sửa chuỗi filter để tạo lại cache

export function duration(file) {
  return Number(/estimated duration: ([\d.]+)/.exec(execFileSync("afinfo", [file]).toString())[1]);
}

export function cleanVoice(src) {
  const stat = fs.statSync(src);
  const hash = crypto.createHash("sha1").update([VERSION, src, stat.size, stat.mtimeMs].join("|")).digest("hex").slice(0, 10);
  const out = path.join(CLEAN, `${path.basename(src, ".wav")}.${hash}.wav`);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(CLEAN, { recursive: true });
  const fadeOut = Math.max(0, duration(src) - 0.06).toFixed(3);
  const filter = [
    "highpass=f=100:poles=2", "highpass=f=100:poles=2", // cắt mạnh dưới 100 Hz: tiếng phì hơi, rung bàn
    "adeclick",                                           // khử click
    "afftdn=nf=-30",                                      // giảm ồn nền
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "afade=t=in:st=0:d=0.02", `afade=t=out:st=${fadeOut}:d=0.06`,
  ].join(",");
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", src, "-af", filter, "-ar", "48000", out]);
  return out;
}
