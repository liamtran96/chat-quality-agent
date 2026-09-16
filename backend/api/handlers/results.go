package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/vietbui/chat-quality-agent/api/middleware"
	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Trang "Kết quả" gom kết quả của mọi tác vụ trong công ty. Khác với các endpoint
// theo từng tác vụ, ở đây lọc và phân trang đều chạy dưới database vì số bản ghi
// của cả công ty có thể lên vài chục nghìn.

const (
	resultsDefaultPageSize = 25
	resultsMaxPageSize     = 100
)

// resultFilter giữ toàn bộ điều kiện lọc đọc từ query string.
type resultFilter struct {
	tenantID   string
	jobType    string // qc_analysis | classification
	jobIDs     []string
	channelIDs []string
	verdict    string // all | pass | fail | skip | classified
	tags       []string
	dateField  string // conv (ngày hội thoại) | eval (ngày đánh giá)
	from       *time.Time
	to         *time.Time
	keyword    string
	scoreMin   *float64
	scoreMax   *float64
	sort       string // recent | score_asc | score_desc
}

// scoreExpr lấy điểm nằm trong cột JSON detail của bản ghi đánh giá.
const scoreExpr = `CAST(JSON_UNQUOTE(JSON_EXTRACT(jr.detail, '$.score')) AS DECIMAL(6,2))`

func parseResultFilter(c *gin.Context) resultFilter {
	f := resultFilter{
		tenantID:  middleware.GetTenantID(c),
		jobType:   c.DefaultQuery("job_type", "qc_analysis"),
		verdict:   c.DefaultQuery("verdict", "all"),
		dateField: c.DefaultQuery("date_field", "conv"),
		keyword:   strings.TrimSpace(c.Query("q")),
		sort:      c.DefaultQuery("sort", "recent"),
	}
	if f.jobType != "classification" {
		f.jobType = "qc_analysis"
	}
	if f.dateField != "eval" {
		f.dateField = "conv"
	}

	f.jobIDs = splitCSVParam(c.Query("job_ids"))
	f.channelIDs = splitCSVParam(c.Query("channel_ids"))
	f.tags = splitCSVParam(c.Query("tags"))

	if v := c.Query("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			f.from = &t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			end := t.Add(24*time.Hour - time.Second)
			f.to = &end
		}
	}
	if v := c.Query("score_min"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			f.scoreMin = &n
		}
	}
	if v := c.Query("score_max"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			f.scoreMax = &n
		}
	}
	return f
}

