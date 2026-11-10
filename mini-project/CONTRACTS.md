# Hợp đồng chung

Mọi chỗ ba người chạm nhau đều được định nghĩa ở đây. Code phải theo đúng file này; muốn đổi thì mở PR sửa file này trước (cần 2 người còn lại approve).

Quy ước: thời gian là **mili-giây epoch** (số nguyên), tiền là **VND số nguyên**, JSON dùng `camelCase`, cột D1 dùng `snake_case`.

## 1. Endpoint

| Route | Chủ | Key | Mô tả |
|---|---|---|---|
| `POST /tx` | A | – | Nhận một giao dịch (§2), trả quyết định (§3). `?inline=0` bỏ qua tầng edge (dùng khi đo chi phí) |
| `GET /tx/probe?accountId=&amount=&deviceId=` | A | – | Như `POST /tx` nhưng nhận qua GET (cho probe Globalping); server tự tạo `txId`, `runId = "probe-<YYYYMMDD>"`. Baseline tập trung có route giống hệt |
| `GET /health` | A | – | `{"ok":true}` |
| `GET /account/:id/state` | A | có | State hiện tại trong Durable Object (debug) |
| `GET /stats` | B | – | Số liệu tổng hợp cho dashboard |
| `GET /alerts?runId=&since=&limit=` | B | – | Cảnh báo mới nhất, `limit` ≤ 200 |
| `GET /export?table=&runId=&after=&limit=` | B | có | Xuất `transactions` hoặc `alerts` của một run theo trang, `limit` ≤ 1000, `after` là con trỏ trả về từ trang trước |
| `GET /dashboard` | B | – | Trang dashboard |
| `POST /reset` | B | có | Xoá toàn bộ dữ liệu D1 |
| `POST /batch?windowMin=` | C | có | Chạy batch ngay (`trigger = manual`) |

"Key": cần `?key=<ADMIN_KEY>`; sai key trả `403`.

## 2. Giao dịch gửi vào `POST /tx`

```json
{
  "txId": "r-20261110-0930-42:000123",
  "runId": "r-20261110-0930-42",
  "accountId": "acc-007",
  "toAccount": "acc-031",
  "amount": 250000,
  "deviceId": "dev-acc-007-1",
  "sentAt": 1794283800123
}
```

| Trường | Bắt buộc | Ràng buộc |
|---|---|---|
| `txId` | có | 1–80 ký tự `[A-Za-z0-9:_-]`, duy nhất. Simulator tạo dạng `<runId>:<số thứ tự 6 chữ số>` |
| `runId` | không | 1–40 ký tự `[A-Za-z0-9_-]` |
| `accountId`, `toAccount` | có | 1–40 ký tự `[A-Za-z0-9_-]`, khác nhau |
| `amount` | có | số nguyên, 1 000 ≤ amount ≤ 500 000 000 |
| `deviceId` | có | 1–64 ký tự `[A-Za-z0-9_-]` |
| `sentAt` | không | số nguyên ms (giờ phía client, chỉ để đo RTT, **không dùng cho luật**) |

Body tối đa 4 KB. Lỗi trả `400 {"ok":false,"error":"invalid_field:<tên trường>"}` hoặc `"error":"invalid_json"` / `"body_too_large"`.

## 3. Response của `POST /tx`

```json
{
  "ok": true,
  "txId": "r-20261110-0930-42:000123",
  "decision": "flag",
  "hits": [{ "rule": "velocity", "detail": { "count": 6, "windowMs": 60000 } }],
  "score": 0.41,
  "via": "queue"
}
```

- `decision`: `allow` | `flag` | `block` | `skipped` (tắt inline) | `degraded` (Durable Object lỗi, cho qua).
- `score`: điểm ML, `null` khi chưa có mô hình (trước P4) hoặc khi `skipped`/`degraded`.
- `via`: `queue` hoặc `direct` (Queue lỗi, ghi thẳng D1).
- `txId` trùng giao dịch đã nhận: trả lại đúng kết quả cũ, **không** đếm lại.

## 4. Sự kiện trên Queue `tx-events` (A gửi, B nhận)

```json
{
  "v": 1,
  "txId": "r-20261110-0930-42:000123",
  "runId": "r-20261110-0930-42",
  "accountId": "acc-007",
  "toAccount": "acc-031",
  "amount": 250000,
  "deviceId": "dev-acc-007-1",
  "sentAt": 1794283800123,
  "receivedAt": 1794283800180,
  "country": "VN",
  "colo": "SIN",
  "asn": 45899,
  "inline": {
    "decision": "flag",
    "hits": [{ "rule": "velocity", "detail": { "count": 6, "windowMs": 60000 } }],
    "score": 0.41,
    "decidedAt": 1794283800195
  }
}
```

