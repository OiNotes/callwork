/**
 * Zod схемы для валидации RopSettings Json полей
 *
 * RopSettings хранит конфигурацию в Json полях:
 * - conversionBenchmarks: пороги конверсий воронки
 * - alertThresholds: пороги оповещений
 * - motivationGrades: грейды мотивации/комиссий
 *
 * Эти схемы обеспечивают runtime валидацию при сохранении и чтении.
 */

import { z } from 'zod'

/**
 * Схема для conversionBenchmarks
 * Проценты конверсии воронки продаж (0-100)
 */
export const conversionBenchmarksSchema = z
  .object({
    BOOKED_TO_ZOOM1: z.number().min(0).max(100).optional(),
    ZOOM1_TO_ZOOM2: z.number().min(0).max(100).optional(),
    ZOOM2_TO_CONTRACT: z.number().min(0).max(100).optional(),
    CONTRACT_TO_PUSH: z.number().min(0).max(100).optional(),
    PUSH_TO_DEAL: z.number().min(0).max(100).optional(),
    ZOOM1_TO_DEAL_KPI: z.number().min(0).max(100).optional(),
  })
  .strict()

export type ConversionBenchmarksInput = z.infer<typeof conversionBenchmarksSchema>

/**
 * Схема для alertThresholds
 * Пороги оповещений (доли от 0 до 1)
 *
 * critical должен быть <= warning (более жёсткий порог)
 */
export const alertThresholdsSchema = z
  .object({
    warning: z.number().min(0).max(1),
    critical: z.number().min(0).max(1),
  })
  .refine((data) => data.critical <= data.warning, {
    message: 'critical threshold must be <= warning threshold',
    path: ['critical'],
  })

export type AlertThresholdsInput = z.infer<typeof alertThresholdsSchema>

/**
 * Схема для одного грейда мотивации
 */
export const motivationGradeSchema = z.object({
  minTurnover: z.number().min(0),
  maxTurnover: z.number().min(0).nullable().optional(),
  commissionRate: z.number().min(0).max(1), // доля от 0 до 1 (0.05 = 5%)
})

export type MotivationGradeInput = z.infer<typeof motivationGradeSchema>

/**
 * Схема для массива грейдов мотивации
 *
 * Правила:
 * - Минимум 1 грейд
 * - Первый грейд должен начинаться с minTurnover = 0
 * - Грейды должны быть отсортированы по minTurnover
 * - Последний грейд должен иметь maxTurnover = null (без верхней границы)
 */
export const motivationGradesSchema = z
  .array(motivationGradeSchema)
  .min(1, 'At least one motivation grade is required')
  .refine(
    (grades) => {
      // Первый грейд должен начинаться с 0
      if (grades[0]?.minTurnover !== 0) return false

      // Грейды должны быть отсортированы по minTurnover
      for (let i = 1; i < grades.length; i++) {
        if (grades[i].minTurnover < grades[i - 1].minTurnover) return false
      }

      // Последний грейд должен иметь maxTurnover = null
      const lastGrade = grades[grades.length - 1]
      if (lastGrade.maxTurnover !== null && lastGrade.maxTurnover !== undefined)
        return false

      return true
    },
    {
      message:
        'Motivation grades must start at 0, be sorted ascending, and last grade must have no upper limit',
    }
  )

export type MotivationGradesInput = z.infer<typeof motivationGradesSchema>

/**
 * Схема для managerPlan (план менеджера)
 */
export const managerPlanSchema = z.object({
  id: z.string(),
  monthlyGoal: z.number().min(0).nullable(),
})

export type ManagerPlanInput = z.infer<typeof managerPlanSchema>

/**
 * Полная схема payload для RopSettings PUT запроса
 */
export const ropSettingsPayloadSchema = z.object({
  departmentGoal: z.number().min(0).nullable().optional(),
  conversionBenchmarks: conversionBenchmarksSchema.optional(),
  alertThresholds: alertThresholdsSchema.partial().optional(),
  alertNoReportDays: z.number().int().min(0).max(60).optional(),
  alertNoDealsDays: z.number().int().min(0).max(60).optional(),
  alertConversionDrop: z.number().int().min(0).max(100).optional(),
  telegramRegistrationTtl: z.number().int().min(1).max(180).optional(),
  telegramReportTtl: z.number().int().min(1).max(180).optional(),
  activityScoreTarget: z.number().int().min(0).max(100).optional(),
  northStarTarget: z.number().int().min(0).max(100).optional(),
  salesPerDeal: z.number().min(0).optional(),
  motivationGrades: motivationGradesSchema.optional(),
  periodStartDay: z.number().int().min(1).max(31).optional(),
  managerPlans: z.array(managerPlanSchema).optional(),
})

export type RopSettingsPayloadInput = z.infer<typeof ropSettingsPayloadSchema>

// ============================================================================
// Safe Parse Helpers
// ============================================================================

/**
 * Безопасный парсинг conversionBenchmarks из Json БД
 *
 * @param json Значение из Prisma Json поля
 * @returns Валидированный объект или null при ошибке
 *
 * @example
 * const benchmarks = parseConversionBenchmarks(settings?.conversionBenchmarks)
 * const effectiveBenchmarks = { ...DEFAULTS, ...benchmarks }
 */
export function parseConversionBenchmarks(
  json: unknown
): ConversionBenchmarksInput | null {
  const result = conversionBenchmarksSchema.safeParse(json)
  return result.success ? result.data : null
}

/**
 * Безопасный парсинг alertThresholds из Json БД
 */
export function parseAlertThresholds(
  json: unknown
): AlertThresholdsInput | null {
  const result = alertThresholdsSchema.safeParse(json)
  return result.success ? result.data : null
}

/**
 * Безопасный парсинг motivationGrades из Json БД
 *
 * Обрабатывает legacy формат { grades: [...] }
 */
export function parseMotivationGrades(
  json: unknown
): MotivationGradesInput | null {
  // Прямой массив
  if (Array.isArray(json)) {
    const result = motivationGradesSchema.safeParse(json)
    return result.success ? result.data : null
  }

  // Legacy формат { grades: [...] }
  if (json && typeof json === 'object' && 'grades' in json) {
    const legacyJson = json as { grades: unknown }
    if (Array.isArray(legacyJson.grades)) {
      const result = motivationGradesSchema.safeParse(legacyJson.grades)
      return result.success ? result.data : null
    }
  }

  return null
}

/**
 * Валидация полного payload для RopSettings
 *
 * @returns Объект с success/error для обработки в API
 */
export function validateRopSettingsPayload(json: unknown): {
  success: boolean
  data?: RopSettingsPayloadInput
  error?: z.ZodError
} {
  const result = ropSettingsPayloadSchema.safeParse(json)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}
