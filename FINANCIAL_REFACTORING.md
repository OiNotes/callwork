# 📊 Отчёт: Унификация числовой логики Callwork

## 🎯 Цель рефакторинга

Устранить разъезжающиеся цифры (план/факт/прогноз) и создать **единый источник правды** для всех финансовых метрик.

---

## ✅ Что было сделано

### 1. Созданы новые сервисы (Single Source of Truth)

#### **`lib/services/ReportAggregationService.ts`** - Единая агрегация факта
- ✅ `getTotalSales(userIds, period)` - замена всех reduce/forEach/aggregate
- ✅ `getTotals(userIds, period)` - все метрики отчётов
- ✅ `getDailySales(userIds, days)` - для weighted прогноза
- ✅ `getAverageDealSize(userId)` - средний чек из истории (замена хардкода 100K)

**Зачем:** Убирает 4+ дубля логики агрегации, гарантирует консистентность.

#### **`lib/services/MetricsService.ts`** - Объединение план/факт/прогноз
- ✅ `getPlanVsFactVsForecast(userId)` - ВСЁ в одном месте
- ✅ `getTeamMetrics(managerId)` - метрики команды
- ✅ Возвращает: plan, fact, forecast (linear/weighted/optimistic), %, дельты

**Зачем:** Один метод вместо 5+ разрозненных вызовов.

#### **Обновлён `lib/services/GoalService.ts`**
- ✅ Добавлен `getTeamUserIds(managerId)` - DRY для запросов команды
- ✅ Метод `hasGoal(userId)` уже был, используется в MetricsService

#### **Расширен `lib/calculations/forecast.ts`**
- ✅ Добавлен `calculateWeightedForecast()` - последние 7 дней важнее (70/30)
- ✅ Исправлен баг: `projectedTotal` теперь возвращается без округления

---

### 2. Убраны критические хардкоды

#### ❌ УБРАН: Хардкод 14M в `scripts/sync-team-goals.ts:124`
**Было:**
```typescript
const totalGoal = Number(manager.monthlyGoal) || 14000000 // дефолт 14 млн
```

**Стало:**
```typescript
if (!manager.monthlyGoal || Number(manager.monthlyGoal) === 0) {
  console.error(`❌ ОШИБКА: У менеджера не установлена цель`)
  console.error(`   Сначала установите цель командой:`)
  console.error(`   npx tsx scripts/sync-team-goals.ts --user="ID" --goal=СУММА`)
  return
}
const totalGoal = Number(manager.monthlyGoal)
```

**Это объясняет баг "план 7M vs forecast 14M"!**

#### ❌ УБРАН: Fallback 1.5M в `components/tv/TVDashboardNew.tsx:337`
**Было:**
```typescript
const GOAL = data.leaderboard[0]?.goal || 1500000
```

**Стало:**
```typescript
const GOAL = data.leaderboard[0]?.goal || 0
if (GOAL === 0 && process.env.NODE_ENV === 'development') {
  console.warn('⚠️ TV Dashboard: У сотрудников не установлены цели')
}
```

#### ⚠️ ЗАДОКУМЕНТИРОВАН: Хардкод SALES_PER_DEAL = 100K
**Файл:** `lib/config/metrics.ts:33`
- Добавлен подробный комментарий с TODO
- Рекомендация: использовать `ReportAggregationService.getAverageDealSize()`

---

### 3. Защита seed-скриптов от production

Все 4 seed-скрипта защищены:
- `scripts/seed-tv-today.ts` ✅
- `scripts/seed-realistic-data.ts` ✅
- `scripts/seed-test-data.ts` ✅
- `scripts/seed-forecast-data.ts` ✅

**Защита:**
```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ОШИБКА: Seed-скрипты не могут быть запущены в production!')
  process.exit(1)
}
```

---

### 4. Изоляция demo-данных

#### Создан `lib/utils/featureFlags.ts`
```typescript
export function isDemoMode(): boolean
export function canUseMockData(): boolean
```

#### Добавлен warning в `lib/utils/demoDataSimulator.ts`
```typescript
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ demoDataSimulator используется в production!')
}
```

---

### 5. Validation Script

#### **`scripts/validate-metrics-consistency.ts`** - Проверка консистентности

Проверяет:
1. ✅ Цели команды = Цель менеджера + Сумма целей сотрудников
2. ✅ У всех активных пользователей есть monthlyGoal
3. ✅ Факт считается одинаково через разные сервисы
4. ✅ Прогноз не расходится с планом без объяснений
5. ✅ Нет подозрительных хардкодов (все цели кратны 100K)

