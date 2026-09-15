# Dashboard

Dashboard là trang tổng quan khi bạn vào 1 công ty. Hiển thị các chỉ số quan trọng và hoạt động gần đây.

![Dashboard](/screenshots/dashboard.png)

## Thẻ thống kê

| Thẻ | Ý nghĩa |
|-----|---------|
| **Tổng cuộc hội thoại** | Số cuộc chat trong khoảng thời gian đang chọn |
| **Vấn đề** | Số vi phạm CSKH phát hiện trong khoảng thời gian đang chọn |
| **Công việc đang chạy** | Số công việc đang thực thi |
| **Kênh hoạt động** | Số kênh chat đang kết nối |

Bốn thẻ này, trừ hai thẻ cuối, thay đổi theo bộ lọc thời gian ở đầu trang.

## Thống kê kênh

Hiển thị số cuộc hội thoại theo từng loại kênh:
- Zalo OA: số cuộc chat
- Facebook: số cuộc chat
- Tổng tin nhắn
- Chi phí AI trong khoảng thời gian đang chọn (VND)

## Hoạt động gần đây

Danh sách các cảnh báo QC và kết quả phân loại mới nhất:

**Cảnh báo QC:**
- Badge mức độ (Nghiêm trọng / Cần cải thiện)
- Tên quy tắc vi phạm
- Bằng chứng
- Bấm vào để xem chi tiết cuộc chat

**Kết quả phân loại:**
- Tên khách hàng
- Nhãn phân loại
- Bấm vào để xem chi tiết

## Chi phí AI

- **Chi phí hôm nay**: Tổng chi phí AI từ 0 giờ hôm nay (VND) — không đổi theo bộ lọc thời gian
- **Chi phí tháng này**: Tổng chi phí từ ngày 1 của tháng — không đổi theo bộ lọc thời gian

Thẻ **Chi phí AI** ở khu vực trên cùng thì ngược lại, nó tính theo khoảng thời gian
đang chọn, nên thường lớn hơn hai con số này khi bạn lọc nhiều ngày.
- **Bảng chi phí 7 ngày gần nhất**: Ngày, số token (input + output), chi phí VND

## Biểu đồ

### Tin nhắn theo ngày
Biểu đồ đường hiển thị 3 chỉ số theo thời gian:
- Tổng tin nhắn
- Số cuộc hội thoại
- Số tin nhắn trả lời từ nhân viên

### Chi phí theo ngày
Biểu đồ vùng hiển thị xu hướng chi phí AI theo thời gian.

## Bộ lọc thời gian

Bạn có thể lọc Dashboard theo khoảng thời gian:
- Hôm nay
- 7 ngày
- 28 ngày
- Tháng này
- Quý này
- Năm nay
- Tùy chỉnh (chọn ngày bắt đầu/kết thúc)

## Trạng thái hệ thống

Hiển thị trạng thái các dịch vụ:
- API Server
- Database
- Scheduler

Xanh = bình thường, Đỏ = có lỗi.

## Dữ liệu demo

Nếu công ty chưa có dữ liệu, Dashboard sẽ hiển thị banner mời import dữ liệu demo. Xem [Dữ liệu demo](/admin/demo-data) để biết thêm.
