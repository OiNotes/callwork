'use client'

import { memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface TrendData {
  date: string
  sales: number
  deals: number
}

interface PerformanceTrendChartProps {
  data: TrendData[]
}

export const PerformanceTrendChart = memo(function PerformanceTrendChart({ data, className }: PerformanceTrendChartProps & { className?: string }) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSales2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--success)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--success)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
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
            iconType="line"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="sales"
            stroke="var(--primary)"
            fillOpacity={1}
            fill="url(#colorSales2)"
            strokeWidth={2}
            name="Продажи (₽)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="deals"
            stroke="var(--success)"
            fillOpacity={1}
            fill="url(#colorDeals)"
            strokeWidth={2}
            name="Сделки"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})
