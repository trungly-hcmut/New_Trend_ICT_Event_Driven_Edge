# Kế hoạch: Phase → Slice → Task

**Cách đọc**

- Người làm: **A = Hiếu** (edge), **B = Khoa** (pipeline, hạ tầng), **C = Trung** (dữ liệu, đo đạc, mô hình). `ALL` = cả nhóm.
- Mã task `P1.2-B3`: phase 1, slice 2, người **B**, task thứ 3 của B trong slice đó.
- Độ lớn: `S` ≈ 2 giờ, `M` ≈ nửa ngày, `L` ≈ 1 ngày.
- **File**: nơi code nằm (theo bản đồ sở hữu trong [README.md](README.md)). **Xong khi**: điều kiện kiểm được. **Chờ**: task phải xong trước; nếu ghi "mock" thì có thể bắt đầu bằng dữ liệu mẫu.
- Mỗi slice có ba người làm song song trên các thư mục khác nhau. Cuối mỗi phase có **mốc** cả nhóm cùng kiểm.
- **Hạn nộp: 00:00 thứ Bảy 12/12/2026**, tức hết thứ Sáu 11/12. Nhóm đặt mục tiêu **nộp thứ Tư 9/12**, giữ 10–11/12 làm dự phòng.
- Chậm quá 1 ngày so với mốc của phase thì cắt theo mục "Thứ tự cắt" ở cuối, không lùi các mốc sau.

| Phase | Mục tiêu | Thời gian (2026) |
|---|---|---|
| P0 | Khung dự án, hợp đồng, dữ liệu mẫu, giao thức thí nghiệm | T3 10/11 – T5 12/11 |
| P1 | Một giao dịch đi hết đường ống, 1 luật, ra Telegram | T6 13/11 – T5 19/11 |
| P2 | Đủ 3 luật ở đủ 3 tầng | T6 20/11 – T5 26/11 |
| P3 | Đo đạc, dashboard, baseline tập trung, chịu lỗi, chịu tải | T6 27/11 – T4 2/12 (phase nặng nhất) |
| P4 | Mô hình bất thường, chạy song song với P3 (cắt được) | T2 23/11 – T4 2/12; chưa xong P4.2 trước T7 28/11 thì cắt |
| — | **Đóng băng mã** (sau mốc này chỉ sửa lỗi) | Hết T4 2/12 |
| P5 | Thí nghiệm chính thức, báo cáo, slide, video, landing page, nộp bài | T5 3/12 – T4 9/12 |

Lịch chi tiết của P5:

| Ngày | Việc |
|---|---|
| T5 3/12 – T6 4/12 | Chạy thí nghiệm chính thức, chốt số liệu; bắt đầu viết báo cáo, slide, khung landing page |
| T7 5/12 | Bản nháp đầy đủ báo cáo và slide; cả nhóm đọc chéo |
| CN 6/12 | Tổng duyệt thuyết trình; quay demo và quay phần thuyết trình của từng người |
| T2 7/12 – T3 8/12 | Dựng video, xuất báo cáo .docx/.pdf, xuất slide, hoàn thiện landing page |
| T4 9/12 | Kiểm tra lần cuối theo checklist, **nộp bài** |
| T5 10/12 – T6 11/12 | Dự phòng |

---

## P0. Khởi động

### S0.1 Khung dự án

- [ ] **P0.1-B1** `M` Tạo Worker và tài nguyên Cloudflare
  - Làm: `npm create cloudflare` trong `mini-project/worker` (JS, không framework), thêm `vitest`. Khai báo binding `DB`, `TX_QUEUE` (producer + consumer, batch 20 / 1 s), `ACCOUNT` (Durable Object `AccountState`, migration `new_sqlite_classes`), cron `*/5 * * * *`. Tạo D1 `tx-alert-db` và Queue `tx-events` trên tài khoản nhóm.
  - File: `worker/wrangler.toml`, `worker/package.json`
  - Xong khi: `npx wrangler deploy` ra URL; `GET /health` trả 200 (dùng router của A, hoặc tạm trả thẳng nếu A chưa xong).
