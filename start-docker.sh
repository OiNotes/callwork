#!/bin/bash

# Скрипт запуска Callwork с Docker PostgreSQL
# Использование: ./start-docker.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "🐳 Запуск Callwork с Docker PostgreSQL..."
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен!${NC}"
    echo "Установите Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker найден"

# Подтянуть переменные из .env (если есть)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

if [ -z "${POSTGRES_PASSWORD}" ]; then
    echo -e "${RED}❌ POSTGRES_PASSWORD не задан (экспортируйте переменную или добавьте в .env)${NC}"
    exit 1
fi

if [ -z "${PGADMIN_DEFAULT_PASSWORD}" ]; then
    echo -e "${RED}❌ PGADMIN_DEFAULT_PASSWORD не задан (экспортируйте переменную или добавьте в .env)${NC}"
    exit 1
fi

# Запуск Docker Compose
echo ""
echo "📦 Запуск PostgreSQL контейнера..."
docker-compose up -d

# Ждем готовности PostgreSQL
echo ""
echo "⏳ Ожидание готовности PostgreSQL..."
sleep 5

# Проверка health
for i in {1..30}; do
    if docker-compose ps | grep -q "healthy"; then
        echo -e "${GREEN}✓${NC} PostgreSQL готов!"
        break
    fi
    echo -n "."
    sleep 1
done

# Применение миграций Prisma
echo ""
echo "🗄️  Применение схемы БД..."
npx prisma generate
npx prisma db push --skip-generate

echo ""
echo -e "${GREEN}✅ Docker PostgreSQL запущен!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Информация"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 PostgreSQL:"
echo "   Host: localhost:5432"
echo "   Database: callwork"
echo "   User: callwork_user"
echo "   Password: (set via POSTGRES_PASSWORD)"
echo ""
echo "🔧 pgAdmin:"
echo "   URL: http://localhost:5050"
echo "   Email: ${PGADMIN_DEFAULT_EMAIL:-admin@callwork.local}"
echo "   Password: (set via PGADMIN_DEFAULT_PASSWORD)"
echo ""
echo "Теперь запустите приложение:"
echo "  npm run dev          # Next.js"
echo "  npm run bot:dev      # Telegram Bot"
echo ""
echo "Остановка:"
echo "  docker-compose down"
echo ""
