'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { formatCurrency, getFriendBalance, getTransferableSavings } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { Calendar, HelpCircle, AlertTriangle, CheckCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import type { MonthlySnapshot, Transaction, Friend } from '@/lib/types'
import { CATEGORIES } from '@/lib/constants'

interface MonthLifecycleCenterProps {
  year: number
  month: number
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function MonthLifecycleCenter({ year, month }: MonthLifecycleCenterProps) {
  const { state, isHydrated, closeMonth } = useApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isHydrated) return null

  const closedMonths = state.closedMonths || []
  const isClosed = closedMonths.some(s => s.year === year && s.month === month)

  // Only display if the month is NOT closed (open month)
  if (isClosed) return null

  // Calculate transferable savings
  const transferableSavings = getTransferableSavings(state)

  // Gather current month's transactions
  const monthString = String(month).padStart(2, '0')
  const monthPrefix = `${year}-${monthString}`
  const monthTransactions = state.transactions.filter(t => t.date.startsWith(monthPrefix))

  // Count pending reviews
  const pendingCount = monthTransactions.filter(
    t => t.status === 'pending_review' || (t.status as string) === 'pending' || t.status === 'needs_context'
  ).length

  const handleCloseMonth = () => {
    setIsProcessing(true)

    // 1. Calculate category breakdowns
    const expenses = monthTransactions.filter(t => t.type === 'expense')
    const categoryBreakdown = CATEGORIES.map(cat => {
      const amount = expenses
        .filter(t => t.category === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      return {
        categoryId: cat.id,
        name: cat.name,
        icon: cat.icon,
        amount
      }
    }).filter(c => c.amount > 0)

    // 2. Spending totals
    const totalSpending = expenses.reduce((sum, t) => sum + t.amount, 0)
    const baseSpending = expenses.filter(t => t.fundingSource === 'base').reduce((sum, t) => sum + t.amount, 0)
    const extraSpending = expenses.filter(t => t.fundingSource === 'extra').reduce((sum, t) => sum + t.amount, 0)
    const savingsSpending = expenses.filter(t => t.fundingSource === 'savings').reduce((sum, t) => sum + t.amount, 0)

    // 3. Friend balances
    const friends = state.friends || []
    const debts = state.debts || []
    const friendBalancesSnapshot = friends.map(f => ({
      friendId: f.id,
      name: f.name,
      balance: getFriendBalance(f.id, debts, state.transactions)
    }))

    // 4. Settlement activity
    const settlements = monthTransactions.filter(t => t.type === 'settlement')
    const settlementActivity = settlements.reduce((sum, t) => sum + t.amount, 0)

    // 5. Top Merchants
    const merchantMap: Record<string, { amount: number; count: number }> = {}
    expenses.forEach(t => {
      const merchant = t.title || 'Unknown'
      if (!merchantMap[merchant]) {
        merchantMap[merchant] = { amount: 0, count: 0 }
      }
      merchantMap[merchant].amount += t.amount
      merchantMap[merchant].count += 1
    })
    const topMerchants = Object.entries(merchantMap)
      .map(([merchant, stats]) => ({
        merchant,
        amount: stats.amount,
        count: stats.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    // 6. Savings Added
    // Filter out paired transfers (which have transferSourceAccountId)
    const savingsDeposits = monthTransactions.filter(t => t.type === 'savings_deposit' && !t.transferSourceAccountId)
    const savingsAdded = savingsDeposits.reduce((sum, t) => sum + t.amount, 0)

    // 7. Extra allowance used
    const extraAllowanceUsed = extraSpending

    // Build snapshot
    const snapshot: MonthlySnapshot = {
      id: `${year}-${monthString}`,
      year,
      month,
      closedAt: new Date().toISOString(),
      spendingTotals: {
        total: totalSpending,
        base: baseSpending,
        extra: extraSpending,
        savings: savingsSpending
      },
      categoryBreakdown,
      savingsAdded,
      extraAllowanceUsed,
      protectedReserveSnapshot: state.settings.protectedReserve ?? 10000,
      friendBalancesSnapshot,
      settlementActivity,
      topMerchants,
      pendingReviewCounts: pendingCount
    }

    // 8. Savings transfer is NOT automatic.
    // The app only shows the transferable amount — the user must
    // transfer funds manually through their banking app.

    // 9. Close month
    closeMonth(year, month, snapshot)
    setIsProcessing(false)
    setIsModalOpen(false)
  }

  return (
    <>
      {/* Banner / Card */}
      <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 hover:shadow-md transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl">
              📅
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Financial Period: {MONTH_NAMES[month - 1]} {year}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Status: <span className="text-green-600 dark:text-green-500 font-bold">Open</span> · {monthTransactions.length} transactions logged
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {transferableSavings > 0 && (
              <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-xl text-xs font-bold flex items-center gap-1">
                <span>💸</span>
                <span>Transferable Savings: {formatCurrency(transferableSavings)}</span>
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs transition-all-smooth"
            >
              Close Month
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border dark:card-glow rounded-3xl w-full max-w-md p-6 relative shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <span className="text-3xl block mb-2">🏁</span>
              <h3 className="text-lg font-bold text-foreground">Close {MONTH_NAMES[month - 1]} {year}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Locking this month will compile a historical snapshot.
              </p>
            </div>

            {/* Warnings section */}
            {pendingCount > 0 && (
              <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-2xl text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
                  Warning: Pending Reviews Exist
                </p>
                <p className="leading-relaxed text-[11px] text-muted-foreground">
                  There are <strong>{pendingCount} transactions</strong> in this month still awaiting review or screenshot context. We recommend finalizing them first, but you can choose to proceed and force-close.
                </p>
              </div>
            )}

            {/* Financial Roll-Over breakdown */}
            <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 space-y-3.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Financial Summary
              </h4>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Protected Reserve</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(state.settings.protectedReserve ?? 10000)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Transferable Savings</span>
                  <span className="font-bold text-green-600 dark:text-green-500">
                    {formatCurrency(transferableSavings)}
                  </span>
                </div>

                {transferableSavings > 0 ? (
                  <p className="text-[10px] text-muted-foreground leading-relaxed pt-1.5 border-t border-border/50">
                    💡 <strong>Suggested Transfer:</strong> You have ₹{transferableSavings.toLocaleString()} above your protected reserve. Consider transferring this to your savings account via your banking app.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground leading-relaxed pt-1.5 border-t border-border/50">
                    💡 Your Debit balance is at or below your protected reserve. No savings transfer needed.
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-xs font-semibold hover:bg-muted text-foreground transition-all-smooth"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseMonth}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 disabled:opacity-50 transition-all-smooth"
              >
                {isProcessing ? 'Processing...' : 'Confirm & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
