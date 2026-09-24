# Kết nối Pancake

[Pancake](https://pancake.vn) gom tin nhắn của nhiều nền tảng — Facebook, Instagram, Zalo OA, TikTok, Shopee… — về một chỗ. Nếu đội CSKH của bạn đang trả lời khách trên Pancake, CQA đọc tin nhắn qua API công khai của Pancake mà không cần kết nối riêng từng nền tảng.

Mỗi kênh Pancake trong CQA ứng với **một page** trong Pancake. Có nhiều page thì tạo nhiều kênh.

## Yêu cầu

- Page đã được kết nối và kích hoạt trong Pancake
- Tài khoản Pancake của bạn phải là **admin của page**. Chỉ admin mới thấy và tạo được token (Pancake gọi là **Public API access token**)

## Bước 1: Lấy Page ID và Page Access Token

1. Đăng nhập [pancake.vn](https://pancake.vn), mở page cần kết nối.
2. Vào **Cài đặt** (thanh trên cùng) → **Công cụ** (cột trái).
3. Kéo xuống mục **Public API access token**. Nếu ô còn trống, bấm **Tạo Token**. Sau đó bấm **Sao chép** để copy token.

![Mục Public API access token trong Cài đặt → Công cụ của Pancake](/screenshots/pancake/pancake-public-api-token.webp)

4. **Page ID** là ID của page trên nền tảng gốc, dạng một dãy số. Với page Facebook: mở trang trên Facebook → **Giới thiệu** → **Minh bạch về Trang**, dòng **ID Trang**.

::: warning Giữ kín Page Access Token
Token này đọc được toàn bộ hội thoại và gửi được tin nhắn thay page. Không chia sẻ token qua chat hay dán lên nơi công khai. CQA mã hoá token trước khi lưu và chỉ dùng token để đọc tin nhắn.
:::

Page Access Token **không hết hạn**. Token chỉ mất hiệu lực khi admin bấm **Tạo Token** lần nữa hoặc **Xoá token** trong Pancake — khi đó cần xoá kênh trong CQA và kết nối lại bằng token mới. Đang có token rồi thì chỉ cần **Sao chép**, đừng bấm Tạo Token.

## Bước 2: Tạo kênh trong CQA

1. Vào menu **Kênh chat** → **Kết nối kênh mới**.
2. **Loại kênh**: chọn **Pancake**.
3. Nhập **Tên kênh**, **Page ID** và **Page Access Token**.
4. Chọn chu kỳ đồng bộ. Nên bật **Lưu trữ file/ảnh từ cuộc chat** (xem lý do bên dưới).
5. Bấm **Tạo**.

![Kết nối kênh Pancake](/screenshots/pancake/pancake-ket-noi-kenh.png)

CQA thử gọi Pancake ngay khi tạo kênh. Nếu Page ID hoặc token sai, CQA báo lỗi và không tạo kênh.

Tạo xong, kênh hiện trong danh sách **Kênh chat** với nhãn **Pancake**. Bấm **Đồng bộ ngay** để lấy tin nhắn lần đầu.

![Kênh Pancake trong danh sách kênh chat](/screenshots/pancake/pancake-danh-sach-kenh.png)

## Dữ liệu được đồng bộ

- **Chỉ hội thoại tin nhắn** (inbox). Bình luận dưới bài viết và livestream không được đồng bộ.
- Tin của khách và tin của page được tách riêng. Tin của page hiện **tên nhân viên đã trả lời** thay vì tên page, nên đánh giá được theo từng người.
- Chữ, emoji, sticker, ảnh, video và file đính kèm.
- Không lưu số điện thoại, email, đơn hàng hay thông tin cá nhân khác mà Pancake trả kèm.

::: tip Nên bật lưu trữ file
Ảnh và sticker nằm trên máy chủ của Pancake. Video và file tài liệu nằm trên máy chủ gốc của nền tảng (ví dụ Facebook), link chỉ dùng được khoảng hai ngày. Bật **Lưu trữ file/ảnh từ cuộc chat** để CQA tải về ngay lúc đồng bộ, sau này mở lại vẫn xem được.
:::

## Giới hạn

- Pancake cho phép tối đa 5 lượt gọi API mỗi giây cho mỗi page. CQA tự giữ nhịp dưới mức này, page nhiều cuộc chat thì lần đồng bộ đầu sẽ lâu hơn.
- CQA đọc dữ liệu bằng cách gọi API định kỳ, không dùng Webhook của Pancake, nên không tốn thêm slot kết nối trong gói Pancake.

## Xử lý sự cố

### Không thấy mục Public API access token

Tài khoản của bạn chưa phải admin của page trong Pancake. Với page Facebook:

1. Trên Facebook, vào trang → **Cài đặt** → **Thiết lập Trang** → **Quyền truy cập Trang**. Tài khoản của bạn phải có **toàn quyền kiểm soát** (dòng quyền có "Xóa Trang, Quyền…").
2. Trong Pancake, bấm **Kết nối** → **Facebook**, đăng nhập lại. Khi Facebook hỏi quyền, bấm **Chỉnh sửa quyền truy cập**, tick đúng page và bật đủ các quyền. Pancake chỉ cập nhật quyền admin sau bước này, nút tải lại danh sách page không đủ.

### Tạo kênh báo "Không kết nối được Pancake"

- Kiểm tra Page ID và token copy đủ, không thừa dấu cách.
- Nếu vừa tạo token mới trong Pancake, token cũ đã mất hiệu lực — dùng token mới.

### Đồng bộ báo lỗi `Invalid access_token`

Token đã bị tạo lại hoặc xoá trong Pancake. Xoá kênh trong CQA rồi kết nối lại bằng token mới.
