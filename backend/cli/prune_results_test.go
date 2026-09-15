package cli

import (
	"fmt"
	"os"
	"testing"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

type pruneFixture struct {
	gdb         *gorm.DB
	tenantID    string
	channelID   string
	convA       string // bị đánh giá lại 3 lượt
	convB       string // chỉ 1 lượt
	jobQC       string
	jobPhanLoai string
	runIDs      map[string]string
}

// seed dựng lại đúng hình dạng dữ liệu hỏng trên production: một cuộc chat bị
// nhiều lượt chạy chấm đi chấm lại, một cuộc chỉ chấm một lần, một job thứ hai
// cũng chấm cùng cuộc chat đó, và một dòng mồ côi không còn lượt chạy.
func setupPruneFixture(t *testing.T) *pruneFixture {
	t.Helper()

	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		dsn = "cqa:cqa_password@tcp(127.0.0.1:3306)/cqa?charset=utf8mb4&parseTime=True&loc=UTC"
	}
	if err := db.Connect(dsn, false); err != nil {
		t.Skipf("bo qua: khong ket noi duoc DB test: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("AutoMigrate loi: %v", err)
	}

	f := &pruneFixture{
		gdb:         db.DB.Session(&gorm.Session{Logger: logger.Discard}),
		tenantID:    "prune-" + pkg.NewUUID()[:8],
		channelID:   "ch-prune-" + pkg.NewUUID()[:8],
		convA:       "conv-prune-a-" + pkg.NewUUID()[:8],
		convB:       "conv-prune-b-" + pkg.NewUUID()[:8],
		jobQC:       "job-prune-qc-" + pkg.NewUUID()[:8],
		jobPhanLoai: "job-prune-cl-" + pkg.NewUUID()[:8],
		runIDs:      map[string]string{},
	}

	f.gdb.Exec(`INSERT INTO tenants (id, name, slug, settings, created_at, updated_at) VALUES (?, ?, ?, '{}', NOW(), NOW())`,
		f.tenantID, "Prune Test", f.tenantID)
	f.gdb.Exec(`INSERT INTO channels (id, tenant_id, channel_type, name, external_id, credentials_encrypted, is_active, metadata, created_at, updated_at) VALUES (?, ?, 'zalo_oa', 'Kenh', 'fake', X'00', true, '{}', NOW(), NOW())`,
		f.channelID, f.tenantID)
	for i, conv := range []string{f.convA, f.convB} {
		f.gdb.Exec(`INSERT INTO conversations (id, tenant_id, channel_id, external_conversation_id, customer_name, last_message_at, message_count, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, 'Khach', NOW(), 1, '{}', NOW(), NOW())`,
			conv, f.tenantID, f.channelID, fmt.Sprintf("ext-%d", i))
		f.gdb.Exec(`INSERT INTO messages (id, tenant_id, conversation_id, external_message_id, sender_type, sender_name, content, sent_at, created_at) VALUES (?, ?, ?, ?, 'customer', 'Khach', 'Xin chao', NOW(), NOW())`,
			pkg.NewUUID(), f.tenantID, conv, fmt.Sprintf("m-%d", i))
	}
	for _, j := range []string{f.jobQC, f.jobPhanLoai} {
		f.gdb.Exec(`INSERT INTO jobs (id, tenant_id, name, job_type, input_channel_ids, rules_content, rules_config, schedule_type, is_active, outputs, created_at, updated_at) VALUES (?, ?, 'Job prune', 'qc_analysis', '[]', '', '[]', 'cron', true, '[]', NOW(), NOW())`,
			j, f.tenantID)
	}

	base := time.Now().Add(-72 * time.Hour)
	addRun := func(label, jobID string, at time.Time) string {
		id := "run-" + label + "-" + pkg.NewUUID()[:8]
		f.gdb.Exec(`INSERT INTO job_runs (id, job_id, tenant_id, started_at, finished_at, status, summary, created_at) VALUES (?, ?, ?, ?, ?, 'success', '{}', ?)`,
			id, jobID, f.tenantID, at, at, at)
		f.runIDs[label] = id
		return id
	}
	addResult := func(runID, convID, resultType string, at time.Time) {
		f.gdb.Exec(`INSERT INTO job_results (id, job_run_id, tenant_id, conversation_id, result_type, severity, rule_name, evidence, detail, ai_raw_response, confidence, created_at) VALUES (?, ?, ?, ?, ?, 'FAIL', 'rule', 'evidence', '{}', '{}', 1.0, ?)`,
			pkg.NewUUID(), runID, f.tenantID, convID, resultType, at)
	}

	// convA: 3 lượt chạy của job QC, mỗi lượt 1 bản đánh giá + 1 vi phạm
	for i, label := range []string{"cu1", "cu2", "moi"} {
		at := base.Add(time.Duration(i) * 24 * time.Hour)
		runID := addRun(label, f.jobQC, at)
		addResult(runID, f.convA, "conversation_evaluation", at)
		addResult(runID, f.convA, "qc_violation", at)
	}
	// convB: 1 lượt duy nhất, nằm trong chính lượt chạy mới nhất của job QC
	addResult(f.runIDs["moi"], f.convB, "conversation_evaluation", base.Add(48*time.Hour))
	// job thứ hai chấm cùng convA — không được đụng tới
	runOther := addRun("job2", f.jobPhanLoai, base)
	addResult(runOther, f.convA, "classification_tag", base)
	// dòng mồ côi: lượt chạy không còn tồn tại
	addResult("run-da-bi-xoa-"+pkg.NewUUID()[:8], f.convA, "conversation_evaluation", base)

	t.Cleanup(func() {
		f.gdb.Exec("DELETE FROM job_results WHERE tenant_id = ?", f.tenantID)
		f.gdb.Exec("DELETE FROM job_runs WHERE tenant_id = ?", f.tenantID)
		f.gdb.Exec("DELETE FROM jobs WHERE tenant_id = ?", f.tenantID)
		f.gdb.Exec("DELETE FROM messages WHERE tenant_id = ?", f.tenantID)
		f.gdb.Exec("DELETE FROM conversations WHERE tenant_id = ?", f.tenantID)
		f.gdb.Exec("DELETE FROM channels WHERE id = ?", f.channelID)
		f.gdb.Exec("DELETE FROM tenants WHERE id = ?", f.tenantID)
	})
	return f
}

func (f *pruneFixture) countResults(t *testing.T, where string, args ...interface{}) int64 {
	t.Helper()
	var n int64
	q := f.gdb.Model(&models.JobResult{}).Where("tenant_id = ?", f.tenantID)
	if where != "" {
		q = q.Where(where, args...)
	}
	if err := q.Count(&n).Error; err != nil {
		t.Fatalf("dem job_results loi: %v", err)
	}
	return n
}

// planOf lọc bản kê toàn hệ thống về đúng phần của fixture này, để test không
// phụ thuộc dữ liệu sẵn có trong DB dev.
func (f *pruneFixture) planOf(t *testing.T) *PrunePlan {
	t.Helper()
	full, err := BuildPrunePlan(f.gdb)
	if err != nil {
		t.Fatalf("BuildPrunePlan loi: %v", err)
	}
	mine := &PrunePlan{}
	for _, tg := range full.Targets {
		if tg.TenantID == f.tenantID {
			mine.Targets = append(mine.Targets, tg)
			mine.DeleteRows += tg.Rows
			mine.PairsWithExtra++
		}
	}
	return mine
}

func TestDonBanDanhGiaTrungGiuLuotMoiNhat(t *testing.T) {
	f := setupPruneFixture(t)

	truoc := f.countResults(t, "")
	if truoc != 9 {
		t.Fatalf("du lieu dung san phai co 9 dong, nhan %d", truoc)
	}

	plan := f.planOf(t)
	if plan.PairsWithExtra != 1 {
		t.Fatalf("chi 1 cap co nhieu luot chay, nhan %d", plan.PairsWithExtra)
	}
	if plan.DeleteRows != 4 {
		t.Fatalf("phai xoa 4 dong (2 luot cu x 2 dong), nhan %d", plan.DeleteRows)
	}

	deleted, err := ApplyPrunePlan(f.gdb, plan, 200, nil)
	if err != nil {
		t.Fatalf("ApplyPrunePlan loi: %v", err)
	}
	if deleted != 4 {
		t.Errorf("cho xoa 4 dong, xoa %d", deleted)
	}

	// Lượt chạy mới nhất của convA còn nguyên 2 dòng
	if got := f.countResults(t, "conversation_id = ? AND job_run_id = ?", f.convA, f.runIDs["moi"]); got != 2 {
		t.Errorf("luot chay moi nhat phai con 2 dong, nhan %d", got)
	}
	// Hai lượt cũ sạch
	for _, label := range []string{"cu1", "cu2"} {
		if got := f.countResults(t, "job_run_id = ?", f.runIDs[label]); got != 0 {
			t.Errorf("luot chay cu %s phai bi xoa het, con %d dong", label, got)
		}
	}
	// Cuộc chat chỉ có 1 lượt: không bị đụng
	if got := f.countResults(t, "conversation_id = ?", f.convB); got != 1 {
		t.Errorf("cuoc chat 1 luot phai con nguyen 1 dong, nhan %d", got)
	}
	// Job thứ hai trên cùng cuộc chat: không bị đụng
	if got := f.countResults(t, "job_run_id = ?", f.runIDs["job2"]); got != 1 {
		t.Errorf("ket qua cua job khac phai con nguyen, nhan %d", got)
	}
	// Dòng mồ côi: giữ nguyên, không bao giờ xoá
	if got := f.countResults(t, "result_type = ? AND conversation_id = ? AND job_run_id LIKE 'run-da-bi-xoa-%'", "conversation_evaluation", f.convA); got != 1 {
		t.Errorf("dong mo coi phai duoc giu nguyen, nhan %d", got)
	}
	if con := f.countResults(t, ""); con != 5 {
		t.Errorf("tong sau khi don phai con 5 dong, nhan %d", con)
	}

	// Chạy lần hai không còn gì để xoá
	lai := f.planOf(t)
	if lai.DeleteRows != 0 {
		t.Errorf("chay lai khong con gi de xoa, nhan %d", lai.DeleteRows)
	}
}

// Lệnh chỉ được đụng tới job_results. Tin nhắn và cuộc chat phải nguyên vẹn.
func TestDonKhongDungToiTinNhanVaCuocChat(t *testing.T) {
	f := setupPruneFixture(t)

	var msgTruoc, convTruoc, runTruoc int64
	f.gdb.Model(&models.Message{}).Where("tenant_id = ?", f.tenantID).Count(&msgTruoc)
	f.gdb.Model(&models.Conversation{}).Where("tenant_id = ?", f.tenantID).Count(&convTruoc)
	f.gdb.Model(&models.JobRun{}).Where("tenant_id = ?", f.tenantID).Count(&runTruoc)

	if _, err := ApplyPrunePlan(f.gdb, f.planOf(t), 200, nil); err != nil {
		t.Fatalf("ApplyPrunePlan loi: %v", err)
	}

	var msgSau, convSau, runSau int64
	f.gdb.Model(&models.Message{}).Where("tenant_id = ?", f.tenantID).Count(&msgSau)
	f.gdb.Model(&models.Conversation{}).Where("tenant_id = ?", f.tenantID).Count(&convSau)
	f.gdb.Model(&models.JobRun{}).Where("tenant_id = ?", f.tenantID).Count(&runSau)

	if msgTruoc != msgSau || msgSau == 0 {
		t.Errorf("tin nhan bi thay doi: truoc %d, sau %d", msgTruoc, msgSau)
	}
	if convTruoc != convSau || convSau == 0 {
		t.Errorf("cuoc chat bi thay doi: truoc %d, sau %d", convTruoc, convSau)
	}
	if runTruoc != runSau || runSau == 0 {
		t.Errorf("luot chay bi thay doi: truoc %d, sau %d", runTruoc, runSau)
	}
}
