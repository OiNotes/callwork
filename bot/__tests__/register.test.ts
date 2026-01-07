import { beforeEach, describe, expect, it, vi } from 'vitest'
import type TelegramBot from 'node-telegram-bot-api'
import { registerHandler, handleRegisterCode } from '@/bot/handlers/register'
import { prismaMock } from '../../tests/mocks/prisma'

vi.mock('@/lib/services/RopSettingsService', () => ({
  RopSettingsService: {
    getEffectiveSettings: vi.fn(async () => ({
      telegramRegistrationTtl: 10
    }))
  }
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true, limit: 10, remaining: 9, reset: 0 }))
}))

const createBot = () => ({
  sendMessage: vi.fn(async () => undefined)
}) as unknown as TelegramBot

const createMessage = (chatId: number, fromId: number, text?: string) => ({
  chat: { id: chatId },
  from: { id: fromId },
  text
}) as TelegramBot.Message

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue(null)
})

describe('registerHandler', () => {
  it('asks for registration code', async () => {
    const bot = createBot()

    await registerHandler(bot, createMessage(1, 111, '/register'), prismaMock as unknown as any)

    expect(bot.sendMessage).toHaveBeenCalled()
    const message = bot.sendMessage.mock.calls[0][1]
    expect(message).toContain('Введите код')
  })
})

describe('handleRegisterCode', () => {
  it('binds account with valid code', async () => {
    const bot = createBot()

    prismaMock.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-1',
        name: 'User',
        telegramCode: '123456',
        isActive: true
      })

    await registerHandler(bot, createMessage(2, 222, '/register'), prismaMock as unknown as any)

    const handled = await handleRegisterCode(bot, createMessage(2, 222, '123456'), prismaMock as unknown as any)

    expect(handled).toBe(true)
    expect(prismaMock.user.update).toHaveBeenCalled()
    const message = bot.sendMessage.mock.calls.at(-1)?.[1] as string
    expect(message).toContain('Успешно')
  })

  it('blocks after multiple wrong codes', async () => {
    const bot = createBot()

    await registerHandler(bot, createMessage(3, 333, '/register'), prismaMock as unknown as any)

    await handleRegisterCode(bot, createMessage(3, 333, 'abc'), prismaMock as unknown as any)
    await handleRegisterCode(bot, createMessage(3, 333, 'abc'), prismaMock as unknown as any)
    await handleRegisterCode(bot, createMessage(3, 333, 'abc'), prismaMock as unknown as any)
    await handleRegisterCode(bot, createMessage(3, 333, 'abc'), prismaMock as unknown as any)

    const lastMessage = bot.sendMessage.mock.calls.at(-1)?.[1] as string
    expect(lastMessage).toContain('Слишком много неверных попыток')
  })
})