- `receivedAt` = `Date.now()` khi Worker nhận request. **Mọi luật ở mọi tầng dùng `receivedAt` làm thời điểm giao dịch.**
- `country`, `colo`, `asn` lấy từ `request.cf`; chạy local thì `null`.
- `inline` = `null` khi `skipped`/`degraded`; khi đó `transactions.inline_decision` vẫn ghi giá trị tương ứng (B lấy từ trường `inlineDecision` dưới đây).
- Thêm trường `"inlineDecision"` luôn có mặt (`allow|flag|block|skipped|degraded`) để B không phải suy ra.
- Queue giao **ít nhất một lần**: B phải chịu được sự kiện trùng.

## 5. Bộ luật dùng chung (`worker/src/shared/rules/`)

Ba tầng gọi **cùng** các hàm thuần dưới đây, chỉ khác cách dựng `state`. Đây là điều kiện để so sánh công bằng.

```js
export const DEFAULT_CONFIG = {
  velocityMax: 5,          // hit khi số giao dịch trong cửa sổ (tính cả giao dịch hiện tại) > 5
  velocityWindowMs: 60000,
  spikeRatio: 5,           // hit khi amount >= 5 × trung vị lịch sử
  spikeMinHistory: 5,      // cần >= 5 giao dịch trước đó
  spikeMinAmount: 2000000, // và amount >= 2 triệu
  newDeviceMinHistory: 3,  // tài khoản có >= 3 giao dịch trước đó mới xét thiết bị lạ
  historySize: 20,
  maxDevices: 10,
};

export function parseConfig(env)              // đọc env (§11), thiếu thì lấy DEFAULT_CONFIG
export function emptyState()                  // { v:1, recent:[], devices:[], txCount:0 }
export function evaluate(state, tx, cfg)      // -> Hit[]; state là lịch sử TRƯỚC tx
export function update(state, tx, cfg)        // -> state mới; không sửa object đầu vào
export function decide(hits)                  // -> 'allow' | 'flag' | 'block'
```

`tx` truyền vào luật: `{ txId, amount, deviceId, ts }` với `ts = receivedAt`.

**State**

```js
{
  v: 1,
  recent: [{ ts, amount, deviceId }], // tối đa historySize giao dịch gần nhất, cũ → mới
  devices: ["dev-acc-007-1"],         // tối đa maxDevices, giữ thiết bị dùng gần nhất
  txCount: 12                         // tổng số giao dịch đã thấy
}
```

**Luật**

| `rule` | Điều kiện | `detail` |
|---|---|---|
| `velocity` | `1 + count(recent có ts > tx.ts − velocityWindowMs) > velocityMax` | `{ count, windowMs }` |
| `amount_spike` | `recent.length >= spikeMinHistory` và `amount >= spikeMinAmount` và `amount >= spikeRatio × median(recent.amount)` | `{ amount, median, ratio }` |
| `new_device` | `txCount >= newDeviceMinHistory` và `deviceId ∉ devices` | `{ deviceId, knownDevices }` |
| `ml_score` (P4) | `score >= model.threshold` | `{ score, threshold }` |

**Quyết định:** 0 hit → `allow`; 1 luật → `flag`; ≥ 2 luật khác nhau → `block`.

**Thứ tự:** giao dịch xếp theo `(receivedAt, txId)` tăng dần. Với mỗi giao dịch: `evaluate` trước, `update` sau. Edge theo thứ tự đến Durable Object; stream và batch sắp lại theo thứ tự trên nên có thể lệch ở vài ca hai giao dịch cách nhau vài ms. Ghi nhận trong báo cáo, không cần xử lý.

## 6. Cảnh báo (Alert)

```json
{
  "txId": "r-20261110-0930-42:000123",
  "runId": "r-20261110-0930-42",
  "accountId": "acc-007",
  "tier": "stream",
  "rule": "velocity",
  "detail": { "count": 6, "windowMs": 60000 },
  "txReceivedAt": 1794283800180,
  "detectedAt": 1794283802310,
  "notifiedAt": 1794283802790
}
```

