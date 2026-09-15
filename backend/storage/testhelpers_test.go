package storage

import (
	"context"
	"errors"
	"io"
	"strings"
)

func stringReader(s string) io.Reader { return strings.NewReader(s) }

// memStoreHong giả lập nơi cất file đang hỏng: ghi vào là báo lỗi.
type memStoreHong struct{ *memStore }

func (m *memStoreHong) Put(context.Context, string, io.Reader, int64, string) error {
	return errors.New("nơi cất file đang hỏng")
}
