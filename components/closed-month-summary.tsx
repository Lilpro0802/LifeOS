'use client'

import { useApp } from '@/lib/app-context'
import { formatCurrency } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { Calendar, RefreshCw, Users, ShieldAlert, Award, TrendingUp, DollarSign, Store } from 'lucide-react'
import type { MonthlySnapshot } from '@/lib/types'

interface ClosedMonthSummaryProps {
  snapshot: MonthlySnapshot
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function ClosedMonthSummary({ snapshot }: ClosedMonthSummaryProps) {
  const { reopenMonth } = useApp()

  const handleReopen = () => {
    if (confirm(`Are you sure you want to reopen ${MONTH_NAMES[snapshot.month - 1]} ${snapshot.year}? The compiled snapshot will be deleted and the period will become editable again.`)) {
      reopenMonth(snapshot.year, snapshot.month)
    }
  }

  return (
    <div className="space-y-6">
      {/* Closed Banner */}
      <div className="bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0 text-yellow-600 dark:text-yellow-500 text-xl">
            🔒
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Locked Financial Period: {MONTH_NAMES[snapshot.month - 1]} {snapshot.year}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              This month was closed on {new Date(snapshot.closedAt).toLocaleDateString()} · Transactions are read-only
            </p>
          </div>
        </div>

        <button
          onClick={handleReopen}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all-smooth"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reopen Period</span>
        </button>
      </div>

      {/* Main Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spending */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Spending</span>
          <span className="text-2xl font-extrabold text-foreground mt-1.5 block tabular-nums">
            {formatCurrency(snapshot.spendingTotals.total)}
          </span>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
            <span>Base: {formatCurrency(snapshot.spendingTotals.base)}</span>
            <span>Extra: {formatCurrency(snapshot.spendingTotals.extra)}</span>
          </div>
        </div>

        {/* Rollover Savings */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Savings Deposits</span>
          <span className="text-2xl font-extrabold text-green-600 dark:text-green-500 mt-1.5 block tabular-nums">
            {formatCurrency(snapshot.savingsAdded)}
          </span>
          <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-1.5">
            Additional reserve protected: {formatCurrency(snapshot.protectedReserveSnapshot)}
          </p>
        </div>

        {/* Extra Allowance */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Extra Allowance Used</span>
          <span className="text-2xl font-extrabold text-foreground mt-1.5 block tabular-nums">
            {formatCurrency(snapshot.extraAllowanceUsed)}
          </span>
          <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-1.5">
            Funded by extra allowance pool
          </p>
        </div>

        {/* Social Activity */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Settlement Activity</span>
          <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-500 mt-1.5 block tabular-nums">
            {formatCurrency(snapshot.settlementActivity)}
          </span>
          <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-1.5">
            Total peer debts resolved
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/50 pb-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Category Spending
          </h3>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {snapshot.categoryBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No categories recorded this month.</p>
            ) : (
              snapshot.categoryBreakdown.map(c => (
                <div key={c.categoryId} className="flex items-center justify-between text-xs p-2 bg-muted/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{c.icon}</span>
                    <span className="font-medium text-foreground">{c.name}</span>
                  </div>
                  <span className="font-extrabold text-foreground tabular-nums">{formatCurrency(c.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Merchants */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/50 pb-2">
            <Store className="w-4 h-4 text-primary" /> Top Merchants
          </h3>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {snapshot.topMerchants.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No merchants recorded this month.</p>
            ) : (
              snapshot.topMerchants.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-muted/20 rounded-xl">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="font-semibold text-foreground truncate block">{m.merchant}</span>
                    <span className="text-[10px] text-muted-foreground">{m.count} transaction{m.count > 1 ? 's' : ''}</span>
                  </div>
                  <span className="font-extrabold text-foreground tabular-nums shrink-0">{formatCurrency(m.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Friends Ledger Snapshot */}
        <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/50 pb-2">
            <Users className="w-4 h-4 text-primary" /> Crew Ledger Snapshot
          </h3>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {snapshot.friendBalancesSnapshot.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No crew members set up.</p>
            ) : (
              snapshot.friendBalancesSnapshot.map(f => {
                const absBal = Math.abs(f.balance)
                const isPositive = f.balance > 0
                const isZero = Math.abs(f.balance) < 0.01

                return (
                  <div key={f.friendId} className="flex items-center justify-between text-xs p-2.5 bg-muted/20 rounded-xl">
                    <span className="font-semibold text-foreground truncate">{f.name}</span>
                    {isZero ? (
                      <span className="text-[10px] text-muted-foreground italic">Settled 🤝</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[9px] font-bold px-1 py-0.5 rounded border leading-none uppercase",
                          isPositive
                            ? "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20"
                            : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        )}>
                          {isPositive ? "Owed you" : "You owed"}
                        </span>
                        <span className="font-extrabold text-foreground tabular-nums">
                          {formatCurrency(absBal)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
