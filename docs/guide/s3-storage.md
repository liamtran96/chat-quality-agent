# Lưu file đính kèm lên S3

Mặc định CQA lưu ảnh, video, tài liệu từ Zalo và Facebook vào đĩa máy chủ. Ảnh chat dồn lên khá
nhanh, chạy lâu là đầy ổ. Chuyển sang S3 để khỏi phải nâng ổ cứng.

**Cấu hình riêng cho từng công ty.** Công ty này để trên S3, công ty kia vẫn lưu trên máy chủ,
không ảnh hưởng nhau — mỗi bên một bucket của riêng mình.

Dùng được với mọi dịch vụ tương thích S3: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO tự
dựng, hay dịch vụ object storage trong nước. Không phải khai báo gì thêm cho từng nhà cung cấp.

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

## Chuyển file cũ lên S3

Chạy trên máy chủ. Xem trước, không đụng gì:

```bash
docker exec cqa-app /app/cqa-server migrate-files
```

Lệnh chạy cho mọi công ty đã bật S3, in ra số file trên đĩa, dung lượng và phần còn phải chép.
Thêm `-tenant <mã công ty>` nếu chỉ muốn làm một công ty.

Chép thật:

```bash
docker exec cqa-app /app/cqa-server migrate-files -apply
```

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

Tắt công tắc trong **Cài đặt > Lưu trữ file** rồi bấm Lưu.

::: warning
File đã lên S3 trong thời gian bật sẽ **không xem được nữa** sau khi tắt, vì chiều đọc dự phòng
chỉ đi từ S3 về đĩa chứ không ngược lại. Muốn quay về hẳn thì phải chép file từ bucket về máy chủ
bằng công cụ của nhà cung cấp trước khi tắt.
:::

## Ảnh đi đường nào tới trình duyệt

CQA đọc file từ S3 rồi trả về cho trình duyệt, không đưa link S3 ra ngoài. Bucket giữ ở chế độ
riêng tư, không cần mở công khai, và quyền xem vẫn kiểm như cũ: phải đăng nhập, và phải thuộc
đúng công ty sở hữu file.

Đổi lại, lưu lượng ảnh vẫn đi qua máy chủ. Với khối lượng ảnh chat thông thường thì không đáng
kể, bù lại không có đường nào rò link ảnh của khách ra ngoài.
