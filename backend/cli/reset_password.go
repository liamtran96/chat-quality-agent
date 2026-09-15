// Package cli chứa các lệnh quản trị chạy trực tiếp trên server,
// không đi qua HTTP. Cố ý không có route nào gọi được vào đây.
package cli

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/term"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg/password"
)

// ResetPassword đặt lại mật khẩu một tài khoản từ dòng lệnh.
// Dùng khi admin duy nhất quên mật khẩu và không đăng nhập được để tự đổi.
//
// Mật khẩu chỉ nhận qua nhập tay (ẩn), không nhận qua tham số dòng lệnh
// để không lọt vào `ps aux`, history hay log.
func ResetPassword(args []string) error {
	fs := flag.NewFlagSet("reset-password", flag.ContinueOnError)
	email := fs.String("email", "", "email tài khoản cần đặt lại mật khẩu")
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

	// CLI không cần log SQL của GORM, kể cả dòng "record not found".
	gdb := db.DB.Session(&gorm.Session{Logger: logger.Discard})

	targetEmail := strings.TrimSpace(*email)
	if targetEmail == "" {
		targetEmail, err = promptEmail(gdb)
		if err != nil {
			return err
		}
	}

	var user models.User
	if err := gdb.Where("email = ?", targetEmail).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("không tìm thấy tài khoản: %s", targetEmail)
		}
		return fmt.Errorf("querying user: %w", err)
	}

	fmt.Printf("\nĐặt lại mật khẩu cho: %s (%s)\n", user.Email, user.Name)
	fmt.Println("Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số.")

	newPassword, err := promptPassword()
	if err != nil {
		return err
	}

	hash, err := password.Hash(newPassword)
	if err != nil {
		return err
	}

	// token_version tăng lên để thu hồi toàn bộ refresh token đang có hiệu lực,
	// giống đường reset qua API.
	result := gdb.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"password_hash": hash,
		"token_version": gorm.Expr("token_version + 1"),
		"updated_at":    time.Now(),
	})
	if result.Error != nil {
		return fmt.Errorf("updating password: %w", result.Error)
	}

	log.Printf("[security] password reset via CLI: user=%s email=%s", user.ID, user.Email)
	fmt.Printf("\nXong. Đăng nhập lại bằng %s với mật khẩu vừa đặt.\n", user.Email)
	fmt.Println("Các phiên đăng nhập cũ đã bị thu hồi.")
	return nil
}

// promptEmail liệt kê tài khoản hiện có rồi hỏi chọn một email.
func promptEmail(gdb *gorm.DB) (string, error) {
	var users []models.User
	if err := gdb.Order("is_admin DESC, created_at ASC").Find(&users).Error; err != nil {
		return "", fmt.Errorf("listing users: %w", err)
	}
	if len(users) == 0 {
		return "", errors.New("chưa có tài khoản nào — mở trang web để chạy thiết lập ban đầu")
	}

	fmt.Println("Tài khoản hiện có:")
	for _, u := range users {
		role := "thành viên"
		if u.IsAdmin {
			role = "quản trị"
		}
		fmt.Printf("  %-40s %-10s %s\n", u.Email, role, u.Name)
	}

	fmt.Print("\nEmail cần đặt lại mật khẩu: ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		return "", fmt.Errorf("reading email: %w", err)
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return "", errors.New("chưa nhập email")
	}
	return line, nil
}

// promptPassword đọc mật khẩu hai lần, ẩn khi gõ.
func promptPassword() (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errors.New("cần chạy ở chế độ tương tác — thêm -it vào lệnh docker exec")
	}

	fmt.Print("Mật khẩu mới: ")
	first, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", fmt.Errorf("reading password: %w", err)
	}

	fmt.Print("Nhập lại mật khẩu: ")
	second, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", fmt.Errorf("reading password confirmation: %w", err)
	}

	if string(first) != string(second) {
		return "", errors.New("hai lần nhập không khớp")
	}
	if err := password.ValidateComplexity(string(first)); err != nil {
		return "", err
	}
	return string(first), nil
}
