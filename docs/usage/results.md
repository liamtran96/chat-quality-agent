# Xem kết quả

Có hai nơi xem kết quả:

- **Menu Kết quả** — gom kết quả của mọi công việc trong công ty vào một trang, lọc theo công việc, kênh, thời gian, điểm, nhãn. Xem [Trang Kết quả](#trang-ket-qua) bên dưới.
- **Chi tiết một công việc** — vào menu **Công việc** > bấm công việc cần xem, có thêm biểu đồ xu hướng và lịch sử chạy của riêng công việc đó.

## Trang Kết quả {#trang-ket-qua}

Mở menu **Kết quả** ở thanh bên. Trang này hiển thị kết quả của tất cả công việc, không phải vào từng công việc mới xem được.

### Hai loại công việc

Nếu công ty có cả công việc chất lượng CSKH lẫn công việc phân loại, trang chia thành hai tab. Công ty chỉ chạy một loại thì không có tab, vào thẳng loại đang dùng.

Công việc đã tạo nhưng chưa chạy lần nào vẫn có tab riêng, bên trong báo chưa có kết quả.

### Bộ lọc

Mỗi bộ lọc là một nút nhỏ trên thanh lọc, bấm vào để mở:

| Bộ lọc | Áp dụng cho | Mô tả |
|--------|-------------|-------|
| **Tìm tên khách** | Cả hai | Gõ một phần tên khách hàng |
| **Tác vụ** | Cả hai | Chọn một hoặc nhiều công việc |
| **Kênh** | Cả hai | Chọn một hoặc nhiều kênh chat |
| **Điểm** | Chất lượng CSKH | Kéo khoảng điểm 0–100 |
| **Nhãn** | Phân loại | Chọn một hoặc nhiều nhãn |
| **Thời gian** | Cả hai | Chọn mốc (ngày hội thoại hay ngày đánh giá), khoảng nhanh (Hôm nay / 7 ngày / 28 ngày / Tháng này) hoặc nhập khoảng ngày tự chọn |
| **Sắp xếp** | Cả hai | Mới nhất, điểm thấp nhất, điểm cao nhất |

Dãy chip ngay dưới thanh lọc (Tất cả / Không đạt / Đạt / Bỏ qua, hoặc Đã phân loại / Tất cả / Bỏ qua) vừa là số đếm vừa là bộ lọc — bấm vào để lọc, bấm lần nữa để bỏ.

Một cuộc chat chạy lại nhiều lần chỉ hiện kết quả của lần đánh giá gần nhất.

### Xem chi tiết

Hai chế độ hiển thị, chuyển bằng cặp nút ở góc phải (chế độ đang chọn được nhớ cho lần sau):

- **Danh sách** — bấm vào một thẻ để xả nội dung ngay tại chỗ: bên trái là diễn biến cuộc chat (kèm ảnh, file đính kèm), bên phải là nhận xét và danh sách vấn đề hoặc nhãn.
- **Bảng** — bấm vào một dòng để mở hộp chi tiết, vì dòng bảng quá hẹp để xả nội dung.

Cả hai đều có nút mở công việc đã sinh ra kết quả và mở cuộc chat bên trang Tin nhắn.

Tài khoản không có quyền xem tin nhắn vẫn xem được phần đánh giá, chỉ phần diễn biến cuộc chat bị ẩn.

### Trên điện thoại

Màn hình hẹp hiển thị dạng thẻ thay cho bảng, các bộ lọc gom vào một nút hình phễu mở bảng lọc trượt lên từ dưới.

### Xuất file

Nút **CSV** và **Excel** ở góc trên xuất đúng những gì bộ lọc đang chọn, không phải toàn bộ kết quả.

**Chất lượng CSKH:** Khách hàng, Kết quả, Điểm, Vấn đề, Nhận xét, Ngày hội thoại, Ngày đánh giá, Tác vụ, Kênh.

**Phân loại:** Khách hàng, Nhãn, Vấn đề, Ngày hội thoại, Ngày đánh giá, Tác vụ, Kênh.

Mỗi lần xuất tối đa 20.000 dòng; quá số này hệ thống báo để thu hẹp bộ lọc rồi xuất lại. Đổi trần bằng biến môi trường `EXPORT_MAX_ROWS`.

## Kết quả trong chi tiết công việc

Phần dưới đây nói về trang chi tiết một công việc (menu **Công việc** > chọn công việc).

## Thống kê tổng quan (KPI Cards)

### Kết quả QC Analysis

| Chỉ số | Ý nghĩa |
|--------|---------|
| **Tổng cuộc chat** | Số cuộc chat đã phân tích |
| **Tỉ lệ đạt** | Phần trăm cuộc chat đạt yêu cầu |
| **Vấn đề phát hiện** | Tổng số vi phạm |
| **Điểm trung bình** | Điểm trung bình 0-100 |

### Kết quả Phân loại

| Chỉ số | Ý nghĩa |
|--------|---------|
| **Tổng cuộc chat** | Số cuộc chat đã xử lý |
| **Đã phân loại** | Số cuộc chat được gán nhãn (trừ SKIP) |
| **Bỏ qua** | Số cuộc chat bị SKIP (không đủ nội dung) |

## Chế độ xem kết quả

### Tab Kết quả đánh giá

![Kết quả đánh giá QC](/screenshots/ket-qua-cong-viec-danh-gia.png)

![Kết quả phân loại](/screenshots/ket-qua-cong-viec-phan-loai.png)

Danh sách kết quả có 2 chế độ hiển thị:

**Chế độ danh sách** (mặc định): Mỗi cuộc chat hiển thị trên 1 dòng:
- Tên khách hàng
- Thời gian chat
- Trạng thái (Đạt/Không đạt/Bỏ qua)
- Nhãn phân loại (với công việc phân loại)
- Số vấn đề phát hiện
- Bấm mũi tên mở rộng để xem chi tiết

**Chế độ bảng**: Hiển thị dạng bảng, dễ so sánh nhiều kết quả.

### Xem chi tiết 1 kết quả

Bấm mở rộng 1 dòng, bạn sẽ thấy:

**Với QC Analysis:**
- **Diễn biến cuộc chat**: Toàn bộ tin nhắn giữa khách và nhân viên
- **Đánh giá chi tiết**: Kết quả Đạt/Không đạt, điểm số
- **Danh sách vấn đề**: Từng vi phạm với mức độ (Nghiêm trọng/Cần cải thiện), tên quy tắc, bằng chứng cụ thể

**Với Phân loại:**
- **Diễn biến cuộc chat**: Nội dung hội thoại
- **Kết quả phân loại**: Nhãn được gán (ví dụ "Khiếu nại"), mô tả ngắn (ví dụ "Khách phàn nàn về chất lượng đồ uống và thời gian phục vụ chậm")

### Bộ lọc kết quả

| Bộ lọc | Áp dụng cho | Mô tả |
|--------|-------------|-------|
| **Đã phân loại / Tất cả / Bỏ qua** | Phân loại | Lọc theo trạng thái |
| **Lọc loại** | Phân loại | Lọc theo nhãn (Khiếu nại, Góp ý...) |
| **Đạt / Không đạt** | QC | Lọc theo kết quả |

### Tab Lịch sử chạy

Danh sách các lần chạy công việc:
- Thời gian chạy
- Trạng thái (Thành công / Lỗi / Đang chạy)
- Số cuộc chat: tổng / đã phân tích / đạt / bỏ qua
- Thời gian chạy
- Chi phí (số token, USD)
- Lỗi (nếu có)

## Xuất kết quả

Bấm nút **CSV** hoặc **Excel** phía trên danh sách kết quả.

### Nội dung file xuất

**QC Analysis (CSV/Excel):**

| Cột | Ví dụ |
|-----|-------|
| Tên khách | Nguyễn Văn A |
| Ngày phát sinh chat | 22/03/2026 |
| Ngày đánh giá | 23/03/2026 |
| Kết quả | Không đạt |
| Đánh giá | Nhân viên không chào hỏi, trả lời chậm |
| Điểm | 45 |
| Vấn đề | Thiếu lời chào; Phản hồi chậm 20 phút |

**Phân loại (CSV/Excel):**

| Cột | Ví dụ |
|-----|-------|
| Tên khách | Trần Thị B |
| Ngày phát sinh chat | 22/03/2026 |
| Ngày đánh giá | 23/03/2026 |
| Loại | Khiếu nại |
| Vấn đề | Khách phàn nàn về chất lượng đồ uống |
| Nội dung chat | (tóm tắt nội dung) |

## Xóa kết quả

Bấm **Xóa kết quả** (icon thùng rác đỏ) để xóa toàn bộ kết quả phân tích của công việc. Thao tác này không thể hoàn tác.
