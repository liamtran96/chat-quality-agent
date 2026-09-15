# Tên miền & SSL

CQA hỗ trợ SSL tự động qua Let's Encrypt. Certificate được tạo và gia hạn hoàn toàn tự động.

## Trỏ tên miền

1. Đăng nhập vào nhà cung cấp domain (123HOST, GoDaddy, Cloudflare...)
2. Tạo bản ghi DNS:
   - **Loại**: A
   - **Tên**: `cqa` (hoặc tên bạn muốn, ví dụ `chat`)
   - **Giá trị**: IP VPS của bạn
   - **TTL**: 300 (hoặc Auto)

3. Chờ DNS cập nhật (thường 5-15 phút). Kiểm tra:

```bash
ping cqa.yourdomain.com
```

Nếu trả về đúng IP VPS là DNS đã cập nhật.

## Bật SSL

Mở file `.env` trên VPS:

```bash
nano /opt/cqa/.env
```

Thêm hoặc sửa 2 dòng:

```env
LEGO_DOMAIN=cqa.yourdomain.com
LEGO_EMAIL=admin@yourdomain.com
```

Khởi động lại:

```bash
cd /opt/cqa
docker compose down
docker compose up -d
```

CQA sẽ tự động:
- Tạo SSL certificate từ Let's Encrypt
- Chuyển hướng HTTP → HTTPS
- Kiểm tra và gia hạn certificate mỗi 7 ngày

Truy cập: `https://cqa.yourdomain.com`

## Chạy không cần SSL (HTTP only)

Nếu không cần SSL (ví dụ test local hoặc mạng nội bộ), **không cần** điền `LEGO_DOMAIN`. CQA sẽ tự chạy ở chế độ HTTP trên port 80.

## Kiểm tra SSL

```bash
docker compose logs nginx --tail=20
```

Bạn sẽ thấy:

```
Certificate obtained for cqa.yourdomain.com
Starting nginx with SSL...
```

Hoặc kiểm tra trên trình duyệt — bấm vào icon khóa bên cạnh URL để xem thông tin certificate.

## Xử lý lỗi SSL

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `Could not obtain certificate` | DNS chưa trỏ đúng | Kiểm tra DNS A record |
| `Too many requests` | Đã request quá 5 lần/tuần | Chờ 1 tuần hoặc dùng staging |
| `Port 80 already in use` | Có service khác dùng port 80 | Dừng service đó (Apache, nginx cũ...) |
| `invalid authorization: ... 403` | Đường dẫn `/.well-known/acme-challenge/` bị chặn | Xem mục bên dưới |

### Chứng chỉ hết hạn dù đã bật tự động gia hạn

CQA tự gia hạn mỗi 7 ngày khi chứng chỉ còn dưới 30 ngày. Nếu vẫn hết hạn, xem log:

```bash
docker compose logs nginx | grep ssl-entrypoint
```

Nguyên nhân hay gặp nhất là Let's Encrypt không truy cập được đường dẫn xác minh.
Họ gọi từ IP bất kỳ, nên nếu nginx bị giới hạn theo IP hoặc tường lửa chặn port 80
từ ngoài thì việc xác minh thất bại, trong khi trang web vẫn chạy bình thường cho
tới ngày chứng chỉ hết hạn.

Kiểm tra từ một máy ngoài mạng:

```bash
curl -I http://cqa.yourdomain.com/.well-known/acme-challenge/test
```

Trả về `404` là đúng (không có file đó, nhưng đường dẫn thông). Trả về `403` là đang
bị chặn — cần cho phép riêng đường dẫn này đi qua. Nếu có giới hạn IP trong cấu hình
nginx, thêm `allow all;` vào ngay trong khối `location /.well-known/acme-challenge/`.

## Bước tiếp theo

- [Thiết lập ban đầu](/guide/initial-setup) — Tạo admin, cấu hình AI
