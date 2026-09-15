#!/usr/bin/env bash
#
# Đặt lại mật khẩu một tài khoản CQA khi không đăng nhập được.
#
# Cách dùng, chạy trên chính server đang cài CQA:
#   bash reset-password.sh
#   bash reset-password.sh -e admin@example.com
#
# Bản CQA từ v2026.09.15 đã có sẵn lệnh này trong ứng dụng:
#   docker exec -it cqa-app /app/cqa-server reset-password
# Script sẽ tự dùng đường đó nếu có, và chỉ tự xử lý khi bản cài còn cũ.
#
# Mật khẩu chỉ nhập tay, không nhận qua tham số dòng lệnh, để không lọt vào
# lịch sử shell hay danh sách tiến trình.

set -euo pipefail

APP_CONTAINER="cqa-app"
DB_CONTAINER="cqa-db"
HASH_IMAGE="httpd:alpine"

TARGET_EMAIL=""
while getopts ":e:h" opt; do
  case "$opt" in
    e) TARGET_EMAIL="$OPTARG" ;;
    h) sed -n '3,15p' "$0"; exit 0 ;;
    \?) echo "Tham số không hợp lệ: -$OPTARG" >&2; exit 1 ;;
    :) echo "Thiếu giá trị cho -$OPTARG" >&2; exit 1 ;;
  esac
done

die() { echo "Lỗi: $*" >&2; exit 1; }

# --- Kiểm tra điều kiện chạy ---

command -v docker >/dev/null 2>&1 || die "không tìm thấy docker"

if ! docker info >/dev/null 2>&1; then
  die "không truy cập được Docker. Chạy bằng root, hoặc bằng tài khoản thuộc nhóm docker."
fi

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || die "không thấy container $DB_CONTAINER. Chạy script này trên server đang cài CQA."

# --- Nếu ứng dụng đã có sẵn lệnh reset-password thì dùng luôn ---

if docker inspect "$APP_CONTAINER" >/dev/null 2>&1 &&
   docker exec "$APP_CONTAINER" /app/cqa-server bogus-check 2>&1 | grep -q "reset-password"; then
  echo "Bản cài đã có sẵn lệnh reset-password, chuyển sang dùng lệnh đó."
  echo
  if [ -n "$TARGET_EMAIL" ]; then
    exec docker exec -it "$APP_CONTAINER" /app/cqa-server reset-password -email "$TARGET_EMAIL"
  fi
  exec docker exec -it "$APP_CONTAINER" /app/cqa-server reset-password
fi

# --- Bản cài cũ: tự xử lý ---

mysql_do() {
  docker exec -e CQA_SQL="$1" "$DB_CONTAINER" \
    sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -N -B -e "$CQA_SQL"' 2>/dev/null
}

if [ -z "$TARGET_EMAIL" ]; then
  echo "Tài khoản hiện có:"
  mysql_do "SELECT email, IF(is_admin, 'quản trị', 'thành viên'), name FROM users ORDER BY is_admin DESC, created_at ASC" |
    while IFS=$'\t' read -r email role name; do
      printf '  %-40s %s (%s)\n' "$email" "$name" "$role"
    done
  echo
  read -r -p "Email cần đặt lại mật khẩu: " TARGET_EMAIL
fi

[ -n "$TARGET_EMAIL" ] || die "chưa nhập email"

# Chặn ký tự có thể phá câu lệnh SQL bên dưới.
if ! printf '%s' "$TARGET_EMAIL" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  die "email không hợp lệ: $TARGET_EMAIL"
fi

FOUND=$(mysql_do "SELECT COUNT(*) FROM users WHERE email = '$TARGET_EMAIL'")
[ "$FOUND" = "1" ] || die "không tìm thấy tài khoản: $TARGET_EMAIL"

echo
echo "Đặt lại mật khẩu cho: $TARGET_EMAIL"
echo "Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số."

read -r -s -p "Mật khẩu mới: " NEW_PASSWORD; echo
read -r -s -p "Nhập lại mật khẩu: " CONFIRM_PASSWORD; echo

[ "$NEW_PASSWORD" = "$CONFIRM_PASSWORD" ] || die "hai lần nhập không khớp"
[ "${#NEW_PASSWORD}" -ge 8 ] || die "mật khẩu phải có ít nhất 8 ký tự"
printf '%s' "$NEW_PASSWORD" | grep -q '[A-Z]' || die "mật khẩu phải có ít nhất 1 chữ hoa"
printf '%s' "$NEW_PASSWORD" | grep -q '[0-9]' || die "mật khẩu phải có ít nhất 1 chữ số"

# bcrypt cost 10, đổi nhãn $2y sang $2a cho khớp thư viện phía ứng dụng.
HASH=$(docker run --rm "$HASH_IMAGE" htpasswd -bnBC 10 "" "$NEW_PASSWORD" 2>/dev/null | tr -d ':\n' | sed 's/^\$2y/\$2a/')
printf '%s' "$HASH" | grep -qE '^\$2a\$10\$.{53}$' || die "sinh mật khẩu mã hoá thất bại"

# token_version tăng lên để thu hồi các phiên đăng nhập cũ.
mysql_do "UPDATE users SET password_hash = '$HASH', token_version = token_version + 1, updated_at = NOW() WHERE email = '$TARGET_EMAIL'" >/dev/null

echo
echo "Xong. Đăng nhập lại bằng $TARGET_EMAIL với mật khẩu vừa đặt."
echo "Các phiên đăng nhập cũ đã bị thu hồi."
