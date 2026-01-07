'use client'

import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart2 } from 'lucide-react'

interface ActivityData {
  day: string
  pzm: number
  vzm: number
  deals: number
}

interface WeeklyActivityChartProps {
  data: ActivityData[]
}

export const WeeklyActivityChart = memo(function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-6 h-6" />}
        title="Нет данных"
        description="Данные появятся после создания отчётов"
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="square"
        />
        <Bar dataKey="pzm" fill="var(--primary)" radius={[8, 8, 0, 0]} name="ПЗМ" />
        <Bar dataKey="vzm" fill="var(--info)" radius={[8, 8, 0, 0]} name="ВЗМ" />
        <Bar dataKey="deals" fill="var(--success)" radius={[8, 8, 0, 0]} name="Сделки" />
      </BarChart>
    </ResponsiveContainer>
  )
})
