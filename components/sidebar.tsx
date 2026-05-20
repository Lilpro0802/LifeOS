'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  PlusCircle,
  CheckCircle,
  ArrowRightLeft,
  PiggyBank,
  CreditCard,
  Settings,
  ChevronLeft,
  Sun,
  Moon,
  Users,
  Sparkles,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useApp } from '@/lib/app-context'

const navItems = [
  { 
    section: 'OVERVIEW',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/add', label: 'Add Entry', icon: PlusCircle },
      { href: '/review', label: 'Review', icon: CheckCircle },
      { href: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
      { href: '/sms-import', label: 'SMS Sandbox', icon: Sparkles },
    ]
  },
  {
    section: 'FINANCE',
    items: [
      { href: '/savings', label: 'Savings', icon: PiggyBank },
      { href: '/cards', label: 'Cards', icon: CreditCard },
      { href: '/friends', label: 'Friends', icon: Users },
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const { state, isHydrated } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const pendingCount = mounted && isHydrated && state?.transactions
    ? state.transactions.filter(
        t => t.status === 'pending_review' || (t.status as string) === 'pending' || t.status === 'needs_context'
      ).length
    : 0

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = saved ? saved === 'dark' : prefersDark
    setIsDark(shouldBeDark)
    document.documentElement.classList.toggle('dark', shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    document.documentElement.classList.toggle('dark', newIsDark)
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
  }

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all-smooth tap-target',
              pathname === '/' ? 'text-primary' : 'text-muted-foreground active:text-foreground'
            )}
          >
            <LayoutDashboard className={cn('w-5 h-5', pathname === '/' && 'stroke-[2.5]')} />
            <span className="text-[9px] font-medium leading-none">Home</span>
          </Link>

          <Link
            href="/transactions"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all-smooth tap-target',
              pathname === '/transactions' ? 'text-primary' : 'text-muted-foreground active:text-foreground'
            )}
          >
            <ArrowRightLeft className={cn('w-5 h-5', pathname === '/transactions' && 'stroke-[2.5]')} />
            <span className="text-[9px] font-medium leading-none">History</span>
          </Link>

          {/* Elevated Floating Quick Add Button */}
          <Link
            href="/add"
            className="flex items-center justify-center -translate-y-4 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 border-4 border-background active:scale-90 transition-all-smooth tap-target shrink-0"
          >
            <PlusCircle className="w-6 h-6 stroke-[2.5]" />
          </Link>

          <Link
            href="/friends"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all-smooth tap-target',
              pathname === '/friends' ? 'text-primary' : 'text-muted-foreground active:text-foreground'
            )}
          >
            <Users className={cn('w-5 h-5', pathname === '/friends' && 'stroke-[2.5]')} />
            <span className="text-[9px] font-medium leading-none">Friends</span>
          </Link>

          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-all-smooth tap-target border-none bg-transparent outline-none cursor-pointer',
              isMoreOpen || ['/settings', '/review', '/sms-import', '/savings', '/cards'].includes(pathname)
                ? 'text-primary'
                : 'text-muted-foreground active:text-foreground'
            )}
          >
            <div className="relative">
              <MoreHorizontal className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-[8px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {isMoreOpen && (
        <div 
          onClick={() => setIsMoreOpen(false)}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Mobile Drawer Sheet */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border rounded-t-3xl transition-transform duration-300 transform safe-area-pb shadow-2xl pb-6",
          isMoreOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Drawer Handle */}
        <div className="flex justify-center py-2.5">
          <div className="w-12 h-1 bg-border rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">More Navigation</h3>
          <button 
            onClick={() => setIsMoreOpen(false)}
            className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid of buttons for pages */}
        <div className="p-5 grid grid-cols-3 gap-3.5">
          {/* Review Page */}
          <Link
            href="/review"
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors relative",
              pathname === '/review' && "bg-primary/10 border-primary text-primary"
            )}
          >
            <CheckCircle className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">Review</span>
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-destructive text-[8px] font-bold text-white rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>

          {/* SMS Import Sandbox */}
          <Link
            href="/sms-import"
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors",
              pathname === '/sms-import' && "bg-primary/10 border-primary text-primary"
            )}
          >
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <span className="text-[10px] font-semibold text-foreground">SMS Sandbox</span>
          </Link>

          {/* Savings */}
          <Link
            href="/savings"
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors",
              pathname === '/savings' && "bg-primary/10 border-primary text-primary"
            )}
          >
            <PiggyBank className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-semibold text-foreground">Savings</span>
          </Link>

          {/* Cards */}
          <Link
            href="/cards"
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors",
              pathname === '/cards' && "bg-primary/10 border-primary text-primary"
            )}
          >
            <CreditCard className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] font-semibold text-foreground">Cards</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors",
              pathname === '/settings' && "bg-primary/10 border-primary text-primary"
            )}
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground">Settings</span>
          </Link>

          {/* Toggle Theme */}
          <button
            onClick={() => {
              toggleTheme()
              setIsMoreOpen(false)
            }}
            className="flex flex-col items-center justify-center text-center gap-1.5 p-3.5 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-colors text-foreground cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-5 h-5 text-yellow-500" />
                <span className="text-[10px] font-semibold">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-violet-500" />
                <span className="text-[10px] font-semibold">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          'hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0',
          collapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0">
            L
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground text-base tracking-tight">Life OS</span>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'ml-auto p-1.5 rounded-lg hover:bg-sidebar-accent transition-all-smooth',
              collapsed && 'mx-auto ml-0'
            )}
          >
            <ChevronLeft className={cn('w-4 h-4 text-muted-foreground transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-hide">
          {navItems.map((group) => (
            <div key={group.section}>
              {!collapsed && (
                <h3 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground tracking-wider">
                  {group.section}
                </h3>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all-smooth',
                          isActive 
                            ? 'bg-sidebar-accent text-sidebar-foreground font-medium' 
                            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-sidebar-primary')} />
                        {!collapsed && <span className="text-sm">{item.label}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all-smooth text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground w-full',
              collapsed && 'justify-center px-2'
            )}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!collapsed && <span className="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all-smooth text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              collapsed && 'justify-center px-2',
              pathname === '/settings' && 'bg-sidebar-accent text-sidebar-foreground font-medium'
            )}
          >
            <Settings className="w-5 h-5" />
            {!collapsed && <span className="text-sm">Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
