package engine

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/vietbui/chat-quality-agent/ai"
	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

// alwaysFailProvider trả về một vi phạm cố định, đủ để sinh bản ghi đánh giá.
type alwaysFailProvider struct{ calls int }

func (p *alwaysFailProvider) qcJSON() string {
	b, _ := json.Marshal(map[string]interface{}{
		"verdict": "FAIL",
		"score":   45,
		"review":  "Nhan vien xin so zalo nhung khong bao lai.",
		"violations": []map[string]interface{}{
			{"severity": "NGHIEM_TRONG", "rule": "Bao ket qua", "evidence": "NV: da chay zalo", "explanation": "Khong xac nhan lai."},
		},
		"summary": "Cuoc chat chua dat.",
	})
	return string(b)
}

func (p *alwaysFailProvider) AnalyzeChat(ctx context.Context, systemPrompt, transcript string) (ai.AIResponse, error) {
	p.calls++
	return ai.AIResponse{Content: p.qcJSON(), InputTokens: 100, OutputTokens: 50, Model: "mock-model", Provider: "mock"}, nil
}

func (p *alwaysFailProvider) AnalyzeChatBatch(ctx context.Context, systemPrompt string, items []ai.BatchItem) (ai.AIResponse, error) {
	p.calls++
	results := make([]json.RawMessage, 0, len(items))
	for range items {
		results = append(results, json.RawMessage(p.qcJSON()))
	}
	b, _ := json.Marshal(results)
	return ai.AIResponse{Content: string(b), InputTokens: 100 * len(items), OutputTokens: 50 * len(items), Model: "mock-model", Provider: "mock"}, nil
}

// reanalyzeFixture dựng tenant/kênh/cuộc chat/job thật trong MySQL test.
type reanalyzeFixture struct {
	tenantID  string
	channelID string
	convID    string
	jobID     string
}

func setupReanalyzeFixture(t *testing.T) *reanalyzeFixture {
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

	f := &reanalyzeFixture{
		tenantID:  "retest-" + pkg.NewUUID()[:8],
		channelID: "ch-retest-" + pkg.NewUUID()[:8],
		convID:    "conv-retest-" + pkg.NewUUID()[:8],
		jobID:     "job-retest-" + pkg.NewUUID()[:8],
	}
	channelIDsJSON, _ := json.Marshal([]string{f.channelID})
	lastMsgAt := time.Now().Add(-2 * time.Hour)

	db.DB.Exec(`INSERT INTO tenants (id, name, slug, settings, created_at, updated_at) VALUES (?, ?, ?, '{}', NOW(), NOW())`,
		f.tenantID, "Reanalyze Test", f.tenantID)
	db.DB.Exec(`INSERT INTO channels (id, tenant_id, channel_type, name, external_id, credentials_encrypted, is_active, metadata, created_at, updated_at) VALUES (?, ?, 'zalo_oa', 'Kenh test', 'fake', X'00', true, '{}', NOW(), NOW())`,
		f.channelID, f.tenantID)
	db.DB.Exec(`INSERT INTO conversations (id, tenant_id, channel_id, external_conversation_id, customer_name, last_message_at, message_count, metadata, created_at, updated_at) VALUES (?, ?, ?, 'ext-1', 'Khach', ?, 2, '{}', NOW(), NOW())`,
		f.convID, f.tenantID, f.channelID, lastMsgAt)
	db.DB.Exec(`INSERT INTO messages (id, tenant_id, conversation_id, external_message_id, sender_type, sender_name, content, sent_at, created_at) VALUES (?, ?, ?, 'm1', 'customer', 'Khach', 'Cho minh hoi', ?, NOW())`,
		pkg.NewUUID(), f.tenantID, f.convID, lastMsgAt.Add(-5*time.Minute))
	db.DB.Exec(`INSERT INTO messages (id, tenant_id, conversation_id, external_message_id, sender_type, sender_name, content, sent_at, created_at) VALUES (?, ?, ?, 'm2', 'agent', 'NV', 'Chi cho em xin so zalo', ?, NOW())`,
		pkg.NewUUID(), f.tenantID, f.convID, lastMsgAt)
	db.DB.Exec(`INSERT INTO jobs (id, tenant_id, name, job_type, input_channel_ids, rules_content, rules_config, schedule_type, schedule_cron, is_active, outputs, output_schedule, created_at, updated_at) VALUES (?, ?, 'QC Reanalyze', 'qc_analysis', ?, 'Nhan vien phai bao lai ket qua.', '[]', 'cron', '0 7 * * *', true, '[]', 'none', NOW(), NOW())`,
		f.jobID, f.tenantID, string(channelIDsJSON))

	t.Cleanup(func() {
		db.DB.Exec("DELETE FROM job_results WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM job_runs WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM ai_usage_logs WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM jobs WHERE id = ?", f.jobID)
		db.DB.Exec("DELETE FROM messages WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM conversations WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM channels WHERE id = ?", f.channelID)
		db.DB.Exec("DELETE FROM tenants WHERE id = ?", f.tenantID)
	})
	return f
}

