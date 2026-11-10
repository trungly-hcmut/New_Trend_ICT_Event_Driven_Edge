# Mini project: Cảnh báo giao dịch đáng ngờ tại edge

Giả lập giao dịch ví điện tử, phát hiện giao dịch đáng ngờ bằng luật và một mô hình bất thường nhỏ, rồi gửi cảnh báo qua Telegram. Cùng một bộ luật được chạy ở **ba tầng** để so sánh thời gian phát hiện:

| Tầng | Chạy ở đâu | Khi nào phát hiện |
|---|---|---|
| `edge` | Worker + Durable Object, ngay trong request `/tx` | Trước khi trả response (có thể chặn) |
| `stream` | Queue consumer | Sau vài giây |
| `batch` | Cron quét lại D1 | Theo chu kỳ (giờ; khi demo dùng 5 phút) |

So với đề gốc (Worker → Queue → luật), nhóm thêm tầng `edge` để phần edge thực sự làm việc chứ không chỉ nhận request, và thêm một **máy chủ tập trung** chạy cùng bộ luật để so sánh edge với cách làm truyền thống.

## Câu hỏi nghiên cứu và giả thuyết

| | Câu hỏi | Giả thuyết (bản nháp, chốt ở P0.3-C3) | Thí nghiệm |
|---|---|---|---|
| RQ1 | Mỗi tầng phát hiện một vụ gian lận mất bao lâu? | Edge cỡ mili-giây (trong request), stream cỡ giây, batch cỡ nửa chu kỳ cron | P3.2-C1, P5.1-C1 |
| RQ2 | Chặn ngay tại edge làm người dùng chờ thêm bao nhiêu? | p95 tăng không quá vài chục ms | P3.2-C2 |
| RQ3 | Edge nhanh hơn máy chủ tập trung tới đâu, với người dùng ở đâu? | Ở Việt Nam chênh ít; người dùng càng xa máy chủ, edge càng có lợi | S3.4 |
| RQ4 | Các tầng có bắt đúng như nhau không? Mô hình có bắt thêm ca nào luật bỏ sót không? | Ba tầng gần như cùng precision/recall vì dùng chung luật; ML tăng recall ở ca kết hợp nhiều dấu hiệu yếu | P3.2-C1, P3.3-A2, P4.4-C1 |
| RQ5 | Khi Queue, consumer, Durable Object hay Telegram lỗi, hệ thống có mất hoặc trùng cảnh báo không? | Không mất giao dịch, không trùng cảnh báo | P3.5-B2 |

## Sản phẩm nộp

**Hạn: 00:00 thứ Bảy 12/12/2026. Nhóm nộp thứ Tư 9/12.** Mini project chiếm 40% điểm môn.

| Sản phẩm | Bắt buộc | Nơi | Ai chốt |
|---|---|---|---|
| Báo cáo cuối (.docx hoặc .pdf) | có | `docs/report/report.md` → `docs/report/build/` | Trung |
| Mã nguồn | có | GitHub Release `v1.0` (kèm dữ liệu thô) | Khoa |
| Slide | có | `slides/` → `.pptx` và `.pdf` | Trung |
| Link video thuyết trình | có | Nhúng trong landing page (`site/video/presentation.mp4`, link nộp `…/mini-project/#video`), dự phòng trên Google Drive | Hiếu |
| Landing page + bản web của báo cáo | nhóm tự thêm | `index.html`, `report/` trên GitHub Pages | Khoa |
| Script tái lập | nhóm tự thêm | `scripts/reproduce.sh` | Trung |
| Quyết định thiết kế | nhóm tự thêm | `docs/adr/` | mỗi người phần mình |
| Bằng chứng đóng góp | nhóm tự thêm | GitHub Project, `docs/contributions.md`, `docs/meetings/` | mỗi người tự ghi |

Landing page: `https://trungly-hcmut.github.io/New_Trend_ICT_Event_Driven_Edge/mini-project/`

