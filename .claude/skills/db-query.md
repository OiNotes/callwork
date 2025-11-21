---
name: db-query
description: Безопасное выполнение SQL запросов к PostgreSQL через Prisma. Используй для исследования данных или отладки.
allowed-tools: Bash, Read
---

# DB Query Skill

Интерактивный SQL запросник для Callwork PostgreSQL БД.

## Что делает

1. Открывает Prisma Studio (GUI для БД)
2. Позволяет выполнять read-only SQL запросы
3. Выводит результаты в удобном формате

## Шаги

### Опция 1: Prisma Studio (GUI)
```bash
echo "🎨 Открываю Prisma Studio..."
npx prisma studio
```

Откроется браузер с GUI на http://localhost:5555:
- Просмотр всех таблиц
- Фильтрация и сортировка
- Редактирование данных (осторожно!)

### Опция 2: SQL запросы через Prisma
```bash
echo "📊 Выполняю SQL запрос..."

# Пример: Получить всех активных пользователей
npx prisma db execute --stdin <<'EOF'
SELECT id, name, email, role, "monthlyGoal"
FROM "User"
WHERE "isActive" = true
ORDER BY role, name;
EOF
```

## Полезные запросы

### 1. Статистика по пользователям
```sql
SELECT
  role,
  COUNT(*) as total,
  COUNT(CASE WHEN "isActive" THEN 1 END) as active,
  SUM("monthlyGoal") as total_goals
FROM "User"
GROUP BY role;
```

### 2. Отчёты за сегодня
```sql
SELECT
  u.name,
  r."monthlySalesAmount",
  r."successfulDeals",
  r.date
FROM "Report" r
JOIN "User" u ON r."userId" = u.id
WHERE r.date = CURRENT_DATE
ORDER BY r."monthlySalesAmount" DESC;
```

### 3. Открытые сделки
```sql
SELECT
  d.title,
  d.budget,
  d.status,
  u.name as owner
FROM "Deal" d
JOIN "User" u ON d."userId" = u.id
WHERE d.status = 'OPEN'
ORDER BY d.budget DESC
LIMIT 10;
```

### 4. Team goals consistency check
```sql
SELECT
  m.name as manager,
  m."monthlyGoal" as manager_goal,
  SUM(e."monthlyGoal") as employees_sum,
  m."monthlyGoal" - SUM(e."monthlyGoal") as diff
FROM "User" m
LEFT JOIN "User" e ON e."managerId" = m.id AND e."isActive" = true
WHERE m.role = 'MANAGER'
GROUP BY m.id, m.name, m."monthlyGoal"
HAVING m."monthlyGoal" != COALESCE(SUM(e."monthlyGoal"), 0);
```

## Безопасность

⚠️ **READ-ONLY рекомендуется:**
- Используй SELECT запросы
- Избегай UPDATE/DELETE без WHERE
- Для изменений данных используй Prisma Client в коде

⚠️ **Опасные операции:**
```sql
-- ❌ НЕ ДЕЛАЙ ТАК без бэкапа!
DELETE FROM "Report"; -- удалит ВСЕ отчёты
UPDATE "User" SET "isActive" = false; -- деактивирует ВСЕХ
```

## Когда использовать

- Исследование данных для debugging
- Проверка data consistency
- Быстрый анализ метрик
- Валидация результатов миграций
- Создание тестовых данных

## Примечания

- Prisma Studio запускается на http://localhost:5555
- Все таблицы в PascalCase (User, Report, Deal)
- Поля с camelCase обёрнуты в кавычки ("monthlyGoal")
- Decimal поля возвращаются как строки
