# Lưu file đính kèm lên S3

Mặc định CQA lưu ảnh, video, tài liệu từ Zalo và Facebook vào đĩa máy chủ. Ảnh chat dồn lên khá
nhanh, chạy lâu là đầy ổ. Chuyển sang S3 để khỏi phải nâng ổ cứng.

**Cấu hình riêng cho từng công ty.** Công ty này để trên S3, công ty kia vẫn lưu trên máy chủ,
không ảnh hưởng nhau — mỗi bên một bucket của riêng mình.

Dùng được với mọi dịch vụ tương thích S3: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO tự
dựng, hay dịch vụ object storage trong nước. Không phải khai báo gì thêm cho từng nhà cung cấp.

## Xem đang dùng bao nhiêu

Ngay ở đầu **Cài đặt > Lưu trữ file** có dòng cho biết công ty đang chiếm bao nhiêu dung lượng
đĩa máy chủ và bao nhiêu file — căn cứ để quyết định có cần chuyển sang S3 hay chưa.

Con số này đếm riêng cho từng công ty, và vẫn hiển thị sau khi đã bật S3, vì đó chính là phần
file cũ còn nằm lại trên máy chủ. Kết quả được giữ lại một phút nên mở đi mở lại không phải
đếm liên tục.

Kho quá lớn khiến việc đếm chưa xong trong thời gian cho phép thì con số kèm ghi chú
*(chưa đếm hết)* — phần đếm được vẫn hiện, không giấu đi.

## Cấu hình

Vào **Cài đặt > Lưu trữ file**, bật **Dùng S3 cho công ty này**, rồi điền:

| Ô | Ý nghĩa |
|---|---|
| **Địa chỉ dịch vụ** | Endpoint của nhà cung cấp, kèm `https://` |
| **Bucket** | Tên bucket đã tạo sẵn trên dịch vụ |
| **Region** | Tuỳ nhà cung cấp, để trống cũng được |
| **Access Key / Secret Key** | Khoá truy cập, cần đủ quyền đọc, ghi và xoá trên bucket |

Trong **Tuỳ chọn nâng cao** còn hai mục hiếm khi cần: *tiền tố khoá* khi dùng chung bucket với
thứ khác, và *path-style* cho vài nhà cung cấp không hỗ trợ tên bucket ở đầu domain.

Secret Key được mã hoá trước khi lưu. Lần sau mở lại, ô đó hiện dấu chấm — để nguyên là giữ khoá
cũ, chỉ điền khi muốn đổi.

## Phải kiểm tra kết nối mới lưu được

Bấm **Kiểm tra kết nối** trước, nút Lưu chỉ bật lên khi kiểm tra đạt.

Phép kiểm tra chạy trọn một vòng thật: ghi một file nhỏ lên bucket, đọc lại, đối chiếu nội dung,
rồi xoá đi. Cố ý không chỉ thử kết nối — khoá đọc được nhưng không ghi được là chuyện thường
gặp, mà chỉ ping thì vẫn báo "bình thường" rồi tới lúc đồng bộ mới hỏng, không ai biết vì sao.

Hỏng ở đâu thì báo đúng chỗ đó:

| Thông báo | Nghĩa là |
|---|---|
| Sai Access Key hoặc Secret Key | Khoá không đúng |
| Khoá này không đủ quyền trên bucket | Kết nối được nhưng thiếu quyền ghi hoặc xoá |
| Không tìm thấy bucket này trên dịch vụ | Sai tên bucket, hoặc bucket chưa được tạo |
| Không kết nối được tới dịch vụ | Sai endpoint, hoặc mạng chặn |

Máy chủ tự chạy lại phép kiểm tra một lần nữa lúc bấm Lưu, nên không có đường nào lưu được một
cấu hình hỏng.

## Hệ thống đang chạy thì sao

**Bật S3 lên là dùng được ngay, không phải chuyển file cũ trước.**

- File mới đồng bộ về sẽ lên S3
- File cũ vẫn nằm trên đĩa và **vẫn xem được bình thường** — khi đọc, CQA tìm trên S3 trước,
  không thấy thì tìm tiếp trên đĩa
- Việc chuyển file cũ lên S3 làm lúc nào cũng được, không gấp

## S3 trục trặc thì sao

