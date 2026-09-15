# Kết nối MCP

MCP (Model Context Protocol) cho phép Claude Web hoặc Claude Desktop truy vấn dữ liệu CQA trực tiếp. Bạn có thể hỏi Claude về cuộc chat, kết quả đánh giá, thống kê... mà không cần mở CQA.

## MCP là gì?

MCP là giao thức kết nối AI với các hệ thống bên ngoài. Khi kết nối CQA với Claude qua MCP, bạn có thể:

- "Hôm nay có bao nhiêu cuộc chat khiếu nại?"
- "Tóm tắt vấn đề CSKH tuần này"
- "Cuộc chat nào bị điểm thấp nhất hôm nay?"
- "Nhân viên nào bị nhiều vi phạm nhất?"

Claude sẽ tự truy vấn CQA và trả lời.

## Tạo kết nối MCP

Vào menu **MCP** ở sidebar, bấm **Tạo kết nối**.

1. Nhập **Tên kết nối** (ví dụ "Claude Desktop", "Claude Web")
2. Nhập **Redirect URIs** — URL callback mà ứng dụng MCP sẽ redirect về sau khi xác thực:
   - Claude Web: `https://claude.ai/api/mcp/auth_callback`
   - Claude Desktop: để trống (không cần)
   - Có thể nhập nhiều URI, nhấn **Enter** để thêm từng URI
3. Chọn **Phân quyền (Scopes)**:
   - `read` — chỉ đọc dữ liệu
   - `write` — đọc + kích hoạt job (mặc định chọn cả hai)
4. Bấm **Tạo**
5. Hệ thống trả về:
   - **Client ID**: Mã định danh kết nối
   - **Client Secret**: Khóa bí mật (**chỉ hiển thị 1 lần**, copy ngay!)

::: danger Quan trọng
**Client Secret chỉ hiển thị 1 lần** khi tạo. Nếu quên copy, bạn phải xóa kết nối và tạo lại.
:::

::: warning Redirect URI bắt buộc với Claude Web
Nếu không điền Redirect URI khi tạo, Claude Web sẽ báo lỗi `invalid_redirect_uri` khi kết nối. Phải xóa và tạo lại client với URI đúng.
:::

## Kết nối với Claude Desktop

Mở file cấu hình Claude Desktop (`claude_desktop_config.json`):

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

::: warning Đừng dán đè lên nội dung cũ
File này thường đã có sẵn cấu hình. Nếu dán cả khối bên dưới vào cuối file, bạn sẽ
có hai khối JSON nối nhau và Claude Desktop báo lỗi:

```
There was an error reading or parsing claude_desktop_config.json:
Unexpected non-whitespace character after JSON at position ...
```

Hãy xem file hiện có nội dung gì rồi làm theo đúng trường hợp bên dưới.
:::

**Trường hợp 1 — File rỗng hoặc chỉ có `{}`**

Thay toàn bộ nội dung bằng:

```json
{
  "mcpServers": {
    "cqa": {
      "url": "https://cqa.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

**Trường hợp 2 — File đã có `mcpServers` với server khác**

Chỉ thêm mục `"cqa"` vào bên trong, nhớ dấu phẩy ngăn cách giữa các mục:

```json
{
  "mcpServers": {
    "server-cu-cua-ban": {
      "command": "..."
    },
    "cqa": {
      "url": "https://cqa.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

Thay `cqa.yourdomain.com` bằng URL CQA và `YOUR_CLIENT_SECRET` bằng secret vừa copy.

Trước khi lưu, kiểm tra file có đúng một dấu `{` mở đầu và một dấu `}` kết thúc.

Khởi động lại Claude Desktop. Bạn sẽ thấy icon CQA trong danh sách MCP tools.

## Kết nối với Claude Web

Claude Web kết nối qua OAuth — cần cấu hình đúng **Redirect URI** khi tạo client.

**Bước 1:** Tạo MCP client trên CQA với Redirect URI:
```
https://claude.ai/api/mcp/auth_callback
```

**Bước 2:** Vào [claude.ai](https://claude.ai), bấm icon kết nối > **Add custom integration**

**Bước 3:** Nhập URL MCP server:
```
https://cqa.yourdomain.com/mcp
```

**Bước 4:** Claude Web sẽ redirect sang CQA để xác thực. Đăng nhập bằng tài khoản CQA của bạn.

**Bước 5:** Sau khi xác thực thành công, Claude Web hiển thị trạng thái **Connected**.

## Các công cụ MCP có sẵn

| Tool | Mô tả |
|------|-------|
| **conversations** | Lấy danh sách cuộc hội thoại gần đây |
| **transcripts** | Đọc nội dung tin nhắn của 1 cuộc chat |
| **evaluations** | Xem kết quả đánh giá QC |
| **statistics** | Thống kê tổng quan (số chat, tỉ lệ đạt, chi phí...) |

## Thu hồi kết nối

Bấm **Thu hồi** bên cạnh kết nối trong danh sách. Sau khi thu hồi, Claude không thể truy cập CQA qua kết nối đó nữa.
