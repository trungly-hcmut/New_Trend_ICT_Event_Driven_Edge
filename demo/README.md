# Demo: Event-driven Clickstream Pipeline với Cloudflare Workers

Demo cho Slide 14 – mô phỏng website bán hàng: người dùng click → sự kiện được bắt tại edge → hàng đợi → xử lý → lưu trữ → dashboard real-time, đặt cạnh một job **batch** (cron 2 phút) để so sánh.

```
[simulator.js] ─┐
                ├─► Worker /event ──► Queue ──► consumer ──► D1 ──► /dashboard (poll 1s)
[Điện thoại SV] ┘   validate, country,           cộng dồn         real-time vs batch
   (quét QR)        colo, lọc bot                bảng tổng hợp
                        │                                   ▲
                        └─► console.log → wrangler tail     │
                                          cron */2 phút ────┘ (batch: quét lại toàn bộ events)
```

| Route | Chức năng |
|---|---|
| `GET /` | Trang shop "Flash Sale 11/11" để cả lớp quét QR và bấm |
| `POST /event` | Edge ingest: validate, gắn `country`, `colo`, `receivedAt`, lọc bot |
| `GET /ping?page=…` | Như `/event` nhưng dùng GET, cho probe Globalping (`simulator.js --global`) |
| `GET /dashboard` | Dashboard chiếu lên màn hình |
| `GET /stats` | API số liệu cho dashboard |
| `GET /batch?key=…` | Chạy job batch ngay (không cần chờ cron) |
| `GET /reset?key=…` | Xoá toàn bộ dữ liệu trước buổi demo |

## Deploy lên Cloudflare

Xem [deploy.md](deploy.md). Đã deploy rồi thì cập nhật code chỉ cần `cd worker && npm run deploy`.

## Chạy local (dự phòng khi mất mạng)

```bash
cd worker
npm run db:init:local
npm run dev                             # http://localhost:8787/dashboard
# terminal khác:
node simulator/simulator.js http://localhost:8787
```

Ở local, cron không tự chạy → gọi `http://localhost:8787/batch?key=demo123` hoặc `/__scheduled`.

## Kịch bản trên lớp (~4 phút)

Chuẩn bị: `GET /reset?key=…`, mở `/dashboard` toàn màn hình, một terminal chạy `npm run tail` (trong `worker/`).

1. **Edge ingest** – chạy `node simulator/simulator.js <URL>`. Log JSON chạy trong `wrangler tail`; chỉ vào `country`, `colo` (ví dụ `SIN`/`HKG`): request được xử lý tại node gần nhất, không về data center trung tâm.
2. **Real-time vs batch** – cột xanh nhảy liên tục, cột cam đứng yên đến khi cron chạy (đếm ngược ở dưới). Nhắc lại câu chuyện giao dịch lúc 2h sáng ở Slide 3.
3. **Cả lớp tham gia** – chiếu QR, mọi người bấm "Mua ngay": đồ thị lưu lượng vọt lên, Worker tự scale, không cần cấu hình gì.
4. **Lọc bot tại edge** – `node simulator/simulator.js <URL> --spam`: ô "bot bị lọc" tăng, feed hiện dòng đỏ.
5. **Phân tán toàn cầu** – `node simulator/simulator.js <URL> --global`: 12 probe ở 12 nước gọi `/ping`, mỗi nơi do data center gần nhất xử lý (FRA, NRT, GRU, SIN...). Cùng một Worker, không cấu hình vùng.
6. **Độ trễ pipeline** – ô "edge → database" khoảng 1–2 giây, chủ yếu do Queue gom lô (`max_batch_timeout = 1`): đánh đổi giữa độ trễ và hiệu quả ghi.

Quay sẵn video các bước trên để dự phòng.

## Video demo tự động (giọng của bạn)

```bash
cd video
npm install
npm run voice      # ghi âm 29 câu lời thoại, từng câu một (Enter bắt đầu / Enter dừng, r = ghi lại)
npm run record     # tự chạy Worker + simulator, quay màn hình, ghép giọng → out/demo.mp4 (~3,5 phút)
```

- Lời thoại và hành động từng cảnh nằm trong `video/scenes.js`. Sửa câu nào thì ghi lại câu đó: `node voice.js s07`.
- Câu nào chưa ghi âm thì dùng giọng AI tiếng Việt (nếu đã cấu hình `video/.env`, xem dưới), không thì giọng máy macOS (Linh). Video tự căn theo độ dài từng câu.
- **Giọng AI tự nhiên hơn:** `cp .env.example .env`, điền API key của FPT.AI, Azure hoặc Google, rồi `npm run tts:test` để nghe thử câu đầu (`npm run tts:test -- s18` cho câu khác). Ưng giọng rồi thì `npm run record`. Toàn bộ lời thoại khoảng 2.600 ký tự, nằm trong hạn mức miễn phí của cả 3 dịch vụ.
- Kết quả trong `video/out/`: `demo.mp4`, `demo_silent.mp4` (không tiếng), `demo.srt` (phụ đề), `script.md` (kịch bản kèm mốc thời gian).
- Lần đầu ghi âm, macOS sẽ hỏi quyền Microphone cho Terminal/VS Code. Micro được tự chọn là "MacBook Pro Microphone"; muốn đổi: `MIC="Tên micro" npm run voice`.

## Điểm nói thêm khi bị hỏi (nối với Slide 12)

- **Edge lỗi giữa chừng có mất sự kiện không?** Worker chỉ trả `ok` sau khi `EVENTS_QUEUE.send()` thành công; consumer lỗi thì Queue tự retry.
- **Exactly-once:** Queue giao *at-least-once* → khi retry, bảng tổng hợp có thể bị cộng trùng. Muốn chuẩn cần idempotency key.
- **Stateless:** bộ lọc bot nhớ trong RAM của một isolate, nên chỉ là best-effort. Bản chuẩn dùng Durable Objects (Slide 15).
- **Streaming vs batch trong code:** consumer *cộng dồn* vào `page_counts` (chi phí nhỏ, cố định); batch job *quét lại toàn bộ* `events` mỗi lần chạy.
- **Giới hạn gói Free:** D1 khoảng 100k dòng ghi/ngày, mỗi lô sự kiện ghi ~5–10 dòng. Tập dượt vài lần vẫn dư, nhưng đừng để simulator chạy cả ngày.

## Cấu trúc

```
worker/
  wrangler.toml     # bindings D1, Queue, cron
  schema.sql        # bảng events + các bảng tổng hợp + batch
  src/index.js      # fetch (ingest/API), queue (consumer), scheduled (batch)
  src/pages.js      # HTML trang shop + dashboard
simulator/
  simulator.js      # giả lập click, --interval, --users, --spam
```
