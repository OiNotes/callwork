'use client'

import { Star } from 'lucide-react'
import { useCallback } from 'react'
import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/SkeletonTable'

export interface DealCard {
  id: string
  title: string
  budget: number
  status: 'OPEN' | 'WON' | 'LOST'
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
  isFocus: boolean
  updatedAt?: string
}

interface DealsListProps {
  deals: DealCard[]
  loading?: boolean
  error?: string | null
  onToggleFocus: (dealId: string, nextValue: boolean) => Promise<void> | void
}

export function DealsList({ deals, loading = false, error, onToggleFocus }: DealsListProps) {
  const handleFocusClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const dealId = event.currentTarget.dataset.dealId
    const nextValue = event.currentTarget.dataset.nextFocus === 'true'
    if (!dealId) return
    onToggleFocus(dealId, nextValue)
  }, [onToggleFocus])

  return (
    <div className="border rounded-lg border-[var(--border)] bg-[var(--card)] overflow-hidden h-full flex flex-col">
      <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--muted)]/30">
        <h3 className="text-xs font-bold uppercase text-[var(--muted-foreground)] tracking-wide">Фокус-лист</h3>
      </div>

      {error && (
        <div className="p-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10">
          {error}
        </div>
      )}

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-3">
            <SkeletonTable rows={4} columns={3} className="border-0 bg-transparent" />
          </div>
        ) : deals.length === 0 ? (
          <EmptyState
            title="Фокус-лист пуст"
            description="Добавьте сделки в фокус, чтобы отслеживать ключевые оплаты."
            actionLabel="Открыть сделки"
            actionHref="/dashboard/forecast/income"
          />
        ) : (
          <table className="w-full text-xs text-left" aria-label="Фокус-сделки">
            <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-medium sticky top-0">
               <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Сделка</th>
                  <th className="px-3 py-2 w-24 text-right">Бюджет</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-[var(--muted)]/20 transition-colors group">
                  <td className="px-2 py-2 text-center">
                     <button
                      data-deal-id={deal.id}
                      data-next-focus={deal.isFocus ? 'false' : 'true'}
                      onClick={handleFocusClick}
                      className={cn(
                          "p-1 rounded hover:bg-[var(--muted)] transition-colors",
                          deal.isFocus ? "text-[var(--warning)]" : "text-[var(--muted-foreground)] opacity-20 group-hover:opacity-100"
                      )}
                     >
                        <Star className={cn("w-3.5 h-3.5", deal.isFocus && "fill-current")} />
                     </button>
                  </td>
                  <td className="px-3 py-2">
                     <div className="font-medium text-[var(--foreground)] truncate max-w-[150px] sm:max-w-[200px]" title={deal.title}>
                         {deal.title}
                     </div>
                     <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            deal.status === 'WON' ? "bg-[var(--success)]" :
                            deal.status === 'LOST' ? "bg-[var(--danger)]" :
                            "bg-[var(--primary)]"
                        )}/>
                        <span className="text-[10px] text-[var(--muted-foreground)] lowercase">
                            {deal.status === 'OPEN' ? 'в работе' : deal.status === 'WON' ? 'успех' : 'отказ'}
                        </span>
                     </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--foreground)] tabular-nums">
                      {formatMoney(deal.budget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
