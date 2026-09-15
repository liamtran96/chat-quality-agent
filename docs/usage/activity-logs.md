# Nhật ký hệ thống

Ghi lại các thao tác quan trọng diễn ra trong công ty: ai đăng nhập, công việc nào chạy, đồng bộ kênh thành công hay hỏng, ai xoá gì. Vào menu **Nhật ký hệ thống** ở sidebar để xem.

Nhật ký tách riêng theo từng công ty — công ty này không thấy nhật ký của công ty kia.

## Bảng nhật ký

| Cột | Mô tả |
|-----|-------|
| **Thời gian** | Thời điểm xảy ra, mới nhất lên đầu |
| **Hành động** | Mã hành động, dạng `nhóm.việc` (xem bảng bên dưới) |
| **Người dùng** | Email người thực hiện. Trống nghĩa là hệ thống tự làm, không do ai bấm |
| **Chi tiết** | Mô tả kèm số liệu, ví dụ số cuộc chat đã phân tích |
| **Lỗi** | Nội dung lỗi nếu hành động đó hỏng |

Mỗi trang 50 dòng.

## Các hành động được ghi

| Mã hành động | Khi nào ghi |
|---|---|
| `user.login` | Đăng nhập thành công |
| `sync.completed` | Đồng bộ một kênh chat xong |
| `sync.error` | Đồng bộ kênh hỏng, cột Lỗi cho biết lý do |
| `job.run.started` | Một lượt chạy công việc bắt đầu |
| `job.run.completed` | Lượt chạy xong, chi tiết ghi số cuộc chat đã phân tích, số đạt, số vấn đề, số lỗi |
| `job.delete` | Xoá một công việc |
| `job.clear_results` | Xoá toàn bộ kết quả của một công việc |
| `job.clear_runs` | Xoá lịch sử các lượt chạy của một công việc |
| `channel.delete` | Xoá một kênh chat |
| `channel.purge_conversations` | Xoá toàn bộ cuộc chat đã đồng bộ của một kênh |
| `notification.error` | Gửi thông báo Telegram hoặc Email hỏng |

Bộ lọc khớp theo tiền tố, nên chọn `job.run` là ra cả `job.run.started` lẫn `job.run.completed`.

## Cái gì không nằm ở đây

Nhật ký này ghi **thao tác**, không ghi mọi thứ hệ thống in ra. Các loại sau chỉ có trong log ứng dụng, xem bằng `docker logs cqa-app`:

- Cảnh báo model chưa có đơn giá (xem [Chi phí AI](/usage/cost-logs))
- Chi tiết lỗi khi gọi AI từng lượt
- Sự kiện bảo mật: JWT không hợp lệ, bị chặn quyền, khoá do đăng nhập sai nhiều lần, vượt giới hạn tần suất
- Chi tiết quá trình đồng bộ từng cuộc chat

Ngược lại, chi phí từng lượt gọi AI có trang riêng: [Chi phí AI](/usage/cost-logs).

## Dùng để làm gì

**Kiểm tra công việc có chạy không.** Lọc `job.run` rồi nhìn cột Thời gian — nếu lịch đặt 7 giờ sáng mà không có dòng nào của hôm nay thì công việc không chạy, không phải chạy mà không ra kết quả.

**Tìm nguyên nhân khi kết quả bất thường.** Dòng `job.run.completed` ghi rõ số cuộc chat đã phân tích và số lỗi. Nhiều lỗi thường là API key hết hạn mức.

**Kiểm tra đồng bộ.** `sync.error` liên tục ở cùng một kênh nghĩa là kết nối kênh đó cần cấp quyền lại.

**Truy vết khi dữ liệu biến mất.** `job.clear_results`, `channel.purge_conversations`, `job.delete`, `channel.delete` cho biết ai đã xoá và lúc nào.

::: tip Lưu ý
Nhật ký không tự xoá theo thời gian. Hệ thống chạy lâu thì bảng này lớn dần — đây thường là một trong những bảng nặng nhất của database.

Mọi thành viên trong công ty đều xem được nhật ký, kể cả tài khoản chỉ có quyền xem. Nhật ký có email người dùng, cân nhắc điều này khi mời người ngoài vào công ty.
:::