**Запуск:**
```bash
npx tsx scripts/validate-metrics-consistency.ts
npx tsx scripts/validate-metrics-consistency.ts --detailed
```

---

### 6. Unit-тесты

#### **`tests/services.test.ts`** - Тесты для новых сервисов

Покрывает:
- ✅ Линейная экстраполяция forecast
- ✅ Прогноз при нулевых продажах
- ✅ Переплан (продажи выше плана)
- ✅ Weighted прогноз (последние дни важнее)
- ✅ Концептуальные сценарии для integration tests

**Запуск:**
```bash
npx tsx tests/services.test.ts
```

---

## 📋 Итоговая архитектура

### Единый источник правды для метрик:

```
┌─────────────────────────────────────────────────────┐
│                   MetricsService                     │
│  getPlanVsFactVsForecast() - ВСЁ В ОДНОМ МЕСТЕ      │
└─────────────────────────────────────────────────────┘
                      ▲
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │   Goal   │ │  Fact    │ │ Forecast │
  │ Service  │ │ Aggreg.  │ │ Calc.    │
  └──────────┘ └──────────┘ └──────────┘
       │            │            │
       ▼            ▼            ▼
  User.         Report.     forecast.ts
  monthlyGoal   monthlySales  (linear +
                Amount       weighted)
```

### Как использовать:

**Старый подход (НЕ ИСПОЛЬЗУЙТЕ!):**
```typescript
// ❌ Разрозненные вызовы
const plan = await GoalService.getUserGoal(userId)
const reports = await prisma.report.findMany(...)
const fact = reports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)
const forecast = calculateMonthlyForecast(fact, plan)
```

**Новый подход (ПРАВИЛЬНО!):**
```typescript
// ✅ Один вызов
import { MetricsService } from '@/lib/services/MetricsService'

const metrics = await MetricsService.getPlanVsFactVsForecast(userId)
// metrics содержит: plan, fact, forecast, percentageComplete, deltaToPlan и т.д.
```

---

## 🔧 Что нужно сделать дальше

### Приоритет 1 (Критично):

1. **Установить monthlyGoal всем активным пользователям**
   ```bash
   # Проверка кто без целей
   npx tsx scripts/validate-metrics-consistency.ts

   # Установка цели
   npx tsx scripts/sync-team-goals.ts --user="USER_ID" --goal=1500000
   ```

2. **Переустановить node_modules (сейчас повреждены)**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Заменить дублирующиеся агрегации на ReportAggregationService**

   Найти и заменить в:
   - `lib/services/SalesForecastService.ts:56-63`
   - `app/api/analytics/forecast/route.ts:108-111`
   - `lib/analytics/funnel.ts:22-36`
   - `app/api/statistics/route.ts:31-57`
   - `lib/services/MotivationCalculatorService.ts:38-49`

   **Пример замены:**
   ```typescript
   // Было:
   const currentSales = reports.reduce(
     (sum, report) => sum + Number(report.monthlySalesAmount), 0
   )

   // Стало:
   import { ReportAggregationService } from '@/lib/services/ReportAggregationService'

   const currentSales = await ReportAggregationService.getTotalSales(userId, {
     startDate,
     endDate
   })
   ```

### Приоритет 2 (Важно):

4. **Обновить API endpoints для использования MetricsService**

   Заменить в:
   - `app/api/analytics/forecast/route.ts`
   - `app/api/employees/route.ts`
   - `app/api/statistics/route.ts`

5. **Обновить frontend компоненты**

   Использовать новые API endpoints с MetricsService.

6. **Сделать SALES_PER_DEAL динамическим**
   ```typescript
   const avgDealSize = await ReportAggregationService.getAverageDealSize(userId)
   const planDeals = avgDealSize ? planSales / avgDealSize : planSales / 100_000
   ```

### Приоритет 3 (Желательно):

7. **Добавить мониторинг расхождений**
   - Alert если |projected - plan| > 50%
   - Логировать все расчёты прогнозов

8. **Создать админ-панель для управления целями**
   - UI для установки monthlyGoal с валидацией
   - История изменений планов
   - Визуализация распределения целей по команде

---

## 📊 Примеры расчётов (из аудита)

### Сценарий 1: Почему план 7M, а forecast 14M?

