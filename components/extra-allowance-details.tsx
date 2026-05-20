'use client'

import { useApp } from '@/lib/app-context'
import { getBudgetStatus, formatCurrency, getMonthTransactions } from '@/lib/calculations'
import { getCategoryIcon } from '@/lib/constants'
import { ArrowUpRight, Gift, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ExtraAllowanceDetails({ selectedMonth, selectedYear }: { selectedMonth?: number; selectedYear?: number }) {
  const { state, isHydrated } = useApp()

  if (!isHydrated) return null

  const now = new Date()
  const m = selectedMonth ?? now.getMonth()
  const y = selectedYear ?? now.getFullYear()

  const { extraSpent, extraInflow, extraPoolBalance } = getBudgetStatus(
    state.transactions,
    state.accounts,
    y,
    m
  )

  const percentSpent = extraInflow > 0 ? Math.min(100, Math.round((extraSpent / extraInflow) * 100)) : 0
  const percentRemaining = 100 - percentSpent

  // Get recent extra allowance transactions for the selected month/year
  const monthTx = getMonthTransactions(state.transactions, y, m)
  const extraTransactions = monthTx
    .filter(t => t.fundingSource === 'extra' || t.type === 'extra_allowance')
    .slice(0, 3)

  return (
    <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border dark:card-glow space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Gift className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Extra Allowance Pool</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Exceptional & Over-allowance Fund</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-500 rounded-full">
          Active Pool
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Remaining Pool</p>
          <p className="text-2xl lg:text-3xl font-extrabold text-foreground tabular-nums">
            {formatCurrency(extraPoolBalance)}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total Received</p>
          <p className="text-lg font-bold text-muted-foreground tabular-nums">
            {formatCurrency(extraInflow)}
          </p>
        </div>
      </div>

      {/* Visual meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{percentSpent}% spent</span>
          <span className="text-muted-foreground">{formatCurrency(extraSpent)} spent</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${percentSpent}%` }}
          />
        </div>
      </div>

      {/* Mini ledger of extra-allowance things */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Extra Transactions</p>
        {extraTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded-xl">No extra transactions yet this month</p>
        ) : (
          <div className="space-y-2">
            {extraTransactions.map((tx) => {
              const isDeposit = tx.type === 'extra_allowance'
              return (
                <div key={tx.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/40 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{isDeposit ? '🎁' : getCategoryIcon(tx.category)}</span>
                    <span className="font-medium truncate text-foreground">{tx.title}</span>
                  </div>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    isDeposit ? "text-green-600 dark:text-green-500" : "text-foreground"
                  )}>
                    {isDeposit ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
