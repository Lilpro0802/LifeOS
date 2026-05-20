'use client'

import { Sidebar } from '@/components/sidebar'
import { formatCurrency, getAccountSpending, getAccountBaseSpending, getDaysUntilReset } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { Plus, CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'

export default function CardsPage() {
  const { state, isHydrated } = useApp()

  if (!isHydrated) return null

  const creditCards = state.accounts.filter(a => a.type === 'credit')
  const totalLimit = creditCards.reduce((sum, card) => sum + card.limit, 0)
  const totalSpent = creditCards.reduce((sum, card) => sum + getAccountSpending(state.transactions, card), 0)
  const totalAvailable = totalLimit - totalSpent

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-pt">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <h1 className="text-lg lg:text-xl font-semibold text-foreground">Cards</h1>
            <Link href="/cards/new" className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all-smooth tap-target">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add card</span>
            </Link>
          </div>
        </header>

        <div className="p-4 lg:p-6 overflow-x-hidden">
          {/* Cards List */}
          <div className="space-y-3">
            {state.accounts.map((card) => {
              const spent = getAccountSpending(state.transactions, card)
              const baseSpent = getAccountBaseSpending(state.transactions, card)
              const extraSpent = spent - baseSpent

              const limitMetric = card.type === 'debit' ? baseSpent : spent
              
              const percentUsed = card.limit > 0 ? Math.round((limitMetric / card.limit) * 100) : 0
              const liveAvailable = card.type === 'debit' ? (card.availableBalance || 0) : 0
              const remaining = card.limit > 0 ? card.limit - limitMetric : liveAvailable
              const daysUntilReset = getDaysUntilReset(card)

              return (
                <Link 
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="block bg-card rounded-2xl p-4 lg:p-5 border border-border hover:shadow-md transition-all-smooth cursor-pointer dark:card-glow active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-11 h-11 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0',
                        card.color
                      )}>
                        {card.type === 'credit' ? 'CC' : 'DC'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate">{card.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{card.type} Card</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {card.type === 'credit' ? (
                        <>
                          <p className="text-lg lg:text-xl font-bold tabular-nums">{formatCurrency(spent)}</p>
                          <p className="text-xs text-muted-foreground">of {formatCurrency(card.limit)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg lg:text-xl font-bold tabular-nums text-green-600 dark:text-green-500">{formatCurrency(liveAvailable)}</p>
                          <p className="text-xs text-muted-foreground">Available balance</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    {card.type === 'credit' ? (
                      <>
                        <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                          <span className="text-muted-foreground">{percentUsed}% ({formatCurrency(spent)}) used</span>
                          <span className="text-muted-foreground">{formatCurrency(remaining)} available</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              percentUsed > 80 ? 'bg-destructive' : card.color
                            )}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </>
                    ) : card.limit > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                          <span className="text-muted-foreground">{percentUsed}% ({formatCurrency(limitMetric)}) used</span>
                          <span className="text-muted-foreground">{formatCurrency(remaining)} available</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              percentUsed > 80 ? 'bg-destructive' : 'bg-primary'
                            )}
                            style={{ width: `${percentUsed > 100 ? 100 : percentUsed}%` }}
                          />
                        </div>
                        {extraSpent > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-2 font-medium">
                            + {formatCurrency(extraSpent)} used from extra allowance
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-xs py-1">
                        <span className="text-muted-foreground">This month's spend</span>
                        <span className="font-medium text-foreground">{formatCurrency(spent)}</span>
                      </div>
                    )}
                  </div>

                    <p className="text-[11px] text-muted-foreground mt-2">
                      {card.type === 'credit' && card.billingCycleDay > 0 
                        ? `Resets in ${daysUntilReset} days` 
                        : (card.limit > 0 ? `Budget resets in ${daysUntilReset} days` : 'Debit Account')}
                    </p>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
