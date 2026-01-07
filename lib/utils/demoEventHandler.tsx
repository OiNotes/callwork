/**
 * Demo Event Handler - обработчик событий для Demo режима
 *
 * Показывает toast уведомления и запускает конфетти
 */

import { toast } from 'sonner'
import { dealConfetti, milestoneConfetti, positionChangeConfetti, miniConfetti } from './confettiEffects'
import type { DemoEvent } from './demoDataSimulator'

/**
 * Форматирует число в рублях
 */
function formatRubles(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Обрабатывает демо-событие: показывает уведомление и запускает конфетти
 */
export function handleDemoEvent(event: DemoEvent) {
  switch (event.type) {
    case 'NEW_DEAL':
      handleNewDeal(event)
      break
    case 'NEW_CALL':
      handleNewCall(event)
      break
    case 'MILESTONE':
      handleMilestone(event)
      break
    case 'POSITION_CHANGE':
      handlePositionChange(event)
      break
  }
}

/**
 * Новая сделка - toast + конфетти справа
 */
function handleNewDeal(event: DemoEvent) {
  const { employeeName, amount } = event.data

  toast.success(
    <div className="flex items-center gap-3">
        <div className="text-4xl">🎉</div>
        <div>
          <div className="font-bold text-lg">Новая сделка!</div>
          <div className="text-sm text-[var(--muted-foreground)]">
            {employeeName} • {formatRubles(amount || 0)}
          </div>
        </div>
      </div>,
    {
      duration: 4000,
      style: {
        background: 'linear-gradient(135deg, var(--warning) 0%, var(--warning) 100%)',
        border: 'none',
        color: 'var(--foreground)',
        padding: '16px 20px',
        fontSize: '16px',
        boxShadow: 'var(--shadow-md)'
      }
    }
  )

  // Запускаем конфетти
  dealConfetti()
}

/**
 * Новый звонок - мини toast + небольшое конфетти
 */
function handleNewCall(event: DemoEvent) {
  const { employeeName } = event.data

  toast(
    <div className="flex items-center gap-3">
      <div className="text-3xl">📞</div>
      <div>
        <div className="font-semibold">Новый звонок</div>
        <div className="text-sm text-[var(--muted-foreground)]">{employeeName}</div>
      </div>
    </div>,
    {
      duration: 2500,
      style: {
        background: 'linear-gradient(135deg, var(--success) 0%, var(--success) 100%)',
        border: 'none',
        color: 'var(--primary-foreground)',
        padding: '12px 16px',
        fontSize: '14px',
        boxShadow: 'var(--shadow-md)'
      }
    }
  )

  // Мини конфетти
  miniConfetti(0.9)
}

/**
 * Milestone достигнут - большой toast + фейерверк
 */
function handleMilestone(event: DemoEvent) {
  const { milestone, totalSales } = event.data

  toast.success(
    <div className="flex items-center gap-4">
      <div className="text-5xl">🏆</div>
      <div>
        <div className="font-bold text-xl">Milestone достигнут!</div>
        <div className="text-lg text-[var(--muted-foreground)]">
          {milestone} • Всего: {formatRubles(totalSales || 0)}
        </div>
      </div>
    </div>,
    {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
        border: 'none',
        color: 'var(--primary-foreground)',
        padding: '20px 24px',
        fontSize: '18px',
        boxShadow: 'var(--shadow-lg)'
      }
    }
  )

  // Фейерверк со всех сторон
  milestoneConfetti()
}

/**
 * Смена позиции в топе - toast + конфетти снизу
 */
function handlePositionChange(event: DemoEvent) {
  const { employeeName, position } = event.data

  if (!position) return

  toast(
    <div className="flex items-center gap-3">
      <div className="text-4xl">⬆️</div>
      <div>
        <div className="font-bold text-lg">Смена позиции!</div>
        <div className="text-sm text-[var(--muted-foreground)]">
          {employeeName} • #{position.from} → #{position.to}
        </div>
      </div>
    </div>,
    {
      duration: 3500,
      style: {
        background: 'linear-gradient(135deg, var(--info) 0%, var(--info) 100%)',
        border: 'none',
        color: 'var(--primary-foreground)',
        padding: '16px 20px',
        fontSize: '16px',
        boxShadow: 'var(--shadow-md)'
      }
    }
  )

  // Конфетти снизу
  positionChangeConfetti()
}
