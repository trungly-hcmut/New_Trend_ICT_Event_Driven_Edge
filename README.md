# Từ Batch đến Real-time

**Data pipeline hướng sự kiện với Serverless & Edge Computing** — slide seminar môn *Những xu hướng mới trong CNTT*.

Nhóm: Bùi Minh Hiếu · Ngô Lê Khoa · Lý Minh Trung

**Xem slide:** https://trungly-hcmut.github.io/New_Trend_ICT_Event_Driven_Edge/

Slide chạy trực tiếp trên trình duyệt, song ngữ VI/EN, không cần build.

## Điều khiển

| Phím | Chức năng |
| --- | --- |
| `←` `→` `Space` | Chuyển slide (trên điện thoại: vuốt ngang) |
| `N` | Bật/tắt ghi chú thuyết trình (“Ý để nói”) |
| `L` | Đổi ngôn ngữ VI / EN |
| `T` | Giao diện tối / sáng |
| `M` | Mục lục |
| `F` | Toàn màn hình |
| `Home` / `End` | Slide đầu / cuối |

Thanh công cụ góc dưới bên phải còn có nút chuyển sang **chế độ cuộn** (đọc như một trang web) và **xuất PDF** (`Ctrl/Cmd + P` → *Save as PDF*, mỗi slide một trang 16:9).

Tham số URL hữu ích:

- `#/12` — mở thẳng slide 12
- `?lang=en`, `?theme=light` — chọn ngôn ngữ / giao diện
- `?notes=1` — mở sẵn ghi chú thuyết trình
- `?static` — tắt hiệu ứng xuất hiện
- `?check` — kiểm tra slide nào bị tràn nội dung (kết quả in ra console)

## Cấu trúc

```
index.html            nội dung 28 slide (VI + EN trong cùng file)
assets/css/deck.css   giao diện
assets/js/deck.js     điều hướng, ngôn ngữ, giao diện, mục lục, ghi chú
assets/js/figures.js  hình động: mạng edge ở trang bìa, đồng hồ 60 giây, bản đồ surge, lưới incremental
```

Mỗi slide là một `<section class="slide">`. Chữ tiếng Việt nằm trong `<span class="vi">`, tiếng Anh trong `<span class="en">`. Ghi chú thuyết trình nằm trong `<aside class="notes">` cuối mỗi slide.

## Đưa lên GitHub Pages

```bash
git init
git add .
git commit -m "Seminar slides: From Batch to Real-time"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
git push -u origin main
```

Sau đó vào **Settings → Pages → Build and deployment**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`. Trang sẽ có ở `https://<tài-khoản>.github.io/<tên-repo>/`.

> File `Dan_bai_seminar_*.docx` là dàn bài gốc; nếu không muốn công khai, thêm nó vào `.gitignore` trước khi push.

## Nguồn

Số liệu và case study lấy từ 23 tài liệu tham khảo ở hai slide cuối. Số liệu của các hãng (Cloudflare, Confluent, Datadog…) là số do chính hãng công bố.
