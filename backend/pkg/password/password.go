// Package password tập trung luật mật khẩu dùng chung cho cả API và CLI,
// để hai đường không bị lệch nhau.
package password

import (
	"fmt"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

// Luật độ mạnh: tối thiểu 8 ký tự, ít nhất 1 chữ hoa và 1 chữ số.
var (
	minLength = regexp.MustCompile(`^.{8,}$`)
	hasUpper  = regexp.MustCompile(`[A-Z]`)
	hasDigit  = regexp.MustCompile(`[0-9]`)
)

// ValidateComplexity kiểm tra độ mạnh mật khẩu.
func ValidateComplexity(pw string) error {
	if !minLength.MatchString(pw) {
		return fmt.Errorf("Mật khẩu phải có ít nhất 8 ký tự")
	}
	if !hasUpper.MatchString(pw) {
		return fmt.Errorf("Mật khẩu phải có ít nhất 1 chữ hoa")
	}
	if !hasDigit.MatchString(pw) {
		return fmt.Errorf("Mật khẩu phải có ít nhất 1 chữ số")
	}
	return nil
}

// Hash sinh bcrypt hash theo đúng cost mà API đang dùng.
func Hash(pw string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hashing password: %w", err)
	}
	return string(h), nil
}
