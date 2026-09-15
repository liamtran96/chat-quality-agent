# Changelog

## v2026.09.15

### Tính năng mới
- **Lệnh đặt lại mật khẩu từ dòng lệnh**: `docker exec -it cqa-app /app/cqa-server reset-password` — liệt kê tài khoản, nhập mật khẩu ẩn, tự kiểm tra độ mạnh và thu hồi toàn bộ phiên đăng nhập cũ. Dùng khi admin duy nhất quên mật khẩu. Chỉ chạy được trên server, không có đường gọi qua web
- **Script `scripts/reset-password.sh`**: làm việc tương tự cho bản cài chưa cập nhật, tự chuyển sang dùng lệnh trong ứng dụng nếu bản cài đã có

### Sửa lỗi
- **Đăng nhập sai không hiện thông báo**: bấm đăng nhập với mật khẩu sai thì trang chỉ nháy một cái rồi về lại như cũ, không báo gì. Bộ chặn lỗi hiểu nhầm 401 của trang đăng nhập thành hết hạn phiên nên đi làm mới phiên, hỏng tiếp rồi tải lại trang, xoá luôn dòng thông báo. Nay 401 từ các endpoint đăng nhập được để nguyên cho màn hình tự xử lý
- **Báo nhầm khi tài khoản bị khoá**: đăng nhập sai 5 lần bị khoá 15 phút nhưng màn hình vẫn báo "Email hoặc mật khẩu không đúng" nên không hiểu vì sao gõ đúng vẫn không vào được — nay hiện đúng lý do và thời gian mở khoá
- **Gia hạn SSL thất bại im lặng**: `/.well-known/acme-challenge/` nay luôn mở cho Let's Encrypt kể cả khi nginx bị giới hạn theo IP — trước đó việc xác minh trả 403 nên chứng chỉ hết hạn dù vòng lặp gia hạn vẫn chạy đều. Gia hạn hỏng cũng ghi cảnh báo rõ vào log thay vì im lặng
- **Chứng chỉ hết hạn không tự cấp lại**: chứng chỉ để quá hạn lâu thì lệnh gia hạn bị Let's Encrypt từ chối vì bản cũ đã bị xoá khỏi hệ thống, mà luồng khởi động lại chỉ biết gia hạn nên kẹt vĩnh viễn — nay tự chuyển sang cấp mới khi gia hạn hỏng

### Tài liệu
- **Quên mật khẩu admin**: viết lại mục trong FAQ — hướng dẫn cũ dùng `-u root -p$MYSQL_ROOT_PASSWORD` trong khi biến này không tồn tại ở shell của host nên chạy sẽ tắc, lại thiếu hẳn bước sinh mã hoá mật khẩu và gợi ý "thêm admin mới qua API" vốn không thực hiện được khi chưa đăng nhập được. Bổ sung cách xử lý khi bị khoá do đăng nhập sai 5 lần
- **Tài liệu cài đặt**: thêm mục Lệnh quản trị liệt kê các lệnh chạy trực tiếp trên server

## v2026.03.30

### Tính năng mới
- **MCP Redirect URIs & Scopes**: Tạo MCP client có thể cấu hình Redirect URIs và phân quyền (read/write) — bắt buộc để kết nối Claude Web

### Sửa lỗi
- **MCP OAuth**: Fix lỗi `invalid_redirect_uri` khi Claude.ai bấm Connect — do chưa cấu hình Redirect URI lúc tạo client
- **Cron timezone**: Job chạy sai giờ (lệch 7 tiếng) do container dùng UTC — đã fix bằng cách prefix `TZ=<tenant_timezone>` vào cron expression và thêm `TZ=Asia/Ho_Chi_Minh` vào Docker

## v2026.03.26

