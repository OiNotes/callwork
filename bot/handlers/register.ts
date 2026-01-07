import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'
import { isValidCode } from '../utils/validation'
import { escapeHtml } from '../utils/formatting'
import { RopSettingsService } from '../../lib/services/RopSettingsService'
import { checkRateLimit } from '../../lib/rate-limit'
import { logError } from '../../lib/logger'

const pendingRegistrations = new Map<string, number>()
const registrationTimers = new Map<string, NodeJS.Timeout>()
const codeAttempts = new Map<string, { count: number; blockedUntil: number }>()
const MAX_WRONG_CODES = 3
const WRONG_CODE_BLOCK_MS = 15 * 60 * 1000

const buildStateKey = (chatId: number, telegramId: string) => `${chatId}:${telegramId}`

const clearPendingRegistration = (stateKey: string) => {
  pendingRegistrations.delete(stateKey)
  const timer = registrationTimers.get(stateKey)
  if (timer) {
    clearTimeout(timer)
    registrationTimers.delete(stateKey)
  }
  resetCodeAttempts(stateKey)
}

const setPendingRegistration = (stateKey: string, ttlMs: number) => {
  clearPendingRegistration(stateKey)
  const expiresAt = Date.now() + ttlMs
  pendingRegistrations.set(stateKey, expiresAt)
  registrationTimers.set(
    stateKey,
    setTimeout(() => {
      const currentExpiry = pendingRegistrations.get(stateKey)
      if (currentExpiry && currentExpiry <= Date.now()) {
        clearPendingRegistration(stateKey)
      }
    }, ttlMs)
  )
}

const getCodeAttempt = (stateKey: string) => codeAttempts.get(stateKey)

function resetCodeAttempts(stateKey: string) {
  codeAttempts.delete(stateKey)
}

const registerWrongCodeAttempt = (stateKey: string) => {
  const current = codeAttempts.get(stateKey)
  const count = (current?.count ?? 0) + 1
  const blockedUntil = count >= MAX_WRONG_CODES ? Date.now() + WRONG_CODE_BLOCK_MS : 0
  codeAttempts.set(stateKey, { count, blockedUntil })
  return { count, blockedUntil }
}

export async function registerHandler(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
) {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id.toString()

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Ошибка: не удалось определить ваш Telegram ID')
    return
  }

  try {
    const rateLimitKey = `telegram:register:${chatId}`
    const rateLimitResult = await checkRateLimit(rateLimitKey, 'register')
    if (!rateLimitResult.success) {
      await bot.sendMessage(
        chatId,
        '⏳ Слишком много попыток регистрации. Попробуйте позже.'
      )
      return
    }

    // Проверка уже привязанного аккаунта
    const existingUser = await prisma.user.findFirst({
      where: { telegramId, isActive: true },
    })

    if (existingUser) {
      await bot.sendMessage(
        chatId,
        '✅ Ваш аккаунт уже привязан!\n\nИспользуйте /report для отправки отчёта.'
      )
      return
    }

    // Запрос кода
    const settings = await RopSettingsService.getEffectiveSettings(null)
    const ttlMinutes = settings.telegramRegistrationTtl
    const ttlMs = ttlMinutes * 60 * 1000

    await bot.sendMessage(
      chatId,
      '🔑 Введите код привязки из вашего профиля на сайте:\n\n' +
      `(Код действителен ${ttlMinutes} минут)`
    )

    const stateKey = buildStateKey(chatId, telegramId)
    setPendingRegistration(stateKey, ttlMs)
  } catch (error) {
    logError('Register handler error', error)
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
  }
}

export async function handleRegisterCode(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
): Promise<boolean> {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id.toString()
  const code = msg.text?.trim()

  if (!telegramId || !code) {
    return false
  }

  const stateKey = buildStateKey(chatId, telegramId)

  if (!pendingRegistrations.has(stateKey)) {
    return false
  }

  try {
    const attempt = getCodeAttempt(stateKey)
    if (attempt?.blockedUntil && attempt.blockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attempt.blockedUntil - Date.now()) / 60000)
      await bot.sendMessage(
        chatId,
        `⛔ Слишком много неверных попыток. Попробуйте через ${minutesLeft} мин.`
      )
      return true
    }

    if (!isValidCode(code)) {
      registerWrongCodeAttempt(stateKey)
      await bot.sendMessage(chatId, '❌ Код должен состоять из 6 цифр.')
      return true
    }

    const expiresAt = pendingRegistrations.get(stateKey)
    if (!expiresAt || expiresAt < Date.now()) {
      clearPendingRegistration(stateKey)
      await bot.sendMessage(chatId, '⌛ Сессия регистрации истекла. Введите /register ещё раз.')
      return true
    }

    // Поиск пользователя по коду
    const user = await prisma.user.findFirst({
      where: {
        telegramCode: code,
        codeExpiresAt: {
          gte: new Date(),
        },
        isActive: true,
      },
    })

    if (!user) {
      const attemptInfo = registerWrongCodeAttempt(stateKey)
      await bot.sendMessage(
        chatId,
        attemptInfo.blockedUntil
          ? '⛔ Слишком много неверных попыток. Попробуйте позже.'
          : '❌ *Код не найден или истёк*\n\n' +
            'Пожалуйста, сгенерируйте новый код в личном кабинете и отправьте его сюда.',
        { parse_mode: 'Markdown' }
      )
      return true
    }

    // Привязка Telegram
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId,
        telegramCode: null,
        codeExpiresAt: null,
      },
    })

    clearPendingRegistration(stateKey)
    resetCodeAttempts(stateKey)

    await bot.sendMessage(
      chatId,
      `🎉 <b>Успешно!</b> Аккаунт <b>${escapeHtml(user.name)}</b> привязан.\n\n` +
      'Теперь вы можете сдавать отчёты через команду /report\n' +
      'Удачи в продажах! 🚀',
      { parse_mode: 'HTML' }
    )
    return true
  } catch (error) {
    logError('Registration error', error)
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка. Попробуйте позже.'
    )
    return true
  }
}
