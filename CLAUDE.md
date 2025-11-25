# CLAUDE.md - Callwork Project

> Call Center Analytics System. Next.js + Prisma + Telegram Bot.

---

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Prisma + PostgreSQL (Vercel/Neon)
- NextAuth.js (JWT), Telegram Bot API
- Decimal.js (финансы), Tailwind v4, shadcn/ui, Framer Motion

---

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run bot:dev      # Telegram bot
npx prisma studio    # DB GUI
npm run test:analytics
```

---

## Доступные субагенты

**Расположение:** `.claude/agents/`

| Субагент | Когда использовать |
|----------|-------------------|
| `financial-developer` | Новые фичи, API, компоненты |
| `financial-bug-fixer` | Падают тесты, баги, ошибки |
| `financial-architect` | Проектирование, ADR, рефакторинг |

---

## Доступные плагины

| Плагин | Когда использовать |
|--------|-------------------|
| `frontend-design` | UI компоненты с высоким качеством |
| `unit-test-generator` | Генерация тестов |
| `project-health-auditor` | Анализ здоровья проекта |

---

## Критичные правила

### Decimal.js для денег
```typescript
// ✅ CORRECT
import Decimal from 'decimal.js';
const total = new Decimal(price).plus(tax);

// ❌ WRONG
const total = price + tax;
```

### GoalService - единственный источник целей
```typescript
// ✅ CORRECT
import { GoalService } from '@/lib/services/GoalService';
const goal = await GoalService.getUserGoal(userId);

// ❌ WRONG
const goal = await prisma.user.findUnique({ where: { id } });
```

### Фильтр активных пользователей
```typescript
// ✅ Всегда добавлять в запросы команды
where: { isActive: true }
```

---

## Sales Funnel (6 этапов)

1. Zoom Booked → 2. Zoom 1 (60%) → 3. Zoom 2 (50%) → 4. Contract (40%) → 5. Push (60%) → 6. Deal (70%)

**North Star:** 5% конверсия Zoom 1 → Deal

---

## Структура проекта

```
app/api/        # API routes (auth, reports, statistics, users)
lib/services/   # GoalService, бизнес-логика
lib/calculations/  # Финансовые расчёты
components/     # UI компоненты
bot/            # Telegram bot
scripts/        # Валидация, сиды
```

---

## Database Models (ключевые)

**User:** `monthlyGoal` (Decimal), `isActive`, `role` (EMPLOYEE|MANAGER)
**Report:** все деньги `Decimal @db.Decimal(12, 2)`, `@@unique([userId, date])`
**Deal:** `budget` (Decimal), `status` (OPEN|WON|LOST), `isFocus`

---

## Проверка данных

```bash
npx tsx scripts/validate-financial-data.ts
npx tsx scripts/analyze-funnel-health.ts
npx tsx scripts/sync-team-goals.ts --validate
```

---

## Don't Touch

- `.env` - секреты
- `lib/services/GoalService.ts` - без согласования
- API контракты - breaking changes запрещены
