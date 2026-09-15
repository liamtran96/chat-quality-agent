#!/usr/bin/env bash
#
# Sao lưu toàn bộ database CQA, rồi TỰ KIỂM CHỨNG bản sao lưu bằng cách phục hồi
# thử sang một database tạm và đối chiếu số dòng từng bảng với bản đang chạy.
# Một file dump chưa phục hồi thử thì chưa gọi là bản sao lưu.
#
# Cách dùng, chạy trên server đang cài CQA:
#   bash backup-db.sh                  # sao lưu + kiểm chứng
#   bash backup-db.sh --no-verify      # chỉ dump, bỏ bước phục hồi thử
#   bash backup-db.sh --keep-verify    # giữ lại database tạm để tự xem
#
# Biến môi trường đổi được: ENV_FILE, BACKUP_DIR, DB_CONTAINER
#
# Script chỉ đọc dữ liệu đang chạy. Database tạm do chính nó tạo ra mới bị xoá,
# và chỉ khi tên khớp đúng mẫu cqa_verify_<dấu thời gian>.

set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/cqa/.env}
BACKUP_DIR=${BACKUP_DIR:-/opt/cqa/backups}
DB_CONTAINER=${DB_CONTAINER:-cqa-db}
VERIFY=1
KEEP_VERIFY=0

for arg in "$@"; do
  case "$arg" in
    --no-verify)   VERIFY=0 ;;
    --keep-verify) KEEP_VERIFY=1 ;;
    -h|--help)     sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Tham số không hiểu: $arg" >&2; exit 1 ;;
  esac
done

die() { echo "LỖI: $*" >&2; exit 1; }

[ -r "$ENV_FILE" ] || die "không đọc được $ENV_FILE"
docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q true \
  || die "container $DB_CONTAINER không chạy"

# shellcheck source=/dev/null
set -a; . "$ENV_FILE"; set +a
: "${DB_NAME:?thiếu DB_NAME trong $ENV_FILE}"
: "${MYSQL_ROOT_PASSWORD:?thiếu MYSQL_ROOT_PASSWORD trong $ENV_FILE}"

mysql_root() {
  docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" mysql -uroot --default-character-set=utf8mb4 "$@"
}

# --- Kiểm tra dung lượng đĩa trước khi làm gì ---------------------------------
DB_MB=$(mysql_root -N -e "SELECT COALESCE(ROUND(SUM(data_length+index_length)/1024/1024),0) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
mkdir -p "$BACKUP_DIR"
FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')
# Cần chỗ cho file dump và cho bản phục hồi thử, cộng biên an toàn.
NEED_MB=$(( DB_MB * 3 + 1024 ))
echo "Database   : $DB_NAME (${DB_MB} MB)"
echo "Đĩa trống  : ${FREE_MB} MB (cần ${NEED_MB} MB)"
[ "$FREE_MB" -ge "$NEED_MB" ] || die "không đủ đĩa trống"

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="$BACKUP_DIR/cqa-$STAMP.sql.gz"

# --- Đếm số dòng thật của bản đang chạy --------------------------------------
# Đếm COUNT(*) từng bảng, không lấy số ước lượng của information_schema.
TABLES=$(mysql_root -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE' ORDER BY table_name;")
[ -n "$TABLES" ] || die "database $DB_NAME không có bảng nào"

count_rows() { # $1 = tên database
  local schema="$1" sql=""
  for t in $TABLES; do
    sql="$sql SELECT '$t' AS t, COUNT(*) AS n FROM \`$schema\`.\`$t\` UNION ALL"
  done
  mysql_root -N -e "${sql% UNION ALL} ORDER BY t;"
}

echo
echo "Đang đếm số dòng bản đang chạy..."
LIVE_COUNTS=$(count_rows "$DB_NAME")
echo "$LIVE_COUNTS" | awk '{printf "  %-24s %10d\n", $1, $2}'

# --- Dump ---------------------------------------------------------------------
echo
echo "Đang sao lưu → $DUMP_FILE"
docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" "$DB_CONTAINER" \
  mysqldump -uroot --single-transaction --quick --routines --triggers --events \
            --hex-blob --default-character-set=utf8mb4 "$DB_NAME" \
  | gzip -6 > "$DUMP_FILE"

[ -s "$DUMP_FILE" ] || die "file sao lưu rỗng"
gzip -t "$DUMP_FILE" || die "file gzip hỏng"
chmod 600 "$DUMP_FILE"
SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "Xong: $DUMP_FILE ($SIZE), nén còn nguyên vẹn"

if [ "$VERIFY" -eq 0 ]; then
  echo
  echo "Bỏ qua bước phục hồi thử theo yêu cầu (--no-verify)."
  echo "Bản sao lưu này CHƯA được chứng minh là phục hồi được."
  exit 0
fi

# --- Phục hồi thử sang database tạm rồi đối chiếu ------------------------------
VERIFY_DB="cqa_verify_$STAMP"
case "$VERIFY_DB" in
  cqa_verify_[0-9]*) : ;;
  *) die "tên database tạm không hợp lệ: $VERIFY_DB" ;;
esac

echo
echo "Đang phục hồi thử sang $VERIFY_DB để kiểm chứng..."
mysql_root -e "CREATE DATABASE \`$VERIFY_DB\` CHARACTER SET utf8mb4;"

cleanup_verify() {
  if [ "$KEEP_VERIFY" -eq 1 ]; then
    echo "Giữ lại database tạm: $VERIFY_DB (xoá tay khi xong)"
    return
  fi
  case "$VERIFY_DB" in
    cqa_verify_[0-9]*) mysql_root -e "DROP DATABASE IF EXISTS \`$VERIFY_DB\`;" ;;
  esac
}
trap cleanup_verify EXIT

gunzip -c "$DUMP_FILE" | mysql_root "$VERIFY_DB"

VERIFY_COUNTS=$(count_rows "$VERIFY_DB")

echo
printf "  %-24s %10s %10s\n" "BẢNG" "ĐANG CHẠY" "PHỤC HỒI"
FAILED=0
while read -r name live; do
  [ -n "$name" ] || continue
  got=$(echo "$VERIFY_COUNTS" | awk -v n="$name" '$1==n{print $2}')
  got=${got:-thiếu}
  if [ "$got" = "$live" ]; then
    printf "  %-24s %10s %10s  ok\n" "$name" "$live" "$got"
  else
    printf "  %-24s %10s %10s  LỆCH\n" "$name" "$live" "$got"
    FAILED=1
  fi
done <<< "$LIVE_COUNTS"

echo
if [ "$FAILED" -ne 0 ]; then
  die "bản sao lưu KHÔNG khớp dữ liệu đang chạy — đừng xoá gì cho tới khi làm lại được bản sao lưu đúng"
fi
echo "Bản sao lưu đã phục hồi thử thành công, số dòng khớp từng bảng."
echo "File: $DUMP_FILE"
echo
echo "Phục hồi khi cần:"
echo "  gunzip -c $DUMP_FILE | docker exec -i $DB_CONTAINER mysql -uroot -p $DB_NAME"
