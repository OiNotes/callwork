import { beforeEach, describe, expect, it, vi } from 'vitest'
import type TelegramBot from 'node-telegram-bot-api'
import { reportHandler, handleDateCallback, handleReportInput, handleReportConfirm } from '@/bot/handlers/report'
import { prismaMock } from '../../tests/mocks/prisma'

vi.mock('@/lib/services/RopSettingsService', () => ({
  RopSettingsService: {
    getEffectiveSettings: vi.fn(async () => ({
      telegramReportTtl: 30
    }))
  }
}))

const createBot = () => ({
  sendMessage: vi.fn(async () => undefined),
  answerCallbackQuery: vi.fn(async () => undefined),
  deleteMessage: vi.fn(async () => undefined)
}) as unknown as TelegramBot

const createMessage = (chatId: number, fromId: number, text?: string) => ({
  chat: { id: chatId },
  from: { id: fromId },
  text
}) as TelegramBot.Message

const createCallbackQuery = (chatId: number, fromId: number, data: string) => ({
  id: 'query-1',
  data,
  from: { id: fromId },
  message: { chat: { id: chatId }, message_id: 10 }
}) as TelegramBot.CallbackQuery

async function advanceToConfirm(bot: TelegramBot, chatId: number, userId: number) {
  const prisma = prismaMock as unknown as any

  await reportHandler(bot, createMessage(chatId, userId, '/report'), prisma)
  await handleDateCallback(bot, createCallbackQuery(chatId, userId, 'date_today'), prisma)

  await handleReportInput(bot, createMessage(chatId, userId, '10'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '8'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '0'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '2'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '2'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '2'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '1'), prisma)
  await handleReportInput(bot, createMessage(chatId, userId, '1000'), prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue({
    id: 'user-1',
    name: 'User',
    telegramId: '123',
    isActive: true,
    managerId: null
  })
  prismaMock.report.findFirst.mockResolvedValue(null)
  prismaMock.report.findUnique.mockResolvedValue(null)
  prismaMock.report.upsert.mockResolvedValue({ id: 'report-1' })
})

describe('reportHandler', () => {
  it('requires registration', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    const bot = createBot()

    await reportHandler(bot, createMessage(1, 123, '/report'), prismaMock as unknown as any)

    expect(bot.sendMessage).toHaveBeenCalled()
    const message = bot.sendMessage.mock.calls[0][1]
    expect(message).toContain('Вы не зарегистрированы')
  })
})

describe('handleReportConfirm', () => {
  it('saves report when confirmed', async () => {
    const bot = createBot()

    await advanceToConfirm(bot, 1, 123)

    await handleReportConfirm(bot, createCallbackQuery(1, 123, 'confirm_report'), prismaMock as unknown as any)

    expect(prismaMock.report.upsert).toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  it('asks confirmation when report already exists', async () => {
    const bot = createBot()

    await advanceToConfirm(bot, 2, 456)

    prismaMock.report.findUnique.mockResolvedValueOnce({ id: 'existing' })

    await handleReportConfirm(bot, createCallbackQuery(2, 456, 'confirm_report'), prismaMock as unknown as any)

    expect(prismaMock.report.upsert).not.toHaveBeenCalled()
    const callArgs = bot.sendMessage.mock.calls.map((call) => call[1])
    expect(callArgs.some((text) => String(text).includes('Перезаписать'))).toBe(true)
  })
})
