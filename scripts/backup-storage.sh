#!/bin/bash
#
# DomovPlus — denné zálohy storage adresára (PDF, fotky, dokumenty).
#
# Použitie (cron):
#   0 4 * * *  /opt/domovplus/scripts/backup-storage.sh >> /var/log/domovplus-backup.log 2>&1
#
# Env premenné (alebo v ~/.domovplus-backup.env):
#   STORAGE_DIR=/var/lib/domovplus/storage   # zdroj
#   STORAGE_BACKUP_DIR=/var/backups/domovplus-storage   # cieľ
#   STORAGE_RETENTION_DAYS=30
#   S3_BACKUP_BUCKET=                        # voliteľné — duplikát do S3
#

set -euo pipefail

ENV_FILE="${HOME}/.domovplus-backup.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${STORAGE_DIR:-${SCRIPT_DIR}/../apps/api/storage}"
DST="${STORAGE_BACKUP_DIR:-${SCRIPT_DIR}/../backups/storage}"
RET="${STORAGE_RETENTION_DAYS:-30}"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
ARCHIVE="${DST}/storage-${TS}.tar.gz"

if [ ! -d "$SRC" ]; then
  echo "[ERROR] Storage adresár nenájdený: $SRC"
  exit 1
fi

mkdir -p "$DST"

echo "[$(date -u +%FT%TZ)] Tar+gzip: $SRC → $ARCHIVE"
tar -czf "$ARCHIVE" -C "$(dirname "$SRC")" "$(basename "$SRC")"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "[$(date -u +%FT%TZ)] OK — záloha (${SIZE})"

if [ -n "${S3_BACKUP_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "[$(date -u +%FT%TZ)] Upload do S3: $S3_BACKUP_BUCKET"
  aws s3 cp "$ARCHIVE" "s3://${S3_BACKUP_BUCKET}/storage-${TS}.tar.gz" --storage-class STANDARD_IA
fi

DELETED=$(find "$DST" -name "storage-*.tar.gz" -type f -mtime +"$RET" -print -delete | wc -l | tr -d ' ')
[ "${DELETED:-0}" -gt 0 ] && echo "[$(date -u +%FT%TZ)] Vymazaných ${DELETED} starých záloh (>${RET} dní)"

echo "[$(date -u +%FT%TZ)] Hotovo."