**Причина 1: Хардкод дефолта (ИСПРАВЛЕНО!)**
```typescript
// scripts/sync-team-goals.ts:124
const totalGoal = Number(manager.monthlyGoal) || 14000000
```
Если `monthlyGoal = NULL`, скрипт автоматически использовал 14M.

**Причина 2: Высокий темп продаж**
- План: 7M
- Факт за 15 дней: 7M
- Daily average: 7M / 15 = 466K
- Projected: 466K × 30 = 14M ← это ПРАВИЛЬНО!

**Причина 3: Optimistic forecast**
```typescript
optimistic = linear forecast + focus deals
= 7M + 7M = 14M
```

### Сценарий 2: Простой расчёт

**Данные:**
- User.monthlyGoal = 7,000,000₽
- 15 дней прошло
- Reports: 500K+300K+400K+...  = 3,500,000₽

**Расчёт (новый MetricsService):**
```typescript
const metrics = await MetricsService.getPlanVsFactVsForecast(userId)

// План: 7,000,000₽ (из User.monthlyGoal)
// Факт: 3,500,000₽ (сумма отчётов)
// Прогноз linear: 7,000,000₽ (3.5M / 15 × 30)
// Прогноз weighted: ~7,200,000₽ (последние дни лучше)
// % выполнения: 50%
// Delta: 3,500,000₽ до плана
```

---

## 🐛 Найденные и исправленные проблемы

| № | Проблема | Файл | Исправление |
|---|----------|------|-------------|
| 1 | Хардкод 14M | `scripts/sync-team-goals.ts:124` | Удалён fallback, требуется явная цель |
| 2 | Fallback 1.5M | `components/tv/TVDashboardNew.tsx:337` | Возврат 0 + warning |
| 3 | Хардкод 100K | `lib/config/metrics.ts:33` | Задокументирован, TODO |
| 4 | Seed в production | Все `scripts/seed-*.ts` | Защита через NODE_ENV |
| 5 | Дубли агрегации | 6 мест в проекте | Создан ReportAggregationService |
| 6 | Demo в production | `lib/utils/demoDataSimulator.ts` | Warning + TODO |
| 7 | Нет weighted forecast | `lib/calculations/forecast.ts` | Добавлен |
| 8 | Дубли запросов команды | 3 места | Добавлен GoalService.getTeamUserIds() |

---

## 📈 Метрики улучшений

- **Создано новых модулей:** 3 (ReportAggregationService, MetricsService, featureFlags)
- **Удалено хардкодов:** 3 критических
- **Защищено seed-скриптов:** 4
- **Найдено дублей логики:** 6+
- **Создано тестов:** 4 unit + 1 validation script
- **Улучшено документации:** 2 файла (CLAUDE.md дополнен, этот отчёт)

---

## 🎯 Финальные определения

### План (Plan)
- **Источник:** `User.monthlyGoal` (Decimal)
- **Сервис:** `GoalService.getUserGoal()` - Single Source of Truth
- **Если NULL:** возврат 0, флаг `hasGoal: false`
- **Команда:** сумма целей менеджера + активных сотрудников

### Факт (Fact)
- **Источник:** `Report.monthlySalesAmount`
- **Формула:** Prisma aggregate _sum за период
- **Сервис:** `ReportAggregationService.getTotalSales()`

### Прогноз (Forecast)
- **Linear:** `(факт / дней прошло) × дней в месяце`
- **Weighted:** последние 7 дней × 0.7 + старые × 0.3
- **Optimistic:** linear + сумма focus deals
- **Модуль:** `lib/calculations/forecast.ts`

---

## ✅ Checklist для проверки

После переустановки node_modules:

- [ ] `npm install` успешно выполнен
- [ ] `npx tsx tests/services.test.ts` - все тесты прошли
- [ ] `npx tsx scripts/validate-metrics-consistency.ts` - нет критических ошибок
- [ ] У всех активных пользователей установлен `monthlyGoal`
- [ ] `npm run dev` - проект запускается без ошибок
- [ ] `npm run build` - build проходит успешно

---

## 📞 Контакты и поддержка

Если возникают вопросы по рефакторингу:
1. Читайте комментарии в коде (добавлены подробные пояснения)
2. Запускайте validation script для диагностики
3. Используйте MetricsService вместо старых методов

**Главное правило:** НИКОГДА не считайте план/факт/прогноз напрямую через Prisma. ВСЕГДА используйте сервисы!

---

**Дата рефакторинга:** 2025-11-21
**Статус:** ✅ Завершён (требуется npm install и миграция API endpoints)
