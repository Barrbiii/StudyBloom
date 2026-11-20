#!/usr/bin/env bash
# Безопасное обновление локального Docker-сервиса без удаления томов.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v git >/dev/null
command -v docker >/dev/null
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Обновление остановлено: есть локальные изменения. Сохраните их прежде, чем продолжить.' >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Обновление остановлено: переключитесь на main после сохранения своей работы.' >&2
  exit 1
fi
docker info >/dev/null
docker compose version >/dev/null
docker compose config --quiet
git fetch origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
  echo 'Обновление остановлено: локальная main расходится с origin/main. История не изменена.' >&2
  exit 1
fi
git merge --ff-only origin/main
docker compose up --build -d
docker compose ps
echo 'Сборка и запуск завершены. Откройте http://localhost:5173. Тома базы данных сохранены.'