func (f *reanalyzeFixture) loadJob(t *testing.T) models.Job {
	t.Helper()
	var job models.Job
	if err := db.DB.First(&job, "id = ?", f.jobID).Error; err != nil {
		t.Fatalf("khong doc duoc job: %v", err)
	}
	return job
}

func (f *reanalyzeFixture) evaluationCount(t *testing.T) int64 {
	t.Helper()
	var n int64
	db.DB.Model(&models.JobResult{}).
		Joins("JOIN job_runs ON job_runs.id = job_results.job_run_id").
		Where("job_runs.job_id = ? AND job_results.conversation_id = ? AND job_results.result_type = 'conversation_evaluation'", f.jobID, f.convID).
		Count(&n)
	return n
}

func summaryInt(t *testing.T, run *models.JobRun, key string) int {
	t.Helper()
	var s map[string]interface{}
	if err := json.Unmarshal([]byte(run.Summary), &s); err != nil {
		t.Fatalf("summary khong parse duoc: %v", err)
	}
	v, ok := s[key].(float64)
	if !ok {
		t.Fatalf("summary thieu khoa %s: %s", key, run.Summary)
	}
	return int(v)
}

// Cuộc chat không có tin nhắn mới thì lần chạy sau không được đánh giá lại.
// Đây là lỗi khiến cuộc chat cũ tích thêm một bản đánh giá trùng mỗi ngày.
func TestKhongDanhGiaLaiCuocChatCu(t *testing.T) {
	f := setupReanalyzeFixture(t)
	analyzer := NewAnalyzer(&config.Config{})
	provider := &alwaysFailProvider{}

	run1, err := analyzer.RunJobWithProvider(context.Background(), f.loadJob(t), 0, provider)
	if err != nil {
		t.Fatalf("lan chay 1 loi: %v", err)
	}
	if got := summaryInt(t, run1, "conversations_analyzed"); got != 1 {
		t.Fatalf("lan chay 1: cho 1 cuoc chat duoc phan tich, nhan %d", got)
	}
	if got := f.evaluationCount(t); got != 1 {
		t.Fatalf("lan chay 1: cho 1 ban danh gia, nhan %d", got)
	}

	// Kéo mốc quét lùi về trước tin nhắn cuối: mốc quét bị đóng băng thì cuộc chat
	// cũ lọt lại vào phạm vi quét mỗi ngày.
	db.DB.Exec("UPDATE jobs SET last_run_at = ? WHERE id = ?", time.Now().Add(-3*time.Hour), f.jobID)

	// Lần chạy thứ hai: không có tin nhắn mới → không được chọn lại
	run2, err := analyzer.RunJobWithProvider(context.Background(), f.loadJob(t), 0, provider)
	if err != nil {
		t.Fatalf("lan chay 2 loi: %v", err)
	}
	if got := summaryInt(t, run2, "conversations_found"); got != 0 {
		t.Errorf("lan chay 2: cho 0 cuoc chat duoc chon, nhan %d", got)
	}
	if got := f.evaluationCount(t); got != 1 {
		t.Errorf("lan chay 2: van phai la 1 ban danh gia, nhan %d", got)
	}
}

