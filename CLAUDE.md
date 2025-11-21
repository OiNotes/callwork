# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚀 Быстрая справка

### Субагенты (автоматически активируются)
- **financial-developer** → "Добавь новую фичу"
- **financial-bug-fixer** → "Исправь баг"
- **financial-architect** → "Спроектируй API"

### Skills (используй командами)
- **quick-start** → "Запусти проект"
- **health-check** → "Проверь систему"
- **run-tests** → "Запусти тесты"
- **validate-finances** → "Проверь финансы"
- **db-query** → "Открой Prisma Studio"
- **fix-errors** → "Исправь ошибки"

📖 Подробнее: см. разделы "Financial Coding Agents" и "Skills" ниже

---

## Project Overview

Callwork - Call Center Analytics System для учёта статистики и продаж call-центра. Включает веб-дашборд (Next.js) и Telegram бота для сбора отчётов от сотрудников.

**Tech Stack:**
- Next.js 16.0.3 (App Router), React 19, TypeScript
- Prisma ORM + PostgreSQL (Vercel Postgres)
- NextAuth.js (JWT auth)
- Telegram Bot API (node-telegram-bot-api)
- Decimal.js для финансовых расчётов
- Tailwind CSS v4, shadcn/ui, Framer Motion

---

## Development Commands

### Running the application
```bash
# Development (Next.js web app)
npm run dev

# Development (Telegram bot)
npm run bot:dev

# Build for production
npm run build

# Start production server
npm start
```

### Database
```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to DB
npx prisma db push

# Open Prisma Studio (DB GUI)
npx prisma studio

# Run seed script
npm run seed:tv
```

### Testing & Validation
```bash
# Lint code
npm run lint

# Type checking
npx tsc --noEmit

# Test analytics
npm run test:analytics

# Validate financial data
npx tsx scripts/validate-financial-data.ts
npx tsx scripts/validate-financial-data.ts --detailed

# Analyze sales funnel health
npx tsx scripts/analyze-funnel-health.ts
npx tsx scripts/analyze-funnel-health.ts --detailed
npx tsx scripts/analyze-funnel-health.ts --critical-only

# Sync team goals
npx tsx scripts/sync-team-goals.ts --validate
npx tsx scripts/sync-team-goals.ts --manager="id" --distribute
npx tsx scripts/sync-team-goals.ts --user="id" --goal=3000000
```

---

## Architecture Overview

### Core Financial Principles

**CRITICAL:** All monetary calculations MUST use Decimal.js, never JavaScript Number due to floating-point precision errors.

```typescript
// ✅ CORRECT
import Decimal from 'decimal.js';
const total = new Decimal(price).plus(tax);

// ❌ WRONG - will cause precision errors
const total = price + tax;
```

### Single Source of Truth Pattern

**GoalService** (`lib/services/GoalService.ts`) is the ONLY source for sales goals. Never query `User.monthlyGoal` directly:

```typescript
// ✅ CORRECT
import { GoalService } from '@/lib/services/GoalService';
const goal = await GoalService.getUserGoal(userId);
const teamGoal = await GoalService.getTeamGoal(managerId);

// ❌ WRONG
const goal = await prisma.user.findUnique({ where: { id } });
```

**Key invariant:** Team goal = Manager goal + Sum of all active employees' goals

### Sales Funnel System

6-stage funnel with defined conversion benchmarks (`lib/config/conversionBenchmarks.ts`):

1. **Zoom Booked** (Entry point)
2. **Zoom 1 Held** → 60% benchmark (Booked → Zoom1)
3. **Zoom 2 Held** → 50% benchmark (Zoom1 → Zoom2)
4. **Contract Review** → 40% benchmark (Zoom2 → Contract)
5. **Push** (Follow-up) → 60% benchmark (Contract → Push)
6. **Deal** (Payment) → 70% benchmark (Push → Deal)

**North Star KPI:** 5% conversion from Zoom 1 → Deal

### Database Models (Prisma)

Key fields with specific requirements:

**User:**
- `monthlyGoal`: Decimal (nullable) - monthly sales target
- `isActive`: Boolean - only active users count in team metrics
- `role`: EMPLOYEE | MANAGER - determines data visibility
- Managers have `employees: User[]` relation

**Report:**
- All monetary fields use `Decimal @db.Decimal(12, 2)`
- `@@unique([userId, date])` - one report per user per day
- Field mappings (historical rename):
  - `zoomAppointments` (was `pzmScheduled`)
  - `pzmConducted` → Zoom 1
  - `vzmConducted` → Zoom 2
  - `contractReviewCount` (was `contractReview`)
  - `successfulDeals` (was `dealsClosed`)
  - `monthlySalesAmount` (was `salesAmount`)

