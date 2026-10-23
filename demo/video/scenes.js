// Kịch bản video demo: mỗi cảnh gồm bố cục (mode), nhãn bước, và các câu thoại.
// Mỗi câu có id cố định → file ghi âm tương ứng: voice/<id>.wav
// `do` chạy ngay khi câu bắt đầu, `after` chạy sau khi đọc xong câu.

export const DASH_QUERY = "?batch=60"; // rút ngắn chu kỳ batch còn 60 giây khi quay

export const SCENES = [
  {
    mode: "title",
    step: "<b>DEMO</b> Giới thiệu",
    lines: [
      { id: "s01", text: "Xin chào thầy cô và các bạn. Nhóm chúng em gồm ba thành viên: Bùi Minh Hiếu, Ngô Lê Khoa và Lý Minh Trung." },
      { id: "s02", text: "Sau đây là phần demo: mô phỏng một website bán hàng trong ngày flash sale mười một tháng mười một." },
      { id: "s03", text: "Mỗi lần người dùng bấm vào sản phẩm, một sự kiện được gửi tới Cloudflare Worker chạy tại edge." },
      { id: "s04", text: "Sự kiện đi qua hàng đợi, được tổng hợp, lưu vào cơ sở dữ liệu D1, rồi hiển thị ngay trên dashboard." },
      { id: "s05", text: "Song song, một job batch chạy theo lịch để so sánh hai cách làm." },
    ],
  },
  {
    mode: "phone",
    step: "<b>Bước 1/6</b> Người dùng tạo sự kiện",
    lines: [
      { id: "s06", text: "Đây là trang bán hàng mà cả lớp sẽ quét mã QR để vào.", do: (c) => c.clickProduct(0) },
      { id: "s07", text: "Khi bấm Mua ngay, trình duyệt gửi một sự kiện JSON gồm loại sự kiện, trang sản phẩm và mã người dùng.", do: (c) => c.clickProduct(3) },
      { id: "s08", text: "Phản hồi trả về cho thấy edge đã gắn thêm quốc gia, node xử lý và thời điểm nhận.", do: (c) => c.clickProduct(4) },
    ],
  },
  {
    mode: "split",
    step: "<b>Bước 2/6</b> Edge ingest",
    // Hẹn giờ batch: chạy ngay sau câu s16 để cột batch "nhảy" đúng lúc (cảnh sau căn lại cho chính xác)
    setup: (c) => c.scheduleBatchAfter(["s09", "s10", "s11", "s12", "s13", "s14", "s15", "s16"]),
    lines: [
      { id: "s09", text: "Bây giờ chạy script giả lập, cứ nửa giây gửi một click từ hai mươi người dùng ảo.", do: (c) => c.sim("normal") },
      { id: "s10", text: "Khung trên là output của script, khung dưới là log của Worker." },
      { id: "s11", text: "Mỗi dòng log là một sự kiện đã được kiểm tra hợp lệ và gắn thêm country, colo và receivedAt." },
      { id: "s12", text: "Edge tự biết người gửi đến từ đâu, không cần gọi thêm dịch vụ nào." },
    ],
  },
  {
    mode: "dash",
    step: "<b>Bước 3/6</b> Real-time và Batch",
    setup: (c) => c.scheduleBatchAfter(["s13", "s14", "s15", "s16"]),
    lines: [
      { id: "s13", text: "Trên dashboard, biểu đồ màu xanh là kết quả real-time, cập nhật mỗi giây." },
      { id: "s14", text: "Biểu đồ màu cam mô phỏng cách làm batch truyền thống: chỉ được tính lại khi đến lịch chạy." },
      { id: "s15", text: "Để tiện demo, chu kỳ batch được rút ngắn còn một phút." },
      { id: "s16", text: "Hãy để ý: trong lúc chờ, số liệu batch hoàn toàn đứng yên, dù sự kiện vẫn liên tục đổ về.", after: (c) => c.waitBatch() },
      { id: "s17", text: "Đến lịch, job batch quét lại toàn bộ dữ liệu và cột màu cam mới nhảy lên." },
      { id: "s18", text: "Đây chính là câu chuyện giao dịch lúc hai giờ sáng: với batch, ta chỉ biết khi job chạy; với pipeline hướng sự kiện, ta biết ngay khi sự kiện xảy ra." },
    ],
  },
  {
    mode: "dash",
    step: "<b>Bước 4/6</b> Flash sale tăng đột biến",
    setup: (c) => c.dashScroll(160),
    lines: [
      { id: "s19", text: "Tiếp theo, giả lập khoảnh khắc mở bán: khoảng sáu mươi người cùng bấm trong mười giây.", do: (c) => c.sim("burst") },
      { id: "s20", text: "Lưu lượng trên biểu đồ tăng vọt lên hơn chục sự kiện mỗi giây." },
      { id: "s21", text: "Chúng ta không phải thêm máy chủ hay cấu hình gì: nền tảng serverless tự mở rộng theo lưu lượng." },
    ],
  },
  {
    mode: "split",
    step: "<b>Bước 5/6</b> Lọc bot tại edge",
    setup: async (c) => { await c.sim("stop"); await c.dashScroll(2000); },
    lines: [
      { id: "s22", text: "Bây giờ, một bot bắn bốn mươi click liên tục từ cùng một tài khoản.", do: (c) => c.sim("spam") },
      { id: "s23", text: "Ngay tại edge, Worker phát hiện hành vi bất thường và đánh dấu là bot, nên các sự kiện này không làm sai lệch số liệu." },
      { id: "s24", text: "Lưu ý: bộ đếm nằm trong bộ nhớ của từng isolate, vì edge là stateless; muốn chính xác trên toàn hệ thống cần dùng Durable Objects." },
    ],
  },
  {
    mode: "dash",
    step: "<b>Bước 6/6</b> Độ trễ pipeline",
    setup: async (c) => { await c.sim("normal"); await c.dashScroll(0); },
    lines: [
      { id: "s25", text: "Ô độ trễ cho biết thời gian từ lúc edge nhận sự kiện đến lúc ghi xong vào cơ sở dữ liệu: chỉ vài trăm mili giây." },
      { id: "s26", text: "Phần lớn thời gian này là do hàng đợi gom sự kiện thành lô, đánh đổi một chút độ trễ để ghi hiệu quả hơn." },
    ],
  },
  {
    mode: "outro",
    step: "<b>DEMO</b> Tổng kết",
    setup: (c) => c.showOutro(),
    lines: [
      { id: "s27", text: "Tóm lại: sự kiện được bắt tại edge, đệm qua hàng đợi, tổng hợp ngay và hiển thị trong khoảng một giây." },
      { id: "s28", text: "Batch vẫn hữu ích cho báo cáo định kỳ, nhưng với cảnh báo và phản hồi tức thì, pipeline hướng sự kiện là lựa chọn phù hợp hơn." },
      { id: "s29", text: "Cảm ơn thầy cô và các bạn đã theo dõi." },
    ],
  },
];

export const ALL_LINES = SCENES.flatMap((s) => s.lines);
