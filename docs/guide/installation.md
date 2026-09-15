# Cài đặt

## Yêu cầu hệ thống

| | Tối thiểu | Khuyến nghị (10-50 kênh) |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Ổ cứng | 10 GB | 20 GB |
| OS | Ubuntu 20.04+ / Debian 11+ / AlmaLinux 8+ | Ubuntu 22.04 LTS |

Yêu cầu: **Docker** và **Docker Compose** (script cài tự động sẽ cài nếu chưa có).

Hỗ trợ macOS và Windows (qua Docker Desktop) nếu muốn chạy trên máy cá nhân.

## Cài đặt trên VPS

Có 2 cách cài đặt CQA. Khuyến nghị dùng cách 1 (tự động) cho đơn giản nhất.

## Cách 1: Cài tự động (khuyến nghị)

Chỉ cần 1 lệnh. Script sẽ tự cài Docker (nếu chưa có), tạo secrets ngẫu nhiên, pull images và khởi chạy.

```bash
curl -s https://raw.githubusercontent.com/tanviet12/chat-quality-agent/main/install.sh | sudo bash
```

Sau khi chạy xong, bạn sẽ thấy:

```
========================================
  Cài đặt thành công!
========================================
  URL: http://<IP-VPS>
  Mở trình duyệt và tạo tài khoản admin.
  Cấu hình: /opt/cqa/.env
  Xem log:  cd /opt/cqa && docker compose logs -f
```

Mở trình duyệt, truy cập `http://<IP-VPS>` — bạn sẽ thấy trang **Thiết lập ban đầu** để tạo tài khoản admin.

## Cách 2: Build từ source

Dùng cách này nếu bạn muốn tùy chỉnh code.

```bash
git clone https://github.com/tanviet12/chat-quality-agent.git
cd chat-quality-agent
cp .env.example .env
```

Mở file `.env`, điền các giá trị bắt buộc:

```bash
# Tạo secrets ngẫu nhiên
DB_PASSWORD=$(openssl rand -hex 16)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
```

Chạy:

```bash
docker compose up -d --build
```

Truy cập:
- Nếu trên VPS: `http://<IP-VPS>`
- Nếu trên máy local: `http://localhost`

Lần đầu sẽ hiện trang Setup để tạo tài khoản admin.

## Chạy trên localhost (Mac / Windows)

Bạn có thể chạy CQA trên chính máy cá nhân bằng Docker Desktop để test trước khi deploy VPS.

**Yêu cầu:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac hoặc Windows)
- Clone repo và chạy `docker compose up -d --build`
- Truy cập `http://localhost`

**Lưu ý kết nối kênh chat:**
- **Zalo OA**: Hỗ trợ callback URL là `http://localhost` — có thể test đầy đủ trên máy local
- **Facebook Fanpage**: Yêu cầu HTTPS — không dùng localhost được, cần deploy lên VPS với domain + SSL

## Kiểm tra trạng thái

```bash
cd /opt/cqa  # hoặc thư mục cài đặt
docker compose ps
```

Kết quả bình thường:

```
NAME        STATUS         PORTS
cqa-app     Up             0.0.0.0:8080->8080/tcp
cqa-db      Up (healthy)   127.0.0.1:3306->3306/tcp
cqa-nginx   Up             0.0.0.0:80->80/tcp
```

## Xem log

```bash
docker compose logs -f        # Xem tất cả
docker compose logs app -f    # Chỉ xem app
docker compose logs nginx -f  # Chỉ xem nginx
```

## Lệnh quản trị

Chạy trực tiếp trên server, không qua giao diện web:

```bash
# Đặt lại mật khẩu một tài khoản (dùng khi admin duy nhất quên mật khẩu)
docker exec -it cqa-app /app/cqa-server reset-password

# Xem phiên bản đang chạy
docker exec cqa-app /app/cqa-server version

# Xem trước số bản đánh giá trùng cần dọn (không xoá gì)
docker exec cqa-app /app/cqa-server prune-duplicate-results

# Dọn thật — sao lưu trước đã
docker exec -it cqa-app /app/cqa-server prune-duplicate-results -apply
```

Chi tiết về đặt lại mật khẩu xem [Quên mật khẩu admin](/faq#quen-mat-khau-admin).

## Sao lưu database

```bash
bash scripts/backup-db.sh
```

Script dump toàn bộ database ra `/opt/cqa/backups`, rồi **phục hồi thử sang một database
tạm và đối chiếu số dòng từng bảng** với bản đang chạy. Lệch một dòng là script báo lỗi và
dừng. Một file dump chưa phục hồi thử thì chưa gọi là bản sao lưu.

Database tạm do chính script tạo ra (tên `cqa_verify_<dấu thời gian>`) được xoá khi xong;
thêm `--keep-verify` nếu muốn giữ lại để tự xem. Dữ liệu đang chạy chỉ được đọc.

Phục hồi khi cần:

```bash
gunzip -c /opt/cqa/backups/cqa-<dấu thời gian>.sql.gz | docker exec -i cqa-db mysql -uroot -p cqa
```

## Dọn bản đánh giá trùng

Các bản CQA trước v2026.09.15.6 có lỗi khiến công việc chạy theo lịch đánh giá lại cuộc chat
cũ mỗi ngày. Lỗi đã sửa, nhưng dữ liệu trùng sinh ra từ trước vẫn nằm lại: database phình to
và số liệu trên Trang chủ bị thổi phồng.

Kiểm tra xem bản cài của bạn có dính không:

```bash
docker exec cqa-app /app/cqa-server prune-duplicate-results
```

Lệnh chỉ in bản kê, không xoá gì. Nếu có dữ liệu trùng thì:

1. Sao lưu: `bash scripts/backup-db.sh`
2. Dọn: `docker exec -it cqa-app /app/cqa-server prune-duplicate-results -apply` — gõ `XOA` để xác nhận
3. Trả lại dung lượng đĩa, chạy ngoài giờ vì thao tác này khoá bảng vài phút:
   `docker exec cqa-db mysql -uroot -p -e "OPTIMIZE TABLE cqa.job_results;"`

Quy tắc giữ lại: mỗi cặp (công việc, cuộc chat) giữ nguyên toàn bộ kết quả của **lượt chạy gần
nhất**, xoá các lượt cũ hơn. Lệnh chỉ đụng tới bảng `job_results` — tin nhắn, cuộc chat, lượt
chạy và cấu hình không bị chạm tới. Lệnh từ chối chạy khi còn công việc đang chạy dở, và sau khi
xoá sẽ tự đối chiếu lại số dòng lẫn số cặp, lệch là báo lỗi.

## Gỡ cài đặt

```bash
cd /opt/cqa
docker compose down -v   # -v xóa cả database
rm -rf /opt/cqa
```

::: warning Lưu ý
`docker compose down -v` sẽ xóa toàn bộ dữ liệu (database, tin nhắn, kết quả). Nếu chỉ muốn dừng mà giữ dữ liệu, dùng `docker compose down` (không có `-v`).
:::

## Bước tiếp theo

- [Cập nhật phiên bản](/guide/updates) — Cập nhật thủ công hoặc tự động
- [Tên miền & SSL](/guide/domain-ssl) — Trỏ domain và bật HTTPS
- [Thiết lập ban đầu](/guide/initial-setup) — Tạo admin, cấu hình AI
