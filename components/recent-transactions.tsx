'use client'

import { formatCurrency, formatDateShort, getMonthTransactions } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useApp } from '@/lib/app-context'
import { getCategoryIcon } from '@/lib/constants'

export function RecentTransactions({ selectedMonth, selectedYear, isClosed }: { selectedMonth?: number; selectedYear?: number; isClosed?: boolean }) {
  const { state, isHydrated } = useApp()

  const now = new Date()
  const m = selectedMonth ?? now.getMonth()
  const y = selectedYear ?? now.getFullYear()

  const monthTx = getMonthTransactions(state.transactions, y, m)

  const recentTransactions = monthTx
    .filter(t => 
      t.type === 'expense' || 
      t.type === 'savings_deposit' || 
      t.type === 'savings_withdrawal' ||
      t.type === 'allowance' ||
      t.type === 'extra_allowance' ||
      t.type === 'reimbursement'
    )
    .sort((a, b) => {
      const aTime = a.parsedTimestamp || new Date(a.date + 'T00:00:00').getTime()
      const bTime = b.parsedTimestamp || new Date(b.date + 'T00:00:00').getTime()
      return bTime - aTime
    })
    .slice(0, 5)

  if (!isHydrated) return null

  return (
    <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border dark:card-glow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Recent Transactions</h3>
        <div className="flex items-center gap-3">
          {!isClosed && (
            <Link 
              href="/add"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors hidden sm:block"
            >
              + Add new
            </Link>
          )}
          <Link 
            href="/transactions"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            See more
          </Link>
        </div>
      </div>

      {/* Mobile-first transaction list - cards instead of table */}
      <div className="space-y-2">
        {recentTransactions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No recent transactions.</p>
          </div>
        ) : recentTransactions.map((transaction) => {
          const accountName = state.accounts.find(a => a.id === transaction.accountId)?.name || 'Unknown Account'
          const isPositive =
            transaction.type === 'allowance' ||
            transaction.type === 'extra_allowance' ||
            transaction.type === 'savings_withdrawal' ||
            transaction.type === 'reimbursement'
          
          return (
          <Link
            key={transaction.id}
            href={`/edit/${transaction.id}`}
            className="flex items-center gap-3 p-3 -mx-1 rounded-xl hover:bg-muted/50 transition-all-smooth cursor-pointer active:scale-[0.99]"
          >
            {/* Category icon */}
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-base shrink-0">
              {getCategoryIcon(transaction.category)}
            </div>
            
            {/* Transaction details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{transaction.title}</p>
                <span className={cn(
                  'font-semibold tabular-nums text-sm shrink-0',
                  isPositive ? 'text-green-600 dark:text-green-500' : 'text-foreground'
                )}>
                  {isPositive ? '+' : '-'}{formatCurrency(transaction.amount)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{accountName}</span>
                <span className="shrink-0">•</span>
                <span className="shrink-0 tabular-nums">
                  {formatDateShort(transaction.date)}
                  {(() => {
                    if (transaction.parsedTimestamp) {
                      const dt = new Date(transaction.parsedTimestamp)
                      const hh = String(dt.getHours()).padStart(2, '0')
                      const mm = String(dt.getMinutes()).padStart(2, '0')
                      return ` at ${hh}:${mm}`
                    }
                    return ''
                  })()}
                </span>
              </div>
            </div>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