Ảnh mới đồng bộ về mà không ghi được lên S3 — mạng chập, khoá hết hạn, bucket đầy — thì CQA
**ghi tạm xuống máy chủ** chứ không bỏ tấm ảnh đó. Link ảnh bên Zalo và Facebook hết hạn sau ít
lâu, bỏ là mất hẳn không tải lại được.

Log sẽ ghi:

```
[sync] kho chính (s3) không nhận file <khoá>: <lý do> — ghi tạm xuống đĩa,
chạy migrate-files -up để chuyển lên sau
```

Ảnh vẫn hiển thị bình thường trong lúc đó vì CQA đọc S3 trước rồi tìm tiếp trên máy chủ. Xử lý
xong sự cố thì chạy `migrate-files -up -apply` để dọn phần ghi tạm lên S3.

## Chuyển file cũ lên S3

Chạy trên máy chủ. Xem trước, không đụng gì:

```bash
docker exec cqa-app /app/cqa-server migrate-files
```

Lệnh chạy cho mọi công ty đã bật S3, in ra số file trên máy chủ, dung lượng và phần còn phải
chép. Thêm `-tenant <mã công ty>` nếu chỉ muốn làm một công ty.

Chép thật:

```bash
docker exec cqa-app /app/cqa-server migrate-files -apply
```

Lệnh có hai chiều, không ghi gì thì mặc định là chiều lên:

| Lệnh | Chiều |
|---|---|
| `migrate-files -up -apply` | Máy chủ → S3 |
| `migrate-files -down -apply` | S3 → máy chủ |

- Chạy lại bao nhiêu lần cũng được: file đã có trên S3 đúng dung lượng thì bỏ qua
- Đứt giữa chừng thì chạy lại, nó chép tiếp phần còn thiếu chứ không làm lại từ đầu
- Chép xong mỗi file đều đối chiếu dung lượng, lệch thì tính là hỏng và **giữ nguyên bản trên đĩa**

## Thu hồi dung lượng đĩa

Bước xoá tách riêng, cố ý không làm chung với bước chép. Chờ vài ngày, mở vài cuộc chat cũ xem
ảnh hiện bình thường, rồi mới:

```bash
docker exec -it cqa-app /app/cqa-server migrate-files -apply -delete-local
```

Lệnh hỏi xác nhận, gõ `XOA` mới chạy. Trước khi xoá **từng file**, nó kiểm lại file đó có thật
trên S3 và đúng dung lượng — file nào chưa chép được thì không bao giờ bị xoá.

## Quay lại lưu trên máy chủ

Thứ tự đúng, làm theo là không mất gì:

1. **Chép file về trước:**
   ```bash
   docker exec cqa-app /app/cqa-server migrate-files -down -apply
   ```
2. Kiểm tra vài cuộc chat cũ, ảnh vẫn hiện bình thường
3. Tắt công tắc trong **Cài đặt > Lưu trữ file**, xác nhận ở hộp thoại
4. Muốn dọn bucket thì xoá bằng giao diện của nhà cung cấp — CQA cố ý không có lệnh xoá file
   trên bucket

Tắt trước rồi mới nhớ ra chưa chép cũng không sao: **thông tin S3 được giữ lại** sau khi tắt, nên
`migrate-files -down -apply` vẫn chạy được bình thường, chép xong là ảnh hiện lại.

::: warning
Trong khoảng thời gian đã tắt mà chưa chép về, file nằm trên S3 sẽ **không hiển thị** — chúng vẫn
nằm nguyên trong bucket, không mất. Đừng xoá khoá S3 trong lúc này, vì chép về cần đúng khoá đó.
:::

### Tự chép bằng công cụ khác

Ai quen rclone hay aws-cli thì không cần dùng lệnh của CQA. Khoá file trên S3 trùng đúng đường
dẫn trên máy chủ nên chép thẳng là chạy:

```bash
rclone copy s3:ten-bucket/<mã công ty>/ /var/lib/cqa/files/<mã công ty>/
```

## Ảnh đi đường nào tới trình duyệt

CQA đọc file từ S3 rồi trả về cho trình duyệt, không đưa link S3 ra ngoài. Bucket giữ ở chế độ
riêng tư, không cần mở công khai, và quyền xem vẫn kiểm như cũ: phải đăng nhập, và phải thuộc
đúng công ty sở hữu file.

Đổi lại, lưu lượng ảnh vẫn đi qua máy chủ. Với khối lượng ảnh chat thông thường thì không đáng
kể, bù lại không có đường nào rò link ảnh của khách ra ngoài.
