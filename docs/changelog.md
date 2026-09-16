# Changelog

## v2026.09.16

### Tính năng mới
- **Menu Kết quả**: trang mới gom kết quả đánh giá và phân loại của mọi công việc trong công ty, không phải vào từng công việc mới xem được. Lọc theo công việc, kênh, khoảng thời gian (chọn mốc theo ngày hội thoại hay ngày đánh giá), khoảng điểm, nhãn phân loại, tên khách; sắp xếp theo mới nhất hoặc điểm. Lọc và phân trang chạy dưới database nên số lượng kết quả lớn vẫn mở nhanh. Công ty chỉ chạy một loại công việc thì không hiện tab, tránh tab rỗng. Một cuộc chat chạy lại nhiều lần chỉ hiện lần đánh giá gần nhất. Xuất CSV/Excel đúng bộ lọc đang chọn, có thêm cột Tác vụ và Kênh, trần mỗi lần xuất 20.000 dòng (`EXPORT_MAX_ROWS`). Màn hình hẹp chuyển sang dạng thẻ, bộ lọc gom vào bảng trượt từ dưới lên
- **Dung lượng file trên máy chủ**: Cài đặt > Lưu trữ file nay cho biết công ty đang chiếm bao nhiêu dung lượng đĩa và bao nhiêu file, vẫn hiện sau khi bật S3 để biết còn bao nhiêu file cũ chưa chuyển đi

## v2026.09.15