**Deal:**
- `budget`: Decimal - deal value
- `status`: OPEN | WON | LOST
- `paymentStatus`: UNPAID | PARTIAL | PAID
- `isFocus`: Boolean - marks priority deals

### API Structure

All API routes are in `app/api/`:
- `/auth/*` - NextAuth + registration
- `/reports/*` - CRUD for daily reports
- `/statistics/*` - Aggregated metrics
- `/users/*` - Employee listings (MANAGER only)
- `/telegram/*` - Bot integration (code generation)

**Authorization pattern:**
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// Managers see all employees' data
const userId = session.user.role === 'MANAGER'
  ? req.nextUrl.searchParams.get('userId')
  : session.user.id;
```

### Telegram Bot Architecture

**State machine** using Map-based sessions (`bot/index.ts`):
- `/start` - Welcome message
- `/register <code>` - Link Telegram account to web user
- `/report` - 11-step wizard to collect daily report data

Bot runs in **polling mode** (not webhooks) with `node-telegram-bot-api`.

---

## Financial Coding Agents (Субагенты)

**Что такое субагенты?** Это специализированные AI помощники, которые автоматически активируются при определённых задачах. Они работают в фоне и помогают писать правильный код.

**Расположение:** `.claude/agents/`

### 1. Financial Code Developer (`financial-developer.md`)
**Когда активируется:** Автоматически при создании новых финансовых фич

- **Use for:** New financial features, components, API endpoints
- **Capabilities:** TDD (tests-first), Decimal.js, Zod validation
- **Tools:** Read, Write, Edit, Bash, Grep, Glob
- **Model:** Claude Sonnet

**Примеры активации:**
```
"Добавь новый API endpoint для расчёта бонусов"
"Создай компонент для отображения прогресса к цели"
"Реализуй функцию валидации финансовых отчётов"
```

### 2. Financial Bug Fixer (`financial-bug-fixer.md`)
**Когда активируется:** Автоматически при падении тестов или багах

- **Use for:** Test failures, calculation errors, currency mismatches
- **Capabilities:** Diagnostic analysis, minimal surgical fixes
- **Tools:** Read, Edit, Bash, Grep, Glob
- **Model:** Claude Sonnet

**Примеры активации:**
```
"Тесты падают, исправь"
"Баг в калькуляции воронки продаж"
"Precision error в Decimal расчётах"
```

### 3. Financial Architect (`financial-architect.md`)
**Когда активируется:** Автоматически при проектировании систем

- **Use for:** System design, API contracts, refactoring plans
- **Capabilities:** ADR creation, trade-off analysis, read-only
- **Tools:** Read, Grep, Glob, WebSearch, WebFetch
- **Model:** Claude Sonnet

**Примеры активации:**
```
"Спроектируй новый API для управления целями"
"Как лучше организовать архитектуру отчётов?"
"Создай ADR для выбора подхода к мультивалютности"
```

**Agents are proactive** - they activate automatically based on request context. See `.claude/agents/README.md` for detailed usage.

---

## Skills - Готовые сценарии автоматизации

**Что такое skills?** Это готовые скрипты для типовых задач (запуск проекта, тесты, проверки). Они выполняются одной командой вместо набора ручных действий.

**Расположение:** `.claude/skills/`

### Доступные Skills:

#### 🚀 Development Skills

**`quick-start`** - Быстрый запуск проекта
```bash
# Что делает:
# 1. Проверяет node_modules
# 2. Устанавливает зависимости если нужно
# 3. Генерирует Prisma Client
# 4. Запускает dev сервер

# Как использовать:
"Запусти проект"
"Quick start"
```

**`health-check`** - Проверка состояния системы
```bash
# Что проверяет:
# - .env файл и переменные окружения
# - Подключение к PostgreSQL
# - Статус Next.js сервера
# - Prisma Client актуальность
# - TypeScript компиляция

# Как использовать:
"Проверь health системы"
"Всё ли работает?"
```

**`fix-errors`** - Автоматическое исправление ошибок
```bash
# Что исправляет:
# - TypeScript compilation errors
# - Prisma schema sync issues
# - Dependency conflicts
# - Port conflicts
# - Missing env variables

# Как использовать:
"Исправь ошибки билда"
"Что-то сломалось, помоги"
```

#### 🧪 Testing & Validation Skills

**`run-tests`** - Запуск всех тестов
```bash
# Что запускает:
# - TypeScript type checking
# - Analytics tests
# - ESLint validation