func splitCSVParam(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// baseQuery dựng truy vấn neo trên bản ghi conversation_evaluation — mỗi hội thoại
// đã xử lý luôn có đúng một bản ghi loại này, nên đếm và phân trang theo nó là
// đếm theo hội thoại. Bảng dẫn xuất "latest" giữ lại lần đánh giá mới nhất của
// mỗi cặp (hội thoại, tác vụ) để chạy lại tác vụ không sinh ra dòng trùng.
//
// withVerdict = false khi cần đếm số lượng của từng nhãn kết quả.
func (f resultFilter) baseQuery(withVerdict bool) *gorm.DB {
	q := db.DB.Table("job_results AS jr").
		Joins("JOIN job_runs r ON r.id = jr.job_run_id").
		Joins("JOIN jobs j ON j.id = r.job_id").
		Joins("JOIN conversations c ON c.id = jr.conversation_id").
		Joins(`JOIN (
			SELECT jr2.conversation_id AS cid, r2.job_id AS jid, MAX(jr2.created_at) AS mx
			FROM job_results jr2
			JOIN job_runs r2 ON r2.id = jr2.job_run_id
			WHERE jr2.tenant_id = ? AND jr2.result_type = 'conversation_evaluation'
			GROUP BY jr2.conversation_id, r2.job_id
		) latest ON latest.cid = jr.conversation_id AND latest.jid = r.job_id AND latest.mx = jr.created_at`, f.tenantID).
		Where("jr.tenant_id = ? AND jr.result_type = 'conversation_evaluation'", f.tenantID).
		Where("j.job_type = ?", f.jobType)

	if len(f.jobIDs) > 0 {
		q = q.Where("j.id IN ?", f.jobIDs)
	}
	if len(f.channelIDs) > 0 {
		q = q.Where("c.channel_id IN ?", f.channelIDs)
	}
	if f.keyword != "" {
		q = q.Where("c.customer_name LIKE ?", "%"+f.keyword+"%")
	}

	dateCol := "c.last_message_at"
	if f.dateField == "eval" {
		dateCol = "jr.created_at"
	}
	if f.from != nil {
		q = q.Where(dateCol+" >= ?", *f.from)
	}
	if f.to != nil {
		q = q.Where(dateCol+" <= ?", *f.to)
	}

	if f.scoreMin != nil {
		q = q.Where(scoreExpr+" >= ?", *f.scoreMin)
	}
	if f.scoreMax != nil {
		q = q.Where(scoreExpr+" <= ?", *f.scoreMax)
	}

	if len(f.tags) > 0 {
		q = q.Where(`EXISTS (
			SELECT 1 FROM job_results t
			WHERE t.conversation_id = jr.conversation_id
			  AND t.job_run_id = jr.job_run_id
			  AND t.result_type = 'classification_tag'
			  AND t.rule_name IN ?
		)`, f.tags)
	}

	if withVerdict {
		q = f.applyVerdict(q)
	}
	return q
}

func (f resultFilter) applyVerdict(q *gorm.DB) *gorm.DB {
	switch f.verdict {
	case "pass":
		return q.Where("jr.severity = ?", "PASS")
	case "fail":
		return q.Where("jr.severity NOT IN ?", []string{"PASS", "SKIP"})
	case "skip":
		return q.Where("jr.severity = ?", "SKIP")
	case "classified":
		return q.Where("jr.severity <> ?", "SKIP")
	default:
		return q
	}
}

func (f resultFilter) orderBy() string {
	switch f.sort {
	case "score_asc":
		return scoreExpr + " IS NULL, " + scoreExpr + " ASC, jr.created_at DESC"
	case "score_desc":
		return scoreExpr + " IS NULL, " + scoreExpr + " DESC, jr.created_at DESC"
	default:
		return "jr.created_at DESC"
	}
}

// resultRow là một hội thoại đã được đánh giá, kèm thông tin tác vụ và kênh.
type resultRow struct {
	ID             string     `json:"id"`
	ConversationID string     `json:"conversation_id"`
	JobRunID       string     `json:"job_run_id"`
	JobID          string     `json:"job_id"`
	JobName        string     `json:"job_name"`
	ChannelID      string     `json:"channel_id"`
	ChannelName    string     `json:"channel_name"`
	CustomerName   string     `json:"customer_name"`
	ConversationAt *time.Time `json:"conversation_at"`
	EvaluatedAt    time.Time  `json:"evaluated_at"`
	Severity       string     `json:"severity"`
	Review         string     `json:"review"`
	Detail         string     `json:"-"`
	Score          *float64   `gorm:"-" json:"score"`
	Issues         []issueRow `gorm:"-" json:"issues"`
	Tags           []string   `gorm:"-" json:"tags"`
}

type issueRow struct {
	RuleName string `json:"rule_name"`
	Evidence string `json:"evidence"`
	Severity string `json:"severity"`
}

const resultSelect = `jr.id, jr.conversation_id, jr.job_run_id, jr.severity, jr.evidence AS review,
	jr.detail, jr.created_at AS evaluated_at,
	j.id AS job_id, j.name AS job_name,
	c.channel_id, c.customer_name, c.last_message_at AS conversation_at,
	ch.name AS channel_name`

// fetchRows chạy truy vấn neo rồi nạp kèm vấn đề / nhãn của đúng những dòng lấy về.
func (f resultFilter) fetchRows(limit, offset int) ([]resultRow, error) {
	var rows []resultRow
	q := f.baseQuery(true).
		Joins("LEFT JOIN channels ch ON ch.id = c.channel_id").
		Select(resultSelect).
		Order(f.orderBy()).
		Limit(limit)
	if offset > 0 {
		q = q.Offset(offset)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("truy vấn kết quả: %w", err)
	}

	for i := range rows {
		rows[i].Score = parseScore(rows[i].Detail)
		rows[i].Issues = []issueRow{}
		rows[i].Tags = []string{}
	}
	if len(rows) == 0 {
		return rows, nil
	}

	runIDs := make([]string, 0, len(rows))
	convIDs := make([]string, 0, len(rows))
	idx := map[string]int{}
	for i, r := range rows {
		runIDs = append(runIDs, r.JobRunID)
		convIDs = append(convIDs, r.ConversationID)
		idx[r.JobRunID+"|"+r.ConversationID] = i
	}

	var details []models.JobResult
	if err := db.DB.
		Where("tenant_id = ? AND result_type <> ? AND job_run_id IN ? AND conversation_id IN ?",
			f.tenantID, "conversation_evaluation", runIDs, convIDs).
		Order("created_at ASC").
		Find(&details).Error; err != nil {
		return nil, fmt.Errorf("truy vấn chi tiết kết quả: %w", err)
	}

	for _, d := range details {
		i, ok := idx[d.JobRunID+"|"+d.ConversationID]
		if !ok {
			continue
		}
		if d.ResultType == "classification_tag" {
			rows[i].Tags = append(rows[i].Tags, d.RuleName)
			if d.Evidence != "" {
				rows[i].Issues = append(rows[i].Issues, issueRow{RuleName: d.RuleName, Evidence: d.Evidence, Severity: d.Severity})
			}
			continue
		}
		rows[i].Issues = append(rows[i].Issues, issueRow{RuleName: d.RuleName, Evidence: d.Evidence, Severity: d.Severity})
	}
	return rows, nil
}

func parseScore(detail string) *float64 {
	if detail == "" {
		return nil
	}
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(detail), &m); err != nil {
		return nil
	}
	v, ok := m["score"]
	if !ok {
		return nil
	}
	switch n := v.(type) {
	case float64:
		return &n
	case string:
		if parsed, err := strconv.ParseFloat(n, 64); err == nil {
			return &parsed
		}
	}
	return nil
}

