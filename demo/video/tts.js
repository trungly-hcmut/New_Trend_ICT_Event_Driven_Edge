// Giọng đọc tiếng Việt neural qua dịch vụ cloud. Cấu hình trong video/.env:
//   TTS_PROVIDER=fpt     FPT_API_KEY=...      FPT_VOICE=leminh        (banmai, thuminh, myan, lannhi, linhsan, leminh, giahuy, minhquang)
//   TTS_PROVIDER=azure   AZURE_SPEECH_KEY=... AZURE_REGION=southeastasia  AZURE_VOICE=vi-VN-NamMinhNeural (hoặc vi-VN-HoaiMyNeural)
//   TTS_PROVIDER=gemini  GEMINI_API_KEY=...   GEMINI_VOICE=Charon     (Kore, Puck, Orus, Aoede… · GEMINI_STYLE = cách đọc)
//   TTS_PROVIDER=google  GOOGLE_API_KEY=...   GOOGLE_VOICE=vi-VN-Neural2-D  (A = nữ, D = nam; hoặc giọng Chirp3-HD nếu tài khoản có)
//   TTS_SPEED=0          tốc độ: -2 … 2 (0 = bình thường)
// Nghe thử: node --env-file=.env tts.js            (đọc câu s01 rồi phát)
//           node --env-file=.env tts.js s18        (đọc câu bất kỳ)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const DIR = import.meta.dirname;
const CACHE = path.join(DIR, "tts");
const env = process.env;
const speed = Number(env.TTS_SPEED ?? 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROVIDERS = {
  fpt: {
    voice: () => env.FPT_VOICE ?? "leminh",
    ext: "mp3",
    async synth(text, voice) {
      need("FPT_API_KEY");
      let body;
      // Gói free giới hạn tần suất gọi → chờ rồi thử lại
      for (let attempt = 1; ; attempt++) {
        const res = await fetch("https://api.fpt.ai/hmi/tts/v5", {
          method: "POST",
          headers: { "api-key": env.FPT_API_KEY, voice, speed: String(speed) },
          body: text,
        });
        body = await res.json();
        const limited = res.status === 429 || /rate limit/i.test(body.message ?? "");
        if (!limited || attempt >= 12) break;
        const wait = Math.min(60, 10 * attempt);
        process.stdout.write(`  ⏳ FPT giới hạn tần suất, chờ ${wait}s rồi thử lại…\n`);
        await sleep(wait * 1000);
      }
      if (body.error !== 0 || !body.async) throw new Error("FPT.AI: " + JSON.stringify(body));
      await sleep(Number(env.FPT_GAP_MS ?? 3000)); // giãn khoảng giữa các lần gọi
      // FPT trả về link mp3 sẽ có sau vài giây → chờ tới khi tải được
      for (let i = 0; i < 40; i++) {
        await sleep(1500);
        const audio = await fetch(body.async);
        if (audio.ok) return Buffer.from(await audio.arrayBuffer());
      }
      throw new Error("FPT.AI: quá thời gian chờ file âm thanh");
    },
  },
  azure: {
    voice: () => env.AZURE_VOICE ?? "vi-VN-NamMinhNeural",
    ext: "wav",
    async synth(text, voice) {
      need("AZURE_SPEECH_KEY");
      const region = env.AZURE_REGION ?? "southeastasia";
      const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const ssml = `<speak version="1.0" xml:lang="vi-VN"><voice name="${voice}"><prosody rate="${speed * 10}%">${esc}</prosody></voice></speak>`;
      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
          "User-Agent": "edge-demo-video",
        },
        body: ssml,
      });
      if (!res.ok) throw new Error(`Azure: HTTP ${res.status} ${await res.text()}`);
      return Buffer.from(await res.arrayBuffer());
    },
  },
  gemini: {
    voice: () => env.GEMINI_VOICE ?? "Charon",
    ext: "wav",
    async synth(text, voice) {
      need("GEMINI_API_KEY");
      const style = env.GEMINI_STYLE ?? "clear, confident university seminar presenter, warm and natural, moderate pace";
      for (let attempt = 1; ; attempt++) {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            model: env.GEMINI_MODEL ?? "gemini-3.8-flash-tts",
            input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
            response_format: { type: "audio" },
            generation_config: { speech_config: [{ voice }] },
          }),
        });
        const body = await res.json();
        if (res.status === 429 && attempt < 12) {
          // Gói free giới hạn số request/phút → chờ rồi thử lại
          const hinted = Number(/(\d+(?:\.\d+)?)s/.exec(JSON.stringify(body))?.[1]);
          const wait = Math.ceil(hinted > 0 ? hinted + 2 : Math.min(60, 10 * attempt));
          process.stdout.write(`  ⏳ Gemini giới hạn tần suất, chờ ${wait}s rồi thử lại…\n`);
          await sleep(wait * 1000);
          continue;
        }
        if (!res.ok) throw new Error("Gemini: " + JSON.stringify(body.error ?? body));
        const audio = (body.steps ?? [])
          .filter((s) => s.type === "model_output")
          .flatMap((s) => s.content ?? [])
          .filter((c) => c.type === "audio")
          .at(-1);
        if (!audio?.data) throw new Error("Gemini: không có audio trong phản hồi " + JSON.stringify(body).slice(0, 300));
        return Buffer.from(audio.data, "base64");
      }
    },
  },
  google: {
    voice: () => env.GOOGLE_VOICE ?? "vi-VN-Neural2-D",
    ext: "wav",
    async synth(text, voice) {
      need("GOOGLE_API_KEY");
      const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_API_KEY },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "vi-VN", name: voice },
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 48000, speakingRate: 1 + speed * 0.1 },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error("Google: " + JSON.stringify(body.error ?? body));
      return Buffer.from(body.audioContent, "base64");
    },
  },
};

