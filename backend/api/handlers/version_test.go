package handlers

import "testing"

func TestIsNewerVersion(t *testing.T) {
	cases := []struct {
		latest, current string
		want            bool
		ghi_chu         string
	}{
		{"v2026.09.15.6", "2026.09.15.5", true, "hậu tố lớn hơn"},
		{"v2026.09.15.5", "2026.09.15.6", false, "bản đang chạy mới hơn, không giục ngược"},
		{"v2026.09.15.6", "2026.09.15.6", false, "bằng nhau"},
		{"v2026.09.15.2", "2026.09.15", true, "bản đầu trong ngày tính là .1"},
		{"v2026.09.15", "2026.09.15.2", false, "ngược lại"},
		{"v2026.09.15", "2026.09.15", false, "bằng nhau, cùng không hậu tố"},
		{"v2026.10.01", "2026.09.15.9", true, "khác tháng"},
		{"v2027.01.01", "2026.12.31.3", true, "khác năm"},
		{"v2026.09.15.10", "2026.09.15.9", true, "so theo số, không theo chữ"},
		{"v2026.09.15.6", "dev", false, "bản dựng từ mã nguồn không bị giục"},
		{"", "2026.09.15.6", false, "không đọc được bản phát hành"},
		{"v2026.09", "2026.09.15", false, "chuỗi phiên bản sai định dạng"},
		{"v2026.09.15.x", "2026.09.15", false, "hậu tố không phải số"},
	}
	for _, c := range cases {
		if got := IsNewerVersion(c.latest, c.current); got != c.want {
			t.Errorf("IsNewerVersion(%q, %q) = %v, muốn %v — %s", c.latest, c.current, got, c.want, c.ghi_chu)
		}
	}
}
