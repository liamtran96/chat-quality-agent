package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AppVersion is set from main.go at startup
var AppVersion = "dev"

const (
	githubReleasesURL = "https://api.github.com/repos/tanviet12/chat-quality-agent/releases/latest"
	cacheDuration     = 1 * time.Hour
)

var (
	versionCache     map[string]interface{}
	versionCacheTime time.Time
	versionCacheMu   sync.Mutex
)

// IsNewerVersion cho biết latest có mới hơn current thật không.
//
// Cố ý không so sánh chuỗi: chỉ cần khác nhau là báo có bản mới thì bản đang
// chạy mới hơn bản phát hành cuối (bản dựng tay, hoặc vừa phát hành xong mà
// GitHub chưa kịp cập nhật) cũng bị giục cập nhật ngược về bản cũ, và bản dựng
// từ mã nguồn với AppVersion "dev" thì bị giục vĩnh viễn.
//
// Phiên bản theo ngày: YYYY.MM.DD hoặc YYYY.MM.DD.N, bản đầu trong ngày không
// có hậu tố nên tính là N=1.
func IsNewerVersion(latest, current string) bool {
	l, okL := parseVersion(latest)
	c, okC := parseVersion(current)
	if !okL || !okC {
		return false
	}
	for i := 0; i < 4; i++ {
		if l[i] != c[i] {
			return l[i] > c[i]
		}
	}
	return false
}

func parseVersion(v string) ([4]int, bool) {
	var out [4]int
	out[3] = 1 // bản đầu trong ngày không có hậu tố

	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if v == "" {
		return out, false
	}
	parts := strings.Split(v, ".")
	if len(parts) < 3 || len(parts) > 4 {
		return out, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}

func CheckVersion(c *gin.Context) {
	versionCacheMu.Lock()
	if versionCache != nil && time.Since(versionCacheTime) < cacheDuration {
		cached := versionCache
		versionCacheMu.Unlock()
		c.JSON(http.StatusOK, cached)
		return
	}
	versionCacheMu.Unlock()

	// Fetch latest release from GitHub
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(githubReleasesURL)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"current":    AppVersion,
			"has_update": false,
			"error":      fmt.Sprintf("check failed: %v", err),
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"current":    AppVersion,
			"has_update": false,
		})
		return
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"current":    AppVersion,
			"has_update": false,
		})
		return
	}

	hasUpdate := IsNewerVersion(release.TagName, AppVersion)
	result := map[string]interface{}{
		"current":       AppVersion,
		"latest":        release.TagName,
		"has_update":    hasUpdate,
		"release_url":   release.HTMLURL,
		"release_notes": release.Body,
	}

	// Cache result
	versionCacheMu.Lock()
	versionCache = result
	versionCacheTime = time.Now()
	versionCacheMu.Unlock()

	c.JSON(http.StatusOK, result)
}
