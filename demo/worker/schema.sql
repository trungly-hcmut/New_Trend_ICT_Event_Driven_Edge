DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS page_counts;
DROP TABLE IF EXISTS country_counts;
DROP TABLE IF EXISTS per_second;
DROP TABLE IF EXISTS counters;
DROP TABLE IF EXISTS batch_snapshot;
DROP TABLE IF EXISTS batch_runs;

-- Dữ liệu thô: mọi sự kiện đi qua pipeline
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  page        TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  country     TEXT,
  colo        TEXT,
  is_bot      INTEGER NOT NULL DEFAULT 0,
  sent_ms     INTEGER,
  received_ms INTEGER NOT NULL,
  stored_ms   INTEGER NOT NULL
);

-- Streaming: các bảng tổng hợp được cộng dồn ngay khi sự kiện tới
CREATE TABLE page_counts    (page    TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE country_counts (country TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE per_second     (sec     INTEGER PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE counters       (name    TEXT PRIMARY KEY, value INTEGER NOT NULL);

-- Batch: chỉ được tính lại khi cron chạy (quét toàn bộ bảng events)
CREATE TABLE batch_snapshot (page TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE batch_runs     (id INTEGER PRIMARY KEY AUTOINCREMENT, ran_ms INTEGER NOT NULL);
