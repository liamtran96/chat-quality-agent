package password

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestValidateComplexity(t *testing.T) {
	cases := []struct {
		name    string
		pw      string
		wantErr bool
	}{
		{"đủ điều kiện", "MatKhau123", false},
		{"ngắn hơn 8 ký tự", "Abc123", true},
		{"thiếu chữ hoa", "matkhau123", true},
		{"thiếu chữ số", "MatKhauDai", true},
		{"rỗng", "", true},
		{"đúng 8 ký tự", "Abcdefg1", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateComplexity(tc.pw)
			if tc.wantErr && err == nil {
				t.Fatalf("ValidateComplexity(%q) = nil, muốn có lỗi", tc.pw)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("ValidateComplexity(%q) = %v, muốn nil", tc.pw, err)
			}
		})
	}
}

func TestHash(t *testing.T) {
	const pw = "MatKhau123"
	h, err := Hash(pw)
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if !strings.HasPrefix(h, "$2a$") {
		t.Fatalf("hash = %q, muốn tiền tố $2a$", h)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(h), []byte(pw)); err != nil {
		t.Fatalf("hash không khớp mật khẩu gốc: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(h), []byte("SaiMatKhau1")); err == nil {
		t.Fatal("hash khớp cả mật khẩu sai")
	}
}

// Hash sinh từ htpasswd -bnBC 10 rồi đổi nhãn $2y sang $2a, đúng cách mà
// scripts/reset-password.sh làm cho bản cài cũ.
func TestHashTuHtpasswdVanDungDuoc(t *testing.T) {
	const (
		pw   = "TestDocs123"
		hash = "$2a$10$tgAl1DMdPVxACaG5QHI7GeAQQtomIIxDayOfulQXZhY6.RRouXEjm"
	)
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)); err != nil {
		t.Fatalf("hash từ htpasswd không dùng được: %v", err)
	}
}
