package cli

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"path/filepath"

	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/storage"
	"github.com/vietbui/chat-quality-agent/storagecfg"
)

// MigrateFiles chuyển file đính kèm đang nằm trên đĩa máy chủ lên S3.
//
// Chạy lại được bao nhiêu lần cũng được: file đã có trên S3 và đúng dung lượng
// thì bỏ qua. Bước xoá bản trên đĩa tách riêng, phải gọi bằng cờ -delete-local,
// và chỉ xoá file đã xác nhận có trên S3 đúng dung lượng.
func MigrateFiles(args []string) error {
	fs := flag.NewFlagSet("migrate-files", flag.ContinueOnError)
	tenantID := fs.String("tenant", "", "mã công ty cần chuyển; bỏ trống là làm mọi công ty đã bật S3")
	apply := fs.Bool("apply", false, "thực sự chép; bỏ trống là chỉ xem trước")
	deleteLocal := fs.Bool("delete-local", false, "xoá bản trên đĩa sau khi đã chắc chắn có trên S3")
	assumeYes := fs.Bool("yes", false, "bỏ qua bước gõ xác nhận khi xoá")
	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("parsing flags: %w", err)
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}
	if err := db.Connect(cfg.DSN(), cfg.IsProduction()); err != nil {
		return fmt.Errorf("connecting database: %w", err)
	}
	defer db.Close()

	congTy, err := danhSachCongTy(cfg, *tenantID)
	if err != nil {
		return err
	}
	if len(congTy) == 0 {
		return fmt.Errorf("không có công ty nào đang bật S3 — bật trong Cài đặt > Lưu trữ file trước đã")
	}

	ctx := context.Background()
	for _, ct := range congTy {
		if err := chuyenMotCongTy(ctx, cfg, ct, *apply, *deleteLocal, *assumeYes); err != nil {
			return err
		}
	}
	return nil
}

// congTyCanChuyen là một công ty đã bật S3.
type congTyCanChuyen struct {
	ID     string
	Ten    string
	Bucket string
	Store  storage.Store
}

func danhSachCongTy(cfg *config.Config, chiMot string) ([]congTyCanChuyen, error) {
	var tenants []models.Tenant
	q := db.DB.Model(&models.Tenant{})
	if chiMot != "" {
		q = q.Where("id = ?", chiMot)
	}
	if err := q.Find(&tenants).Error; err != nil {
		return nil, err
	}

	var out []congTyCanChuyen
	for _, t := range tenants {
		sc, err := storagecfg.Load(cfg, t.ID)
		if err != nil {
			return nil, fmt.Errorf("công ty %s: %w", t.Name, err)
		}
		if strings.ToLower(sc.Backend) != "s3" {
			continue
		}
		st, err := storage.NewS3(sc)
		if err != nil {
			return nil, fmt.Errorf("công ty %s: %w", t.Name, err)
		}
		out = append(out, congTyCanChuyen{ID: t.ID, Ten: t.Name, Bucket: sc.S3Bucket, Store: st})
	}
	return out, nil
}

func chuyenMotCongTy(ctx context.Context, cfg *config.Config, ct congTyCanChuyen, apply, deleteLocal, assumeYes bool) error {
	// File của mỗi công ty nằm trong thư mục con mang tên công ty đó, nên chỉ
	// quét đúng phần của họ.
	localDir := filepath.Join(cfg.StorageLocalDir, ct.ID)
	remote := ct.Store

	fmt.Println("Chuyển file đính kèm từ đĩa máy chủ lên S3")
	fmt.Println(strings.Repeat("-", 52))
	fmt.Printf("Công ty          : %s\n", ct.Ten)
	fmt.Printf("Thư mục trên đĩa : %s\n", localDir)
	fmt.Printf("Bucket           : %s\n\n", ct.Bucket)

	// Luôn xem trước để biết khối lượng, kể cả khi đã truyền -apply.
	plan, err := storage.MigrateLocalToRemote(ctx, remote, localDir, storage.MigrateOptions{KeyPrefix: ct.ID}, nil)
	if err != nil {
		return fmt.Errorf("quét thư mục: %w", err)
	}
	fmt.Printf("File trên đĩa            : %d (%s)\n", plan.Scanned, khoiLuong(plan.BytesTotal))
	fmt.Printf("Đã có trên S3, bỏ qua    : %d\n", plan.AlreadyOK)
	fmt.Printf("Cần chép                 : %d (%s)\n", plan.Scanned-plan.AlreadyOK-plan.Failed, khoiLuong(plan.BytesToDo))
	if plan.Failed > 0 {
		fmt.Printf("Không đọc được           : %d\n", plan.Failed)
	}

	if plan.Scanned == 0 {
		fmt.Println("\nKhông có file nào trên đĩa. Không cần làm gì.")
		return nil
	}

	if !apply {
		fmt.Println("\nĐây là bản xem trước, chưa chép gì.")
		fmt.Println("Chạy lại kèm -apply để chép thật.")
		return nil
	}

	if deleteLocal && !assumeYes {
		fmt.Printf("\nSẽ chép rồi XOÁ bản trên đĩa của %d file. Đã sao lưu chưa?\n", plan.Scanned)
		fmt.Print("Gõ XOA rồi Enter để tiếp tục: ")
		answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
		if strings.TrimSpace(answer) != "XOA" {
			fmt.Println("Đã huỷ, không đụng gì.")
			return nil
		}
	}

	fmt.Println()
	st, err := storage.MigrateLocalToRemote(ctx, remote, localDir,
		storage.MigrateOptions{Apply: true, DeleteLocal: deleteLocal, KeyPrefix: ct.ID},
		func(s storage.MigrateStats) {
			fmt.Printf("\r  đã xử lý %d/%d file", s.Scanned, plan.Scanned)
		})
	fmt.Println()
	if err != nil {
		return err
	}

	fmt.Printf("\nĐã chép   : %d file\n", st.Copied)
	fmt.Printf("Bỏ qua    : %d file (đã có sẵn)\n", st.AlreadyOK)
	if deleteLocal {
		fmt.Printf("Đã xoá đĩa: %d file\n", st.Deleted)
	}
	if st.Failed > 0 {
		fmt.Printf("Hỏng      : %d file — bản trên đĩa vẫn còn nguyên, chạy lại lệnh để thử tiếp\n", st.Failed)
		return fmt.Errorf("%d file chưa chuyển được", st.Failed)
	}
	if !deleteLocal {
		fmt.Println("\nBản trên đĩa vẫn còn. Kiểm tra ảnh hiển thị bình thường vài ngày rồi chạy")
		fmt.Println("lại kèm -delete-local để thu hồi dung lượng đĩa.")
	}
	return nil
}

func khoiLuong(b int64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(1<<10))
	default:
		return fmt.Sprintf("%d B", b)
	}
}
