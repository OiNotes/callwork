'use client'

import { memo } from 'react'
import { motion } from '@/lib/motion'
import { CheckCircle2, AlertTriangle, Target } from 'lucide-react'
import { RedZone, getSeverityColor, getSeverityIcon } from '@/lib/analytics/recommendations'

interface RedZoneAnalysisProps {
  redZones: RedZone[]
}

export const RedZoneAnalysis = memo(function RedZoneAnalysis({ redZones }: RedZoneAnalysisProps) {
  if (redZones.length === 0) {
    return (
      <div className="mt-8 p-6 bg-[var(--success)]/10 rounded-[var(--radius-lg)] border-2 border-[var(--success)]/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--success)] flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-[var(--status-foreground)]" />
            </div>
          <div>
            <h3 className="text-xl font-semibold text-[var(--success)]">Всё отлично!</h3>
            <p className="text-sm text-[var(--success)]/80 mt-1">
              Все показатели выше среднего по команде
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
        Зоны для улучшения
      </h2>

      <div className="space-y-4">
        {redZones.map((zone, index) => (
          <motion.div
            key={zone.stage}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-6 rounded-[var(--radius-lg)] border-2 ${getSeverityColor(zone.severity)}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[var(--primary-foreground)] ${getSeverityIcon(zone.severity)}`}>
                !
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-[var(--foreground)] mb-2">{zone.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-3">{zone.description}</p>

                <div className="flex gap-6 text-sm mb-3">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Текущее:</span>
                    <strong className="text-[var(--danger)] ml-2">{zone.current}%</strong>
                  </div>
                  <div className="text-[var(--border)]">•</div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Средняя:</span>
                    <strong className="text-[var(--foreground)] ml-2">{zone.teamAverage}%</strong>
                  </div>
                  <div className="text-[var(--border)]">•</div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Разрыв:</span>
                    <strong className="text-[var(--danger)] ml-2">-{zone.teamAverage - zone.current}%</strong>
                  </div>
                </div>

                <div className="p-4 bg-[var(--info)]/10 rounded-[var(--radius-md)] border border-[var(--info)]/20">
                  <p className="text-sm text-[var(--info)] flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Рекомендация:</strong> {zone.recommendation}</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
