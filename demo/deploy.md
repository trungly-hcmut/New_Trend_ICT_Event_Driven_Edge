# Deploy lên Cloudflare

`wrangler.toml` chỉ **khai báo** Worker dùng gì (D1 `clickstream`, Queue `click-events`, cron 2 phút). Các tài nguyên này phải được tạo sẵn trên tài khoản Cloudflare, và `RESET_KEY` là secret đặt riêng, không nằm trong file.

| Cần có | Tạo bằng | Ghi chú |
|---|---|---|
| Đăng nhập | `npx wrangler login` | |
| D1 `clickstream` | `npx wrangler d1 create clickstream` | Copy `database_id` in ra vào `wrangler.toml` |
| Bảng trong D1 | `npm run db:init:remote` | Chạy `schema.sql`. **Xoá sạch dữ liệu cũ** (`DROP TABLE`) |
| Queue `click-events` | `npx wrangler queues create click-events` | Không tạo được thì xoá 2 khối `[[queues.*]]`, Worker tự ghi thẳng vào D1 |
| Secret `RESET_KEY` | `npx wrangler secret put RESET_KEY` | Khoá cho `/reset` và `/batch`. Chép cùng giá trị vào `worker/.dev.vars` để chạy local |
| Code + cron | `npm run deploy` | In ra URL `https://edge-clickstream.<subdomain>.workers.dev` |

## Lần đầu (tài khoản mới)

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create clickstream          # sửa database_id trong wrangler.toml
npx wrangler queues create click-events
npm run db:init:remote
npx wrangler secret put RESET_KEY
npm run deploy
```

`database_id` đang có trong `wrangler.toml` là của tài khoản nhóm. Deploy sang tài khoản khác thì phải tạo D1 mới và thay id này.

## Cập nhật code

Tài nguyên đã có sẵn thì chỉ cần:

```bash
cd worker && npm run deploy
```

Chỉ chạy lại `db:init:remote` khi `schema.sql` thay đổi (sẽ mất dữ liệu).

## Kiểm tra sau khi deploy

```bash
npx wrangler deployments list                  # phiên bản đang chạy
npx wrangler queues info click-events          # producer + consumer = edge-clickstream
curl https://edge-clickstream.<subdomain>.workers.dev/stats
```
