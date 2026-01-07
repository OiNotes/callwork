'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from '@/lib/motion'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart2 } from 'lucide-react'

interface TeamComparisonProps {
  employeeStats: {
    deals: number
    sales: number
    bookedToZoom1: number
    pushToDeal: number
  }
  teamAverage: {
    deals: number
    sales: number
    bookedToZoom1: number
    pushToDeal: number
  }
}

export function TeamComparisonChart({ employeeStats, teamAverage }: TeamComparisonProps) {
  const data = [
    {
      metric: 'Сделки',
      employee: employeeStats.deals,
      team: teamAverage.deals
    },
    {
      metric: 'Запись → 1-й Zoom',
      employee: employeeStats.bookedToZoom1,
      team: teamAverage.bookedToZoom1
    },
    {
      metric: 'Дожим → Оплата',
      employee: employeeStats.pushToDeal,
      team: teamAverage.pushToDeal
    }
  ]
  const hasData = data.some((item) => item.employee > 0 || item.team > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-6 h-6" />}
        title="Нет данных"
        description="Данные появятся после создания отчётов"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[var(--card)] rounded-2xl p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]"
    >
      <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Сравнение с командой</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="metric" stroke="var(--muted-foreground)" />
            <YAxis stroke="var(--muted-foreground)" />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="employee"
              fill="var(--primary)"
              name="Сотрудник"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="team"
              fill="var(--secondary-foreground)"
              name="Средняя по команде"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