function need(name) {
  if (!env[name]) throw new Error(`Thiếu ${name} trong video/.env`);
}

export const provider = env.TTS_PROVIDER ? PROVIDERS[env.TTS_PROVIDER] : null;
if (env.TTS_PROVIDER && !provider) throw new Error(`TTS_PROVIDER không hợp lệ: ${env.TTS_PROVIDER} (fpt | azure | google | gemini)`);
export const providerLabel = provider ? `${env.TTS_PROVIDER}:${provider.voice()}` : null;

// Trả về đường dẫn file âm thanh của câu, có cache theo (dịch vụ, giọng, tốc độ, nội dung)
export async function synthesize(line) {
  const voice = provider.voice();
  const hash = crypto.createHash("sha1").update([env.TTS_PROVIDER, voice, speed, line.text].join("|")).digest("hex").slice(0, 10);
  const file = path.join(CACHE, `${line.id}.${env.TTS_PROVIDER}.${hash}.${provider.ext}`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, await provider.synth(line.text, voice));
  }
  return file;
}

// Chạy trực tiếp: nghe thử một câu
if (process.argv[1] === import.meta.filename) {
  if (!provider) {
    console.log("Chưa cấu hình. Tạo video/.env theo mẫu video/.env.example rồi chạy lại.");
    process.exit(1);
  }
  const { ALL_LINES } = await import("./scenes.js");
  if (process.argv[2] === "--all") {
    // Tạo trước toàn bộ lời thoại (đã có trong cache thì bỏ qua)
    for (const [i, line] of ALL_LINES.entries()) {
      await synthesize(line);
      console.log(`  ✓ ${i + 1}/${ALL_LINES.length} ${line.id}`);
    }
    process.exit(0);
  }
  const id = process.argv[2] ?? "s01";
  const line = ALL_LINES.find((l) => l.id === id);
  if (!line) throw new Error("Không có câu " + id);
  console.log(`🔊 ${providerLabel} · ${id}: ${line.text}`);
  const file = await synthesize(line);
  spawnSync("afplay", [file]);
}
