# Demo: Edge Clickstream

| | |
|---|---|
| Trang shop | https://edge-clickstream.edge-clickstream-demo.workers.dev/ |
| Dashboard | https://edge-clickstream.edge-clickstream-demo.workers.dev/dashboard |

```bash
URL=https://edge-clickstream.edge-clickstream-demo.workers.dev
```

## Chuẩn bị

```bash
curl "$URL/reset?key=$KEY"      # xoá dữ liệu
cd worker && npm run tail        # log tại edge (terminal riêng)
```

## Các bước

```bash
# 1. Người dùng ảo bấm liên tục
node simulator/simulator.js $URL --interval 300

# 2. Flash sale: ~60 người bấm trong 10 giây
node simulator/simulator.js $URL --burst

# 3. Bot: 40 click liên tục từ một tài khoản
node simulator/simulator.js $URL --spam

# 4. 12 probe ở 12 quốc gia cùng gọi /ping
node simulator/simulator.js $URL --global

# Chạy batch ngay, không chờ cron 2 phút
curl "$URL/batch?key=$KEY"
```

## Chạy local

```bash
cd worker && npm run db:init:local && npm run dev
node simulator/simulator.js http://localhost:8787
```
