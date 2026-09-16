package handlers

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

func TestParseScore(t *testing.T) {
	cases := []struct {
		ten    string
		detail string
		muon   *float64
	}{
		{"khong co detail", "", nil},
		{"detail hong", "{khong phai json", nil},
		{"khong co khoa score", `{"summary":"abc"}`, nil},
		{"score la so", `{"score":88}`, ptrFloat(88)},
		{"score la chuoi", `{"score":"72.5"}`, ptrFloat(72.5)},
	}
	for _, c := range cases {
		t.Run(c.ten, func(t *testing.T) {
			got := parseScore(c.detail)
			if c.muon == nil {
				if got != nil {
					t.Fatalf("muon nil, nhan %v", *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("muon %v, nhan nil", *c.muon)
			}
			if *got != *c.muon {
				t.Fatalf("muon %v, nhan %v", *c.muon, *got)
			}
		})
	}
}

func ptrFloat(v float64) *float64 { return &v }

func TestSplitCSVParam(t *testing.T) {
	if got := splitCSVParam("  "); got != nil {
		t.Fatalf("chuoi rong phai tra nil, nhan %v", got)
	}
	got := splitCSVParam("a, b ,,c")
	if len(got) != 3 || got[0] != "a" || got[1] != "b" || got[2] != "c" {
		t.Fatalf("tach sai: %v", got)
	}
}

func TestVerdictLabel(t *testing.T) {
	if verdictLabel("PASS") != "Đạt" || verdictLabel("SKIP") != "Bỏ qua" || verdictLabel("NGHIEM_TRONG") != "Không đạt" {
		t.Fatal("nhãn kết quả sai")
	}
}

func TestJoinIssues(t *testing.T) {
	if joinIssues(nil) != "" {
		t.Fatal("khong co van de thi phai tra chuoi rong")
	}
	got := joinIssues([]issueRow{
		{RuleName: "Chào hỏi"},
		{RuleName: "Phản hồi", Evidence: "chậm 18 phút"},
	})
	if got != "Chào hỏi; Phản hồi: chậm 18 phút" {
		t.Fatalf("gộp vấn đề sai: %s", got)
	}
}

// resultsFixture dựng dữ liệu thật trong MySQL test: một tác vụ QC chạy hai lần
// trên cùng một cuộc chat, cộng thêm một cuộc chat bị bỏ qua.
type resultsFixture struct {
	tenantID  string
	channelID string
	convID    string
	conv2ID   string
	jobID     string
}

func setupResultsFixture(t *testing.T) *resultsFixture {
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

	f := &resultsFixture{
		tenantID:  "restest-" + pkg.NewUUID()[:8],
		channelID: "ch-restest-" + pkg.NewUUID()[:8],
		convID:    "conv-restest-" + pkg.NewUUID()[:8],
		conv2ID:   "conv2-restest-" + pkg.NewUUID()[:8],
		jobID:     "job-restest-" + pkg.NewUUID()[:8],
	}
	channelIDsJSON, _ := json.Marshal([]string{f.channelID})
	convAt := time.Now().Add(-48 * time.Hour)

	db.DB.Exec(`INSERT INTO tenants (id, name, slug, settings, created_at, updated_at) VALUES (?, ?, ?, '{}', NOW(), NOW())`,
		f.tenantID, "Results Test", f.tenantID)
	db.DB.Exec(`INSERT INTO channels (id, tenant_id, channel_type, name, external_id, credentials_encrypted, is_active, metadata, created_at, updated_at) VALUES (?, ?, 'zalo_oa', 'Kenh ket qua', 'fake', X'00', true, '{}', NOW(), NOW())`,
		f.channelID, f.tenantID)
	db.DB.Exec(`INSERT INTO conversations (id, tenant_id, channel_id, external_conversation_id, customer_name, last_message_at, message_count, metadata, created_at, updated_at) VALUES (?, ?, ?, 'ext-1', 'Khach Mot', ?, 2, '{}', NOW(), NOW())`,
		f.convID, f.tenantID, f.channelID, convAt)
	db.DB.Exec(`INSERT INTO conversations (id, tenant_id, channel_id, external_conversation_id, customer_name, last_message_at, message_count, metadata, created_at, updated_at) VALUES (?, ?, ?, 'ext-2', 'Khach Hai', ?, 1, '{}', NOW(), NOW())`,
		f.conv2ID, f.tenantID, f.channelID, convAt)
	db.DB.Exec(`INSERT INTO jobs (id, tenant_id, name, job_type, input_channel_ids, rules_content, rules_config, schedule_type, schedule_cron, is_active, outputs, output_schedule, created_at, updated_at) VALUES (?, ?, 'QC Ket qua', 'qc_analysis', ?, 'Quy tac', '[]', 'cron', '0 7 * * *', true, '[]', 'none', NOW(), NOW())`,
		f.jobID, f.tenantID, string(channelIDsJSON))

	// Lần chạy cũ: cuộc chat 1 bị đánh Không đạt
	runCu := "run-cu-" + pkg.NewUUID()[:8]
	runMoi := "run-moi-" + pkg.NewUUID()[:8]
	cu := time.Now().Add(-24 * time.Hour)
	moi := time.Now().Add(-1 * time.Hour)
	db.DB.Exec(`INSERT INTO job_runs (id, job_id, tenant_id, status, summary, started_at, created_at) VALUES (?, ?, ?, 'success', '{}', ?, ?)`,
		runCu, f.jobID, f.tenantID, cu, cu)
	db.DB.Exec(`INSERT INTO job_runs (id, job_id, tenant_id, status, summary, started_at, created_at) VALUES (?, ?, ?, 'success', '{}', ?, ?)`,
		runMoi, f.jobID, f.tenantID, moi, moi)

	themKetQua(f.tenantID, runCu, f.convID, "conversation_evaluation", "NGHIEM_TRONG", "", "Lan cu", `{"score":40}`, cu)
	themKetQua(f.tenantID, runCu, f.convID, "qc_violation", "NGHIEM_TRONG", "Chao hoi", "Khong chao", `{}`, cu)
	// Lần chạy mới: cùng cuộc chat nhưng đã Đạt
	themKetQua(f.tenantID, runMoi, f.convID, "conversation_evaluation", "PASS", "", "Lan moi", `{"score":90}`, moi)
	// Cuộc chat 2 bị bỏ qua
	themKetQua(f.tenantID, runMoi, f.conv2ID, "conversation_evaluation", "SKIP", "", "Chi co 1 tin nhan", `{}`, moi)

	t.Cleanup(func() {
		db.DB.Exec("DELETE FROM job_results WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM job_runs WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM jobs WHERE id = ?", f.jobID)
		db.DB.Exec("DELETE FROM conversations WHERE tenant_id = ?", f.tenantID)
		db.DB.Exec("DELETE FROM channels WHERE id = ?", f.channelID)
		db.DB.Exec("DELETE FROM tenants WHERE id = ?", f.tenantID)
	})
	return f
}

func themKetQua(tenantID, runID, convID, resultType, severity, ruleName, evidence, detail string, at time.Time) {
	db.DB.Create(&models.JobResult{
		ID:             pkg.NewUUID(),
		JobRunID:       runID,
		TenantID:       tenantID,
		ConversationID: convID,
		ResultType:     resultType,
		Severity:       severity,
		RuleName:       ruleName,
		Evidence:       evidence,
		Detail:         detail,
		Confidence:     1,
		CreatedAt:      at,
	})
}

func (f *resultsFixture) loc() resultFilter {
	return resultFilter{tenantID: f.tenantID, jobType: "qc_analysis", verdict: "all", dateField: "conv", sort: "recent"}
}

// Chạy lại tác vụ không được sinh ra dòng trùng: mỗi cuộc chat chỉ còn lần đánh giá mới nhất.
func TestFetchRowsChiLayLanDanhGiaMoiNhat(t *testing.T) {
	f := setupResultsFixture(t)

	rows, err := f.loc().fetchRows(50, 0)
	if err != nil {
		t.Fatalf("fetchRows loi: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("muon 2 cuoc chat, nhan %d", len(rows))
	}

	var conv1 *resultRow
	for i := range rows {
		if rows[i].ConversationID == f.convID {
			conv1 = &rows[i]
		}
	}
	if conv1 == nil {
		t.Fatal("khong thay cuoc chat 1")
	}
	if conv1.Severity != "PASS" {
		t.Fatalf("phai lay lan chay moi nhat (PASS), nhan %s", conv1.Severity)
	}
	if conv1.Score == nil || *conv1.Score != 90 {
		t.Fatalf("diem phai la 90 cua lan moi, nhan %v", conv1.Score)
	}
	// Vi phạm của lần chạy cũ không được dính sang kết quả mới
	if len(conv1.Issues) != 0 {
		t.Fatalf("lan chay moi khong co vi pham, nhan %d", len(conv1.Issues))
	}
}

func TestVerdictCountsVaLocTheoNhan(t *testing.T) {
	f := setupResultsFixture(t)

	counts, err := f.loc().verdictCounts()
	if err != nil {
		t.Fatalf("verdictCounts loi: %v", err)
	}
	if counts["all"] != 2 || counts["pass"] != 1 || counts["skip"] != 1 || counts["fail"] != 0 {
		t.Fatalf("dem sai: %v", counts)
	}

	locSkip := f.loc()
	locSkip.verdict = "skip"
	rows, err := locSkip.fetchRows(50, 0)
	if err != nil {
		t.Fatalf("fetchRows loi: %v", err)
	}
	if len(rows) != 1 || rows[0].ConversationID != f.conv2ID {
		t.Fatalf("loc Bo qua sai: %+v", rows)
	}
}

func TestLocTheoDiemVaTenKhach(t *testing.T) {
	f := setupResultsFixture(t)

	min80, max100 := 80.0, 100.0
	locDiem := f.loc()
	locDiem.scoreMin = &min80
	locDiem.scoreMax = &max100
	rows, err := locDiem.fetchRows(50, 0)
	if err != nil {
		t.Fatalf("fetchRows loi: %v", err)
	}
	if len(rows) != 1 || rows[0].ConversationID != f.convID {
		t.Fatalf("loc theo diem sai: %+v", rows)
	}

	locTen := f.loc()
	locTen.keyword = "Khach Hai"
	rows, err = locTen.fetchRows(50, 0)
	if err != nil {
		t.Fatalf("fetchRows loi: %v", err)
	}
	if len(rows) != 1 || rows[0].CustomerName != "Khach Hai" {
		t.Fatalf("tim theo ten sai: %+v", rows)
	}
}

// Công ty khác không được nhìn thấy kết quả của công ty này.
func TestKhongLoDuLieuSangCongTyKhac(t *testing.T) {
	f := setupResultsFixture(t)

	locKhac := f.loc()
	locKhac.tenantID = "cong-ty-khac-" + pkg.NewUUID()[:8]
	rows, err := locKhac.fetchRows(50, 0)
	if err != nil {
		t.Fatalf("fetchRows loi: %v", err)
	}
	if len(rows) != 0 {
		t.Fatalf("cong ty khac phai khong thay gi, nhan %d dong", len(rows))
	}
}
