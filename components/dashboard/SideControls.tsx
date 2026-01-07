'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from '@/lib/motion'
import { PeriodPreset } from '@/components/filters/PeriodSelector'

interface SideControlsProps {
  // Period Props
  selectedPreset: PeriodPreset
  range: { start: Date; end: Date }
  onPresetChange: (preset: PeriodPreset, range: { start: Date; end: Date }) => void
  
  // Manager Props
  managers: Array<{ id: string; name: string }>
  selectedManagerId: string
  onSelectManager: (id: string) => void
}

const toDateInputValue = (date: Date) => {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

export function SideControls({ 
  selectedPreset, 
  range, 
  onPresetChange,
  managers,
  selectedManagerId,
  onSelectManager
}: SideControlsProps) {
  const [mounted, setMounted] = useState(false)
  const [activePanel, setActivePanel] = useState<'none' | 'manager' | 'customDate'>('none')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // --- Logic Helpers ---

  const presets = [
    { key: 'today', label: 'День' },
    { key: 'week', label: 'Неделя' },
    { key: 'thisMonth', label: 'Месяц' },
    { key: 'lastMonth', label: 'Пред.' },
  ] as const

  const handlePreset = useCallback((preset: PeriodPreset) => {
    const now = new Date()
    let start = new Date(range.start)
    let end = new Date(range.end)

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - 7)
        end = now
        break
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = now
        break
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      default:
        break
    }
    onPresetChange(preset, { start, end })
    setActivePanel('none')
  }, [onPresetChange, range.end, range.start])

  const handlePresetClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const preset = event.currentTarget.dataset.preset as PeriodPreset | undefined
    if (!preset) return
    handlePreset(preset)
  }, [handlePreset])

  const handleCustomChange = (key: 'start' | 'end', value: string) => {
    if (!value) return
    const next = {
      start: key === 'start' ? new Date(value) : range.start,
      end: key === 'end' ? new Date(value) : range.end,
    }
    onPresetChange('custom', next)
  }

  // Get manager display info
  const selectedManager = managers.find(m => m.id === selectedManagerId)
  const managerInitials = selectedManager 
    ? selectedManager.name.slice(0, 2).toUpperCase() 
    : (selectedManagerId === 'all' ? 'ВС' : '??')

  const toggleManagerPanel = useCallback(() => {
    setActivePanel((prev) => (prev === 'manager' ? 'none' : 'manager'))
  }, [])

  const toggleCustomDatePanel = useCallback(() => {
    setActivePanel((prev) => (prev === 'customDate' ? 'none' : 'customDate'))
  }, [])

  const closePanel = useCallback(() => {
    setActivePanel('none')
  }, [])

  const handleManagerSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.managerId
    if (!id) return
    onSelectManager(id)
    setActivePanel('none')
  }, [onSelectManager])

  if (!mounted) return null

  return createPortal(
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      
      {/* Main Vertical Dock */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-[var(--card)]/90 backdrop-blur-xl border border-[var(--border)]/60 shadow-[var(--shadow-lg)] rounded-2xl p-2 flex flex-col gap-2 pointer-events-auto w-[64px] items-center"
      >
        {/* 1. Manager Trigger */}
        <div className="relative group w-full flex justify-center">
            <button 
                onClick={toggleManagerPanel}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                    ${activePanel === 'manager' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--border)]' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'}
                `}
            >
                {managerInitials}
            </button>
            <span className="absolute right-[120%] top-1/2 -translate-y-1/2 bg-[var(--accent)] text-[var(--foreground)] text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-[var(--border)]">
                {selectedManager ? selectedManager.name : 'Все менеджеры'}
            </span>
        </div>

        <div className="w-8 h-[1px] bg-[var(--border)]/60" />

        {/* 2. Period Buttons */}
        <div className="flex flex-col gap-1 w-full items-center">
            {presets.map((item) => {
                const isActive = selectedPreset === item.key
                return (
                    <button
                        key={item.key}
                        data-preset={item.key}
                        onClick={handlePresetClick}
                        className={`
                            w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200
                            ${isActive 
                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' 
                                : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--primary)]'}
                        `}
                    >
                        {item.label}
                    </button>
                )
            })}
        </div>

        <div className="w-8 h-[1px] bg-[var(--border)]/60" />

        {/* 3. Custom Date Trigger */}
        <button
            onClick={toggleCustomDatePanel}
            className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200
                ${selectedPreset === 'custom' || activePanel === 'customDate'
                    ? 'text-[var(--primary)] bg-[var(--primary)]/15' 
                    : 'text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--secondary)]'}
            `}
        >
            <Calendar className="w-4 h-4" />
        </button>

      </motion.div>


      {/* --- Sliding Panels --- */}
      <AnimatePresence>
        
        {/* Manager Selection Panel */}
        {activePanel === 'manager' && (
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: -12, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="pointer-events-auto absolute right-full top-0 mr-2 bg-[var(--card)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-lg)] rounded-2xl p-2 w-[240px] max-h-[400px] flex flex-col overflow-hidden origin-top-right"
                style={{ top: '-20px' }} // Align with top of dock
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] mb-1">
                    <span className="text-xs font-bold text-[var(--foreground)] uppercase">Сотрудники</span>
                    <button onClick={closePanel} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={14}/></button>
                </div>
                <div className="overflow-y-auto flex-1 p-1 space-y-0.5 custom-scrollbar">
                    <button
                        data-manager-id="all"
                        onClick={handleManagerSelect}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedManagerId === 'all' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--secondary)] text-[var(--foreground)]'}`}
                    >
                        <span>Все менеджеры</span>
                        {selectedManagerId === 'all' && <Check size={14} />}
                    </button>
                    {managers.map(m => (
                        <button
                            key={m.id}
                            data-manager-id={m.id}
                            onClick={handleManagerSelect}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedManagerId === m.id ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--secondary)] text-[var(--foreground)]'}`}
                        >
                            <span>{m.name}</span>
                            {selectedManagerId === m.id && <Check size={14} />}
                        </button>
                    ))}
                </div>
            </motion.div>
        )}

        {/* Date Selection Panel */}
        {activePanel === 'customDate' && (
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: -12, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="pointer-events-auto absolute right-full bottom-0 mr-2 bg-[var(--card)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-lg)] rounded-2xl p-4 w-[260px] origin-bottom-right"
                style={{ bottom: '0px' }} // Align with bottom of dock
            >
                 <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[var(--foreground)] uppercase">Диапазон дат</span>
                    <button onClick={closePanel} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={14}/></button>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-[var(--muted-foreground)] font-medium ml-1">С</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.start)}
                            onChange={(e) => handleCustomChange('start', e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-[var(--muted-foreground)] font-medium ml-1">По</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.end)}
                            onChange={(e) => handleCustomChange('end', e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                        />
                    </div>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>,
    document.body
  )
}
