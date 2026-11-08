# Edge Clickstream: Event-driven Pipeline trên Cloudflare

Pipeline xử lý clickstream hướng sự kiện, chạy hoàn toàn serverless tại edge: sự kiện click được thu tại data center gần người dùng nhất, đi qua hàng đợi, được tổng hợp liên tục và hiển thị real-time. Một job **batch** chạy song song trên cùng dữ liệu để so sánh hai mô hình.

## Kiến trúc tổng quan

```
 Nguồn sự kiện             Edge (Worker)              Đệm              Xử lý               Lưu trữ (D1)          Phục vụ
┌──────────────┐     ┌──────────────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐   ┌────────────────┐
│ Trình duyệt  │     │ POST /event          │   │ Cloudflare   │   │ queue()       │   │ events (thô)     │   │ GET /stats     │
│ (trang shop) ├────►│ GET  /ping           ├──►│ Queue        ├──►│ consumer      ├──►│ page_counts      ├──►│ GET /dashboard │
│ Simulator    │     │ validate, enrich,    │   │ click-events │   │ cộng dồn      │   │ country_counts   │   │ (poll 1 s)     │
│ Globalping   │     │ lọc bot              │   │ lô ≤20 / 1 s │   │ theo lô       │   │ per_second       │   └────────────────┘
└──────────────┘     └──────────┬───────────┘   └──────────────┘   └───────────────┘   │ counters         │
                                │ fallback: ghi thẳng D1 khi Queue lỗi                 │                  │
                                └─────────────────────────────────────────────────────►│ batch_snapshot ◄─┼── scheduled()
                                                                                       │ batch_runs       │   cron */2 phút
                                                                                       └──────────────────┘   quét lại events
```

Toàn bộ hệ thống là **một Worker** với ba entry point, mỗi entry point ứng với một tầng của pipeline:

| Entry point | Kích hoạt bởi | Vai trò |
|---|---|---|
| `fetch` | HTTP request | Edge ingest + API + phục vụ trang |
| `queue` | Cloudflare Queues | Consumer: xử lý và tổng hợp theo lô |
| `scheduled` | Cron `*/2 * * * *` | Batch job truyền thống để đối chiếu |

## Các tầng

### 1. Edge ingest (`fetch` → `/event`, `/ping`)

Worker chạy trên mạng anycast của Cloudflare, nên mỗi request được xử lý tại data center gần người gửi nhất (không có vùng trung tâm).

- **Validate:** `type ∈ {click, view, add_to_cart}`, `page` bắt đầu bằng `/`, `userId` 1–64 ký tự; sai thì trả `400` ngay tại edge.
- **Enrich:** gắn `country` và `colo` (mã data center) từ `request.cf`, cùng `receivedAt`.
- **Lọc bot:** cửa sổ trượt theo `userId` (quá 10 sự kiện / 5 s bị đánh dấu `isBot`). Trạng thái nằm trong bộ nhớ của từng isolate nên chỉ là best-effort; lọc chính xác toàn cục cần Durable Objects.
- **Publish:** `EVENTS_QUEUE.send(event)` rồi mới trả `ok`, nên client chỉ nhận xác nhận khi sự kiện đã vào hàng đợi.
- **Fallback:** nếu Queue không khả dụng, sự kiện được ghi thẳng vào D1 qua `ctx.waitUntil`, response mang `via: "direct"`.

`/ping` dùng chung đường ingest nhưng nhận tham số qua GET, cho các probe đo lường toàn cầu (Globalping) chỉ gửi được GET.

### 2. Hàng đợi (Cloudflare Queues)

Queue `click-events` tách tầng thu nhận khỏi tầng ghi dữ liệu: edge trả lời nhanh bất kể database đang tải thế nào, và các đợt tăng đột biến được hấp thụ ở hàng đợi.

- Consumer nhận lô tối đa **20 sự kiện** hoặc sau **1 giây** (`max_batch_size`, `max_batch_timeout`). Đây là điểm đánh đổi giữa độ trễ và số lần ghi DB; độ trễ edge → database đo được khoảng 1–2 s chủ yếu đến từ đây.
- Giao nhận **at-least-once**: consumer lỗi thì Queue retry. Khi retry, bảng tổng hợp có thể bị cộng trùng; muốn exactly-once cần idempotency key.

### 3. Xử lý streaming (`queue`)

Với mỗi lô, consumer gom số đếm trong bộ nhớ rồi ghi một lần bằng `DB.batch()`:

- `INSERT` từng sự kiện vào `events` (dữ liệu thô, kèm `received_ms` và `stored_ms` để đo độ trễ pipeline).
- `UPSERT ... count = count + excluded.count` vào các bảng tổng hợp: theo trang, theo quốc gia, theo giây, và bộ đếm tổng / bot.
- Dọn `per_second` cũ hơn 120 s.

Chi phí mỗi lô nhỏ và cố định (tỉ lệ với kích thước lô), không phụ thuộc tổng lượng dữ liệu đã có.

### 4. Batch đối chiếu (`scheduled`)

Cron mỗi 2 phút xoá `batch_snapshot` rồi tính lại bằng `SELECT page, COUNT(*) FROM events GROUP BY page`. Kết quả chỉ cập nhật theo chu kỳ, và chi phí tăng theo kích thước bảng `events`. Dashboard đặt hai con số cạnh nhau để thấy khoảng trễ giữa streaming và batch.

### 5. Lưu trữ (D1)

| Bảng | Loại | Cập nhật bởi |
|---|---|---|
| `events` | Dữ liệu thô | Consumer (hoặc fallback) |
| `page_counts`, `country_counts`, `per_second`, `counters` | Tổng hợp streaming | Consumer, cộng dồn |
| `batch_snapshot`, `batch_runs` | Tổng hợp batch | Cron, tính lại toàn bộ |

Schema: [`worker/schema.sql`](worker/schema.sql).

### 6. Phục vụ (`/stats`, `/dashboard`)

`/stats` đọc toàn bộ số liệu trong một `DB.batch()` (7 truy vấn) và tính độ trễ pipeline trung bình từ 12 sự kiện gần nhất. Dashboard poll `/stats` mỗi giây.

## API

| Route | Chức năng |
|---|---|
| `GET /` | Trang shop phát sinh sự kiện |
| `POST /event` | Ingest một sự kiện `{ type, page, userId, sentAt? }` |
| `GET /ping?page=&userId=&type=` | Ingest qua GET |
| `GET /stats` | Số liệu tổng hợp (JSON) |
| `GET /dashboard` | Dashboard real-time vs batch |
| `GET /batch?key=` | Chạy batch job ngay |
| `GET /reset?key=` | Xoá toàn bộ dữ liệu |

`key` là secret `RESET_KEY` của Worker.

## Mã nguồn

```
worker/
  wrangler.toml     bindings: D1 (DB), Queue producer/consumer (EVENTS_QUEUE), cron
  schema.sql        bảng thô + bảng tổng hợp streaming + bảng batch
  src/index.js      fetch (ingest, API), queue (consumer), scheduled (batch)
  src/pages.js      HTML trang shop + dashboard
simulator/
  simulator.js      nguồn sự kiện giả lập: luồng đều, burst, bot, probe toàn cầu
video/              công cụ quay video demo tự động
```

## Chạy

- Deploy lên Cloudflare: [deploy.md](deploy.md)
- Các lệnh chạy demo và chạy local: [demo.md](demo.md)
