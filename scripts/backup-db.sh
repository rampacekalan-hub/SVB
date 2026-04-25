#!/bin/bash
#
# DomovPlus — denné zálohy PostgreSQL databázy.
#
# Použitie:
#   1. Nastavte environment premenné v ~/.domovplus-backup.env (alebo exportujte priamo):
#        DATABASE_URL=postgresql://user:pass@host:5432/dbname
#        BACKUP_DIR=/var/backups/domovplus     # default ./backups
#        BACKUP_RETENTION_DAYS=30              # zálohy staršie sa mažú (default 30)
#        S3_BACKUP_BUCKET=                     # voliteľné — nahrá aj do S3
#   2. Pridajte do crontab (kompletný cron skript):
#        crontab -e
#        0 3 * * *  /Users/alanrampacek/domov/scripts/backup-db.sh >> /var/log/domovplus-backup.log 2>&1
#
# Skript:
#   - vytvorí pg_dump (formát custom = .dump, kompresia úroveň 6)
#   - pomenuje súbor ISO timestampom (UTC)
#   - vymaže zálohy staršie ako BACKUP_RETENTION_DAYS dní
#   - voliteľne nahrá do S3 ak je nastavený S3_BACKUP_BUCKET (cez aws cli alebo mc)
#
# Test obnovy:
#   pg_restore --clean --no-owner -d <target_db> backup-2026-04-25T03-00-00Z.dump
#

set -euo pipefail

# Načítaj env file ak existuje
ENV_FILE="${HOME}/.domovplus-backup.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Defaults
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILENAME="domovplus-${TS}.dump"

# Sanity check
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL nie je nastavený. Skontrolujte ~/.domovplus-backup.env"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%FT%TZ)] Spúšťam zálohu → ${BACKUP_DIR}/${FILENAME}"

# Vytvor dump (custom format, compression 6 = balanced)
pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --file="${BACKUP_DIR}/${FILENAME}" \
  "$DATABASE_URL"

SIZE_HUMAN="$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"
echo "[$(date -u +%FT%TZ)] OK — záloha vytvorená (${SIZE_HUMAN})"

# Voliteľné: nahrať do S3 (ak je nastavené)
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[$(date -u +%FT%TZ)] Nahrávam do S3: ${S3_BACKUP_BUCKET}"
    aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${S3_BACKUP_BUCKET}/${FILENAME}" \
      --storage-class STANDARD_IA
    echo "[$(date -u +%FT%TZ)] OK — nahrané do S3"
  elif command -v mc >/dev/null 2>&1; then
    echo "[$(date -u +%FT%TZ)] Nahrávam cez mc: ${S3_BACKUP_BUCKET}"
    mc cp "${BACKUP_DIR}/${FILENAME}" "${S3_BACKUP_BUCKET}/${FILENAME}"
  else
    echo "[$(date -u +%FT%TZ)] WARN — S3_BACKUP_BUCKET je nastavený ale aws/mc nie je v PATH, preskočil som upload"
  fi
fi

# Vymaž staré zálohy (lokálne)
DELETED=$(find "$BACKUP_DIR" -name "domovplus-*.dump" -type f -mtime +"${BACKUP_RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
if [ "${DELETED:-0}" -gt 0 ]; then
  echo "[$(date -u +%FT%TZ)] Vymazaných ${DELETED} starých záloh (>${BACKUP_RETENTION_DAYS} dní)"
fi

echo "[$(date -u +%FT%TZ)] Hotovo."