// ListResults trả một trang kết quả kèm số lượng của từng nhãn theo bộ lọc hiện tại.
func ListResults(c *gin.Context) {
	f := parseResultFilter(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(resultsDefaultPageSize)))
	if pageSize < 1 || pageSize > resultsMaxPageSize {
		pageSize = resultsDefaultPageSize
	}

	var total int64
	if err := f.baseQuery(true).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}

	rows, err := f.fetchRows(pageSize, (page-1)*pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}

	counts, err := f.verdictCounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     rows,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"counts":    counts,
	})
}

// verdictCounts đếm theo từng nhãn kết quả, bỏ qua chính điều kiện nhãn đang chọn
// để các chip luôn hiện tổng số thật của bộ lọc còn lại.
func (f resultFilter) verdictCounts() (map[string]int64, error) {
	type row struct {
		Severity string
		Total    int64
	}
	var rows []row
	if err := f.baseQuery(false).
		Select("jr.severity AS severity, COUNT(*) AS total").
		Group("jr.severity").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	counts := map[string]int64{"all": 0, "pass": 0, "fail": 0, "skip": 0, "classified": 0}
	for _, r := range rows {
		counts["all"] += r.Total
		switch r.Severity {
		case "PASS":
			counts["pass"] += r.Total
			counts["classified"] += r.Total
		case "SKIP":
			counts["skip"] += r.Total
		default:
			counts["fail"] += r.Total
			counts["classified"] += r.Total
		}
	}
	return counts, nil
}

// ResultsFacets trả dữ liệu để dựng bộ lọc: công ty có những loại tác vụ nào,
// danh sách tác vụ, kênh và nhãn phân loại.
func ResultsFacets(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	type jobFacet struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		JobType string `json:"job_type"`
	}
	var jobs []jobFacet
	db.DB.Model(&models.Job{}).
		Select("id, name, job_type").
		Where("tenant_id = ?", tenantID).
		Order("name ASC").
		Find(&jobs)

	type channelFacet struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var channels []channelFacet
	db.DB.Model(&models.Channel{}).
		Select("id, name").
		Where("tenant_id = ?", tenantID).
		Order("name ASC").
		Find(&channels)

	var tags []string
	db.DB.Model(&models.JobResult{}).
		Where("tenant_id = ? AND result_type = ? AND rule_name <> ''", tenantID, "classification_tag").
		Distinct().
		Order("rule_name ASC").
		Pluck("rule_name", &tags)

	// Có job loại nào thì hiện tab loại đó, kể cả khi tác vụ chưa chạy lần nào —
	// ẩn đi sẽ khiến người dùng chạy xong không biết kết quả nằm ở đâu.
	types := map[string]map[string]int64{
		"qc_analysis":    {"jobs": 0, "results": 0},
		"classification": {"jobs": 0, "results": 0},
	}
	for _, j := range jobs {
		if _, ok := types[j.JobType]; ok {
			types[j.JobType]["jobs"]++
		}
	}
	for _, jobType := range []string{"qc_analysis", "classification"} {
		f := resultFilter{tenantID: tenantID, jobType: jobType, verdict: "all", dateField: "conv"}
		var n int64
		f.baseQuery(true).Count(&n)
		types[jobType]["results"] = n
	}

	if tags == nil {
		tags = []string{}
	}
	c.JSON(http.StatusOK, gin.H{
		"types":    types,
		"jobs":     jobs,
		"channels": channels,
		"tags":     tags,
	})
}

