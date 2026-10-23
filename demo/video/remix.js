// Ghép lại tiếng cho video đã quay (out/demo_silent.mp4) mà không cần quay lại:
// lấy mốc thời gian từng câu trong out/demo.srt, dùng bản ghi âm đã làm sạch trong voice/.
// Dùng khi chỉ sửa / ghi lại vài câu có độ dài gần như cũ, hoặc đổi cách xử lý âm thanh.
import ffmpeg from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ALL_LINES } from "./scenes.js";
import { cleanVoice, duration } from "./audio.js";

const OUT = path.join(import.meta.dirname, "out");
const VOICE = path.join(import.meta.dirname, "voice");
const srt = fs.readFileSync(path.join(OUT, "demo.srt"), "utf8");
const starts = [...srt.matchAll(/^(\d+):(\d+):(\d+),(\d+) -->/gm)].map(
  ([, h, m, s, ms]) => ((+h * 60 + +m) * 60 + +s) * 1000 + +ms
);
if (starts.length !== ALL_LINES.length) throw new Error(`demo.srt có ${starts.length} câu, kịch bản có ${ALL_LINES.length}: hãy chạy npm run record`);

const clips = ALL_LINES.map((l, i) => {
  const src = path.join(VOICE, l.id + ".wav");
  if (!fs.existsSync(src)) throw new Error(`Thiếu ${src}: remix chỉ dùng cho giọng thu âm`);
  const file = cleanVoice(src);
  const gap = (starts[i + 1] ?? Infinity) - starts[i];
  if (duration(file) * 1000 > gap) console.warn(`  ⚠ ${l.id} dài hơn khoảng trống trong video, sẽ đè lên câu sau. Nên chạy npm run record.`);
  return { file, ms: starts[i] };
});

const voiceTrack = path.join(OUT, "voice.m4a");
execFileSync(ffmpeg, [
  "-y", "-loglevel", "error", ...clips.flatMap((c) => ["-i", c.file]),
  "-filter_complex",
  clips.map((c, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${c.ms}|${c.ms}[a${i}]`).join(";") + ";" +
    clips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0[out]`,
  "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "-ac", "2", voiceTrack,
]);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(OUT, "demo_silent.mp4"), "-i", voiceTrack,
  "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", path.join(OUT, "demo.mp4")]);
console.log("✅ Đã ghép lại tiếng: out/demo.mp4");
