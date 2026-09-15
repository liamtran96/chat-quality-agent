package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/vietbui/chat-quality-agent/ai/pricing"
	"github.com/vietbui/chat-quality-agent/api"
	"github.com/vietbui/chat-quality-agent/api/handlers"
	"github.com/vietbui/chat-quality-agent/api/middleware"
	"github.com/vietbui/chat-quality-agent/cli"
	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/engine"
	"github.com/vietbui/chat-quality-agent/storage"
	"github.com/vietbui/chat-quality-agent/storagecfg"
)

var version = "dev"

func main() {
	// Lệnh quản trị chạy trực tiếp trên server, không khởi động web server.
	if len(os.Args) > 1 {
		runCommand(os.Args[1], os.Args[2:])
		return
	}

	log.Printf("Chat Quality Agent %s", version)
	handlers.AppVersion = version

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize JWT
	middleware.SetJWTSecret(cfg.JWTSecret)

	// Connect database
	if err := db.Connect(cfg.DSN(), cfg.IsProduction()); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Nơi cất file đính kèm do từng công ty tự cấu hình trong giao diện, đọc
	// theo yêu cầu chứ không dựng sẵn một kho dùng chung.
	storage.SetConfigLoader(storagecfg.Loader(cfg))

	// Đồng bộ bảng giá model từ nguồn ngoài. Hỏng thì bảng tĩnh vẫn phục vụ.
	if cfg.PricingSyncEnabled {
		ctx, cancelPricing := context.WithCancel(context.Background())
		defer cancelPricing()
		pricing.StartSync(ctx, cfg.PricingSyncURL, cfg.PricingSyncInterval)
	} else {
		log.Printf("[pricing] đồng bộ giá đang tắt, dùng bảng tĩnh")
	}

	// Start scheduler
	scheduler, err := engine.NewScheduler(cfg)
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}
	engine.SetDefaultScheduler(scheduler)
	scheduler.Start()
	defer scheduler.Stop()

	// Setup router
	router := api.SetupRouter(cfg)

	// Start server
	log.Printf("CQA server starting on %s (env: %s)", cfg.ListenAddr(), cfg.Env)
	if err := router.Run(cfg.ListenAddr()); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// runCommand chạy một lệnh quản trị rồi thoát.
func runCommand(name string, args []string) {
	switch name {
	case "reset-password":
		if err := cli.ResetPassword(args); err != nil {
			fmt.Fprintf(os.Stderr, "Lỗi: %v\n", err)
			os.Exit(1)
		}
	case "migrate-files":
		if err := cli.MigrateFiles(args); err != nil {
			fmt.Fprintf(os.Stderr, "Lỗi: %v\n", err)
			os.Exit(1)
		}
	case "prune-duplicate-results":
		if err := cli.PruneDuplicateResults(args); err != nil {
			fmt.Fprintf(os.Stderr, "Lỗi: %v\n", err)
			os.Exit(1)
		}
	case "version":
		fmt.Println(version)
	default:
		fmt.Fprintf(os.Stderr, "Lệnh không hợp lệ: %s\n\n", name)
		fmt.Fprintln(os.Stderr, "Các lệnh có sẵn:")
		fmt.Fprintln(os.Stderr, "  reset-password [-email EMAIL]   Đặt lại mật khẩu một tài khoản")
		fmt.Fprintln(os.Stderr, "  prune-duplicate-results [-apply] Dọn bản đánh giá trùng, giữ lượt chạy mới nhất")
		fmt.Fprintln(os.Stderr, "  migrate-files [-apply]           Chuyển file đính kèm từ đĩa lên S3")
		fmt.Fprintln(os.Stderr, "  version                         In phiên bản")
		fmt.Fprintln(os.Stderr, "\nChạy không kèm lệnh để khởi động web server.")
		os.Exit(1)
	}
}