### Tính năng mới
- **Thông báo cập nhật**: Banner thông báo khi có phiên bản mới + changelog + hướng dẫn update
- **Nút Dừng job**: Có thể dừng job đang chạy từ giao diện (#7)
- **Docs + Version**: Hiển thị ở sidebar, truy cập nhanh tài liệu và changelog
- **URL ứng dụng**: Cấu hình URL trong Cài đặt để link thông báo Telegram/Email chính xác (#43)
- **Lịch chạy "Sau mỗi lần đồng bộ"**: Tự động chạy phân tích sau khi đồng bộ kênh thành công (#7, #45)
- **Cron hot-reload**: Tạo/sửa/xóa job "Theo lịch" không cần restart app

### Sửa lỗi
- **Job bị treo**: Fix infinite loop khi batchSize=0, thêm context cancellation check, check lỗi DB query (#7)
- **Facebook token**: Fix lỗi "must be called with Page Access Token" — tự động exchange User Token thành Page Token (#12, #13, #14)
- **Gemini models**: Thay gemini-2.0-flash (deprecated) bằng gemini-2.5-flash/pro
- **Lịch chạy**: Không lưu được "Lịch chạy" khi sửa công việc (#9)
- **AI model**: Job detail hiện đúng AI model từ Settings global thay vì giá trị cũ (#33)
- **Tỷ giá**: Dashboard dùng tỷ giá từ tenant settings thay vì hardcode 26000 VND (#23)
- **Install script**: Fix bị treo trên Ubuntu do interactive prompt (#35)
- **Ảnh trong đánh giá**: Hiển thị ảnh/sticker/file trong "Diễn biến cuộc chat" + lightbox zoom (#39)
- **Link Telegram**: Link thông báo dùng domain thực thay vì localhost (#43)
- **Job polling**: Spinner/progress bar dùng server status, không timeout cứng — F5 tự resume polling
- **Badge tab**: Đánh giá/Phân loại badge màu nổi hơn
- **Mobile sidebar**: Không tự mở sidebar trên điện thoại sau khi login

### Bảo mật
- Thêm security log khi từ chối truy cập file (IDOR fix)
- IDOR: Kiểm tra tenant ownership khi serve file (#22)
- Token refresh: Fix race condition gây logout bất ngờ (#26)
- OAuth state URL-encoded (#29)
- Goroutine timeout cho TriggerJob và TestRunJob (#30, #31)
- Giới hạn per_page max 100 tránh DB exhaustion (#32)
- Infinite polling: Frontend tự dừng poll sau timeout (#27, #28)
- **RBAC**: Phân quyền Member đầy đủ — backend middleware + frontend ẩn menu/nút + router guard (#42)
- **Export**: Member không có quyền ghi không được export tin nhắn
- **Tạo/xóa công ty**: Chỉ admin/owner mới được tạo và xóa công ty

### Tài liệu
- Sửa hướng dẫn lấy Telegram Group ID — dùng Telegram Web (#36)
- Thêm hướng dẫn chạy localhost (Zalo OA hỗ trợ callback localhost) (#34)
- Sửa docs Zalo OA: localhost không cần SSL (#37)
- Đơn giản hóa cài đặt Watchtower — 1 lệnh curl thay vì sửa YAML thủ công

---

## v2026.03.24

### Bug Fixes
- **Timezone**: Sửa lệch giờ 7 tiếng giữa Zalo OA và CQA — giờ hiển thị đúng GMT+7 (#5)
- **Sửa công việc**: Không lưu được "Quy tắc cho AI" khi sửa công việc phân tích (#2)
- **Đồng bộ kênh**: Chuyển sang async để tránh lỗi 504 timeout khi đồng bộ
- **Rate limit**: Tăng giới hạn mặc định lên 500/IP và 1000/user mỗi phút
- **Hiển thị ảnh**: Sửa lỗi không hiển thị ảnh từ Facebook trong tin nhắn
- **Auto-reload**: Tự tải lại khi JS chunks cũ sau deploy

### Mobile UI
- Onboarding bar: scroll ngang mượt, nút X luôn hiện
- Dashboard: ẩn tiêu đề trên mobile, date filter responsive
- Tin nhắn: toggle list/detail trên mobile thay vì xếp chồng
- Tạo công việc: stepper không còn đè chữ
- Chi tiết công việc: header compact, buttons responsive
- Bảng dữ liệu: thêm scroll ngang cho các bảng bị tràn

### CI/CD
- Tự động build + push Docker image lên Docker Hub khi push main
- Versioning theo ngày: v2026.03.24, v2026.03.24.2...
- Tự động tạo GitHub Release với changelog

### Documentation
- Thêm yêu cầu hệ thống vào hướng dẫn cài đặt
- Ảnh trong docs có thể click zoom
- Hỗ trợ macOS và Windows (Docker Desktop)

---

## [1.0.0] - 2026-03-23

### Ra mắt phiên bản đầu tiên

- Đồng bộ tin nhắn từ Zalo OA và Facebook Messenger
- Đánh giá chất lượng CSKH bằng AI (Claude / Gemini)
- Phân loại chat theo chủ đề tùy chỉnh
- Cảnh báo tự động qua Telegram và Email
- Batch AI mode — tiết kiệm chi phí gọi AI
- Dashboard với biểu đồ và thống kê
- Multi-tenant với phân quyền Owner > Admin > Member
- Tích hợp MCP cho Claude Web/Desktop
- Nginx reverse proxy + SSL tự động (Let's Encrypt)
- Docker Compose deployment
- Hỗ trợ Docker Hub images