- Khoá duy nhất: `(txId, tier, rule)`. Ghi bằng `INSERT OR IGNORE`; chỉ gửi Telegram khi thật sự chèn được dòng mới.
- `detectedAt`: `edge` = `inline.decidedAt`; `stream` = `Date.now()` sau khi đọc lịch sử từ D1; `batch` = `Date.now()` lúc ghi kết quả.
- `notifiedAt`: lúc Telegram trả 200; `null` nếu bị gom hoặc không gửi.

## 7. Schema D1 (`worker/schema.sql`, chủ: B)

```sql
CREATE TABLE IF NOT EXISTS transactions (
  tx_id            TEXT PRIMARY KEY,
  run_id           TEXT,
  account_id       TEXT    NOT NULL,
  to_account       TEXT    NOT NULL,
  amount           INTEGER NOT NULL,
  device_id        TEXT    NOT NULL,
  sent_at          INTEGER,
  received_at      INTEGER NOT NULL,
  country          TEXT,
  colo             TEXT,
  asn              INTEGER,
  inline_decision  TEXT    NOT NULL,  -- allow|flag|block|skipped|degraded
  inline_score     REAL,
  via              TEXT    NOT NULL,  -- queue|direct
  stored_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions(account_id, received_at);
CREATE INDEX IF NOT EXISTS idx_tx_run          ON transactions(run_id, received_at);

CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id           TEXT    NOT NULL,
  run_id          TEXT,
  account_id      TEXT    NOT NULL,
  tier            TEXT    NOT NULL,   -- edge|stream|batch
  rule            TEXT    NOT NULL,
  detail          TEXT,               -- JSON
  tx_received_at  INTEGER NOT NULL,
  detected_at     INTEGER NOT NULL,
  notified_at     INTEGER,
  UNIQUE (tx_id, tier, rule)
);
CREATE INDEX IF NOT EXISTS idx_alerts_run  ON alerts(run_id, tier);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(detected_at);

CREATE TABLE IF NOT EXISTS notify_state (
  account_id    TEXT PRIMARY KEY,
  last_sent_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger       TEXT    NOT NULL,     -- cron|manual
  window_start  INTEGER NOT NULL,
  window_end    INTEGER NOT NULL,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  tx_scanned    INTEGER,
  alerts_new    INTEGER
);
```

Giao dịch `via = direct` không đi qua Queue nên tầng `stream` không thấy. Khi đó edge tự ghi cả dòng `transactions` lẫn alert tầng `edge`. Eval loại các giao dịch này khỏi phép so sánh giữa các tầng, nhưng vẫn tính chúng trong thí nghiệm chịu lỗi.

## 8. Đặc trưng và mô hình (P4)

Đặc trưng tính từ **state trước giao dịch** (giống `evaluate`), cùng thứ tự ở JS (`shared/features.js`) và Python (`ml/features.py`):

| # | Tên | Công thức |
|---|---|---|
| 0 | `log_amount` | `log10(amount)` |
| 1 | `amount_ratio` | `amount / median(recent.amount)`; không có lịch sử → `1` |
| 2 | `count_60s` | số giao dịch trong 60 s, tính cả giao dịch hiện tại |
| 3 | `is_new_device` | `1` nếu `txCount >= 3` và thiết bị chưa biết, ngược lại `0` |
| 4 | `log_gap` | `log10(1 + min(giây từ giao dịch trước, 86400))`; chưa có → `log10(86401)` |
| 5 | `log_tx_count` | `log10(1 + txCount)` |

`ml/out/model.json`:

```json
{
  "version": "lr-2026-11-20",
  "features": ["log_amount", "amount_ratio", "count_60s", "is_new_device", "log_gap", "log_tx_count"],
  "mean": [5.3, 1.2, 1.4, 0.03, 2.9, 1.1],
  "std":  [0.6, 1.8, 1.1, 0.17, 1.0, 0.4],
  "weights": [0.4, 1.9, 1.2, 1.5, -0.6, -0.2],
  "bias": -4.1,
  "threshold": 0.7
}
```

`score = 1 / (1 + exp(-(bias + Σ weights[i] × (x[i] − mean[i]) / std[i])))`. Số trên chỉ là ví dụ.

Kiểm tra khớp JS và Python bằng `ml/out/feature-fixtures.json`: `[{ "state": {...}, "tx": {...}, "features": [...], "score": 0.12 }]`, sai số cho phép `1e-9`.

## 9. File kết quả của simulator (`runs/<runId>/`, không commit)

