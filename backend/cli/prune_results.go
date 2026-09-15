package cli

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
)

// pairKey là một cặp (công việc, cuộc chat) — đơn vị mà quy tắc giữ lại áp dụng.
type pairKey struct {
	JobID          string
	ConversationID string
}

// runGroup là toàn bộ kết quả của một lượt chạy cho một cuộc chat.
type runGroup struct {
	TenantID       string
	JobID          string
	ConversationID string
	JobRunID       string
	LastCreated    time.Time
	Rows           int64 `gorm:"column:row_count"`
}

// staleTarget là phần cần xoá của một cặp: các lượt chạy cũ hơn lượt gần nhất.
type staleTarget struct {
	TenantID       string
	ConversationID string
	StaleRunIDs    []string
	Rows           int64
}

// PrunePlan là bản kê việc sẽ làm, tính xong trước khi xoá bất cứ thứ gì.
type PrunePlan struct {
	TotalRows      int64
	KeepRows       int64
	DeleteRows     int64
	OrphanRows     int64
	Pairs          int64
	PairsWithExtra int64
	Targets        []staleTarget
}

// PruneDuplicateResults xoá các bản đánh giá trùng trong job_results, giữ lại
// lượt chạy gần nhất của mỗi cặp (công việc, cuộc chat).
//
// Có mặt vì một lỗi ở luồng chạy theo lịch khiến cuộc chat cũ bị đánh giá lại
// mỗi ngày — lỗi đã sửa, nhưng dữ liệu trùng sinh ra từ trước vẫn nằm lại,
// làm phình database và thổi phồng số liệu trên Trang chủ.
//
// Lệnh chỉ đụng tới bảng job_results. Tin nhắn, cuộc chat, lượt chạy, cấu hình
// đều không bị chạm tới.
func PruneDuplicateResults(args []string) error {
	fs := flag.NewFlagSet("prune-duplicate-results", flag.ContinueOnError)
	apply := fs.Bool("apply", false, "thực sự xoá; bỏ trống là chỉ xem trước (dry-run)")
	assumeYes := fs.Bool("yes", false, "bỏ qua bước gõ xác nhận")
	batch := fs.Int("batch", 200, "số cặp xử lý mỗi giao dịch")
	if err := fs.Parse(args); err != nil {
		return fmt.Errorf("parsing flags: %w", err)
	}
	if *batch < 1 {
		*batch = 200
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}
	if err := db.Connect(cfg.DSN(), cfg.IsProduction()); err != nil {
		return fmt.Errorf("connecting database: %w", err)
	}
	defer db.Close()

	gdb := db.DB.Session(&gorm.Session{Logger: logger.Discard})

	// Có job đang chạy thì dữ liệu còn thay đổi giữa lúc tính và lúc xoá.
	var running int64
	if err := gdb.Model(&models.JobRun{}).Where("status = ?", "running").Count(&running).Error; err != nil {
		return fmt.Errorf("checking running jobs: %w", err)
	}
	if running > 0 {
		return fmt.Errorf("đang có %d lượt chạy chưa xong — đợi chạy xong rồi làm lại", running)
	}

	plan, err := BuildPrunePlan(gdb)
	if err != nil {
		return err
	}

	printPlan(plan)

	if plan.DeleteRows == 0 {
		fmt.Println("\nKhông có dữ liệu trùng. Không cần làm gì.")
		return nil
	}

	if !*apply {
		fmt.Println("\nĐây là bản xem trước, chưa xoá gì.")
		fmt.Println("Chạy lại kèm -apply để xoá thật. Nhớ sao lưu database trước:")
		fmt.Println("  bash scripts/backup-db.sh")
		return nil
	}

	if !*assumeYes {
		fmt.Printf("\nSẽ xoá %d dòng trong job_results. Đã sao lưu database chưa?\n", plan.DeleteRows)
		fmt.Print("Gõ XOA rồi Enter để tiếp tục: ")
		reader := bufio.NewReader(os.Stdin)
		answer, _ := reader.ReadString('\n')
		if strings.TrimSpace(answer) != "XOA" {
			fmt.Println("Đã huỷ, không xoá gì.")
			return nil
		}
	}

	deleted, err := ApplyPrunePlan(gdb, plan, *batch, func(done, total int) {
		fmt.Printf("\r  đã xử lý %d/%d cặp", done, total)
	})
	fmt.Println()
	if err != nil {
		return err
	}

	// Đối chiếu sau khi xoá: số dòng phải khớp bản kê, và không cặp nào được
	// phép biến mất hoàn toàn.
	after, err := BuildPrunePlan(gdb)
	if err != nil {
		return fmt.Errorf("kiểm tra lại sau khi xoá: %w", err)
	}
	fmt.Printf("\nĐã xoá %d dòng.\n", deleted)
	fmt.Printf("Còn lại   : %d dòng (dự kiến %d)\n", after.TotalRows, plan.KeepRows+plan.OrphanRows)
	fmt.Printf("Số cặp    : %d (trước khi xoá %d)\n", after.Pairs, plan.Pairs)

	if after.Pairs != plan.Pairs {
		return fmt.Errorf("SỐ CẶP KHÔNG KHỚP: trước %d, sau %d — kiểm tra lại ngay, cân nhắc phục hồi từ bản sao lưu",
			plan.Pairs, after.Pairs)
	}
	if after.DeleteRows != 0 {
		return fmt.Errorf("vẫn còn %d dòng trùng sau khi xoá — chạy lại lệnh", after.DeleteRows)
	}
	fmt.Println("\nXong. Chạy OPTIMIZE TABLE job_results ngoài giờ để trả lại dung lượng đĩa.")
	return nil
}