> Đề chưa nói thang điểm chi tiết, thời lượng video và ngôn ngữ báo cáo. Cần hỏi giảng viên sớm (trong P0); có thông tin thì đối chiếu với [PLAN.md](PLAN.md) và thêm task nếu còn thiếu.

## Kiến trúc

```
 Simulator (C)                Edge: Worker fetch (A)                   Sau edge (B)
┌───────────────┐  POST /tx  ┌──────────────────────────────┐  send  ┌──────────┐   ┌──────────────────┐   ┌──────────┐
│ giao dịch giả ├───────────►│ validate → enrich (request.cf)├──────►│ Queue    ├──►│ consumer         ├──►│ D1       │
│ + nhãn thật   │◄───────────┤ → Durable Object / tài khoản │        │ tx-events│   │ lưu + chạy luật  │   │ txs      │
│ (truth.jsonl) │  allow /   │   chạy luật + điểm ML         │        └──────────┘   │ tier=stream      │   │ alerts   │
└───────────────┘  flag/block└──────────────────────────────┘                       └────────┬─────────┘   └────┬─────┘
                                                                                             ▼                  │
 Đánh giá (C)                 Batch (C): cron replay D1 qua cùng bộ luật ── tier=batch ──────► Telegram (B)       │
 eval/ ◄── /export ───────────────────────────────────────────── /stats, /alerts, /dashboard (B) ◄──────────────┘
```

Toàn bộ là **một Worker** (`worker/`): `fetch` (edge + API), `queue` (stream), `scheduled` (batch), cùng class Durable Object `AccountState`.

## Vai trò

| | Người | Phụ trách | Câu hỏi cần trả lời trong báo cáo |
|---|---|---|---|
| **A** | **Hiếu** | Edge: `/tx`, Durable Object, bộ luật dùng chung, chấm điểm ML tại edge | Chặn tại edge tốn thêm bao nhiêu độ trễ? |
| **B** | **Khoa** | Pipeline: Queue consumer, D1, tầng stream, Telegram, API, dashboard, deploy | Pipeline có mất / trùng cảnh báo không? |
| **C** | **Trung** | Simulator có nhãn, tầng batch, đo đạc, huấn luyện mô hình, ghép báo cáo | Mỗi tầng phát hiện nhanh và đúng tới đâu? |

Khối lượng đã cân theo điểm (xem cuối [PLAN.md](PLAN.md)). Trong PLAN, chữ cái trong mã task là người làm: `P1.1-A1` là của Hiếu, `P1.2-B1` của Khoa, `P1.5-C1` của Trung.

Lý do xếp: Hiếu quen Cloudflare nhất nên nhận phần edge (Durable Object là phần mới và khó nhất). Khoa nhận pipeline và hạ tầng; phần consumer, D1, dashboard gần với code demo cũ ở [../demo/worker/](../demo/worker/) nên có sẵn mẫu để theo. Trung đề xuất đề tài và làm slide, nên nhận phần dữ liệu, đo đạc, mô hình và ghép báo cáo.

Trước P0.1-B1, Hiếu thêm Khoa vào tài khoản Cloudflare của nhóm (quyền tạo Worker, D1, Queue, Durable Object) để Khoa tự tạo tài nguyên và deploy.

## Tài liệu

- [PLAN.md](PLAN.md): phase → slice → task, có người làm, độ lớn, điều kiện xong, phụ thuộc.
- [CONTRACTS.md](CONTRACTS.md): định dạng dữ liệu, API, schema, công thức đo. **Đọc trước khi code.**

## Quy tắc để không đụng nhau