# Как использовать:
"Запусти тесты"
"Проверь перед коммитом"
```

**`validate-finances`** - Валидация финансовых данных
```bash
# Что проверяет:
# - Decimal precision (точность расчётов)
# - Team goals sync (консистентность целей)
# - Funnel health (здоровье воронки)
# - Data integrity (целостность данных)

# Как использовать:
"Проверь финансовые данные"
"Валидируй цели команды"
```

#### 🗄️ Database Skills

**`db-query`** - SQL запросы к PostgreSQL
```bash
# Что делает:
# - Открывает Prisma Studio (GUI)
# - Позволяет выполнять SQL запросы
# - Показывает данные в удобном формате

# Как использовать:
"Открой Prisma Studio"
"Покажи активных пользователей"
"Какие открытые сделки?"
```

### Как работают Skills

**Автоматическая активация:**
Claude Code автоматически выбирает нужный skill на основе твоего запроса.

**Примеры:**
```
Ты: "Запусти проект"
→ Claude использует quick-start skill

Ты: "Проверь всё ли работает"
→ Claude использует health-check skill

Ты: "Запусти тесты"
→ Claude использует run-tests skill

Ты: "Проверь финансовые данные"
→ Claude использует validate-finances skill
```

**Явный вызов:**
Можно явно попросить использовать конкретный skill:
```
"Используй skill health-check"
"Запусти validate-finances"
```

**Подробная документация:** См. `.claude/skills/README.md`

---

## Как субагенты и skills работают вместе

| Задача | Субагент | Используемые Skills |
|--------|----------|-------------------|
| Разработка новой фичи | financial-developer | quick-start, run-tests |
| Исправление бага | financial-bug-fixer | fix-errors, run-tests, db-query |
| Архитектурное проектирование | financial-architect | health-check, validate-finances |

**Workflow пример:**
1. "Добавь API для экспорта отчётов" → `financial-developer` активируется
2. Developer использует `quick-start` для запуска проекта
3. Пишет код, использует `run-tests` для проверки
4. Использует `validate-finances` перед коммитом

---

## Key Conventions

### Decimal Precision Rules
1. Always use `Decimal` for money, never `Number`
2. Store as `Decimal @db.Decimal(12, 2)` in Prisma
3. Convert to string for API responses: `amount.toString()`
4. Round with explicit mode: `amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)`

### Validation Layers
1. **Schema validation** - Zod at API boundary
2. **Business rules** - Validate logic constraints
3. **Database constraints** - CHECK constraints in schema

### Data Consistency
- **Team goals:** Always validate that `team = manager + employees`
- **Funnel logic:** Validate that later stages ≤ earlier stages (e.g., deals ≤ contracts)
- **Active users:** Filter by `isActive: true` for metrics

### Test-Driven Development
When implementing financial features:
1. Write failing tests first
2. Implement minimal code to pass
3. Refactor for clarity
4. Add edge case tests (0, negative, large numbers, precision)

---

## Common Pitfalls

❌ **Using Number for money calculations**
- Causes: 0.1 + 0.2 = 0.30000000000000004
- Solution: Use Decimal.js

❌ **Direct Prisma queries for goals**
- Problem: Bypasses business logic
- Solution: Always use GoalService

❌ **Forgetting to filter isActive users**
- Problem: Includes inactive employees in team metrics
- Solution: Add `isActive: true` to all team queries

❌ **Currency mismatch errors**
- Problem: Adding USD + EUR without validation
- Solution: Always validate currency before operations

---

## Helper Scripts

Located in `scripts/`:
- `validate-financial-data.ts` - Multi-layer validation of financial data integrity
- `analyze-funnel-health.ts` - Health score and red zone detection for sales funnel
- `sync-team-goals.ts` - Validate and sync team goal consistency
- `seed-tv-today.ts` - Seed test data

Run with `npx tsx scripts/<script>.ts` and see script headers for available flags.

---

## Environment Variables

Required in `.env`:
```env
POSTGRES_URL=          # Vercel Postgres connection string
NEXTAUTH_SECRET=       # Generate with: openssl rand -base64 32
NEXTAUTH_URL=          # http://localhost:3000 or production URL
TELEGRAM_BOT_TOKEN=    # From @BotFather
```

---

## Testing Strategy

- **Unit tests:** Financial calculations with edge cases
- **Integration tests:** API endpoints with Prisma
- **Analytics tests:** Funnel conversion calculations
- **Validation scripts:** Data integrity checks

Test coverage priorities:
1. All Decimal.js calculations (precision critical)
2. GoalService methods (single source of truth)
3. Funnel analytics (business logic)
4. Authorization logic (security)
