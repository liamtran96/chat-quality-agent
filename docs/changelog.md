# Changelog

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

## [1.0.0] - 2025-03-23

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
