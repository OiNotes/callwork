'use client'

import Link from 'next/link'
import { Settings, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Настройки</h1>
          <p className="text-[var(--muted-foreground)]">Управление аккаунтом и системой</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard/settings/rop">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card p-6 h-full rounded-[24px] cursor-pointer hover:shadow-lg hover:shadow-[var(--primary)]/10 transition-all border border-[var(--border)]"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center mb-4 shadow-lg shadow-[var(--primary)]/30">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Настройки РОПа</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Планы продаж, нормы конверсий, грейды мотивации и пороговые значения алертов
              </p>
            </motion.div>
          </Link>

          <Link href="/profile">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card p-6 h-full rounded-[24px] cursor-pointer hover:shadow-lg hover:shadow-[var(--primary)]/10 transition-all border border-[var(--border)]"
            >
              <div className="w-12 h-12 rounded-2xl bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center mb-4 group-hover:border-[var(--primary)]/50 transition-colors">
                <User className="w-6 h-6 text-[var(--foreground)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Профиль</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Личная информация, настройки безопасности и уведомлений
              </p>
            </motion.div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}