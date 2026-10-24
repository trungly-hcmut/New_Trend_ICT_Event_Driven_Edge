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

Thanh công cụ góc dưới bên phải còn có nút chuyển sang **chế độ cuộn** (đọc như một trang web), **tải PowerPoint** và **xuất PDF** (`Ctrl/Cmd + P` → *Save as PDF*, mỗi slide một trang 16:9).

## Bản PowerPoint

Tải ở nút **Tải PowerPoint** trên trang bìa (theo ngôn ngữ đang chọn): [`Batch-to-Realtime_VI.pptx`](assets/pptx/Batch-to-Realtime_VI.pptx) · [`Batch-to-Realtime_EN.pptx`](assets/pptx/Batch-to-Realtime_EN.pptx).

- Mỗi slide là ảnh Full HD chụp từ trang web nên giữ nguyên thiết kế; chữ trên slide **không sửa trực tiếp được** trong PowerPoint.
- Ghi chú thuyết trình nằm trong phần **Notes**; các chương là **Section**; link tài liệu tham khảo bấm được khi trình chiếu.
- Video demo được **nhúng sẵn** ở slide Video dự phòng, chiếu được khi không có mạng (vì vậy mỗi file ~20 MB).

Sửa slide xong thì xuất lại (cần Google Chrome):

```bash
cd tools/export-pptx
npm install
npm run export                          # cả VI và EN → assets/pptx/
npm run export -- --demo <URL Worker>   # in sẵn mã QR demo vào slide Demo trực tiếp
npm run export -- --no-video            # bỏ video, file còn ~6 MB
```

Tham số URL hữu ích:

- `#/12` — mở thẳng slide 12
- `?lang=en`, `?theme=light` — chọn ngôn ngữ / giao diện
- `?notes=1` — mở sẵn ghi chú thuyết trình
- `?demo=https://edge-clickstream.<subdomain>.workers.dev` — hiện mã QR và nút mở dashboard ở slide Demo trực tiếp (dùng `?demo=http://localhost:8787` khi chạy local)
- `?static` — tắt hiệu ứng xuất hiện
- `?check` — kiểm tra slide nào bị tràn nội dung (kết quả in ra console)

## Cấu trúc

```
index.html            nội dung 33 slide (VI + EN trong cùng file)
assets/pptx/          bản PowerPoint VI / EN (sinh bằng tools/export-pptx)
tools/export-pptx/    công cụ xuất PowerPoint từ trang web
assets/css/deck.css   giao diện
assets/js/deck.js     điều hướng, ngôn ngữ, giao diện, mục lục, ghi chú
assets/js/figures.js  hình động: mạng edge ở trang bìa, đồng hồ 60 giây, bản đồ surge, lưới incremental
assets/js/demo.js     slide demo: mã QR theo URL Worker, video dự phòng
assets/video/demo.mp4 video demo dự phòng (chép từ demo/video/out/demo.mp4)
demo/                 mã nguồn demo (Worker, simulator, công cụ quay video)
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

## Demo

Phần Demo nằm ở slide 24–28 (trước Kết luận): kiến trúc, kịch bản trực tiếp có mã QR, những gì demo chứng minh và giới hạn, video dự phòng.

Code demo nằm trong [`demo/`](demo/): Cloudflare Worker + Queues + D1 (thu click tại edge, dashboard real-time so với batch), script giả lập click, và công cụ tự quay video demo kèm lời thoại. Hướng dẫn chạy và deploy: [`demo/README.md`](demo/README.md).

## Nguồn

Số liệu và case study lấy từ 23 tài liệu tham khảo ở hai slide cuối. Số liệu của các hãng (Cloudflare, Confluent, Datadog…) là số do chính hãng công bố.
