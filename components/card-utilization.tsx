'use client'

import { formatCurrency, getAccountSpending, getDaysUntilReset } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'

export function CardUtilization({ selectedMonth, selectedYear }: { selectedMonth?: number; selectedYear?: number }) {
  const { state, isHydrated } = useApp()
  
  if (!isHydrated) return null
  return (
    <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border dark:card-glow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Card Utilization</h3>
        <Link href="/cards" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          See all
        </Link>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {state.accounts.map((card) => {
          const spent = getAccountSpending(state.transactions, card, selectedYear, selectedMonth)
          const percentUsed = card.limit > 0 ? Math.min(100, Math.round((spent / card.limit) * 100)) : 0
          const remaining = card.limit > 0 ? Math.max(0, card.limit - spent) : null
          const daysUntilReset = getDaysUntilReset(card)

          return (
            <Link 
              key={card.id}
              href="/cards"
              className="flex-shrink-0 w-[280px] lg:w-auto p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-all-smooth cursor-pointer block"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0',
                  card.color
                )}>
                  {card.type === 'credit' ? 'CC' : 'DC'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{card.name}</h4>
                  <p className="text-xs text-muted-foreground capitalize">{card.type}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between mb-1.5 gap-2">
                  {card.type === 'credit' ? (
                    <>
                      <span className="text-lg font-bold tabular-nums">{formatCurrency(spent)}</span>
                      {remaining !== null && (
                        <span className="text-xs text-muted-foreground truncate">{formatCurrency(remaining)} left</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold tabular-nums text-green-600 dark:text-green-500">
                        {formatCurrency(card.availableBalance || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">Available</span>
                    </>
                  )}
                </div>
                {card.type === 'credit' ? (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        percentUsed > 80 ? 'bg-destructive' : card.color
                      )}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] py-1 border-t border-border mt-1">
                    <span className="text-muted-foreground">Spent this month</span>
                    <span className="font-semibold text-foreground">{formatCurrency(spent)}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {card.type === 'credit' && card.billingCycleDay > 0 ? `Resets in ${daysUntilReset}d` : 'Debit Account'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