- [ ] **P0.1-B2** `S` Schema D1
  - Làm: viết `schema.sql` đúng [CONTRACTS §7](CONTRACTS.md#7-schema-d1-workerschemasql-chủ-b); thêm script `db:reset:local`, `db:reset:remote`.
  - File: `worker/schema.sql`, `worker/package.json`
  - Xong khi: chạy được cả local và remote; `wrangler d1 execute ... "SELECT name FROM sqlite_master"` thấy đủ 4 bảng.
- [ ] **P0.1-B3** `S` Bot Telegram
  - Làm: tạo bot qua BotFather, tạo group, thêm bot, lấy `chat_id`; gửi thử bằng `curl`. Đặt `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_KEY` bằng `wrangler secret put`. Gửi token cho A và C qua kênh riêng.
  - Xong khi: tin thử xuất hiện trong group; không có secret nào trong git.
- [ ] **P0.1-A1** `S` Router và stub
  - Làm: `src/index.js` định tuyến mọi route ở [CONTRACTS §1](CONTRACTS.md#1-endpoint) tới module của từng chủ; tạo sẵn file stub (trả `501 not_implemented`) cho `edge/`, `durable/account.js`, `pipeline/consumer.js`, `api/*.js`, `batch/run.js`. Export `queue`, `scheduled`, `AccountState`.
  - File: `worker/src/index.js`, các file stub
  - Xong khi: `wrangler dev` chạy; mọi route trả 501 hoặc 200 (`/health`). Từ đây không ai cần sửa `index.js` khi thêm logic.
  - Chờ: P0.1-B1
- [ ] **P0.1-C1** `M` Khung simulator
  - Làm: CLI Node `simulator/sim.js` với `--target --scenario --rate --duration --seed --accounts --inline --dry-run`. PRNG có seed (ví dụ mulberry32) để chạy lại ra đúng dữ liệu. Tạo `runId` dạng `r-YYYYMMDD-HHMM-<seed>`, thư mục `runs/<runId>/`, ghi `meta.json`.
  - File: `simulator/sim.js`, `simulator/lib/rng.js`
  - Xong khi: `node sim.js --dry-run --seed 42` hai lần ra hai `meta.json` giống nhau (trừ thời gian).

### S0.2 Hợp đồng và dữ liệu mẫu

- [ ] **P0.2-ALL** `M` Họp chốt hợp đồng (cả nhóm, 1 giờ)
  - Làm: đọc [CONTRACTS.md](CONTRACTS.md), chốt ngưỡng luật, sửa chỗ chưa rõ, mỗi người xác nhận phần mình phụ thuộc. Xác nhận phân vai Hiếu / Khoa / Trung trong README. Hiếu thêm Khoa vào tài khoản Cloudflare của nhóm.
  - Xong khi: PR sửa CONTRACTS (nếu có) được merge.
- [ ] **P0.2-A2** `S` Khung bộ luật
  - Làm: `shared/rules/index.js` có đủ chữ ký `DEFAULT_CONFIG`, `parseConfig`, `emptyState`, `evaluate`, `update`, `decide` (tạm trả rỗng); test runner đọc `fixtures/rules-cases.json` và chạy từng ca.
  - File: `worker/src/shared/rules/index.js`, `worker/test/rules.test.js`
  - Xong khi: `npm test` chạy (các ca luật đang fail là đúng).
- [ ] **P0.2-A3** `S` Sự kiện mẫu cho consumer
  - Làm: 30 sự kiện đúng [CONTRACTS §4](CONTRACTS.md#4-sự-kiện-trên-queue-tx-events-a-gửi-b-nhận): 3 tài khoản, có một đợt dồn dập, có một bản trùng `txId`, có một sự kiện `inline = null`.
  - File: `fixtures/sample-events.json`
  - Xong khi: B xác nhận dùng được.
- [ ] **P0.2-C2** `M` Bảng ca kiểm thử luật
  - Làm: viết tay từ [CONTRACTS §5](CONTRACTS.md#5-bộ-luật-dùng-chung-workersrcsharedrules) (không nhìn code của A) ít nhất 15 ca: mỗi luật có dưới ngưỡng, đúng ngưỡng, trên ngưỡng, chưa đủ lịch sử; thêm ca 2 luật cùng hit → `block`. Mỗi ca: `{ name, state, tx, expectHits, expectDecision }`.
  - File: `fixtures/rules-cases.json`
  - Xong khi: A review không phát hiện ca nào hiểu sai hợp đồng.
- [ ] **P0.2-B4** `S` CI
  - Làm: GitHub Actions chạy `npm ci`, `npm run lint` (ESLint + Prettier check) và `npm test` trong `mini-project/worker` cho PR chạm `mini-project/**`. Bật branch protection: không merge khi CI đỏ hoặc chưa có 1 review.
  - File: `.github/workflows/mini-project.yml`
  - Xong khi: PR mẫu hiện check xanh/đỏ.

### S0.3 Quản lý dự án và nền tảng nghiên cứu

- [ ] **P0.3-B1** `S` Issue và bảng theo dõi
  - Làm: tạo GitHub Issue cho mỗi task trong file này (có thể dùng `gh issue create` theo vòng lặp), label theo người (`A`, `B`, `C`) và phase, một GitHub Project dạng bảng Todo / Doing / Review / Done. PR ghi `Closes #<số issue>`.
  - Xong khi: mọi task có issue; giảng viên xem được tiến độ qua bảng.
- [ ] **P0.3-B2** `S` Nhật ký nhóm
  - Làm: mẫu biên bản họp `docs/meetings/YYYY-MM-DD.md` (có mặt, đã xong, quyết định, việc tiếp theo); file `docs/contributions.md` để mỗi người tự ghi việc đã làm theo tuần, kèm link PR.
  - Xong khi: có biên bản buổi P0.2-ALL.
- [ ] **P0.3-C1** `S` Đề cương báo cáo
  - Làm: `docs/report/outline.md` theo khung: Tóm tắt; 1. Giới thiệu (bài toán, câu hỏi nghiên cứu, đóng góp); 2. Cơ sở lý thuyết và công trình liên quan; 3. Thiết kế hệ thống; 4. Cài đặt; 5. Thực nghiệm (thiết lập, chỉ số, kết quả); 6. Thảo luận (đánh đổi, hạn chế, mối đe doạ tính hợp lệ); 7. Kết luận và hướng phát triển; Tài liệu tham khảo; Phụ lục (phân công, hướng dẫn tái lập). Ghi rõ mục nào ai viết.
- [ ] **P0.3-A1** `S` Tổng quan tài liệu phần edge
  - Làm: đọc và tóm tắt (mỗi nguồn 5–10 dòng: ý chính, liên quan gì tới bài) vào mục của mình trong `docs/report/related-work.md`. Gợi ý: Shi và cộng sự, "Edge Computing: Vision and Challenges" (IEEE IoT Journal, 2016); Satyanarayanan, "The Emergence of Edge Computing" (IEEE Computer, 2017); tài liệu Cloudflare về Workers và Durable Objects.
- [ ] **P0.3-B3** `S` Tổng quan tài liệu phần pipeline
  - Gợi ý: Kleppmann, *Designing Data-Intensive Applications* (2017), chương 11 về xử lý luồng; Akidau và cộng sự, "The Dataflow Model" (VLDB, 2015); tài liệu Cloudflare Queues về cơ chế giao nhận và retry.
- [ ] **P0.3-C2** `S` Tổng quan tài liệu phần dữ liệu và phát hiện gian lận
  - Gợi ý: Lopez-Rojas, Elmir, Axelsson, "PaySim: A financial mobile money simulator for fraud detection" (EMSS, 2016); Dal Pozzolo và cộng sự, "Credit Card Fraud Detection: A Realistic Modeling and a Novel Learning Strategy" (IEEE TNNLS, 2018).
- [ ] **P0.3-C3** `M` Giao thức thí nghiệm
  - Làm: `docs/experiments.md` viết **trước** khi có số liệu: các giả thuyết (bắt đầu từ bản nháp trong README), mỗi thí nghiệm gồm mục đích, biến thay đổi, biến cố định, tải, số lần lặp (≥ 3 seed), chỉ số, cách loại dữ liệu khởi động (bỏ 30 s đầu). Cả nhóm review.
  - Xong khi: được 2 người còn lại approve. Sau đó đổi giao thức phải ghi lý do trong file.

**Mốc P0:** `wrangler dev` chạy, CI chạy, có 2 file fixtures, hợp đồng đã chốt, issue và bảng theo dõi đã có, giao thức thí nghiệm đã duyệt.

---

## P1. Walking skeleton

Mốc: `node sim.js --scenario velocity_burst` → tin Telegram tầng `stream` trong vài giây.

### S1.1 Edge ingest (A)

- [ ] **P1.1-A1** `M` `POST /tx`: đọc và kiểm tra dữ liệu
  - Làm: đọc body tối đa 4 KB, parse JSON, kiểm tra từng trường theo [CONTRACTS §2](CONTRACTS.md#2-giao-dịch-gửi-vào-post-tx); lỗi trả `400` với mã đúng hợp đồng; method khác trả `405`.
  - File: `worker/src/edge/validate.js`, `worker/src/edge/ingest.js`, `worker/test/validate.test.js`
  - Xong khi: test phủ mỗi trường ít nhất một ca sai.
- [ ] **P1.1-A2** `S` Làm giàu sự kiện
  - Làm: thêm `receivedAt`, `country`, `colo`, `asn` (từ `request.cf`, local thì `null`), `v: 1`, `inlineDecision: "skipped"`, `inline: null` (inline làm ở P2).
  - File: `worker/src/edge/ingest.js`
  - Xong khi: sự kiện tạo ra khớp schema §4 (test so với `fixtures/sample-events.json`).
- [ ] **P1.1-A3** `M` Đẩy vào Queue và fallback
  - Làm: `await env.TX_QUEUE.send(event)` rồi mới trả 200, `via: "queue"`. Queue lỗi → `ctx.waitUntil` ghi thẳng bảng `transactions`, `via: "direct"`. Tham khảo [../demo/worker/src/index.js](../demo/worker/src/index.js).
  - File: `worker/src/edge/ingest.js`
  - Xong khi: chạy local thấy sự kiện vào consumer; giả lập Queue lỗi thì response có `via: "direct"` và dòng xuất hiện trong D1.

### S1.2 Consumer và lưu trữ (B)

- [ ] **P1.2-B1** `M` Consumer lưu giao dịch
  - Làm: `queue(batch)`: `INSERT OR IGNORE` mọi sự kiện vào `transactions` bằng một `DB.batch()`; lỗi thì throw để Queue retry.
  - File: `worker/src/pipeline/consumer.js`, `worker/test/consumer.test.js`
  - Xong khi: nạp `fixtures/sample-events.json` hai lần vẫn chỉ có 29 dòng (một bản trùng).
  - Chờ: mock bằng P0.2-A3
- [ ] **P1.2-B2** `S` `GET /stats` tối thiểu
  - Làm: trả `{ txTotal, alertsByTier: { edge, stream, batch } }`.
  - File: `worker/src/api/stats.js`
  - Xong khi: số liệu khớp `SELECT COUNT(*)`.
- [ ] **P1.2-B3** `M` `GET /export` và `POST /reset`
  - Làm: xuất `transactions` hoặc `alerts` theo `runId`, phân trang bằng con trỏ `after` (theo `received_at, tx_id` hoặc `id`), kiểm `ADMIN_KEY`. `/reset` xoá dữ liệu 4 bảng.
  - File: `worker/src/api/export.js`, `worker/src/api/reset.js`
  - Xong khi: tải hết 2 500 dòng qua 3 trang, không thiếu không trùng.

### S1.3 Luật đầu tiên (A)

- [ ] **P1.3-A1** `M` Luật `velocity`, `update`, `decide`
  - Làm: cài đặt theo §5; `update` giữ tối đa `historySize` giao dịch, không sửa object đầu vào.
  - File: `worker/src/shared/rules/velocity.js`, `worker/src/shared/rules/index.js`
  - Xong khi: mọi ca `velocity` trong `fixtures/rules-cases.json` pass.
  - Chờ: P0.2-C2

### S1.4 Tầng stream và Telegram (B)

- [ ] **P1.4-B1** `L` Chạy luật trong consumer
  - Làm: sau khi lưu lô, sắp sự kiện theo `(receivedAt, txId)`; với mỗi giao dịch đọc lịch sử của tài khoản từ D1 (`received_at` nhỏ hơn, tối đa 20 dòng, cộng danh sách thiết bị), dựng state bằng `buildStateFromRows`, gọi `evaluate`, `INSERT OR IGNORE` vào `alerts` với `tier = "stream"`.
  - File: `worker/src/pipeline/state.js`, `worker/src/pipeline/stream.js`, `worker/test/state.test.js`
  - Xong khi: nạp 6 giao dịch của một tài khoản trong 30 s → đúng 1 alert `velocity` ở giao dịch thứ 6.
  - Chờ: P1.3-A1 (trước đó dùng hàm `evaluate` giả)
- [ ] **P1.4-B2** `M` Gửi Telegram
  - Làm: `notifyAlerts(env, alerts)`: chỉ gửi alert vừa chèn được (`meta.changes = 1`); gom tối đa 1 tin / tài khoản / `NOTIFY_GROUP_MS` qua bảng `notify_state`; gặp `429` thì chờ `retry_after` một lần; ghi `notified_at`. Chạy trong `ctx.waitUntil`. Lưu ý giới hạn Telegram cho group khoảng 20 tin/phút.
  - File: `worker/src/pipeline/notify.js`
  - Xong khi: một đợt 8 giao dịch dồn dập chỉ sinh 1 tin; chạy lại cùng lô không gửi thêm.

### S1.5 Simulator và kiểm thử khói (C)

- [ ] **P1.5-C1** `M` Hồ sơ tài khoản
  - Làm: sinh N tài khoản: số tiền trung vị theo phân phối lognormal (50 nghìn – 2 triệu), tần suất 0,2–2 giao dịch/phút, 1–2 thiết bị, danh sách người nhận quen. Ghi `accounts.json`.
  - File: `simulator/lib/accounts.js`
  - Xong khi: cùng seed ra cùng hồ sơ.
- [ ] **P1.5-C2** `M` Luồng giao dịch bình thường
  - Làm: mỗi tài khoản phát giao dịch theo quá trình Poisson; gửi `POST /tx` với số kết nối đồng thời giới hạn (`--concurrency`, mặc định 10); ghi `client.jsonl` và `truth.jsonl` (label `normal`). Với `--dry-run` ghi `txs.jsonl` và thời gian giả lập, không gửi.
  - File: `simulator/lib/normal.js`, `simulator/lib/sender.js`
  - Xong khi: chạy 2 phút với 20 tài khoản, số dòng `client.jsonl` = số giao dịch trong D1.
  - Chờ: P1.1-A1 để gửi thật; trước đó dùng `--dry-run`
- [ ] **P1.5-C3** `S` Kịch bản `velocity_burst`
  - Làm: chọn 1 tài khoản, 8 giao dịch trong 30 s, label `fraud`, chung `caseId`.
  - File: `simulator/scenarios/velocity_burst.js`
  - Xong khi: `truth.jsonl` có đúng 8 dòng `fraud` cùng `caseId`.
- [ ] **P1.5-C4** `M` Kiểm thử khói đầu-cuối
  - Làm: script chạy một kịch bản, chờ 10 s, gọi `/export?table=alerts`, in PASS/FAIL theo tầng mong đợi. Dùng lại cho mọi phase sau.
  - File: `eval/smoke.js`
  - Xong khi: chạy được trên bản deploy và in PASS cho `velocity_burst` ở tầng `stream`.
  - Chờ: P1.2-B3, P1.4-B1

**Mốc P1:** cả nhóm chạy `node eval/smoke.js --scenario velocity_burst` trên bản deploy → PASS và có tin Telegram.

---

## P2. Đủ luật, đủ tầng

Mốc: một lượt chạy `mixed` → có alert ở cả `edge`, `stream`, `batch`.

### S2.1 Các luật còn lại (A)

- [ ] **P2.1-A1** `M` Luật `amount_spike`
  - File: `worker/src/shared/rules/amount_spike.js`
  - Xong khi: mọi ca `amount_spike` trong fixtures pass, kể cả ca thiếu lịch sử và ca số tiền nhỏ.
- [ ] **P2.1-A2** `M` Luật `new_device`
  - File: `worker/src/shared/rules/new_device.js`
  - Xong khi: mọi ca `new_device` pass; tài khoản mới (dưới 3 giao dịch) không bị báo; danh sách thiết bị không vượt `maxDevices`.
- [ ] **P2.1-A3** `S` `parseConfig(env)`
  - Làm: đọc các biến ở [CONTRACTS §11](CONTRACTS.md#11-cấu-hình), sai kiểu thì lấy mặc định và log cảnh báo.
  - Xong khi: test đổi `VELOCITY_MAX` làm đổi kết quả luật.

### S2.2 Chặn tại edge bằng Durable Object (A)

- [ ] **P2.2-A1** `L` Durable Object `AccountState`
  - Làm: RPC `check(tx)`: đọc state từ storage → nếu `txId` nằm trong 50 `txId` gần nhất thì trả lại kết quả cũ → `evaluate` → `update` → ghi state → trả `{ hits, decision }`. Mỗi tài khoản một object (`idFromName(accountId)`); mọi thao tác trong một lần gọi để không mất cập nhật.
  - File: `worker/src/durable/account.js`, `worker/test/account.test.js`
  - Xong khi: test gọi trùng `txId` không làm tăng `txCount`.
- [ ] **P2.2-A2** `M` Gắn quyết định vào `/tx`
  - Làm: gọi DO trước khi đẩy Queue; ghi `inline = { decision, hits, score: null, decidedAt }` vào sự kiện và response; `?inline=0` hoặc `INLINE_ENABLED = "0"` thì bỏ qua (`skipped`). Khi rơi vào fallback `via = "direct"`, ghi luôn alert tầng `edge` vào D1 trong `ctx.waitUntil`, vì consumer sẽ không thấy sự kiện này.
  - File: `worker/src/edge/ingest.js`
  - Xong khi: kịch bản `velocity_burst` nhận `flag` ngay ở giao dịch thứ 6 trong response.
- [ ] **P2.2-A3** `M` Fail-open khi DO lỗi
  - Làm: `Promise.race` với `DO_TIMEOUT_MS`; lỗi hoặc quá hạn → `degraded`, vẫn đẩy Queue. Ghi chú lý do chọn fail-open (ví điện tử thật có thể chọn fail-closed) cho báo cáo.
  - Xong khi: test giả lập DO ném lỗi → response `degraded`, sự kiện vẫn vào Queue.
- [ ] **P2.2-A4** `S` `GET /account/:id/state`
  - Xong khi: trả state hiện tại khi đúng key, `403` khi sai.

### S2.3 Tầng stream đầy đủ (B)

- [ ] **P2.3-B1** `M` Lưu cảnh báo tầng edge
  - Làm: với mỗi sự kiện có `inline.hits`, ghi alert `tier = "edge"`, `detected_at = inline.decidedAt`; ghi `inline_decision`, `inline_score` vào `transactions`.
  - File: `worker/src/pipeline/consumer.js`
  - Xong khi: số alert `edge` trong D1 bằng số hit trong response mà simulator nhận được.
  - Chờ: mock bằng P0.2-A3 (thêm `inline.hits` vào fixtures nếu thiếu)
- [ ] **P2.3-B2** `M` Dựng state đủ cho cả 3 luật
  - Làm: `buildStateFromRows` dựng `recent`, `devices`, `txCount` (dùng `COUNT(*)`). Test: với cùng một dãy giao dịch, state dựng từ D1 phải bằng state có được khi gọi `update` lần lượt.
  - File: `worker/src/pipeline/state.js`, `worker/test/state.test.js`
  - Xong khi: test so khớp pass trên 200 giao dịch ngẫu nhiên.
- [ ] **P2.3-B3** `M` Định dạng tin và bật/tắt theo tầng
  - Làm: tin gồm tầng, luật, tài khoản, số tiền, độ trễ từ lúc nhận giao dịch; đọc `NOTIFY_TIERS`; export thêm `notifySummary(env, text)` cho batch.
  - File: `worker/src/pipeline/notify.js`
  - Xong khi: tin edge và stream phân biệt được bằng mắt; tắt `edge` thì không còn tin edge.

### S2.4 Tầng batch (C, B)

- [ ] **P2.4-C1** `L` Job batch bằng replay
  - Làm: `replay(rows, cfg, { windowStart, windowEnd })`: dựng state theo từng tài khoản bằng `emptyState`/`evaluate`/`update`, chỉ trả hit cho giao dịch trong cửa sổ. `scheduled()`: cửa sổ `[now − BATCH_WINDOW_MIN, now]`, tải giao dịch từ `windowStart − 24h` để có lịch sử, sắp theo `(received_at, tx_id)`, ghi alert `tier = "batch"`, ghi `batch_runs`.
  - File: `worker/src/batch/replay.js`, `worker/src/batch/run.js`, `worker/test/replay.test.js`
  - Xong khi: chạy trên dữ liệu `velocity_burst` ra đúng các hit như tầng stream.
  - Chờ: P1.3-A1
- [ ] **P2.4-C2** `S` `POST /batch?windowMin=`
  - Xong khi: gọi tay tạo một dòng `batch_runs` với `trigger = "manual"`.
- [ ] **P2.4-B1** `S` Tin tổng kết batch
  - Làm: sau mỗi lần chạy, C gọi `notifySummary` với số giao dịch quét, số alert mới, thời gian chạy; B đảm bảo hàm không bị gom như tin từng tài khoản.
  - Xong khi: mỗi lần batch có đúng 1 tin tổng kết.
  - Chờ: P2.3-B3

### S2.5 Đủ kịch bản gian lận (C)

- [ ] **P2.5-C1** `M` Kịch bản `amount_spike` và `account_takeover`
  - Làm: `amount_spike`: một giao dịch ≥ 10 lần trung vị của tài khoản. `account_takeover`: thiết bị mới + 3–5 giao dịch lớn tới người nhận lạ trong 2 phút.
  - File: `simulator/scenarios/*.js`
- [ ] **P2.5-C2** `M` Kịch bản `mixed` có bẫy
  - Làm: 50 tài khoản, 10 phút, 2–3% giao dịch thuộc các vụ gian lận rải ngẫu nhiên. Thêm ca **bình thường dễ bị báo nhầm**: đổi điện thoại hợp lệ, một lần mua lớn hợp lệ, chuyển nhiều lần chia tiền nhóm. Các ca này label `normal` để đo precision thật.
  - Xong khi: `truth.jsonl` có thống kê in ra cuối lượt chạy (số vụ, số giao dịch fraud, số bẫy).
- [ ] **P2.5-C3** `S` Mở rộng kiểm thử khói
  - Làm: `smoke.js` kiểm mỗi kịch bản gian lận có alert ở tầng `edge` và `stream`; với `--with-batch` gọi `/batch` rồi kiểm tầng `batch`.
- [ ] **P2.5-C4** `M` Hiệu chỉnh simulator theo dữ liệu công khai
  - Làm: lấy phân phối số tiền và tỉ lệ gian lận từ bộ dữ liệu PaySim (Kaggle; kiểm tra giấy phép trước khi dùng) để đặt tham số cho `accounts.js`, thay vì tự chọn. Ghi bảng "tham số simulator ↔ nguồn" vào `docs/experiments.md`.
  - Xong khi: biểu đồ phân phối số tiền của simulator đặt cạnh của PaySim có hình dạng tương tự; nếu khác thì ghi lý do.

**Mốc P2:** `node eval/smoke.js --scenario mixed --with-batch` PASS cả 3 tầng.

---

## P3. Đo đạc, dashboard, kiểm chứng

Mốc: có bảng số liệu đầu tiên (TTD, precision, recall theo tầng) và dashboard chạy trực tiếp.

### S3.1 API và dashboard (B)

- [ ] **P3.1-B1** `M` `/stats` đầy đủ
  - Làm: giao dịch/giây trong 60 s gần nhất; alert theo tầng × luật; median TTD theo tầng trong 10 phút gần nhất; lần batch gần nhất; tỉ lệ `degraded` và `direct`. Tất cả trong một `DB.batch()`.
  - File: `worker/src/api/stats.js`
- [ ] **P3.1-B2** `L` Trang `/dashboard`
  - Làm: 3 cột edge / stream / batch, mỗi cột có số alert và TTD; feed cảnh báo mới nhất; biểu đồ cột so TTD; poll 1 s. Tái dùng style của [../demo/worker/src/pages.js](../demo/worker/src/pages.js).
  - File: `worker/src/api/dashboard.js`
  - Xong khi: chạy `mixed` thấy cột edge nhảy ngay, stream sau vài giây, batch sau khi gọi `/batch`.
- [ ] **P3.1-B3** `S` `GET /alerts`
  - File: `worker/src/api/alerts.js`
- [ ] **P3.1-B4** `S` Kiểm tra hiệu năng D1
  - Làm: `EXPLAIN QUERY PLAN` cho truy vấn lịch sử của consumer và truy vấn của batch, xác nhận dùng index; đo thời gian xử lý một lô 20 sự kiện.
  - Xong khi: ghi kết quả vào `docs/report/B-pipeline.md`.

### S3.2 Đo đạc (C, B)

- [ ] **P3.2-C1** `L` Tính số liệu
  - Làm: tải `/export` của một run, ghép với `truth.jsonl`, tính theo [CONTRACTS §10](CONTRACTS.md#10-công-thức-đo): precision/recall theo giao dịch và theo vụ, TTD theo vụ và theo giao dịch (median, p95), độ trễ tới Telegram; theo tầng × luật. Loại giao dịch `via = direct`.
  - File: `eval/metrics.js`
  - Xong khi: xuất `eval/out/<runId>/metrics.json` và `metrics.md`; kiểm tay 3 vụ khớp với D1.
- [ ] **P3.2-C2** `M` Chi phí chặn tại edge
  - Làm: chạy cùng seed, cùng tải hai lần (`--inline 1` / `--inline 0`), so p50, p95 của `respAt − sentAt`.
  - File: `eval/inline_cost.js`
  - Xong khi: có bảng 2 dòng trong `metrics.md`.
- [ ] **P3.2-B1** `M` Biểu đồ cho báo cáo
  - Làm: từ `metrics.json` vẽ PNG: TTD theo tầng (log scale), precision/recall theo tầng, phân bố RTT inline on/off.
  - File: `eval/plot.py`
  - Chờ: định dạng `metrics.json` từ P3.2-C1 (thống nhất sớm bằng file mẫu)
- [ ] **P3.2-C4** `S` Khoảng tin cậy
  - Làm: bootstrap (1 000 lần lấy mẫu lại) cho median TTD, p95 RTT, precision, recall; báo khoảng tin cậy 95% trong `metrics.json`. Gộp 3 seed.
  - Xong khi: mọi con số chính trong báo cáo có kèm khoảng tin cậy.

### S3.3 Kiểm chứng edge (A)

- [ ] **P3.3-A1** `M` Kiểm tra đồng thời
  - Làm: 20 request song song cùng tài khoản → `txCount = 20`, hit `velocity` đúng từ giao dịch thứ 6; gửi lại 5 `txId` cũ → không đếm thêm.
  - File: `worker/test/concurrency.test.js` (hoặc script chạy trên bản deploy)
- [ ] **P3.3-A2** `M` Kiểm tra 3 tầng nhất quán
  - Làm: với cùng một dãy giao dịch, so tập hit của (a) gọi `evaluate`/`update` lần lượt như DO, (b) `buildStateFromRows` của B, (c) `replay` của C. Phải giống nhau.
  - File: `worker/test/consistency.test.js`
  - Chờ: P2.3-B2, P2.4-C1
- [ ] **P3.3-A3** `S` Log có cấu trúc
  - Làm: mỗi `/tx` log một dòng JSON (`txId`, `decision`, `hits`, `via`, `colo`) để xem bằng `wrangler tail`.
- [ ] **P3.3-A4** `M` Phân tích độ nhạy ngưỡng
  - Làm: replay offline (không cần deploy) dữ liệu `mixed` với `VELOCITY_MAX` 3–8 và `SPIKE_RATIO` 3–10; vẽ đường precision/recall theo ngưỡng; giải thích vì sao chọn ngưỡng mặc định.
  - File: `eval/sweep.js`
  - Chờ: P2.5-C2

### S3.4 So sánh với máy chủ tập trung (A, C)

Đây là phép so sánh trả lời trực tiếp "edge mang lại gì". Không có nó, cả 3 tầng đều chạy trên Cloudflare và báo cáo chưa chứng minh được lợi ích của edge.

- [ ] **P3.4-A1** `L` Baseline tập trung
  - Làm: server Node `baseline/server.js` dùng **cùng** `shared/rules` và `shared/features`, state giữ trong bộ nhớ của một tiến trình, cùng API `POST /tx` và `GET /tx/probe`. Deploy lên **một** VM ở một vùng (đề xuất Singapore, lựa chọn hợp lý của một công ty Việt Nam). Không dùng dịch vụ tự ngủ khi rảnh, vì cold start làm sai số đo.
  - File: `baseline/**`, `docs/report/A-edge.md` (ghi cấu hình VM)
  - Xong khi: chạy kịch bản `velocity_burst` vào baseline cho cùng quyết định như edge.
- [ ] **P3.4-A2** `S` Endpoint đo bằng GET
  - Làm: `GET /tx/probe?accountId=&amount=&deviceId=` đi qua đúng đường `/tx` (tự tạo `txId`, `runId = "probe-<ngày>"`), cho các probe chỉ gửi được GET; làm trên cả Worker và baseline.
  - Xong khi: [CONTRACTS §1](CONTRACTS.md#1-endpoint) đã có route này và hai bên trả cùng định dạng.
- [ ] **P3.4-C1** `M` Đo từ nhiều vùng bằng Globalping
  - Làm: ít nhất 5 vùng (Việt Nam, Singapore, Nhật, châu Âu, Mỹ), mỗi vùng ≥ 30 lần cho mỗi bên (edge, baseline); lấy p50, p95 thời gian phản hồi; kiểm hạn mức lượt đo của Globalping trước khi chạy.
  - File: `eval/globalping.js`
  - Xong khi: bảng vùng × (edge, baseline) có khoảng tin cậy. Báo cáo phải nói trung thực: người dùng ở Việt Nam có thể chỉ chênh ít; lợi ích rõ khi người dùng phân tán.
  - Chờ: P3.4-A1, P3.4-A2

### S3.5 Chịu lỗi và chịu tải (B, A)

- [ ] **P3.5-A1** `S` Tiêm lỗi Queue ở edge
  - Làm: biến `FAULT_QUEUE_SEND_RATE` (0–1): `send()` bị coi như lỗi theo tỉ lệ này để kích hoạt đường `direct`.
  - File: `worker/src/edge/ingest.js`
- [ ] **P3.5-B1** `M` Tiêm lỗi pipeline
  - Làm: `FAULT_CONSUMER_FAIL_RATE` (consumer ném lỗi sau khi đã ghi một phần lô, để Queue giao lại), `FAULT_NOTIFY_FAIL_RATE` (Telegram lỗi). Mặc định đều là 0.
  - File: `worker/src/pipeline/**`
- [ ] **P3.5-B2** `M` Thí nghiệm chịu lỗi
  - Làm: chạy `mixed` với từng loại lỗi (và DO timeout của A). Kiểm: số giao dịch trong D1 = số response 200 ở client (không mất); không có alert trùng `(txId, tier, rule)`; không có tin Telegram trùng; số giao dịch `direct`/`degraded` khớp tỉ lệ tiêm.
  - File: `eval/faults.js`, kết quả vào `docs/report/B-pipeline.md`
  - Chờ: P3.5-A1, P3.5-B1
- [ ] **P3.5-A2** `M` Thí nghiệm chịu tải
  - Làm: tăng dần 20 → 50 → 100 → 200 giao dịch/s, mỗi mức 60 s (k6 hoặc simulator); đo RTT, độ trễ consumer (`stored_at − received_at`), lỗi; thêm ca "tài khoản nóng" 1 tài khoản 50 giao dịch/s để thấy giới hạn của một Durable Object. Tính trước tổng request để không vượt hạn mức gói Cloudflare.
  - File: `eval/loadtest/**`

**Mốc P3:** bảng số liệu của 1 lượt `mixed` được cả nhóm đọc và thống nhất cách diễn giải; có bảng edge so với baseline theo vùng; thí nghiệm chịu lỗi không mất giao dịch.

---

## P4. Mô hình bất thường (cắt được)

Mốc: luật `ml_score` chạy tại edge và stream; bảng số liệu có thêm hàng ML.

### S4.1 Đặc trưng dùng chung (A, C)

- [ ] **P4.1-A1** `M` `computeFeatures(state, tx)` bằng JS
  - Làm: đúng [CONTRACTS §8](CONTRACTS.md#8-đặc-trưng-và-mô-hình-p4).
  - File: `worker/src/shared/features.js`
- [ ] **P4.1-C1** `M` Đặc trưng bằng Python và fixtures
  - Làm: cùng spec trong `ml/features.py`; xuất ≥ 200 mẫu (state, tx, features) vào `ml/out/feature-fixtures.json`.
- [ ] **P4.1-A2** `S` Test khớp JS và Python
  - Xong khi: mọi mẫu trong fixtures lệch < `1e-9`.
  - Chờ: P4.1-C1

### S4.2 Huấn luyện (C)

- [ ] **P4.2-C1** `M` Tạo tập huấn luyện offline
  - Làm: `sim --dry-run --scenario mixed --duration 6h` với seed **khác** seed dùng để đánh giá; replay để tính đặc trưng + nhãn.
  - File: `ml/build_dataset.py`
- [ ] **P4.2-C2** `M` Huấn luyện và xuất mô hình
  - Làm: chuẩn hoá, `LogisticRegression(class_weight="balanced")`; chọn ngưỡng sao cho precision ≥ 0,8 trên tập kiểm tra; xuất `ml/out/model.json` đúng §8.
  - File: `ml/train.py`
- [ ] **P4.2-C3** `S` Đánh giá offline
  - Làm: PR-AUC, ma trận nhầm lẫn, trọng số từng đặc trưng; ghi vào `docs/report/C-ml.md`.

### S4.3 Chấm điểm tại edge (A)

- [ ] **P4.3-A1** `M` Luật `ml_score`
  - Làm: `score(model, features)`; import `model.json` lúc build; thêm hit `ml_score` khi vượt ngưỡng; cắm vào `AccountState.check` và `decide`; điền `score` trong response.
  - File: `worker/src/shared/model/score.js`, `worker/src/durable/account.js`
  - Chờ: P4.2-C2 (trước đó dùng `model.json` giả)
- [ ] **P4.3-A2** `S` Đo chi phí chấm điểm
  - Làm: chấm 10 000 lần bằng Node local, ghi thời gian trung bình vào `docs/report/A-edge.md` (không đo bằng `Date.now()` trong Worker).

### S4.4 Hiển thị và đánh giá (B, C)

- [ ] **P4.4-B1** `M` Chấm điểm ở tầng stream
  - Làm: consumer gọi `computeFeatures` + `score` trên state dựng từ D1, ghi hit `ml_score` với `tier = "stream"`.
  - Chờ: P4.3-A1
- [ ] **P4.4-B2** `S` Hiển thị điểm
  - Làm: dashboard và tin Telegram hiện điểm ML.
- [ ] **P4.4-C1** `S` Thêm ML vào bảng số liệu
  - Làm: thêm hàng `ml_score` và hàng "luật + ML"; liệt kê các vụ chỉ ML bắt được.

---

## P5. Thí nghiệm chính thức và sản phẩm nộp

Sản phẩm phải nộp (theo đề): **báo cáo cuối (.docx hoặc .pdf)**, **mã nguồn**, **slide**, **link video thuyết trình**. Nhóm làm thêm **landing page** gom tất cả lại và có bản web của báo cáo.

Mốc: T4 9/12 nộp đủ 4 sản phẩm; landing page chạy trên GitHub Pages.

### S5.1 Ổn định và chạy thí nghiệm

- [ ] **P5.1-B1** `M` Tài liệu deploy và hạn mức
  - Làm: các bước tạo tài nguyên, đặt secret, nạp schema, reset; đối chiếu tải của thí nghiệm với hạn mức gói Cloudflare đang dùng (request Worker, ghi D1, request DO, Queue).
  - File: `docs/deploy.md`
- [ ] **P5.1-A1** `S` Rà lỗi edge
  - Làm: thử payload lạ, rất nhiều tài khoản mới, state lớn; sửa lỗi tìm được.
- [ ] **P5.1-C1** `M` Chạy thí nghiệm chính thức
  - Làm: `mixed` × 3 seed với batch 5 phút; 1 lượt chạy thật với batch theo giờ (`BATCH_WINDOW_MIN = 60`, cron `0 * * * *`); 1 cặp inline on/off. Lưu toàn bộ `eval/out/`. Theo đúng [docs/experiments.md](docs/experiments.md); so TTD batch đo được với giá trị lý thuyết (trung bình khoảng nửa chu kỳ cron cộng thời gian chạy job).
  - Chờ: P3.2-C1
  - Kết quả cuối lưu ở `eval/out/final/`; landing page, báo cáo và slide đều lấy số từ đây.
- [ ] **P5.1-C2** `S` Tái lập một lệnh
  - Làm: `scripts/reproduce.sh` chạy lại toàn bộ thí nghiệm chính từ đầu (reset → chạy các seed → tính số liệu → vẽ biểu đồ).
  - Xong khi: một người khác trong nhóm chạy lại trên máy mình ra cùng bảng số liệu (sai khác nằm trong khoảng tin cậy).
- [ ] **P5.1-B2** `S` Đóng băng mã và phát hành
  - Làm: hết T4 2/12 tạo tag `v1.0-freeze`; sau thí nghiệm chính thức tạo GitHub Release `v1.0` đính kèm `eval/out/final/` (nén); README gốc của repo thêm mục trỏ tới mini project. Link mã nguồn nộp bài là link Release này.
  - Xong khi: mở link Release ở chế độ ẩn danh thấy mã và dữ liệu.

### S5.2 Nội dung báo cáo

- [ ] **P5.2-A1** `M` Báo cáo phần edge: Durable Object, inline, fail-open, đánh đổi vị trí DO, chi phí inline. File `docs/report/A-edge.md`.
- [ ] **P5.2-B1** `M` Báo cáo phần pipeline: Queue at-least-once, chống trùng, giới hạn Telegram, D1. File `docs/report/B-pipeline.md`.
- [ ] **P5.2-C1** `M` Báo cáo phương pháp, kết quả, ML; ghép 3 phần thành `docs/report/report.md`.
- [ ] **P5.2-C4** `M` Xuất báo cáo để nộp
  - Làm: từ `docs/report/report.md` dùng pandoc xuất `.docx` (kèm `reference.docx` định dạng font, lề, đánh số mục, mục lục, chú thích hình và bảng), `.pdf` và `.html` (cho landing page). Trang bìa có tên môn, đề tài, họ tên và MSSV cả nhóm. Tài liệu tham khảo theo một chuẩn thống nhất (IEEE). Một lệnh `npm run report` (hoặc `make report`) để xuất lại khi sửa.
  - File: `docs/report/build/**`
  - Xong khi: mở .docx bằng Word và .pdf không vỡ bảng, hình đọc được, mục lục đúng.
  - Chờ: P5.2-A1, P5.2-B1, P5.2-C1
- [ ] **P5.2-A3** `S` ADR phần edge (`docs/adr/`, mỗi quyết định 1 file: bối cảnh, lựa chọn đã cân nhắc, quyết định, hệ quả): một Durable Object mỗi tài khoản; fail-open khi DO lỗi.
- [ ] **P5.2-A4** `S` Mô hình đe doạ và quyền riêng tư: ai có thể giả mạo `deviceId`, gửi trùng `txId`, dò ngưỡng luật; dữ liệu cá nhân nào nằm ở edge và bao lâu; cách hệ thống thật xử lý (ký request, xác thực thiết bị). Vào `docs/report/A-edge.md`.
- [ ] **P5.2-B3** `S` ADR phần pipeline: giao nhận at-least-once với chống trùng bằng khoá duy nhất; gom tin Telegram.
- [ ] **P5.2-B4** `S` Phân tích chi phí: chi phí Cloudflare (Workers, Durable Objects, Queues, D1) cho 1 triệu giao dịch theo bảng giá hiện hành, so với VM của baseline; ghi ngày tra giá.
- [ ] **P5.2-C3** `S` ADR phần batch và đánh giá: batch bằng replay cùng bộ luật; chỉ số chính là TTD theo vụ.

### S5.3 Slide và video thuyết trình

Video thuyết trình là **sản phẩm bắt buộc**, không phải video dự phòng.

- [ ] **P5.3-A3** `S` 3–4 slide phần edge (Durable Object, chặn inline, so với máy chủ tập trung).
- [ ] **P5.3-B2** `S` 3–4 slide phần pipeline, chịu lỗi, dashboard.
- [ ] **P5.3-C2** `M` 3–4 slide kết quả; ghép deck
  - Làm: deck HTML `slides/index.html` dùng lại khung slide sẵn có của repo ([../assets/css/deck.css](../assets/css/deck.css), [../assets/js/deck.js](../assets/js/deck.js)), có ghi chú thuyết trình. Xuất `.pptx` và `.pdf` bằng [../tools/export-pptx/](../tools/export-pptx/) (thêm tham số đường dẫn deck nếu công cụ đang cố định trang gốc).
  - Xong khi: có `slides/MiniProject.pptx` và `.pdf` để nộp; số liệu trên slide khớp `eval/out/final/`.
- [ ] **P5.3-C1** `S` Preset demo
  - Làm: `sim --demo`: 60 s bình thường → `velocity_burst` → `account_takeover`, in bước đang chạy ra terminal.
- [ ] **P5.3-A1** `M` Kịch bản video và checklist quay
  - Làm: xác nhận thời lượng video yêu cầu (nếu đề không nói, đề xuất ≤ 20 phút); chia phân đoạn: mở đầu và bài toán, edge (Hiếu), pipeline (Khoa), kết quả (Trung), demo trực tiếp, kết luận; mỗi đoạn ghi slide nào, ai nói, bao nhiêu phút. Checklist trước khi quay demo: reset dữ liệu, gọi thử để làm nóng, kiểm secret, tắt `FAULT_*`, mở sẵn dashboard, Telegram, terminal.
  - File: `docs/video/script.md`
- [ ] **P5.3-A4** `S`, **P5.3-B3** `S`, **P5.3-C3** `S` Mỗi người quay phần thuyết trình của mình
  - Làm: quay màn hình slide kèm giọng nói (và camera nếu đề yêu cầu); micro rõ, không tiếng vang; đặt tên file theo đoạn trong kịch bản.
  - Xong khi: file nằm trong thư mục chung trước tối CN 6/12.
- [ ] **P5.3-A2** `L` Quay demo và dựng video
  - Làm: quay demo bằng `sim --demo` (dashboard, tin Telegram, terminal cùng khung hình); ghép các đoạn theo kịch bản, thêm tiêu đề từng phần và chú thích số liệu; có thể dùng công cụ trong [../demo/video/](../demo/video/). Xuất **hai file** để nhúng vào landing page, giống cách trang gốc nhúng `assets/video/demo.mp4`:
    - `site/video/presentation.mp4`: video thuyết trình đầy đủ.
    - `site/video/demo.mp4`: riêng đoạn demo, 2–3 phút.
    - `site/video/poster.jpg`: ảnh bìa; và `site/video/chapters.json`: mốc thời gian từng phần theo kịch bản (`[{ "title": "Edge", "start": 95 }, ...]`).
  - Nén để vừa GitHub (mỗi file < 100 MB, nên < 50 MB để không bị cảnh báo) và tua được ngay khi xem trên web:
    ```bash
    ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 28 -vf scale=-2:1080 -r 30 \
           -c:a aac -b:a 96k -movflags +faststart presentation.mp4
    ```
    Video slide nén rất tốt. Nếu vẫn vượt 100 MB thì hạ xuống `scale=-2:720` hoặc tăng `-crf`; không dùng Git LFS vì GitHub Pages không phục vụ file LFS.
  - Chỉ commit **bản cuối** (mỗi lần commit lại file video là repo phình thêm vĩnh viễn); bản nháp chia sẻ qua Google Drive. Tải thêm một bản lên Google Drive làm dự phòng.
  - Xong khi: video phát được trên landing page (Chrome, Safari, điện thoại), tua được; thời lượng đúng yêu cầu.
  - Chờ: P5.3-A4, P5.3-B3, P5.3-C3
- [ ] **P5.3-ALL** `M` Tổng duyệt (cả nhóm): một lần đọc theo kịch bản và bấm giờ trước khi quay (CN 6/12); một lần xem bản dựng trước khi đăng.

### S5.4 Landing page (B, chủ trang)

Trang ở `mini-project/index.html`, chạy trên GitHub Pages hiện có của repo: `https://trungly-hcmut.github.io/New_Trend_ICT_Event_Driven_Edge/mini-project/`. Không cần build; dùng font và màu của deck để đồng bộ.

- [ ] **P5.4-B1** `S` Sơ đồ kiến trúc SVG dùng chung
  - Làm: một sơ đồ SVG (đọc được ở nền sáng và tối) dùng chung cho báo cáo, slide và landing page.
  - File: `site/assets/architecture.svg`
- [ ] **P5.4-B2** `M` Khung trang
  - Làm: các mục: tên đề tài và nhóm; bài toán; kiến trúc; câu hỏi nghiên cứu; kết quả chính; demo; sản phẩm (báo cáo PDF/DOCX, bản web của báo cáo, slide, video, mã nguồn, dashboard trực tiếp); nhóm và phân công. Có chế độ sáng/tối, xem tốt trên điện thoại.
  - File: `index.html`, `site/**`
- [ ] **P5.4-B3** `M` Nội dung kết quả
  - Làm: đọc số từ `eval/out/final/metrics.json` (chép sang `site/data/` bằng script, không gõ tay); nhúng biểu đồ.
  - Nhúng video tự host như trang gốc: mục `#video` dùng `<video controls preload="metadata" playsinline poster="site/video/poster.jpg">` với `site/video/presentation.mp4`, bên dưới là danh sách chương đọc từ `chapters.json` (bấm vào thì nhảy tới mốc đó); mục Demo nhúng `site/video/demo.mp4`. Trước khi có video thật, dùng file ngắn bất kỳ để dựng.
  - Chờ: P5.1-C1, P5.3-A2
- [ ] **P5.4-B4** `S` Bản web của báo cáo
  - Làm: đặt `report.html` do P5.2-C4 xuất vào `report/index.html`, thêm CSS chung và nút tải PDF/DOCX.
  - Chờ: P5.2-C4
- [ ] **P5.4-B5** `S` Kiểm tra trang
  - Làm: không có link hỏng; xem được trên điện thoại, nền sáng và tối; trang vẫn dùng được khi Worker tắt (dashboard chỉ là link phụ). Video phát và tua được trên Chrome, Safari và điện thoại sau khi deploy GitHub Pages (không chỉ khi mở file local); link `…/mini-project/#video` mở thẳng tới video.

### S5.5 Nộp bài

- [ ] **P5.5-C1** `S` Checklist nộp bài (T4 9/12)
  - Làm: kiểm từng mục: báo cáo .pdf (và .docx), link mã nguồn (Release `v1.0`), slide .pptx/.pdf, link video (`…/mini-project/#video`, kèm link Google Drive dự phòng), link landing page. Mở mọi link ở chế độ ẩn danh. Nộp và chụp màn hình xác nhận vào `docs/meetings/`.
  - File: `docs/submission-checklist.md`

---

## Khối lượng mỗi người

Điểm: `S` = 1, `M` = 2, `L` = 4. Không tính 2 task chung (`P0.2-ALL`, `P5.3-ALL`).

| Người | Số task | S | M | L | Điểm | Phần chính trong P5 |
|---|---|---|---|---|---|---|
| A: Hiếu | 35 | 17 | 15 | 3 | 59 | Kịch bản và dựng video thuyết trình |
| B: Khoa | 37 | 19 | 16 | 2 | 59 | Landing page, phát hành mã nguồn |
| C: Trung | 33 | 13 | 18 | 2 | 57 | Xuất báo cáo .docx/.pdf, ghép slide, checklist nộp bài |

## Phụ thuộc chéo quan trọng

| Task | Cần từ | Cách không phải chờ |
|---|---|---|
| P1.2-B1 consumer | sự kiện của A | `fixtures/sample-events.json` (P0.2-A3) |
| P1.3-A1 luật | ca kiểm thử của C | viết code theo CONTRACTS, chạy fixtures khi có |
| P1.4-B1 stream | `evaluate` của A | dùng hàm giả trả hit cố định |
| P1.5-C2 gửi thật | `/tx` của A | `--dry-run` |
| P2.4-C1 batch | bộ luật của A | dùng bản `velocity` đã có ở P1 |
| P3.2-B1 biểu đồ | `metrics.json` của C | thống nhất file mẫu ngay đầu P3 |
| P3.3-A2 nhất quán | `buildStateFromRows` (B), `replay` (C) | làm cuối P3 |
| P4.3-A1 chấm điểm | `model.json` của C | `model.json` giả cùng định dạng |
| P3.4-C1 Globalping | baseline và `/tx/probe` của A | viết script trước, thử trên `/health` |
| P3.5-B2 chịu lỗi | `FAULT_QUEUE_SEND_RATE` của A | thử trước với lỗi consumer và Telegram |
| P5.4-B3 kết quả trên landing | `eval/out/final/` (C), file video (A) | dựng trang bằng `metrics.json` mẫu và một file mp4 ngắn tạm |
| P5.4-B4 báo cáo web | `report.html` (C) | dùng bản xuất nháp ngày T7 5/12 |
| P5.3-A2 dựng video | phần quay của B và C | quay demo trước, ghép sau |

## Thứ tự cắt khi thiếu thời gian

1. P4 (mô hình) — giữ lại phần báo cáo "hướng phát triển". Quyết định vào T7 28/11.
2. P2.5-C4 hiệu chỉnh theo PaySim (ghi là hạn chế trong báo cáo).
3. P3.3-A4 phân tích độ nhạy ngưỡng.
4. P5.4-B4 bản web của báo cáo (landing page chỉ để link PDF).
5. P3.5-A2 thí nghiệm chịu tải (giữ chịu lỗi).
6. Luật `amount_spike` (giữ `velocity` và `new_device`).

Không cắt: P1, tầng edge P2.2, batch P2.4, đo đạc P3.2-C1, baseline tập trung S3.4, thí nghiệm chịu lỗi P3.5-B2, và **4 sản phẩm phải nộp** (báo cáo, mã nguồn, slide, video). Thiếu một trong các phần này thì không còn trả lời được câu hỏi nghiên cứu hoặc thiếu bài nộp.
