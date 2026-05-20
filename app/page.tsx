'use client'

import { Sidebar } from '@/components/sidebar'
import { SpendingChart } from '@/components/spending-chart'
import { BudgetDonut } from '@/components/budget-donut'
import { CardUtilization } from '@/components/card-utilization'
import { RecentTransactions } from '@/components/recent-transactions'
import { ExtraAllowanceDetails } from '@/components/extra-allowance-details'
import { FriendSummaryCard } from '@/components/friend-summary-card'
import { MonthLifecycleCenter } from '@/components/month-lifecycle-center'
import { ClosedMonthSummary } from '@/components/closed-month-summary'
import { getGreeting } from '@/lib/calculations'
import { useApp } from '@/lib/app-context'
import { Plus, Lock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const { state, isHydrated } = useApp()
  const [greeting, setGreeting] = useState('Welcome')
  const [today, setToday] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Generate options for the last 6 months
  const monthOptions = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return {
      month: d.getMonth(),
      year: d.getFullYear(),
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    }
  })

  useEffect(() => {
    setGreeting(getGreeting())
    setToday(new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }))
  }, [])

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          {/* Skeleton Header */}
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-pt">
            <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
              <div className="space-y-2">
                <div className="skeleton h-5 w-32 rounded-lg" />
                <div className="skeleton h-3 w-24 rounded-lg hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <div className="skeleton h-9 w-24 rounded-xl" />
                <div className="skeleton h-9 w-9 rounded-xl" />
              </div>
            </div>
          </div>
          {/* Skeleton Content */}
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            <div className="skeleton h-32 w-full rounded-2xl" />
            <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
              <div className="skeleton h-64 w-full rounded-2xl" />
              <div className="skeleton h-64 w-full rounded-2xl" />
            </div>
            <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
              <div className="skeleton h-48 w-full rounded-2xl" />
              <div className="skeleton h-48 w-full rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  const closedMonths = state?.closedMonths || []
  const currentSnapshot = closedMonths.find(s => s.year === selectedYear && s.month === (selectedMonth + 1))
  const isClosed = !!currentSnapshot

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-pt">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-semibold text-foreground truncate">{greeting}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setSelectedYear(y)
                  setSelectedMonth(m)
                }}
                className="bg-card border border-border rounded-xl px-2.5 py-1.5 lg:px-3 lg:py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all-smooth"
              >
                {monthOptions.map((opt) => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {isClosed ? (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-xl text-xs font-bold select-none shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked</span>
                </div>
              ) : (
                <Link
                  href="/add"
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all-smooth shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add transaction</span>
                </Link>
              )}
            </div>
          </div>
        </header>
 
        {/* Content */}
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-x-hidden animate-fade-in-up">
          {isClosed ? (
            <>
              <ClosedMonthSummary snapshot={currentSnapshot} />
              <RecentTransactions selectedMonth={selectedMonth} selectedYear={selectedYear} isClosed={true} />
            </>
          ) : (
            <>
              <MonthLifecycleCenter year={selectedYear} month={selectedMonth + 1} />
              
              {/* Main Grid - Stack on mobile */}
              <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
                <SpendingChart selectedMonth={selectedMonth} selectedYear={selectedYear} />
                <BudgetDonut selectedMonth={selectedMonth} selectedYear={selectedYear} />
              </div>

              {/* Extra Allowance & Crew Summary Sections */}
              <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
                <ExtraAllowanceDetails selectedMonth={selectedMonth} selectedYear={selectedYear} />
                <FriendSummaryCard />
              </div>

              {/* Card Utilization */}
              <CardUtilization selectedMonth={selectedMonth} selectedYear={selectedYear} />

              {/* Recent Transactions */}
              <RecentTransactions selectedMonth={selectedMonth} selectedYear={selectedYear} isClosed={false} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
