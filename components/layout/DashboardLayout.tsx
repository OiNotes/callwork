'use client'

import { memo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, TrendingUp, BarChart, Trophy, Bell, LayoutDashboard, ClipboardList, Settings, User, Users, Target, Menu } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { AlertBadge } from '@/components/alerts/AlertBadge'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { motion } from '@/lib/motion'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'
  const roleLabel =
    session?.user?.role === 'ADMIN'
      ? 'Admin'
      : session?.user?.role === 'MANAGER'
        ? 'Manager'
        : 'Employee'

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' })
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ...(session?.user?.role === 'EMPLOYEE'
      ? [{ name: 'Отчёт', href: '/dashboard/report', icon: ClipboardList }]
      : []),
    { name: 'Forecast', href: '/dashboard/forecast', icon: TrendingUp },
    { name: 'Funnel', href: '/dashboard/analytics/funnel', icon: BarChart },
    { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
    {
      name: 'Alerts',
      href: '/dashboard/alerts',
      icon: Bell,
      badge: <AlertBadge />
    },
    ...(isManager
      ? [
          { name: 'Users', href: '/dashboard/admin/users', icon: Users },
          { name: 'Goals', href: '/dashboard/admin/goals', icon: Target },
        ]
      : []),
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)] transition-colors duration-300">
      {/* Floating Header */}
      <header className="sticky top-6 z-50 px-6 mb-8">
        <div className="max-w-7xl mx-auto glass-card rounded-[24px] h-[72px] flex items-center justify-between px-2 pl-6">
          {/* Logo — Refined wordmark */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-[22px] font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-[var(--primary)] to-blue-400 bg-clip-text text-transparent">C</span>
              <span className="text-[var(--foreground)]">allwork</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-[var(--secondary)]/50 p-1.5 rounded-full border border-[var(--border)]">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${active
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-md border border-[var(--border)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-[var(--primary)]' : ''}`} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3 pl-6">
            {/* Mobile Navigation */}
            {session?.user && (
              <div className="lg:hidden">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      aria-label="Открыть меню"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="min-w-[220px] bg-[var(--card)]/95 backdrop-blur-xl rounded-[16px] p-2 shadow-xl border border-[var(--border)] z-50"
                      sideOffset={8}
                      align="end"
                    >
                      {navigation.map((item) => {
                        const Icon = item.icon
                        return (
                          <DropdownMenu.Item
                            key={item.href}
                            className="group flex items-center px-3 py-2.5 text-sm text-[var(--foreground)] rounded-lg hover:bg-[var(--secondary)] outline-none cursor-pointer transition-colors"
                            asChild
                          >
                            <Link href={item.href}>
                              <Icon className="w-5 h-5 mr-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                              <span className="flex-1">{item.name}</span>
                            </Link>
                          </DropdownMenu.Item>
                        )
                      })}
                      <DropdownMenu.Separator className="h-[1px] bg-[var(--border)] my-2" />
                      <DropdownMenu.Item
                        className="group flex items-center px-3 py-2.5 text-sm text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/10 outline-none cursor-pointer transition-colors"
                        onSelect={handleSignOut}
                      >
                        <LogOut className="w-5 h-5 mr-3" />
                        Выход
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* TV Mode */}
            <Link
              href="/tv"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
              aria-label="TV режим"
              title="TV режим"
            >
              <LayoutDashboard className="h-5 w-5" />
            </Link>

            {/* Divider */}
            <div className="h-8 w-px bg-[var(--border)]" />

            {/* User Profile — Compact avatar with gradient ring */}
            {session?.user && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="group relative outline-none">
                    {/* Gradient ring */}
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-[var(--primary)] via-blue-400 to-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Avatar */}
                    <div className="relative grid h-10 w-10 place-items-center rounded-full bg-[var(--secondary)] border-2 border-[var(--card)] text-sm font-semibold text-[var(--foreground)] transition-transform duration-200 group-hover:scale-105">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--card)] bg-emerald-500" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[240px] bg-[var(--card)]/95 backdrop-blur-xl rounded-[16px] p-2 shadow-xl border border-[var(--border)] z-50"
                    sideOffset={8}
                    align="end"
                  >
                    {/* User info header */}
                    <div className="px-3 py-3 border-b border-[var(--border)] mb-2">
                      <div className="font-medium text-[var(--foreground)]">{session.user.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{session.user.email}</div>
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-semibold uppercase tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                        {roleLabel}
                      </div>
                    </div>

                    <DropdownMenu.Item className="group flex items-center px-3 py-2.5 text-sm text-[var(--foreground)] rounded-lg hover:bg-[var(--secondary)] outline-none cursor-pointer transition-colors" asChild>
                      <Link href="/dashboard/profile">
                        <User className="w-4 h-4 mr-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                        Профиль
                      </Link>
                    </DropdownMenu.Item>

                    {isManager && (
                      <DropdownMenu.Item className="group flex items-center px-3 py-2.5 text-sm text-[var(--foreground)] rounded-lg hover:bg-[var(--secondary)] outline-none cursor-pointer transition-colors" asChild>
                        <Link href="/dashboard/settings/rop">
                          <Settings className="w-4 h-4 mr-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                          Настройки
                        </Link>
                      </DropdownMenu.Item>
                    )}

                    <DropdownMenu.Separator className="h-[1px] bg-[var(--border)] my-2" />

                    <DropdownMenu.Item
                      className="group flex items-center px-3 py-2.5 text-sm text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/10 outline-none cursor-pointer transition-colors"
                      onSelect={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Выйти
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
})