// ExportResults xuất đúng bộ lọc đang chọn ra CSV hoặc Excel.
func ExportResults(c *gin.Context) {
	f := parseResultFilter(c)
	format := c.DefaultQuery("format", "csv")

	limit := exportRowLimit()
	var total int64
	if err := f.baseQuery(true).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}
	if total > int64(limit) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "export_too_large",
			"limit": limit,
			"total": total,
		})
		return
	}

	rows, err := f.fetchRows(limit, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}

	isClassification := f.jobType == "classification"
	var headers []string
	if isClassification {
		headers = []string{"Khách hàng", "Nhãn", "Vấn đề", "Ngày hội thoại", "Ngày đánh giá", "Tác vụ", "Kênh"}
	} else {
		headers = []string{"Khách hàng", "Kết quả", "Điểm", "Vấn đề", "Nhận xét", "Ngày hội thoại", "Ngày đánh giá", "Tác vụ", "Kênh"}
	}

	records := make([][]string, 0, len(rows))
	for _, r := range rows {
		if isClassification {
			records = append(records, []string{
				r.CustomerName,
				strings.Join(r.Tags, "; "),
				joinIssues(r.Issues),
				formatResultTime(r.ConversationAt),
				formatResultTime(&r.EvaluatedAt),
				r.JobName,
				r.ChannelName,
			})
			continue
		}
		records = append(records, []string{
			r.CustomerName,
			verdictLabel(r.Severity),
			formatScore(r.Score),
			joinIssues(r.Issues),
			r.Review,
			formatResultTime(r.ConversationAt),
			formatResultTime(&r.EvaluatedAt),
			r.JobName,
			r.ChannelName,
		})
	}

	filename := "ket-qua"
	if isClassification {
		filename = "phan-loai"
	}

	if format == "xlsx" {
		writeResultsXLSX(c, filename, headers, records)
		return
	}
	writeResultsCSV(c, filename, headers, records)
}

// exportRowLimit là trần số dòng cho mỗi lần xuất file, đặt qua biến môi trường
// để tránh một lần xuất quá lớn làm nghẽn bộ nhớ máy chủ.
func exportRowLimit() int {
	cfg, err := config.Load()
	if err != nil || cfg.ExportMaxRows <= 0 {
		return config.DefaultExportMaxRows
	}
	return cfg.ExportMaxRows
}

func verdictLabel(severity string) string {
	switch severity {
	case "PASS":
		return "Đạt"
	case "SKIP":
		return "Bỏ qua"
	default:
		return "Không đạt"
	}
}

func formatScore(score *float64) string {
	if score == nil {
		return ""
	}
	return strconv.FormatFloat(*score, 'f', -1, 64)
}

func formatResultTime(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02 15:04")
}

func joinIssues(issues []issueRow) string {
	if len(issues) == 0 {
		return ""
	}
	parts := make([]string, 0, len(issues))
	for _, i := range issues {
		if i.Evidence == "" {
			parts = append(parts, i.RuleName)
			continue
		}
		parts = append(parts, i.RuleName+": "+i.Evidence)
	}
	return strings.Join(parts, "; ")
}

func writeResultsXLSX(c *gin.Context, filename string, headers []string, records [][]string) {
	f := excelize.NewFile()
	sheet := "Results"
	f.SetSheetName("Sheet1", sheet)
	for i, h := range headers {
		f.SetCellValue(sheet, cellName(i+1, 1), h)
	}
	for i, rec := range records {
		for j, v := range rec {
			f.SetCellValue(sheet, cellName(j+1, i+2), v)
		}
	}
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename="+filename+".xlsx")
	if err := f.Write(c.Writer); err != nil {
		log.Printf("[results] ghi file xlsx lỗi: %v", err)
	}
}

func writeResultsCSV(c *gin.Context, filename string, headers []string, records [][]string) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename+".csv")

	var b strings.Builder
	b.WriteString("\xEF\xBB\xBF")
	writeRow := func(cells []string) {
		quoted := make([]string, len(cells))
		for i, v := range cells {
			quoted[i] = `"` + strings.ReplaceAll(v, `"`, `""`) + `"`
		}
		b.WriteString(strings.Join(quoted, ","))
		b.WriteString("\n")
	}
	writeRow(headers)
	for _, rec := range records {
		writeRow(rec)
	}
	c.String(http.StatusOK, b.String())
}
