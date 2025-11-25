'use client'

import { memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Bar, ComposedChart, Line } from 'recharts'

interface TrendData {
  date: string
  sales: number
  deals: number
}

interface PerformanceTrendChartProps {
  data: TrendData[]
  className?: string
}

export const PerformanceTrendChart = memo(function PerformanceTrendChart({ data, className }: PerformanceTrendChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
            data={data} 
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            barGap={4} // Increased gap for readability
        >
          <defs>
            <linearGradient id="gradientSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          
          {/* Left Axis: Money (Sales) - Primary Blue */}
          <YAxis
            yAxisId="left"
            tick={{ fill: 'var(--primary)', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          
          {/* Right Axis: Quantity (Deals) - Orange/Contrast */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#F97316', fontSize: 11, fontWeight: 500 }} // Orange-500
            tickLine={false}
            axisLine={false}
          />
          
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '12px'
            }}
            itemStyle={{ padding: 0 }}
          />
          
          <Legend 
            verticalAlign="top" 
            height={36}
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
          
          {/* Sales: BAR (Volume) - with visible gap */}
          <Bar
            yAxisId="left"
            dataKey="sales"
            name="Продажи (₽)"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            barSize={16} // Significantly reduced for better separation
            opacity={0.9}
          />

          {/* Deals: LINE (Trend) - Smoothed */}
          <Line
            yAxisId="right"
            type="monotone" // Smooth interpolation
            dataKey="deals"
            name="Сделки (шт)"
            stroke="#F97316" // Orange
            strokeWidth={3}
            dot={false} // Cleaner look without dots everywhere
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
})