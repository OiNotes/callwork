import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'
import { ReportState } from '../types'
import { validateNumber, validateSalesAmount, MAX_REASON_LENGTH } from '../utils/validation'
import { formatReportPreview } from '../utils/formatting'
import { roundMoney, toDecimal } from '../../lib/utils/decimal'
import { RopSettingsService } from '../../lib/services/RopSettingsService'
import { logError } from '../../lib/logger'

// Map для хранения состояния пользователей
const reportStates = new Map<string, ReportState>()
const reportStateTimers = new Map<string, NodeJS.Timeout>()
const DEFAULT_REPORT_TTL_MS = 30 * 60 * 1000

const buildStateKey = (chatId: number, telegramId: string) => `${chatId}:${telegramId}`

const clearReportState = (stateKey: string) => {
  reportStates.delete(stateKey)
  const timer = reportStateTimers.get(stateKey)
  if (timer) {
    clearTimeout(timer)
    reportStateTimers.delete(stateKey)
  }
}

const scheduleReportStateCleanup = (stateKey: string, ttlMs: number) => {
  const existingTimer = reportStateTimers.get(stateKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  reportStateTimers.set(
    stateKey,
    setTimeout(() => {
      const currentState = reportStates.get(stateKey)
      const maxAge = currentState?.ttlMs ?? ttlMs
      if (currentState && Date.now() - currentState.updatedAt >= maxAge) {
        clearReportState(stateKey)
      }
    }, ttlMs)
  )
}

const updateReportState = (stateKey: string, state: ReportState) => {
  state.updatedAt = Date.now()
  reportStates.set(stateKey, state)
  const ttlMs = state.ttlMs ?? DEFAULT_REPORT_TTL_MS
  scheduleReportStateCleanup(stateKey, ttlMs)
}

const getReportState = (stateKey: string) => {
  const state = reportStates.get(stateKey)
  if (!state) return null
  const ttlMs = state.ttlMs ?? DEFAULT_REPORT_TTL_MS
  if (Date.now() - state.updatedAt >= ttlMs) {
    clearReportState(stateKey)
    return null
  }
  return state
}

/**
 * Обработчик команды /report - начало сбора отчёта
 */
export async function reportHandler(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
): Promise<void> {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id.toString()

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Ошибка: не удалось определить ваш Telegram ID')
    return
  }

  try {
    // Проверяем, что пользователь зарегистрирован
    const user = await prisma.user.findFirst({
      where: { telegramId, isActive: true }
    })

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Вы не зарегистрированы в системе.\n\n' +
        'Используйте команду /register для регистрации.'
      )
      return
    }

    const settings = await RopSettingsService.getEffectiveSettings(user.managerId ?? null)
    const ttlMs = settings.telegramReportTtl * 60 * 1000

    // Инициализируем состояние сбора отчёта
    const stateKey = buildStateKey(chatId, telegramId)
    updateReportState(stateKey, {
      step: 'date',
      date: new Date(),
      data: {},
      updatedAt: Date.now(),
      ttlMs,
    })

    // Отправляем клавиатуру выбора даты
    await bot.sendMessage(
      chatId,
      '📊 *Создание отчёта*\n\n' +
      'Выберите дату отчёта:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📅 Сегодня', callback_data: 'date_today' },
              { text: '📅 Вчера', callback_data: 'date_yesterday' }
            ],
            [
              { text: '📅 Позавчера', callback_data: 'date_daybeforeyesterday' }
            ]
          ]
        }
      }
    )
  } catch (error) {
    logError('Error in reportHandler', error)
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
  }
}

/**
 * Обработчик выбора даты (callback query)
 */
export async function handleDateCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  prisma: PrismaClient
): Promise<void> {
  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id

  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
    return
  }
  const telegramId = query.from?.id?.toString()
  if (!telegramId) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
    return
  }
  const stateKey = buildStateKey(chatId, telegramId)

  const state = getReportState(stateKey)
  if (!state || state.step !== 'date') {
    await bot.answerCallbackQuery(query.id, { text: '❌ Сессия истекла' })
    return
  }

  try {
    // Вычисляем дату в зависимости от выбора
    const selectedDate = new Date()
    selectedDate.setHours(0, 0, 0, 0) // Обнуляем время

    if (query.data === 'date_yesterday') {
      selectedDate.setDate(selectedDate.getDate() - 1)
    } else if (query.data === 'date_daybeforeyesterday') {
      selectedDate.setDate(selectedDate.getDate() - 2)
    }

    // Обновляем состояние
    state.date = selectedDate
    state.step = 'zoomAppointments'

    // Получаем пользователя и предыдущий отчет для подсказок
    const user = await prisma.user.findFirst({ where: { telegramId, isActive: true } })

    if (user) {
      const lastReport = await prisma.report.findFirst({
        where: {
          userId: user.id,
          date: { lt: selectedDate }
        },
        orderBy: { date: 'desc' }
      })

        if (lastReport) {
          state.lastReport = {
            zoomAppointments: lastReport.zoomAppointments,
            pzmConducted: lastReport.pzmConducted,
            refusalsCount: lastReport.refusalsCount,
            refusalsReasons: lastReport.refusalsReasons || undefined,
            warmingUpCount: lastReport.warmingUpCount,
            vzmConducted: lastReport.vzmConducted,
            contractReviewCount: lastReport.contractReviewCount,
            pushCount: lastReport.pushCount,
            successfulDeals: lastReport.successfulDeals,
            monthlySalesAmount: roundMoney(toDecimal(lastReport.monthlySalesAmount)).toString()
          }
        }
    }

    updateReportState(stateKey, state)

    // Отвечаем на callback query
    await bot.answerCallbackQuery(query.id, { text: '✅ Дата выбрана' })

    // Удаляем сообщение с клавиатурой
    await bot.deleteMessage(chatId, messageId)

    // Запрашиваем первое поле с подсказкой
    const suggestion = state.lastReport?.zoomAppointments !== undefined
      ? ` (Ранее: ${state.lastReport.zoomAppointments})`
      : ''

    await bot.sendMessage(
      chatId,
      `📋 *Отчёт за ${formatDateRu(selectedDate)}*\n\n` +
      `📞 Введите количество *назначенных ПЗМ*${suggestion}:`,
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    logError('Error in handleDateCallback', error)
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
  }
}