### Tính năng mới
- **Không mất ảnh khi S3 trục trặc**: ảnh mới đồng bộ về mà không ghi được lên S3 sẽ được ghi tạm xuống máy chủ thay vì bỏ qua — link ảnh bên Zalo và Facebook hết hạn sau ít lâu nên bỏ là mất hẳn. Ảnh vẫn hiển thị bình thường nhờ đường đọc dự phòng, xử lý xong sự cố thì chạy `migrate-files -up` để dọn phần ghi tạm lên S3
- **Lối thoát khi thôi dùng S3**: `migrate-files -down` chép ngược file từ S3 về máy chủ, cùng bảo đảm với chiều lên (chạy lại được, đứt giữa chừng thì chép tiếp, đối chiếu dung lượng từng file) và cố ý không đụng gì tới bucket. Chạy được cả sau khi đã tắt S3 vì thông tin kết nối vẫn được giữ lại. Tắt S3 trong giao diện nay có hộp xác nhận nói rõ file trên S3 sẽ không hiển thị, kèm sẵn lệnh chép về
- **Lưu file đính kèm lên S3** (#52): thêm tuỳ chọn cất ảnh, video, tài liệu của cuộc chat lên dịch vụ tương thích S3 (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, object storage trong nước) thay vì đĩa máy chủ. **Cấu hình trong Cài đặt > Lưu trữ file, riêng cho từng công ty** — công ty này để trên S3, công ty kia vẫn lưu trên máy chủ. Phải bấm Kiểm tra kết nối đạt mới lưu được, và phép kiểm tra chạy trọn vòng ghi–đọc–xoá thật chứ không chỉ thử kết nối, nên khoá thiếu quyền ghi bị phát hiện ngay thay vì đợi tới lúc đồng bộ. Bật S3 trên hệ thống đang chạy **không cần chuyển file cũ trước**: file mới lên S3, file cũ vẫn đọc được từ máy chủ. Khoá file giữ nguyên đường dẫn cũ nên không phải sửa database. Ảnh vẫn đi qua ứng dụng nên bucket để riêng tư, không lộ link ra ngoài
- **Lệnh chuyển file cũ lên S3**: `migrate-files` chép file từ máy chủ lên S3 cho các công ty đã bật, chạy lại bao nhiêu lần cũng được và đứt giữa chừng thì chép tiếp phần còn thiếu. Bước xoá bản trên máy chủ tách riêng bằng cờ `-delete-local`, chỉ xoá file đã xác nhận có trên S3 đúng dung lượng
- **Tự dọn nhật ký hệ thống**: bảng nhật ký chỉ ghi thêm nên chạy lâu là phình to. Nay mỗi ngày 3h15 sáng hệ thống xoá các dòng cũ hơn 90 ngày, xoá theo lô để không khoá bảng. Đổi số ngày bằng `ACTIVITY_LOG_RETENTION_DAYS`, đặt `0` để giữ mãi như trước
- **Lệnh dọn bản đánh giá trùng**: `prune-duplicate-results` giữ lại kết quả của lượt chạy gần nhất mỗi cặp (công việc, cuộc chat) và xoá các lượt cũ hơn, dành cho bản cài đã tích dữ liệu trùng từ lỗi đánh giá lặp. Mặc định chỉ in bản kê, phải thêm `-apply` và gõ xác nhận mới xoá; từ chối chạy khi còn công việc đang chạy dở; xoá xong tự đối chiếu lại số dòng và số cặp. Chỉ đụng tới bảng `job_results`
- **Script sao lưu tự kiểm chứng**: `scripts/backup-db.sh` dump toàn bộ database rồi phục hồi thử sang database tạm và đối chiếu số dòng từng bảng, lệch một dòng là dừng và báo lỗi. Database tạm tự xoá sau khi kiểm xong, dữ liệu đang chạy chỉ được đọc
- **Danh sách model gọn lại**: bỏ hai mục gắn nhãn CLIProxy khỏi danh sách có sẵn. Ai dùng proxy nay điền URL rồi bấm làm mới để lấy đúng danh sách model của proxy mình, không phải chọn từ danh sách đoán trước. Model đang dùng vẫn được giữ nguyên
- **Thêm ChatGPT (OpenAI) và Grok (xAI)**: hai nhà cung cấp mới bên cạnh Claude và Gemini, dùng chung một bộ kết nối theo chuẩn OpenAI nên mục Tùy chỉnh API URL cũng chạy được với OpenRouter, LiteLLM hay máy chủ tự dựng theo chuẩn đó
- **Danh sách model tự cập nhật**: ô chọn model nay lấy trực tiếp từ nhà cung cấp bằng API key của tenant, lưu lại và làm mới mỗi ngày, kèm nút làm mới thủ công. Model mới ra không cần chờ bản phát hành CQA. Model đang dùng luôn được giữ trong danh sách kể cả khi nhà cung cấp đã gỡ, để không mất lựa chọn đang có
- **Tự cập nhật bảng giá AI**: đơn giá token nay tự đồng bộ định kỳ từ nguồn công khai nên model mới hoặc giá thay đổi không phải chờ bản phát hành. Bảng giá kèm sẵn trong chương trình vẫn là lưới an toàn khi không có mạng. Tắt bằng `PRICING_SYNC_ENABLED=false`
- **Cập nhật danh sách model AI**: bổ sung Claude Sonnet 5, Opus 5 và Gemini 3.x; mặc định chuyển sang Claude Sonnet 5 (rẻ hơn và mới hơn Sonnet 4.6) và Gemini 3.8 Flash. Gemini 2.0 Flash đã bị Google ngừng hoạt động; các model thế hệ cũ vẫn giữ trong danh sách cho ai đang dùng
- **Lệnh đặt lại mật khẩu từ dòng lệnh**: `docker exec -it cqa-app /app/cqa-server reset-password` — liệt kê tài khoản, nhập mật khẩu ẩn, tự kiểm tra độ mạnh và thu hồi toàn bộ phiên đăng nhập cũ. Dùng khi admin duy nhất quên mật khẩu. Chỉ chạy được trên server, không có đường gọi qua web
- **Script `scripts/reset-password.sh`**: làm việc tương tự cho bản cài chưa cập nhật, tự chuyển sang dùng lệnh trong ứng dụng nếu bản cài đã có

### Sửa lỗi
- **Chế độ tối: chữ chìm vào nền ở vài chỗ**: thẻ Hoạt động gần đây trên Trang chủ, khung nội dung cuộc chat trong chi tiết công việc và khung lệnh cập nhật đều tô nền sáng cứng nên sang chế độ tối thì chữ trắng nằm trên nền trắng, không đọc được. Nay dùng màu theo chủ đề đang bật, sáng hay tối đều đúng
- **Thẻ Hoạt động gần đây chỉ hiện 5 dòng**: thẻ gộp cảnh báo chất lượng với kết quả phân loại rồi lấy 10 dòng mới nhất, nhưng phía máy chủ chỉ trả 5 cảnh báo chất lượng. Công ty không dùng công việc phân loại thì thẻ vĩnh viễn dừng ở 5 dòng và trông như thiếu dữ liệu. Nay cả hai danh sách đều lấy đủ 10
- **Banner "có phiên bản mới" không chịu tắt sau khi cập nhật**: giao diện giữ kết quả tra cứu phiên bản trong trình duyệt 1 giờ, nên cập nhật xong banner vẫn còn đó kèm số hiệu phiên bản cũ, trông như cập nhật hỏng và nhiều người chạy lại lệnh cập nhật lần nữa. Nay hỏi thẳng mỗi lần mở trang, tải lại là hết; phần tra cứu GitHub vẫn được máy chủ cache như cũ nên không phát sinh thêm lượt gọi ra ngoài
- **So sánh phiên bản sai**: chỉ cần khác chuỗi là báo có bản mới, nên bản đang chạy mới hơn bản phát hành cuối vẫn bị giục cập nhật ngược về bản cũ, và bản dựng từ mã nguồn (`dev`) thì bị giục vĩnh viễn. Nay so theo số của từng phần trong `YYYY.MM.DD.N`
- **Nhật ký hệ thống và chi phí AI ai cũng gọi được**: giao diện đã ẩn hai mục này với thành viên không có quyền đọc Cài đặt, nhưng hai endpoint tương ứng lại không kiểm quyền nên vẫn gọi thẳng được — nhật ký chứa email và IP đăng nhập của người dùng. Nay hai endpoint kiểm đúng quyền mà menu vốn đã dùng
- **Bộ lọc nhật ký hệ thống trả về rỗng**: ba lựa chọn trong ô lọc (`job.create`, `ai.error`, `settings`) không ứng với hành động nào được ghi nên chọn vào là bảng trắng, trông như hệ thống không ghi nhật ký. Nay ô lọc chỉ liệt kê các hành động thực sự có, bổ sung đồng bộ kênh, xoá dữ liệu công việc và đăng nhập
- **Cuộc chat cũ bị đánh giá lại mỗi ngày**: công việc chạy theo lịch lấy mốc quét từ bản sao nạp lúc đăng ký lịch, mà bản sao đó không bao giờ đọc lại `last_run_at` mới. Mốc quét vì thế đứng yên ở thời điểm ứng dụng khởi động, mỗi ngày job quét lại toàn bộ hội thoại kể từ mốc đó. Truy vấn lại không có thứ tự cố định và không loại cuộc chat đã đánh giá, nên ngày nào cũng gặp đúng nhóm cũ nhất rồi hết giờ: cuộc chat mới không tới lượt, cuộc chat cũ thì tích thêm bản đánh giá trùng. Nay mỗi lượt chạy đọc lại công việc từ database, quét từ cũ đến mới, bỏ qua cuộc chat đã có đánh giá mới hơn tin nhắn cuối, và lượt chạy bị cắt vì hết giờ được ghi trạng thái `partial` đồng thời giữ nguyên mốc quét để phần còn lại vào lần sau
- **Không còn đoán giá model lạ**: trước đây model không có trong bảng giá bị tính theo giá của một model khác, khiến chi phí sai mà không ai biết. Nay model chưa rõ giá được ghi nhận là chưa tính được kèm cảnh báo trong log, thay vì cho ra một con số sai trông như đúng
- **Bảng giá AI tính sai chi phí**: đối chiếu bảng giá chính thức ngày 15/09/2026 thì Claude Opus 4.6 đang bị tính cao gấp ba ($15/$75 thay vì $5/$25), Claude Haiku 4.5 tính thiếu, còn Gemini 2.5 Flash — model được chọn mặc định — rơi vào nhánh giá của Gemini 2.0 nên thấp hơn thực tế tới 8 lần ở chiều ra. Con số trên Nhật ký chi phí và Trang chủ vì thế không đối chiếu được với hoá đơn. Nay cập nhật đúng giá và thêm kiểm thử khoá giá từng model
- **Chi phí và số vấn đề trên trang chủ hiển thị sai ý nghĩa**: thẻ "Chi phí hôm nay" thực ra cộng chi phí của cả khoảng thời gian đang lọc nên lọc 28 ngày sẽ ra con số lớn hơn "Chi phí tháng này", trông như hai ô bị đảo chỗ. Nay chi phí hôm nay tính riêng từ 0 giờ, thẻ trên cùng đổi thành chi phí theo khoảng đang lọc. Thẻ "Vấn đề hôm nay" cũng lọc theo khoảng thời gian chứ không riêng hôm nay nên đổi tên thành "Vấn đề"
- **Nút kiểm tra API key không kiểm tra gì** (#51): nút "Kiểm tra API Key" chỉ xem trong database có key hay không rồi báo xanh, không hề gọi tới Claude hay Gemini. Key sai, bị thu hồi hay hết hạn mức vẫn hiện "API key configured", người dùng chỉ phát hiện khi công việc chạy thật mà không ra kết quả. Nay nút này gọi thật một lượt tới nhà cung cấp và báo đúng lý do khi hỏng
- **Phải nhập lại API key mỗi lần đổi cấu hình AI** (#11): ô key hiển thị dấu chấm khi đã lưu, nhưng lưu cài đặt lại bắt nhập key thật nên chỉ muốn đổi model cũng phải dán key vào lại, dễ tưởng là key bị mất. Nay để nguyên ô đó thì key cũ được giữ
- **Không biết khi khoá mã hoá bị đổi**: đổi `ENCRYPTION_KEY` trong `.env` làm API key và thông tin kết nối kênh đã lưu không giải mã được, nhưng giao diện vẫn hiện như đã cấu hình xong. Nay báo rõ lý do và cách khắc phục
- **Không có nút thêm công ty sau khi cài đặt** (#50): tạo tài khoản quản trị xong thì vào thẳng màn hình trống, không thao tác được gì. Màn hình cài đặt lưu phiên nhưng chưa nạp hồ sơ người dùng, mà bước sau lại chuyển trang trong ứng dụng nên không còn chỗ nào nạp — giao diện coi như chưa biết người dùng là quản trị viên và ẩn hết nút. Tải lại trang hoặc đăng nhập lại thì hết, nên lỗi chỉ xuất hiện đúng lần cài đầu tiên
- **Đăng nhập sai không hiện thông báo**: bấm đăng nhập với mật khẩu sai thì trang chỉ nháy một cái rồi về lại như cũ, không báo gì. Bộ chặn lỗi hiểu nhầm 401 của trang đăng nhập thành hết hạn phiên nên đi làm mới phiên, hỏng tiếp rồi tải lại trang, xoá luôn dòng thông báo. Nay 401 từ các endpoint đăng nhập được để nguyên cho màn hình tự xử lý
- **Báo nhầm khi tài khoản bị khoá**: đăng nhập sai 5 lần bị khoá 15 phút nhưng màn hình vẫn báo "Email hoặc mật khẩu không đúng" nên không hiểu vì sao gõ đúng vẫn không vào được — nay hiện đúng lý do và thời gian mở khoá
- **Gia hạn SSL thất bại im lặng**: `/.well-known/acme-challenge/` nay luôn mở cho Let's Encrypt kể cả khi nginx bị giới hạn theo IP — trước đó việc xác minh trả 403 nên chứng chỉ hết hạn dù vòng lặp gia hạn vẫn chạy đều. Gia hạn hỏng cũng ghi cảnh báo rõ vào log thay vì im lặng
- **Chứng chỉ hết hạn không tự cấp lại**: chứng chỉ để quá hạn lâu thì lệnh gia hạn bị Let's Encrypt từ chối vì bản cũ đã bị xoá khỏi hệ thống, mà luồng khởi động lại chỉ biết gia hạn nên kẹt vĩnh viễn — nay tự chuyển sang cấp mới khi gia hạn hỏng

### Tài liệu
- **Lưu file lên S3**: thêm trang hướng dẫn bật S3, chuyển file cũ, thu hồi dung lượng đĩa và cách quay lại lưu trên đĩa
- **Cập nhật phiên bản**: mô tả lại cơ chế kiểm tra phiên bản cho khớp hành vi mới
- **Biến môi trường**: thêm mục nhật ký hệ thống, và sửa mặc định giới hạn tần suất đang ghi sai (`100`/`300` trong khi mã dùng `500`/`1000`)
- **Nhật ký hệ thống**: thêm trang tài liệu cho mục này — các hành động được ghi, cách dùng để kiểm tra công việc có chạy không, và những gì chỉ có trong log ứng dụng chứ không lên giao diện
- **Cài đặt**: thêm mục sao lưu database và mục dọn bản đánh giá trùng, kèm các bước làm theo thứ tự
- **Công việc**: bổ sung cách hoạt động của lần chạy tự động (không đánh giá lại cuộc chat cũ) và bảng ý nghĩa các trạng thái lần chạy
- **Cấu hình AI**: bổ sung bảng model và giá của ChatGPT, Grok, kèm ghi chú về dùng proxy
- **Cấu hình AI**: hướng dẫn cơ chế danh sách model tự cập nhật và nút làm mới
- **Biến môi trường**: thêm mục đồng bộ bảng giá AI kèm các lớp kiểm tra dữ liệu tải từ nguồn ngoài
- **Cấu hình AI**: bảng model kèm đơn giá từng loại, cảnh báo Gemini 2.0 Flash ngừng hoạt động và mốc tăng giá Gemini 3.x đầu năm 2027
- **Trang chủ**: nói rõ thẻ nào đổi theo bộ lọc thời gian, thẻ nào cố định theo ngày và theo tháng
- **Cấu hình AI**: bổ sung bảng ý nghĩa từng thông báo của nút Kiểm tra API Key, và mục xử lý khi khoá mã hoá bị đổi
- **Hướng dẫn MCP** (#49): tách rõ hai trường hợp file cấu hình Claude Desktop rỗng và đã có sẵn nội dung — trước đây chỉ đưa một khối JSON hoàn chỉnh nên nhiều người dán thêm vào file có sẵn, thành hai khối JSON nối nhau và Claude Desktop báo lỗi không đọc được
- **Quên mật khẩu admin**: viết lại mục trong FAQ — hướng dẫn cũ dùng `-u root -p$MYSQL_ROOT_PASSWORD` trong khi biến này không tồn tại ở shell của host nên chạy sẽ tắc, lại thiếu hẳn bước sinh mã hoá mật khẩu và gợi ý "thêm admin mới qua API" vốn không thực hiện được khi chưa đăng nhập được. Bổ sung cách xử lý khi bị khoá do đăng nhập sai 5 lần
- **Tài liệu cài đặt**: thêm mục Lệnh quản trị liệt kê các lệnh chạy trực tiếp trên server

## v2026.03.30

### Tính năng mới
- **MCP Redirect URIs & Scopes**: Tạo MCP client có thể cấu hình Redirect URIs và phân quyền (read/write) — bắt buộc để kết nối Claude Web

### Sửa lỗi
- **MCP OAuth**: Fix lỗi `invalid_redirect_uri` khi Claude.ai bấm Connect — do chưa cấu hình Redirect URI lúc tạo client
- **Cron timezone**: Job chạy sai giờ (lệch 7 tiếng) do container dùng UTC — đã fix bằng cách prefix `TZ=<tenant_timezone>` vào cron expression và thêm `TZ=Asia/Ho_Chi_Minh` vào Docker

## v2026.03.26

### Tính năng mới
- **Thông báo cập nhật**: Banner thông báo khi có phiên bản mới + changelog + hướng dẫn update
- **Nút Dừng job**: Có thể dừng job đang chạy từ giao diện (#7)
- **Docs + Version**: Hiển thị ở sidebar, truy cập nhanh tài liệu và changelog
- **URL ứng dụng**: Cấu hình URL trong Cài đặt để link thông báo Telegram/Email chính xác (#43)
- **Lịch chạy "Sau mỗi lần đồng bộ"**: Tự động chạy phân tích sau khi đồng bộ kênh thành công (#7, #45)
- **Cron hot-reload**: Tạo/sửa/xóa job "Theo lịch" không cần restart app

### Sửa lỗi
- **Job bị treo**: Fix infinite loop khi batchSize=0, thêm context cancellation check, check lỗi DB query (#7)
- **Facebook token**: Fix lỗi "must be called with Page Access Token" — tự động exchange User Token thành Page Token (#12, #13, #14)
- **Gemini models**: Thay gemini-2.0-flash (deprecated) bằng gemini-2.5-flash/pro
- **Lịch chạy**: Không lưu được "Lịch chạy" khi sửa công việc (#9)
- **AI model**: Job detail hiện đúng AI model từ Settings global thay vì giá trị cũ (#33)
- **Tỷ giá**: Dashboard dùng tỷ giá từ tenant settings thay vì hardcode 26000 VND (#23)
- **Install script**: Fix bị treo trên Ubuntu do interactive prompt (#35)
- **Ảnh trong đánh giá**: Hiển thị ảnh/sticker/file trong "Diễn biến cuộc chat" + lightbox zoom (#39)
- **Link Telegram**: Link thông báo dùng domain thực thay vì localhost (#43)
- **Job polling**: Spinner/progress bar dùng server status, không timeout cứng — F5 tự resume polling
- **Badge tab**: Đánh giá/Phân loại badge màu nổi hơn
- **Mobile sidebar**: Không tự mở sidebar trên điện thoại sau khi login

### Bảo mật
- Thêm security log khi từ chối truy cập file (IDOR fix)
- IDOR: Kiểm tra tenant ownership khi serve file (#22)
- Token refresh: Fix race condition gây logout bất ngờ (#26)
- OAuth state URL-encoded (#29)
- Goroutine timeout cho TriggerJob và TestRunJob (#30, #31)
- Giới hạn per_page max 100 tránh DB exhaustion (#32)
- Infinite polling: Frontend tự dừng poll sau timeout (#27, #28)
- **RBAC**: Phân quyền Member đầy đủ — backend middleware + frontend ẩn menu/nút + router guard (#42)
- **Export**: Member không có quyền ghi không được export tin nhắn
- **Tạo/xóa công ty**: Chỉ admin/owner mới được tạo và xóa công ty

### Tài liệu
- Sửa hướng dẫn lấy Telegram Group ID — dùng Telegram Web (#36)
- Thêm hướng dẫn chạy localhost (Zalo OA hỗ trợ callback localhost) (#34)
- Sửa docs Zalo OA: localhost không cần SSL (#37)
- Đơn giản hóa cài đặt Watchtower — 1 lệnh curl thay vì sửa YAML thủ công

---

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

## [1.0.0] - 2026-03-23

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
