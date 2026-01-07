'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from '@/lib/motion'

interface Alert {
    id: string
    type: 'critical' | 'warning' | 'info'
    title: string
    description: string
    managerName?: string
}

interface RedZoneAlertsProps {
    alerts: Alert[]
}

export function RedZoneAlerts({ alerts }: RedZoneAlertsProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const handleToggleExpanded = useCallback(() => {
        setIsExpanded((prev) => !prev)
    }, [])

    if (alerts.length === 0) return null

    // Sort: Critical first
    const sortedAlerts = [...alerts].sort((a, b) => {
        if (a.type === 'critical' && b.type !== 'critical') return -1
        if (a.type !== 'critical' && b.type === 'critical') return 1
        return 0
    })

    const visibleAlerts = isExpanded ? sortedAlerts : sortedAlerts.slice(0, 3)
    const hiddenCount = sortedAlerts.length - 3

    // Helper to format description with bold text
    const formatDescription = (desc: string) => {
        const parts = desc.split(/(\d+(?:\.\d+)?%|Норма: \d+(?:\.\d+)?%)/g)
        return parts.map((part, i) => {
            if (part.match(/(\d+(?:\.\d+)?%|Норма: \d+(?:\.\d+)?%)/)) {
                return <b key={`${part}-${i}`} className="font-bold text-[var(--foreground)]">{part}</b>
            }
            return part
        })
    }

    return (
        <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
               <h2 className="text-lg font-bold text-[var(--foreground)]">Точки внимания</h2>
               {sortedAlerts.length > 3 && (
                   <button 
                      onClick={handleToggleExpanded}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Скрыть алерты' : 'Показать все алерты'}
                      className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1"
                   >
                      {isExpanded ? 'Свернуть' : `Показать еще ${hiddenCount}`}
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                   </button>
               )}
            </div>
            
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                <AnimatePresence initial={false}>
                    {visibleAlerts.map((alert) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`
                              relative pl-5 pr-4 py-3 rounded bg-[var(--card)] border border-[var(--border)] shadow-sm
                              before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:rounded-l
                              ${alert.type === 'critical' ? 'before:bg-[var(--danger)]' : ''}
                              ${alert.type === 'warning' ? 'before:bg-[var(--warning)]' : ''}
                              ${alert.type === 'info' ? 'before:bg-[var(--primary)]' : ''}
                            `}
                        >
                            <div className="flex items-start gap-3">
                               <div className="mt-0.5 shrink-0">
                                  {alert.type === 'critical' && <AlertCircle className="w-4 h-4 text-[var(--danger)]" />}
                                  {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />}
                                  {alert.type === 'info' && <Info className="w-4 h-4 text-[var(--primary)]" />}
                               </div>
                               <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                     {alert.managerName && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
                                           {alert.managerName}
                                        </span>
                                     )}
                                     <h4 className="text-sm font-bold text-[var(--foreground)]">
                                        {alert.title.replace('Проблема на этапе ', '')}
                                     </h4>
                                  </div>
                                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                                     {formatDescription(alert.description)}
                                  </p>
                               </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
