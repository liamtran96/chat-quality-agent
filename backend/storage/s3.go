package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// s3Store cất file trên dịch vụ tương thích S3: AWS S3, Cloudflare R2,
// DigitalOcean Spaces, MinIO, hay dịch vụ trong nước.
type s3Store struct {
	client *minio.Client
	bucket string
	prefix string
}

// NewS3 dựng store S3. Thiếu tham số bắt buộc thì báo lỗi ngay lúc khởi động
// chứ không để đến lúc đồng bộ mới hỏng.
func NewS3(cfg Config) (Store, error) {
	missing := []string{}
	if cfg.S3Endpoint == "" {
		missing = append(missing, "S3_ENDPOINT")
	}
	if cfg.S3Bucket == "" {
		missing = append(missing, "S3_BUCKET")
	}
	if cfg.S3AccessKey == "" {
		missing = append(missing, "S3_ACCESS_KEY")
	}
	if cfg.S3SecretKey == "" {
		missing = append(missing, "S3_SECRET_KEY")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("storage: STORAGE_BACKEND=s3 nhưng thiếu %s", strings.Join(missing, ", "))
	}

	endpoint := cfg.S3Endpoint
	secure := true
	if strings.Contains(endpoint, "://") {
		u, err := url.Parse(endpoint)
		if err != nil {
			return nil, fmt.Errorf("storage: S3_ENDPOINT không hợp lệ: %w", err)
		}
		secure = u.Scheme != "http"
		endpoint = u.Host
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(cfg.S3AccessKey, cfg.S3SecretKey, ""),
		Secure:       secure,
		Region:       cfg.S3Region,
		BucketLookup: bucketLookup(cfg.S3ForcePathStyle),
		Transport: &http.Transport{
			ResponseHeaderTimeout: 30 * time.Second,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("storage: không tạo được client S3: %w", err)
	}

	return &s3Store{
		client: client,
		bucket: cfg.S3Bucket,
		prefix: strings.Trim(cfg.S3Prefix, "/"),
	}, nil
}

func bucketLookup(forcePathStyle bool) minio.BucketLookupType {
	if forcePathStyle {
		return minio.BucketLookupPath
	}
	return minio.BucketLookupAuto
}

func (s *s3Store) Kind() string { return "s3" }

func (s *s3Store) objectName(key string) (string, error) {
	if err := validKey(key); err != nil {
		return "", err
	}
	if s.prefix == "" {
		return key, nil
	}
	return s.prefix + "/" + key, nil
}

func (s *s3Store) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	name, err := s.objectName(key)
	if err != nil {
		return err
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	_, err = s.client.PutObject(ctx, s.bucket, name, r, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

func (s *s3Store) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	name, err := s.objectName(key)
	if err != nil {
		return nil, "", 0, err
	}
	obj, err := s.client.GetObject(ctx, s.bucket, name, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", 0, translateErr(err)
	}
	// GetObject trả về lazily, phải Stat mới biết file có thật hay không.
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, "", 0, translateErr(err)
	}
	ct := info.ContentType
	if ct == "" {
		ct = "application/octet-stream"
	}
	return obj, ct, info.Size, nil
}

func (s *s3Store) Exists(ctx context.Context, key string) (bool, error) {
	name, err := s.objectName(key)
	if err != nil {
		return false, err
	}
	_, err = s.client.StatObject(ctx, s.bucket, name, minio.StatObjectOptions{})
	if err != nil {
		if errors.Is(translateErr(err), ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Stat cho biết dung lượng object, lệnh chuyển file dùng để đối chiếu.
func (s *s3Store) Stat(ctx context.Context, key string) (int64, error) {
	name, err := s.objectName(key)
	if err != nil {
		return 0, err
	}
	info, err := s.client.StatObject(ctx, s.bucket, name, minio.StatObjectOptions{})
	if err != nil {
		return 0, translateErr(err)
	}
	return info.Size, nil
}

func (s *s3Store) List(ctx context.Context, prefix string, fn func(key string, size int64) error) error {
	full := prefix
	if s.prefix != "" {
		full = s.prefix + "/" + prefix
	}
	for obj := range s.client.ListObjects(ctx, s.bucket, minio.ListObjectsOptions{Prefix: full, Recursive: true}) {
		if obj.Err != nil {
			return translateErr(obj.Err)
		}
		key := obj.Key
		if s.prefix != "" {
			key = strings.TrimPrefix(key, s.prefix+"/")
		}
		// Bỏ qua file do phép kiểm tra kết nối để lại, nếu có sót.
		if strings.HasPrefix(key, "__cqa_kiem_tra/") {
			continue
		}
		if err := fn(key, obj.Size); err != nil {
			return err
		}
	}
	return nil
}

func (s *s3Store) Delete(ctx context.Context, key string) error {
	name, err := s.objectName(key)
	if err != nil {
		return err
	}
	return s.client.RemoveObject(ctx, s.bucket, name, minio.RemoveObjectOptions{})
}

// translateErr đổi lỗi "không có object" của S3 thành ErrNotFound để phía gọi
// chỉ phải biết một loại lỗi.
func translateErr(err error) error {
	if err == nil {
		return nil
	}
	resp := minio.ToErrorResponse(err)
	switch resp.Code {
	case "NoSuchKey", "NotFound", "NoSuchBucket":
		return ErrNotFound
	}
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	return err
}
