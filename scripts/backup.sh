#!/usr/bin/env bash
# Full private database dump; never overwrites a prior backup.
set -euo pipefail
umask 077
project_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${1:-$project_root/backups}"
mkdir -p -- "$backup_dir"
backup_dir="$(CDPATH= cd -- "$backup_dir" && pwd)"
backup_file="$(mktemp "$backup_dir/studybloom-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXXXX")"
backup_complete=false
cleanup() { if [ "$backup_complete" != true ]; then rm -f -- "$backup_file"; fi; }
trap cleanup EXIT
cd "$project_root"
docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$backup_file"
test -s "$backup_file"
docker compose exec -T db pg_restore --list < "$backup_file" > /dev/null
backup_complete=true
printf '%s\n' "$backup_file"
