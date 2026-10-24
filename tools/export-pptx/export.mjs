// Xuất slide HTML ra PowerPoint (.pptx).
// Mỗi slide là ảnh chụp Full HD từ chính trang web (giữ nguyên thiết kế), kèm:
//   - ghi chú thuyết trình ("Ý để nói") trong phần Notes của PowerPoint,
//   - link bấm được (tài liệu tham khảo, mã nguồn demo),
//   - video demo nhúng sẵn ở slide "Video dự phòng" để chiếu offline,
//   - section theo chương để dễ di chuyển trong PowerPoint.
//
// Cách dùng (trong thư mục này):
//   npm install
//   npm run export                         # cả bản VI và EN → assets/pptx/
//   npm run export -- --lang vi            # chỉ một ngôn ngữ
//   npm run export -- --demo <URL Worker>  # in sẵn mã QR demo vào slide Demo trực tiếp
//   npm run export -- --no-video           # không nhúng video (file nhẹ hơn ~14 MB)
// Cần Google Chrome đã cài trên máy (hoặc đặt CHROME_PATH).

import { chromium } from "playwright-core";
import PptxGenJS from "pptxgenjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT_DIR = path.join(ROOT, "assets", "pptx");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const langs = arg("--lang") ? [arg("--lang")] : ["vi", "en"];
const demoUrl = arg("--demo");
const withVideo = !args.includes("--no-video");

const W = 1280, H = 720;           // kích thước slide trên web
const SCALE = 1.5;                 // ảnh 1920×1080
const SLIDE_W = 13.333, SLIDE_H = 7.5;
const inch = (px) => +(px * SLIDE_W / W).toFixed(3);

const TITLE = {
  vi: "Từ Batch đến Real-time — Data pipeline hướng sự kiện với Serverless & Edge Computing",
  en: "From Batch to Real-time — Event-driven data pipelines with Serverless & Edge Computing",
};

async function launch() {
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" };
  try {
    return await chromium.launch(opts);
  } catch (err) {
    console.error("Không mở được Google Chrome. Cài Chrome hoặc đặt CHROME_PATH=/đường/dẫn/tới/chrome.");
    throw err;
  }
}

async function exportLang(browser, lang) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const q = new URLSearchParams({ lang });
  if (demoUrl) q.set("demo", demoUrl);
  await page.goto(`${pathToFileURL(path.join(ROOT, "index.html")).href}?export&${q}#/1`);
  await page.waitForFunction(() => window.Deck && window.Deck.slides.length > 0);
  await page.evaluate(() => document.fonts.ready);

  // ảnh PNG trong suốt 1×1 làm "vùng bấm" cho link
  const clickArea = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/png").replace(/^data:/, "");
  });

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = TITLE[lang];
  pres.subject = lang === "vi" ? "Seminar Những xu hướng mới trong CNTT" : "Seminar · New Trends in IT";
  pres.author = "Bùi Minh Hiếu, Ngô Lê Khoa, Lý Minh Trung";

  const count = await page.evaluate(() => window.Deck.slides.length);
  let section = null;

  for (let i = 0; i < count; i++) {
    await page.evaluate((n) => window.Deck.go(n), i);
    await page.waitForTimeout(120);
    // chờ ảnh trong slide (mã QR) tải xong
    await page.evaluate((n) => Promise.all(
      [...window.Deck.slides[n].querySelectorAll("img")].map((img) => img.complete || new Promise((r) => { img.onload = img.onerror = r; }))
    ), i);

    const info = await page.evaluate(({ n, lang }) => {
      const s = window.Deck.slides[n];
      const base = s.getBoundingClientRect();
      const rel = (r) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
      const h = s.querySelector("h2, h1");
      const toc = s.dataset[lang === "vi" ? "tocVi" : "tocEn"];
      const ch = s.dataset.ch || "0";
      const chapter = (window.Deck.chapters[ch] || window.Deck.chapters["0"])[lang];
      const links = [...s.querySelectorAll("a[href]")]
        .filter((a) => /^https?:/.test(a.href) && a.getClientRects().length && getComputedStyle(a).visibility !== "hidden")
        .map((a) => ({ url: a.href, text: a.textContent.replace(/\s+/g, " ").trim(), ...rel(a.getBoundingClientRect()) }));
      const box = s.querySelector(".video-box:not(.missing)");
      return {
        chapter,
        title: (toc || (h ? h.innerText : "") || "").replace(/\s+/g, " ").trim(),
        notes: [...s.querySelectorAll(`.notes .${lang}`)].map((p) => p.textContent.replace(/\s+/g, " ").trim()).join("\n\n"),
        links,
        video: box ? { src: box.querySelector("source").getAttribute("src"), ...rel(box.getBoundingClientRect()) } : null,
      };
    }, { n: i, lang });

    // video: lấy một khung hình làm ảnh bìa rồi ẩn video khỏi ảnh chụp slide
    let cover = null;
    if (info.video && withVideo) {
      await page.evaluate(async () => {
        const v = document.querySelector(".video-box video");
        v.controls = false;
        v.muted = true;
        if (v.readyState < 2) await new Promise((r) => v.addEventListener("loadeddata", r, { once: true }));
        v.currentTime = 1.5;
        await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
      });
      cover = "image/png;base64," + (await page.locator(".video-box video").screenshot({ type: "png" })).toString("base64");
      await page.evaluate(() => { document.querySelector(".video-box video").style.visibility = "hidden"; });
    }

    const shot = await page.screenshot({ type: "jpeg", quality: 88 });

    if (info.chapter !== section) {
      section = info.chapter;
      pres.addSection({ title: section });
    }
    const slide = pres.addSlide({ sectionTitle: section });
    slide.background = { color: "060A13" };
    slide.addImage({
      data: "image/jpeg;base64," + shot.toString("base64"),
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
      altText: info.title,
      objectName: `Slide ${i + 1}`,
    });
    for (const l of info.links) {
      slide.addImage({
        data: clickArea,
        x: inch(l.x), y: inch(l.y), w: inch(l.w), h: inch(l.h),
        hyperlink: { url: l.url, tooltip: l.url },
        altText: `Link: ${l.text}`,
        objectName: `Link ${l.text}`.slice(0, 60),
      });
    }
    if (cover) {
      slide.addMedia({
        type: "video",
        path: path.join(ROOT, info.video.src),
        cover,
        x: inch(info.video.x), y: inch(info.video.y), w: inch(info.video.w), h: inch(info.video.h),
        objectName: "Demo video",
      });
    }
    if (info.notes) slide.addNotes(info.notes);
    process.stdout.write(`\r[${lang}] ${i + 1}/${count} ${info.title.slice(0, 60).padEnd(60)}`);
  }

  await page.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `Batch-to-Realtime_${lang.toUpperCase()}.pptx`);
  await pres.writeFile({ fileName: file });
  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ ${path.relative(ROOT, file)} (${mb} MB)`);
}

const browser = await launch();
try {
  for (const lang of langs) await exportLang(browser, lang);
} finally {
  await browser.close();
}
