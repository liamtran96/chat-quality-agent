# Cấu hình AI

CQA sử dụng AI để đọc và đánh giá cuộc chat. Bạn cần cấu hình AI provider và API key trước khi sử dụng.

## Cấu hình AI Provider

Vào menu **Cài đặt** > tab **Cấu hình AI**.

![Cấu hình AI](/screenshots/cau-hinh-ai.png)

### Bước 1: Chọn Provider

| Provider | Ưu điểm | Nhược điểm |
|----------|---------|------------|
| **Claude** (Anthropic) | Phân tích tiếng Việt tốt, chính xác cao | Giá cao hơn Gemini |
| **Gemini** (Google) | Giá rẻ, tốc độ nhanh | Độ chính xác thấp hơn Claude |

### Bước 2: Chọn Model

**Claude:**
| Model | Đặc điểm | Phù hợp |
|-------|----------|---------|
| Claude Sonnet 4.6 | Cân bằng chất lượng và chi phí | Khuyến nghị cho hầu hết trường hợp |
| Claude Haiku 4.5 | Nhanh, rẻ nhất | Số lượng chat lớn, budget hạn chế |
| Claude Opus 4 | Mạnh nhất, đắt nhất | Yêu cầu phân tích phức tạp |

**Gemini:**
| Model | Đặc điểm | Phù hợp |
|-------|----------|---------|
| Gemini 2.0 Flash | Nhanh, rẻ | Phân loại đơn giản |
| Gemini 2.5 Pro | Mạnh hơn | Phân tích chi tiết |

### Bước 3: Nhập API Key

- **Claude**: Lấy key tại [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **Gemini**: Lấy key tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

Nhập key vào ô **API Key** rồi bấm **Lưu cài đặt**.

Sau đó bấm **Kiểm tra API Key**. Nút này gọi thật một lượt tới nhà cung cấp bằng
key vừa lưu (tốn vài token, không đáng kể), nên kết quả phản ánh đúng tình trạng key:

| Thông báo | Ý nghĩa |
|---|---|
| Kết nối thành công | Key dùng được với model đang chọn |
| API key không hợp lệ hoặc không có quyền truy cập | Key sai, đã bị thu hồi, hoặc không có quyền |
| API key đã hết hạn mức hoặc bị giới hạn tần suất | Thường gặp với key miễn phí — chờ hạn mức khôi phục hoặc nâng cấp tài khoản |
| Model đang chọn không dùng được với API key này | Đổi sang model khác |
| Không kết nối được tới nhà cung cấp | Mạng hoặc tường lửa chặn |
| Không giải mã được API key đã lưu | Xem mục bên dưới |

::: tip Đã lưu key rồi thì không phải nhập lại
Ô API Key hiển thị `••••••••` nghĩa là đã có key lưu sẵn. Muốn đổi model hay cỡ lô,
cứ để nguyên ô đó rồi **Lưu cài đặt** — key cũ được giữ nguyên. Chỉ nhập lại khi
muốn thay key.
:::

### Không giải mã được API key đã lưu

Key được mã hoá bằng `ENCRYPTION_KEY` trong file `.env`. Nếu giá trị này bị đổi
(cài lại, sinh key mới, khôi phục nhầm bản `.env`) thì mọi thứ đã mã hoá trước đó —
API key lẫn thông tin kết nối kênh chat — không giải mã được nữa, trong khi giao diện
vẫn hiển thị `••••••••` như thể đã cấu hình xong.

Cách xử lý: nhập lại API key và kết nối lại các kênh chat. Sau đó giữ nguyên
`ENCRYPTION_KEY`, đừng đổi nữa.

## Batch Mode

Batch mode gom nhiều cuộc chat vào 1 lần gọi AI, giúp tiết kiệm token đáng kể.

### Cách hoạt động

- **Tắt batch**: Mỗi cuộc chat = 1 lần gọi API → chính xác nhất nhưng tốn token
- **Bật batch**: Gom N cuộc chat = 1 lần gọi API → tiết kiệm 60-80% token

### Cấu hình Batch

1. Bật **Chế độ Batch**
2. Chọn **Batch Size** (số cuộc chat gom lại):

| Batch Size | Tiết kiệm | Rủi ro | Khuyến nghị |
|-----------|-----------|--------|-------------|
| 3 | ~40% | Thấp | Mới bắt đầu |
| 5 | ~60% | Thấp | Khuyến nghị chung |
| 10 | ~75% | Trung bình | Đã quen, chat đơn giản |
| 15-20 | ~80% | Cao | Chat ngắn, phân loại đơn giản |
| 30 | ~85% | Cao | Chỉ dùng cho phân loại |

::: tip Khuyến nghị
Bắt đầu với batch size **5**. Sau khi kiểm tra kết quả chính xác, tăng lên **10**.
Với công việc **Phân loại** (không cần chấm điểm chi tiết), có thể dùng **10-20**.
:::

::: warning Lưu ý
Batch size lớn = nếu API lỗi, mất kết quả nhiều cuộc chat cùng lúc. Nên giữ ở mức 5-10 cho an toàn.
:::

### So sánh chi phí thực tế

Ví dụ đánh giá 100 cuộc chat:

| Chế độ | Số lần gọi API | Chi phí ước tính (Claude Sonnet) |
|--------|----------------|----------------------------------|
| Không batch | 100 lần | ~$2.00 |
| Batch 5 | 20 lần | ~$0.80 |
| Batch 10 | 10 lần | ~$0.50 |

*Chi phí thực tế phụ thuộc vào độ dài cuộc chat.*