// BuildPrunePlan tính xem cần xoá những gì, không đụng vào dữ liệu.
func BuildPrunePlan(gdb *gorm.DB) (*PrunePlan, error) {
	var groups []runGroup
	err := gdb.Model(&models.JobResult{}).
		Select("job_results.tenant_id AS tenant_id, job_runs.job_id AS job_id, job_results.conversation_id AS conversation_id, " +
			"job_results.job_run_id AS job_run_id, MAX(job_results.created_at) AS last_created, COUNT(*) AS row_count").
		Joins("JOIN job_runs ON job_runs.id = job_results.job_run_id").
		Group("job_results.tenant_id, job_runs.job_id, job_results.conversation_id, job_results.job_run_id").
		Scan(&groups).Error
	if err != nil {
		return nil, fmt.Errorf("đọc danh sách kết quả: %w", err)
	}

	plan := &PrunePlan{}
	if err := gdb.Model(&models.JobResult{}).Count(&plan.TotalRows).Error; err != nil {
		return nil, fmt.Errorf("đếm tổng số dòng: %w", err)
	}

	byPair := make(map[pairKey][]runGroup)
	var grouped int64
	for _, g := range groups {
		key := pairKey{JobID: g.JobID, ConversationID: g.ConversationID}
		byPair[key] = append(byPair[key], g)
		grouped += g.Rows
	}
	// Dòng có job_run_id không còn trong job_runs không nằm trong bản kê,
	// và cũng không bao giờ bị xoá.
	plan.OrphanRows = plan.TotalRows - grouped
	plan.Pairs = int64(len(byPair))

	for _, runs := range byPair {
		// Lượt chạy gần nhất được giữ. Trùng thời điểm thì lấy job_run_id lớn hơn
		// để kết quả luôn như nhau giữa các lần chạy lệnh.
		sort.Slice(runs, func(i, j int) bool {
			if !runs[i].LastCreated.Equal(runs[j].LastCreated) {
				return runs[i].LastCreated.After(runs[j].LastCreated)
			}
			return runs[i].JobRunID > runs[j].JobRunID
		})
		keep := runs[0]
		plan.KeepRows += keep.Rows
		if len(runs) == 1 {
			continue
		}
		plan.PairsWithExtra++
		target := staleTarget{TenantID: keep.TenantID, ConversationID: keep.ConversationID}
		for _, stale := range runs[1:] {
			target.StaleRunIDs = append(target.StaleRunIDs, stale.JobRunID)
			target.Rows += stale.Rows
			plan.DeleteRows += stale.Rows
		}
		plan.Targets = append(plan.Targets, target)
	}

	// Thứ tự cố định để lần chạy sau lặp lại được y hệt.
	sort.Slice(plan.Targets, func(i, j int) bool {
		return plan.Targets[i].ConversationID < plan.Targets[j].ConversationID
	})
	return plan, nil
}

// ApplyPrunePlan xoá theo bản kê, mỗi lô một giao dịch.
func ApplyPrunePlan(gdb *gorm.DB, plan *PrunePlan, batch int, progress func(done, total int)) (int64, error) {
	var deleted int64
	total := len(plan.Targets)

	for start := 0; start < total; start += batch {
		end := start + batch
		if end > total {
			end = total
		}
		err := gdb.Transaction(func(tx *gorm.DB) error {
			for _, t := range plan.Targets[start:end] {
				// Ba điều kiện cùng lúc: đúng tenant, đúng cuộc chat, đúng các
				// lượt chạy cũ. Không có đường nào chạm sang bảng khác.
				res := tx.Where("tenant_id = ? AND conversation_id = ? AND job_run_id IN ?",
					t.TenantID, t.ConversationID, t.StaleRunIDs).
					Delete(&models.JobResult{})
				if res.Error != nil {
					return fmt.Errorf("xoá kết quả cũ của cuộc chat %s: %w", t.ConversationID, res.Error)
				}
				deleted += res.RowsAffected
			}
			return nil
		})
		if err != nil {
			return deleted, err
		}
		if progress != nil {
			progress(end, total)
		}
	}
	return deleted, nil
}

func printPlan(p *PrunePlan) {
	fmt.Println("Dọn bản đánh giá trùng trong job_results")
	fmt.Println(strings.Repeat("-", 52))
	fmt.Printf("Tổng số dòng hiện có          : %d\n", p.TotalRows)
	fmt.Printf("Cặp (công việc, cuộc chat)    : %d\n", p.Pairs)
	fmt.Printf("Cặp có nhiều hơn 1 lượt chạy  : %d\n", p.PairsWithExtra)
	fmt.Printf("Giữ lại (lượt chạy mới nhất)  : %d\n", p.KeepRows)
	if p.OrphanRows != 0 {
		fmt.Printf("Không có lượt chạy, giữ nguyên: %d\n", p.OrphanRows)
	}
	fmt.Printf("Sẽ xoá                        : %d\n", p.DeleteRows)
}