1. **Mỗi file có đúng một chủ** (bảng dưới). Muốn sửa file của người khác: nhắn chủ file hoặc mở PR để chủ file review.
2. **Chỉ nói chuyện qua hợp đồng.** Thay đổi [CONTRACTS.md](CONTRACTS.md) cần PR riêng, cả 2 người còn lại approve, merge trước code dùng nó.
3. **Không chờ nhau, dùng dữ liệu mẫu:** B code consumer bằng `fixtures/sample-events.json`, A test luật bằng `fixtures/rules-cases.json`, C test đánh giá bằng file export mẫu.
4. **Nhánh:** `<người>/<task-id>-<mô-tả>`, ví dụ `a/P1.1-A1-validate`. PR nhỏ, mỗi PR một task, 1 người khác review.
5. **Xong** = code + test chạy được + đánh dấu `[x]` trong PLAN.md (chỉ sửa dòng task của mình).
6. Đồng bộ 15 phút / 2 ngày: mỗi người nói task xong, task đang làm, đang bị chặn bởi ai.
7. Không commit secret. Token Telegram và `ADMIN_KEY` đặt bằng `wrangler secret put`.

## Bản đồ sở hữu file

| Đường dẫn | Chủ |
|---|---|
| `worker/src/index.js` (router, viết một lần ở P0) | A |
| `worker/src/edge/**`, `worker/src/durable/**` | A |
| `worker/src/shared/**` (luật, đặc trưng, chấm điểm) | A |
| `worker/src/pipeline/**` (consumer, alerts, notifier) | B |
| `worker/src/api/**` (stats, alerts, export, dashboard) | B |
| `worker/src/batch/**` | C |
| `worker/schema.sql`, `worker/wrangler.toml`, `.github/workflows/**` | B |
| `scripts/**` | C |
| `worker/test/<module>.test.js` | chủ module tương ứng |
| `baseline/**` (máy chủ tập trung) | A |
| `simulator/**`, `ml/**`, `eval/**` (trừ các file dưới) | C |
| `eval/plot.py`, `eval/faults.js` | B |
| `eval/sweep.js`, `eval/loadtest/**` | A |
| `index.html`, `site/**`, `report/**` (landing page) | B |
| `slides/**`, `docs/report/build/**`, `docs/submission-checklist.md` | C |
| `docs/video/**`, `site/video/**` (file video, ảnh bìa, mốc chương) | A |
| `docs/experiments.md`, `docs/report/outline.md` | C (cả nhóm review) |
| `docs/adr/*`, `docs/report/related-work.md` | mỗi người phần mình |
| `docs/meetings/**`, `docs/contributions.md` | B tạo mẫu, mọi người ghi |
| `fixtures/rules-cases.json` | C |
| `fixtures/sample-events.json` | A |
| `docs/report/<A|B|C>-*.md` | từng người; C ghép |
| `CONTRACTS.md` | cả nhóm (PR + 2 approve) |

## Cấu trúc thư mục dự kiến

```
mini-project/
  README.md  PLAN.md  CONTRACTS.md
  worker/          Cloudflare Worker (A, B, C cùng code, khác thư mục con)
  baseline/        máy chủ tập trung một vùng, cùng bộ luật (A)
  simulator/       sinh giao dịch có nhãn (C)
  ml/              huấn luyện mô hình, xuất model.json (C)
  eval/            tính số liệu, vẽ biểu đồ, thí nghiệm lỗi và tải (C, B, A)
  fixtures/        dữ liệu mẫu dùng chung cho test
  scripts/         tái lập thí nghiệm bằng một lệnh (C)
  docs/            deploy, giao thức thí nghiệm, ADR, báo cáo, kịch bản video, biên bản họp
  index.html       landing page (B)
  site/            CSS, ảnh, dữ liệu của landing page (B)
  report/          bản web của báo cáo (B)
  slides/          deck HTML, xuất .pptx/.pdf (C)
  runs/            kết quả mỗi lượt chạy simulator (không commit)
```

Có thể tham khảo cách làm ingest, Queue, fallback, dashboard ở [../demo/worker/src/index.js](../demo/worker/src/index.js) và [../demo/worker/src/pages.js](../demo/worker/src/pages.js).
