---
name: fix-errors
description: Автоматический анализ и исправление типовых ошибок (TypeScript errors, Prisma schema issues, dependency conflicts). Используй когда билд падает или тесты не проходят.
allowed-tools: Bash, Read, Edit, Grep
---

# Fix Errors Skill

Автоматическая диагностика и исправление частых ошибок в Callwork.

## Что делает

1. Анализирует TypeScript errors
2. Проверяет Prisma schema синхронизацию
3. Диагностирует dependency conflicts
4. Предлагает конкретные fix команды

## Типовые проблемы и решения

### 1. TypeScript Compilation Errors

**Симптомы:**
```bash
npm run build
# Error: Type 'string' is not assignable to type 'number'
```

**Диагностика:**
```bash
npx tsc --noEmit
```

**Частые причины:**
- Отсутствующие типы для импортов
- Decimal.js использован как Number
- Неправильные PropTypes в компонентах

**Fix:**
- Добавь explicit type annotations
- Используй `Decimal` вместо `number` для денег
- Проверь `tsconfig.json` strict mode

---

### 2. Prisma Client Outdated

**Симптомы:**
```bash
Error: PrismaClient is unable to run in the browser
Error: @prisma/client did not initialize yet
```

**Fix:**
```bash
npx prisma generate
```

Если не помогло:
```bash
rm -rf node_modules/.prisma
npm install
npx prisma generate
```

---

### 3. Prisma Schema Migration Issues

**Симптомы:**
```bash
Error: P2021: The table `Report` does not exist in the database
```

**Диагностика:**
```bash
npx prisma db pull  # Синхронизирует schema с реальной БД
```

**Fix (development):**
```bash
npx prisma db push  # Применяет schema изменения без миграции
```

**Fix (production):**
```bash
npx prisma migrate deploy  # Применяет pending миграции
```

---

### 4. Dependency Conflicts

**Симптомы:**
```bash
npm install
# ERESOLVE unable to resolve dependency tree
```

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

Или:
```bash
npm install --force
```

---

### 5. Port Already in Use

**Симптомы:**
```bash
npm run dev
# Error: Port 3000 is already in use
```

**Диагностика:**
```bash
lsof -i:3000
```

**Fix:**
```bash
# Убить процесс на порту 3000
kill -9 $(lsof -t -i:3000)

# Или использовать другой порт
PORT=3001 npm run dev
```

---

### 6. Environment Variables Missing

**Симптомы:**
```bash
Error: POSTGRES_URL is not defined
Error: NEXTAUTH_SECRET must be provided
```

**Fix:**
```bash
# Копируем example
cp .env.example .env

# Генерируем секрет
openssl rand -base64 32

# Заполняем .env:
# POSTGRES_URL=postgresql://...
# NEXTAUTH_SECRET=<generated>
# NEXTAUTH_URL=http://localhost:3000
```

---

### 7. Decimal.js Precision Errors

**Симптомы:**
```bash
Expected: 1000.00
Received: 999.9999999999
```

**Fix в коде:**
```typescript
// ❌ WRONG
const total = price + tax;

// ✅ CORRECT
import Decimal from 'decimal.js';
const total = new Decimal(price).plus(tax);
```

---

### 8. NextAuth Session Issues

**Симптомы:**
```bash
Error: [next-auth][error][SESSION_ERROR]
```

**Fix:**
```bash
# Проверь .env
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "NEXTAUTH_URL=http://localhost:3000" >> .env

# Перезапусти сервер
npm run dev
```

---

## Автоматическая диагностика

Запусти полную проверку:
```bash
echo "🔍 Диагностирую проблемы..."

# 1. TypeScript
npx tsc --noEmit || echo "❌ TypeScript errors найдены"

# 2. Prisma
npx prisma validate || echo "❌ Prisma schema некорректна"

# 3. Dependencies
npm list --depth=0 || echo "❌ Dependency conflicts"

# 4. Env vars
grep -q "POSTGRES_URL=" .env || echo "❌ POSTGRES_URL отсутствует"

# 5. Build test
npm run build || echo "❌ Build падает"
```

## Когда использовать

- Build или dev сервер не запускается
- Тесты падают с неожиданными ошибками
- После git merge с конфликтами
- После обновления dependencies
- При странных runtime ошибках

## Emergency Reset

Если ничего не помогает:
```bash
# ⚠️ NUCLEAR OPTION - удаляет ВСЁ и переустанавливает
rm -rf node_modules .next package-lock.json
npm install
npx prisma generate
npm run dev
```
