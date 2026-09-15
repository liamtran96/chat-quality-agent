# Chi phí AI

Mỗi lần gọi AI để phân tích chat đều được ghi nhận chi phí. Vào menu **Chi phí AI** ở sidebar để theo dõi.

![Chi phí AI](/screenshots/chi-phi-ai.png)

## Bảng chi phí

| Cột | Mô tả |
|-----|-------|
| **Thời gian** | Thời điểm gọi API |
| **Provider** | `claude`, `gemini`, `openai` (ChatGPT) hoặc `xai` (Grok) |
| **Model** | Model AI cụ thể đã dùng cho lượt gọi đó |
| **Input Tokens** | Số token đầu vào (nội dung chat gửi cho AI) |
| **Output Tokens** | Số token đầu ra (kết quả AI trả về) |
| **Chi phí USD** | Chi phí tính bằng USD (4 chữ số thập phân) |
| **Chi phí VND** | Chi phí quy đổi sang VND theo tỉ giá trong [Cài đặt chung](/usage/general-settings) |

Bật Batch Mode thì một lượt gọi gồm nhiều cuộc chat, nên mỗi dòng ở đây là **một lượt gọi API**, không phải một cuộc chat.

## Tổng chi phí

Cuối bảng hiển thị tổng chi phí USD và VND của các dòng đang lọc.

## Bộ lọc

| Bộ lọc | Mô tả |
|--------|-------|
| **Provider** | Lọc theo nhà cung cấp |
| **Từ ngày** | Ngày bắt đầu |
| **Đến ngày** | Ngày kết thúc |

## Đơn giá lấy từ đâu

CQA tự đồng bộ bảng giá token định kỳ từ nguồn công khai, nên model mới ra hoặc giá thay đổi không phải chờ bản phát hành mới. Bảng giá kèm sẵn trong chương trình là lưới an toàn khi không có mạng.

Bảng đơn giá từng model xem tại [Cấu hình AI](/usage/ai-settings#buoc-2-chon-model). Tắt đồng bộ bằng `PRICING_SYNC_ENABLED=false`, chi tiết ở [Biến môi trường](/reference/env-vars).

::: warning Model chưa có đơn giá
Nếu dùng một model chưa có trong bảng giá — thường là model quá mới, hoặc model riêng của proxy tự dựng — CQA **không đoán giá theo model khác**. Lượt gọi đó ghi chi phí 0, kèm cảnh báo trong log ứng dụng (`docker logs cqa-app`, không hiện trên giao diện):

```
[ai] chưa có đơn giá cho model <tên model> (provider=<nhà cung cấp>), chi phí lượt gọi này không được tính
```

Thấy 0 đồng ở đây nghĩa là **chưa tính được**, không phải miễn phí. Cập nhật CQA lên bản mới là thường có giá.
:::

## Hiểu về token và chi phí

### Token là gì?

Token là đơn vị đo lường AI xử lý. Khoảng 1 token = 0.75 từ tiếng Việt (hoặc 4 ký tự).

### Tiết kiệm chi phí

1. **Bật Batch Mode** — tiết kiệm 60-80% token (xem [Cấu hình AI](/usage/ai-settings#batch-mode))
2. **Dùng model rẻ hơn** — Haiku (Claude), Flash Lite (Gemini), GPT-5 mini (OpenAI) cho phân loại đơn giản
3. **Giới hạn số chat mỗi lần chạy** — dùng chế độ "Tùy chọn" khi chạy thủ công
4. **Viết điều kiện Skip tốt** — loại bỏ chat spam/rỗng trước khi gọi AI
5. **Không chạy lại công việc trên cuộc chat đã đánh giá** — lần chạy theo lịch tự bỏ qua cuộc chat đã có đánh giá mới hơn tin nhắn cuối; chỉ dùng "Chạy lại toàn bộ" khi thực sự đổi bộ quy tắc
