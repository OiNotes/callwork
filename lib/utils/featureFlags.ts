/**
 * Feature Flags - управление функционалом через environment variables
 */

/**
 * Проверка включён ли demo-режим
 *
 * Demo-режим используется для:
 * - TV Dashboard с фейковыми данными
 * - Симуляция событий и обновлений
 * - Показательные презентации
 *
 * ВАЖНО: В production demo-режим должен быть ВЫКЛЮЧЕН!
 *
 * @returns true если ENABLE_DEMO_MODE=true
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true'
}

/**
 * Проверка включён ли режим разработки
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Проверка production среды
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Проверка что мы можем использовать фейковые данные
 * (demo-режим включён ИЛИ development)
 */
export function canUseMockData(): boolean {
  return isDemoMode() || isDevelopment()
}