/**
 * Обработчик ввода полей отчёта (text messages)
 */
export async function handleReportInput(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  _prisma: PrismaClient
): Promise<void> {
  const chatId = msg.chat.id
  const text = msg.text?.trim()
  const telegramId = msg.from?.id?.toString()

  if (!text || !telegramId) return

  const stateKey = buildStateKey(chatId, telegramId)
  const state = getReportState(stateKey)
  if (!state || state.step === 'date') return

  try {
    switch (state.step) {
      case 'zoomAppointments': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число (например: 5):')
          return
        }
        state.data.zoomAppointments = value
        state.step = 'pzmConducted'

        const suggestion = state.lastReport?.pzmConducted !== undefined
          ? ` (Ранее: ${state.lastReport.pzmConducted})`
          : ''
        await bot.sendMessage(chatId, `📞 Сколько было *проведённых ПЗМ*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'pzmConducted': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.pzmConducted = value
        state.step = 'refusalsCount'

        const suggestion = state.lastReport?.refusalsCount !== undefined
          ? ` (Ранее: ${state.lastReport.refusalsCount})`
          : ''
        await bot.sendMessage(chatId, `🚫 Количество *отказов*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'refusalsCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.refusalsCount = value

        if (value > 0) {
          state.step = 'refusalsReasons'
          await bot.sendMessage(chatId, '❓ Укажите *причину отказов* (текстом):', { parse_mode: 'Markdown' })
        } else {
          state.step = 'warmingUpCount'

          const suggestion = state.lastReport?.warmingUpCount !== undefined
            ? ` (Ранее: ${state.lastReport.warmingUpCount})`
            : ''
          await bot.sendMessage(chatId, `🔥 Количество *прогревов*?${suggestion}`, { parse_mode: 'Markdown' })
        }
        break
      }

      case 'refusalsReasons': {
        if (text.length > MAX_REASON_LENGTH) {
          await bot.sendMessage(chatId, `❌ Причина отказа слишком длинная (макс. ${MAX_REASON_LENGTH} символов).`)
          return
        }
        state.data.refusalsReasons = text
        state.step = 'warmingUpCount'

        const suggestion = state.lastReport?.warmingUpCount !== undefined
          ? ` (Ранее: ${state.lastReport.warmingUpCount})`
          : ''
        await bot.sendMessage(chatId, `🔥 Количество *прогревов*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'warmingUpCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.warmingUpCount = value
        state.step = 'vzmConducted'

        const suggestion = state.lastReport?.vzmConducted !== undefined
          ? ` (Ранее: ${state.lastReport.vzmConducted})`
          : ''
        await bot.sendMessage(chatId, `📹 Сколько *проведённых ВЗМ*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'vzmConducted': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.vzmConducted = value
        state.step = 'contractReviewCount'

        const suggestion = state.lastReport?.contractReviewCount !== undefined
          ? ` (Ранее: ${state.lastReport.contractReviewCount})`
          : ''
        await bot.sendMessage(chatId, `📄 Договоров *на проверке*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'contractReviewCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.contractReviewCount = value
        state.step = 'successfulDeals'

        const suggestion = state.lastReport?.successfulDeals !== undefined
          ? ` (Ранее: ${state.lastReport.successfulDeals})`
          : ''
        await bot.sendMessage(chatId, `🤝 Количество *успешных сделок*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'successfulDeals': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.successfulDeals = value
        state.step = 'monthlySalesAmount'

        const suggestion = state.lastReport?.monthlySalesAmount !== undefined
          ? ` (Ранее: ${state.lastReport.monthlySalesAmount})`
          : ''
        await bot.sendMessage(chatId, `💰 Общая *сумма продаж* (в рублях)?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'monthlySalesAmount': {
        const value = validateSalesAmount(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите корректную сумму (например: 50000):')
          return
        }
        state.data.monthlySalesAmount = value
        state.step = 'confirm'

        // Показываем preview отчёта
        const preview = formatReportPreview(state.data, state.date)
        await bot.sendMessage(
          chatId,
          preview,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Отправить', callback_data: 'confirm_report' },
                  { text: '✏️ Исправить', callback_data: 'cancel_report' } // Пока просто отмена, но можно сделать редактирование
                ]
              ]
            }
          }
        )
        break
      }

      default:
        break
    }

    updateReportState(stateKey, state)
  } catch (error) {
    logError('Error in handleReportInput', error)
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
  }
}

/**
 * Обработчик подтверждения отчёта (callback query)
 */
export async function handleReportConfirm(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  prisma: PrismaClient
): Promise<void> {
  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id
  const telegramId = query.from.id.toString()

  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
    return
  }

  const stateKey = buildStateKey(chatId, telegramId)
  const state = getReportState(stateKey)
  if (!state || (state.step !== 'confirm' && state.step !== 'confirm_overwrite')) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Сессия истекла' })
    return
  }

  try {
    const action = query.data
    if (action === 'cancel_report') {
      clearReportState(stateKey)
      await bot.answerCallbackQuery(query.id, { text: '❌ Отменено' })
      await bot.deleteMessage(chatId, messageId)
      await bot.sendMessage(chatId, '❌ Отчёт отменён. Используйте /report чтобы начать заново.')
      return
    }

    if (action !== 'confirm_report' && action !== 'confirm_overwrite') {
      await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { telegramId, isActive: true }
    })

    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Пользователь не найден' })
      clearReportState(stateKey)
      return
    }

    const existingReport = await prisma.report.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: state.date
        }
      },
      select: { id: true }
    })

    if (existingReport && !state.overwriteConfirmed && action !== 'confirm_overwrite') {
      state.overwriteConfirmed = true
      state.step = 'confirm_overwrite'
      updateReportState(stateKey, state)
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Отчёт уже существует' })
      await bot.deleteMessage(chatId, messageId)
      await bot.sendMessage(chatId, '⚠️ Отчёт за эту дату уже существует. Перезаписать?', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔁 Перезаписать', callback_data: 'confirm_overwrite' },
              { text: '❌ Отмена', callback_data: 'cancel_report' }
            ]
          ]
        }
      })
      return
    }

    // Сохраняем отчёт в БД
    const contractReviewCount = state.data.contractReviewCount ?? 0
    const pushCount = state.data.pushCount ?? contractReviewCount
    const invalidFunnel =
      (state.data.pzmConducted ?? 0) > (state.data.zoomAppointments ?? 0) ||
      (state.data.vzmConducted ?? 0) > (state.data.pzmConducted ?? 0) ||
      contractReviewCount > (state.data.vzmConducted ?? 0) ||
      pushCount > contractReviewCount ||
      (state.data.successfulDeals ?? 0) > pushCount
    if (invalidFunnel) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Проверьте порядок этапов воронки' })
      await bot.sendMessage(chatId, '❌ Каждый следующий этап не может быть больше предыдущего. Отчёт не сохранён.')
      return
    }

    const salesAmount = roundMoney(toDecimal(state.data.monthlySalesAmount ?? 0)).toString()

    await prisma.report.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: state.date
        }
      },
      update: {
        zoomAppointments: state.data.zoomAppointments!,
        pzmConducted: state.data.pzmConducted!,
        refusalsCount: state.data.refusalsCount!,
        refusalsReasons: state.data.refusalsReasons || null,
        warmingUpCount: state.data.warmingUpCount!,
        vzmConducted: state.data.vzmConducted!,
        contractReviewCount: state.data.contractReviewCount!,
        pushCount,
        successfulDeals: state.data.successfulDeals!,
        monthlySalesAmount: salesAmount
      },
      create: {
        userId: user.id,
        date: state.date,
        zoomAppointments: state.data.zoomAppointments!,
        pzmConducted: state.data.pzmConducted!,
        refusalsCount: state.data.refusalsCount!,
        refusalsReasons: state.data.refusalsReasons || null,
        warmingUpCount: state.data.warmingUpCount!,
        vzmConducted: state.data.vzmConducted!,
        contractReviewCount: state.data.contractReviewCount!,
        pushCount,
        successfulDeals: state.data.successfulDeals!,
        monthlySalesAmount: salesAmount
      }
    })

    clearReportState(stateKey)

    await bot.answerCallbackQuery(query.id, { text: '✅ Сохранено!' })
    await bot.deleteMessage(chatId, messageId)
    await bot.sendMessage(
      chatId,
      '🚀 *Отчёт принят!*\n\n' +
      'Данные обновлены в системе. Отличная работа!',
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    logError('Error in handleReportConfirm', error)
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка сохранения' })
    await bot.sendMessage(chatId, '❌ Не удалось сохранить отчёт. Попробуйте позже.')
  }
}

/**
 * Вспомогательная функция для форматирования даты на русском
 */
function formatDateRu(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}