// Có tin nhắn mới sau lần đánh giá gần nhất thì phải được đánh giá lại.
func TestDanhGiaLaiKhiCoTinNhanMoi(t *testing.T) {
	f := setupReanalyzeFixture(t)
	analyzer := NewAnalyzer(&config.Config{})
	provider := &alwaysFailProvider{}

	if _, err := analyzer.RunJobWithProvider(context.Background(), f.loadJob(t), 0, provider); err != nil {
		t.Fatalf("lan chay 1 loi: %v", err)
	}

	newMsgAt := time.Now()
	db.DB.Exec(`INSERT INTO messages (id, tenant_id, conversation_id, external_message_id, sender_type, sender_name, content, sent_at, created_at) VALUES (?, ?, ?, 'm3', 'customer', 'Khach', 'Sao chua thay ai lien he', ?, NOW())`,
		pkg.NewUUID(), f.tenantID, f.convID, newMsgAt)
	db.DB.Exec(`UPDATE conversations SET last_message_at = ?, message_count = 3 WHERE id = ?`, newMsgAt, f.convID)

	run2, err := analyzer.RunJobWithProvider(context.Background(), f.loadJob(t), 0, provider)
	if err != nil {
		t.Fatalf("lan chay 2 loi: %v", err)
	}
	if got := summaryInt(t, run2, "conversations_analyzed"); got != 1 {
		t.Fatalf("lan chay 2: cho 1 cuoc chat duoc phan tich lai, nhan %d", got)
	}
	if got := f.evaluationCount(t); got != 2 {
		t.Errorf("lan chay 2: cho 2 ban danh gia, nhan %d", got)
	}
}

// Lần chạy bị cắt vì hết giờ phải ghi trạng thái partial và KHÔNG dời mốc quét,
// nếu không phần chưa xử lý bị bỏ qua vĩnh viễn.
func TestChayBiCatGhiPartialVaGiuMocQuet(t *testing.T) {
	f := setupReanalyzeFixture(t)
	analyzer := NewAnalyzer(&config.Config{})
	provider := &alwaysFailProvider{}

	jobTruoc := f.loadJob(t)
	if jobTruoc.LastRunAt != nil {
		t.Fatalf("job moi tao khong duoc co last_run_at")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // hết giờ ngay lập tức

	run, err := analyzer.RunJobWithProvider(ctx, jobTruoc, 0, provider)
	if err != nil {
		t.Fatalf("chay loi: %v", err)
	}
	if run.Status != "partial" {
		t.Errorf("cho trang thai 'partial', nhan '%s'", run.Status)
	}

	jobSau := f.loadJob(t)
	if jobSau.LastRunAt != nil {
		t.Errorf("mo quet khong duoc doi khi lan chay bi cat, nhan last_run_at=%v", jobSau.LastRunAt)
	}
	if jobSau.LastRunStatus != "partial" {
		t.Errorf("cho last_run_status 'partial', nhan '%s'", jobSau.LastRunStatus)
	}
	if got := f.evaluationCount(t); got != 0 {
		t.Errorf("khong duoc sinh ban danh gia nao, nhan %d", got)
	}
}

// Mỗi lượt chạy theo lịch phải đọc lại job từ DB. Bản sao capture lúc đăng ký cron
// giữ nguyên trạng thái cũ suốt vòng đời tiến trình — đúng lỗi làm mốc quét đóng băng.
func TestChayTheoLichDocLaiJobTuDB(t *testing.T) {
	f := setupReanalyzeFixture(t)
	s := &Scheduler{cfg: &config.Config{}}

	countRuns := func() int64 {
		var n int64
		db.DB.Model(&models.JobRun{}).Where("job_id = ?", f.jobID).Count(&n)
		return n
	}

	// Job đang bật: có lượt chạy được ghi nhận (dừng ở bước thiếu API key là đủ,
	// điều cần khẳng định là job đã được nạp và chạy).
	s.runScheduledJob(f.jobID, "QC Reanalyze")
	if got := countRuns(); got != 1 {
		t.Fatalf("job dang bat: cho 1 luot chay, nhan %d", got)
	}

	// Tắt job trong DB sau khi cron đã đăng ký: lượt sau phải bỏ qua.
	db.DB.Exec("UPDATE jobs SET is_active = false WHERE id = ?", f.jobID)
	s.runScheduledJob(f.jobID, "QC Reanalyze")
	if got := countRuns(); got != 1 {
		t.Errorf("job da tat: khong duoc chay them, tong luot chay %d", got)
	}

	// Job bị xoá: không được panic, không ghi thêm lượt chạy.
	db.DB.Exec("DELETE FROM jobs WHERE id = ?", f.jobID)
	s.runScheduledJob(f.jobID, "QC Reanalyze")
	if got := countRuns(); got != 1 {
		t.Errorf("job da xoa: khong duoc chay them, tong luot chay %d", got)
	}
}