| File | Nội dung mỗi dòng |
|---|---|
| `meta.json` | `{ runId, seed, scenario, target, inlineEnabled, accounts, startedAt, finishedAt }` |
| `accounts.json` | hồ sơ tài khoản: `{ accountId, medianAmount, ratePerMin, devices, ... }` |
| `truth.jsonl` | `{ txId, accountId, label: "fraud"|"normal", scenario, caseId }`; `caseId` gom các giao dịch của một vụ gian lận, `null` nếu bình thường |
| `client.jsonl` | `{ txId, sentAt, respAt, status, decision, via }` (giờ phía client) |
| `txs.jsonl` | chỉ có khi `--dry-run`: các giao dịch §2 kèm `ts` giả lập, dùng để huấn luyện offline |

**Nhãn không bao giờ được gửi lên Worker.**

## 10. Công thức đo

- **TTD theo vụ** (số chính của báo cáo): với mỗi `caseId` và mỗi tầng, `min(detected_at của alert tầng đó trên giao dịch thuộc vụ) − received_at của giao dịch đầu tiên trong vụ`. Không có alert → vụ bị bỏ sót.
- **TTD theo giao dịch:** `detected_at − tx_received_at` của từng alert.
- **Độ trễ đến người nhận:** `notified_at − tx_received_at`.
- **Precision / recall theo giao dịch**, mỗi tầng (và mỗi luật): giao dịch "bị báo" = có ít nhất một alert ở tầng đó.
- **Recall theo vụ:** số vụ phát hiện được / tổng số vụ.
- **Chi phí inline:** p50, p95 của `respAt − sentAt` khi `?inline=1` so với `?inline=0`, cùng tải.
- Báo median và p95; mỗi thí nghiệm chạy 3 seed.

Lưu ý: trong Workers, `Date.now()` chỉ nhảy sau mỗi lần I/O, nên **không** đo thời gian chạy CPU bên trong Worker bằng `Date.now()`. Độ trễ inline đo từ phía client.

## 11. Cấu hình

`[vars]` trong `wrangler.toml`:

| Biến | Mặc định | Dùng bởi |
|---|---|---|
| `VELOCITY_MAX`, `VELOCITY_WINDOW_MS`, `SPIKE_RATIO`, `SPIKE_MIN_HISTORY`, `SPIKE_MIN_AMOUNT`, `NEW_DEVICE_MIN_HISTORY` | theo §5 | cả 3 tầng qua `parseConfig` |
| `INLINE_ENABLED` | `"1"` | A |
| `DO_TIMEOUT_MS` | `"300"` | A |
| `NOTIFY_TIERS` | `"edge,stream,batch"` | B |
| `NOTIFY_GROUP_MS` | `"60000"` (tối đa 1 tin / tài khoản / 60 s) | B |
| `BATCH_WINDOW_MIN` | `"5"` khi demo, `"60"` khi chạy theo giờ | C |
| `FAULT_QUEUE_SEND_RATE` | `"0"` | A: coi `send()` là lỗi theo tỉ lệ |
| `FAULT_CONSUMER_FAIL_RATE` | `"0"` | B: consumer ném lỗi sau khi ghi một phần lô |
| `FAULT_NOTIFY_FAIL_RATE` | `"0"` | B: lệnh gửi Telegram bị coi là lỗi |

Các biến `FAULT_*` chỉ bật trong thí nghiệm chịu lỗi; khi demo và khi đo chính phải để `"0"`.

Secret (`wrangler secret put`): `ADMIN_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

Binding: `DB` (D1), `TX_QUEUE` (Queue `tx-events`, consumer `max_batch_size = 20`, `max_batch_timeout = 1`), `ACCOUNT` (Durable Object `AccountState`, migration `new_sqlite_classes`).

## 12. Hàm export dùng chéo

| Hàm | File | Chủ | Ai gọi |
|---|---|---|---|
| `evaluate`, `update`, `decide`, `emptyState`, `parseConfig` | `shared/rules/index.js` | A | A, B, C |
| `computeFeatures(state, tx)`, `score(model, features)` | `shared/features.js`, `shared/model/score.js` | A | A, B |
| `buildStateFromRows(rows, cfg)`: dựng state từ các dòng `transactions` | `pipeline/state.js` | B | B, test của A |
| `replay(rows, cfg, { windowStart, windowEnd })`: trả danh sách hit | `batch/replay.js` | C | C, test của A |
| `notifyAlerts(env, alerts)`, `notifySummary(env, text)` | `pipeline/notify.js` | B | B, C |
