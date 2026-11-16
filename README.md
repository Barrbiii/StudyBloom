# StudyBloom 🌸

Студенческий планер. Начальный прототип: React + TypeScript, FastAPI, PostgreSQL, Docker Compose.

## Запуск на Linux

Установите Docker Engine и Docker Compose plugin. Затем из корня проекта:

```bash
docker compose up --build -d
```

Откройте http://localhost:5173 (интерфейс) и http://localhost:8000/docs (API).

Остановка: `docker compose down`.

## Текущий статус

Реализованы задачи, предметы и дедлайны с хранением в PostgreSQL. Календарь
показывает дедлайны на месяц и неделю, позволяет фильтровать по предмету и менять
название, дату и предмет дедлайна. Неделя начинается в понедельник.

Авторизация пока не реализована: данные общие. Расписание, события календаря,
Pomodoro, привычки и аналитика находятся в плане разработки.

План и фактический прогресс: [PROJECT_STATUS.md](PROJECT_STATUS.md).
Инструкция демонстрации: [docs/LINUX_DEMO.md](docs/LINUX_DEMO.md).

## Проверки

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cd backend
../.venv/bin/python -m pytest -q
cd ../frontend
npm ci
npm test
npm run build
```

Для frontend-тестов нужен Node.js 22.18+ (или Node.js 24).
GitHub Actions проверяет API, календарные вычисления, TypeScript и Docker build на Ubuntu.

## Доступ преподавателю

Для доступа с другого устройства в той же сети откройте `http://IP_НОУТБУКА:5173` и убедитесь, что брандмауэр разрешает порт 5173. Не публикуйте порт БД и не используйте демонстрационный пароль для публичного развёртывания.

## ИИ и коммиты

При использовании ИИ отмечайте фактически использованную модель в описании соответствующего коммита, `При разработке использована модель ИИ: OpenAI GPT-6.`.
