// =============================================
// Life OS — Pure Calculation Functions
// =============================================
// All functions are pure: (data in) → (result out)
// No side effects, no state mutation, no imports from context.

import type { Transaction, Account, FriendDebt, AppState } from './types'
import { getCategoryById } from './constants'

// =============================================
// Date Helpers
// =============================================

/** Get start and end of a given month (inclusive) */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/** Get start and end of the current calendar month */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return getMonthRange(now.getFullYear(), now.getMonth())
}

/** Get start of the current week (Monday) */
function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  return start
}

// =============================================
// Transaction Filters
// =============================================

/** Filter transactions within a date range (inclusive, based on t.date) */
export function filterByDateRange(
  transactions: Transaction[],
  start: Date,
  end: Date
): Transaction[] {
  return transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    return d >= start && d <= end
  })
}

/** Get transactions for the current calendar month */
export function getCurrentMonthTransactions(transactions: Transaction[]): Transaction[] {
  const { start, end } = getCurrentMonthRange()
  return filterByDateRange(transactions, start, end)
}

/** Get transactions for a specific month */
export function getMonthTransactions(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  const { start, end } = getMonthRange(year, month)
  return filterByDateRange(transactions, start, end)
}

/** Filter to only expense-type transactions */
export function filterExpenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.type === 'expense')
}

/** Filter to only finalized transactions (not pending) */
export function filterFinalized(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.status !== 'pending')
}

// =============================================
// Budget Calculations
// =============================================

/** Helper to compute the net budget impact of a transaction considering splits */
export function getTransactionNetExpense(t: Transaction): number {
  if (t.splits && t.splits.length > 0) {
    const negativeSum = t.splits.filter(s => s.amount < 0).reduce((sum, s) => sum + Math.abs(s.amount), 0)
    if (negativeSum > 0) {
      return negativeSum
    }
    const positiveSum = t.splits.filter(s => s.amount > 0).reduce((sum, s) => sum + s.amount, 0)
    return Math.max(0, t.amount - positiveSum)
  }
  
  if (t.friendOwedAmount !== undefined) {
    return t.friendOwedAmount < 0 ? Math.abs(t.friendOwedAmount) : t.amount - t.friendOwedAmount
  }
  
  return t.amount
}

/** Total expenses for a set of transactions */
export function sumExpenses(transactions: Transaction[]): number {
  return filterExpenses(transactions).reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
}

/** Total base lifestyle expenses */
export function sumBaseExpenses(transactions: Transaction[]): number {
  return filterExpenses(transactions)
    .filter(t => !t.fundingSource || t.fundingSource === 'base')
    .reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
}

/** Total extra exceptional expenses */
export function sumExtraExpenses(transactions: Transaction[]): number {
  return filterExpenses(transactions)
    .filter(t => t.fundingSource === 'extra')
    .reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
}

/** Total savings-funded expenses */
export function sumSavingsExpenses(transactions: Transaction[]): number {
  return filterExpenses(transactions)
    .filter(t => t.fundingSource === 'savings')
    .reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
}

/** Total extra allowance received in a set of transactions */
export function sumExtraAllowance(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.type === 'extra_allowance')
    .reduce((sum, t) => sum + t.amount, 0)
}

/** Calculate total base budget dynamically from active cards */
export function getBaseBudget(accounts: Account[]): number {
  const activeAccounts = accounts.filter(a => a.isActive)
  const creditLimit = activeAccounts
    .filter(a => a.type === 'credit' && !a.isExtra)
    .reduce((sum, a) => sum + (a.limit || 0), 0)
  const debitBudget = activeAccounts
    .filter(a => a.type === 'debit')
    .reduce((sum, a) => sum + (a.limit || 0), 0)
  return creditLimit + debitBudget
}

/** Full budget status for the current month */
export function getBudgetStatus(
  transactions: Transaction[],
  accounts: Account[],
  year?: number,
  month?: number
) {
  const monthlyBudget = getBaseBudget(accounts)
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()
  const monthTx = getMonthTransactions(transactions, y, m)
  
  const spent = sumExpenses(monthTx)
  const baseSpent = sumBaseExpenses(monthTx)
  const extraSpent = sumExtraExpenses(monthTx)
  const savingsSpent = sumSavingsExpenses(monthTx)

  console.log("DEBUG getBudgetStatus monthTx:", monthTx.map(t => ({
    title: t.title,
    amount: t.amount,
    type: t.type,
    fundingSource: t.fundingSource,
    netExpense: getTransactionNetExpense(t),
    friendOwedAmount: t.friendOwedAmount,
    splits: t.splits
  })))
  console.log("DEBUG getBudgetStatus summary:", { spent, baseSpent, extraSpent, savingsSpent })

  const extraInflow = sumExtraAllowance(monthTx)
  const extraPoolBalance = Math.max(0, extraInflow - extraSpent)

  const totalAvailable = monthlyBudget
  const remaining = Math.max(0, monthlyBudget - baseSpent)
  
  const overspend = Math.max(0, baseSpent - monthlyBudget)
  const percentUsed = monthlyBudget > 0
    ? Math.min(100, Math.round((baseSpent / monthlyBudget) * 100))
    : 0

  return {
    spent, // Total of all spending combined
    baseSpent, // Lifestyle spending
    extraSpent, // Contextual spending
    savingsSpent, // Emergency/Savings spending
    budget: monthlyBudget,
    extraInflow,
    extraPoolBalance, // Actual usable extra money
    totalAvailable,
    remaining, // Remaining base lifestyle budget
    overspend,
    percentUsed,
  }
}

/** Spending in the current week (since Monday) */
export function getWeeklySpending(transactions: Transaction[]): number {
  const start = getWeekStart()
  const now = new Date()
  return sumExpenses(filterByDateRange(transactions, start, now))
}

/** Count of expense transactions in a month */
export function getMonthlyTransactionCount(
  transactions: Transaction[],
  year?: number,
  month?: number
): number {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()
  const monthTx = getMonthTransactions(transactions, y, m)
  return filterExpenses(monthTx).length
}

// =============================================
// Card / Account Calculations
// =============================================

/** Get the start date of the current billing cycle for a credit card */
export function getCardCycleStart(billingCycleDay: number): Date {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // Clamp day to max days in current month to prevent rolling over (e.g. Feb 31 -> March 3)
  const daysInThisMonth = new Date(year, month + 1, 0).getDate()
  const clampedThisMonthDay = Math.min(billingCycleDay, daysInThisMonth)
  const thisMonthCycle = new Date(year, month, clampedThisMonthDay)
  thisMonthCycle.setHours(0, 0, 0, 0)

  if (today >= thisMonthCycle) {
    return thisMonthCycle
  }
  // Cycle started last month
  const daysInLastMonth = new Date(year, month, 0).getDate()
  const clampedLastMonthDay = Math.min(billingCycleDay, daysInLastMonth)
  return new Date(year, month - 1, clampedLastMonthDay)
}

/** Get the next reset date for a card */
export function getCardNextReset(account: Account): Date {
  if (account.type === 'credit' && account.billingCycleDay > 0) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    const daysInThisMonth = new Date(year, month + 1, 0).getDate()
    const clampedThisMonthDay = Math.min(account.billingCycleDay, daysInThisMonth)
    const thisMonthReset = new Date(year, month, clampedThisMonthDay)
    if (today < thisMonthReset) return thisMonthReset

    const daysInNextMonth = new Date(year, month + 2, 0).getDate()
    const clampedNextMonthDay = Math.min(account.billingCycleDay, daysInNextMonth)
    return new Date(year, month + 1, clampedNextMonthDay)
  }
  // Debit/cash: end of current month
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

/** Days until a card resets */
export function getDaysUntilReset(account: Account): number {
  const reset = getCardNextReset(account)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = reset.getTime() - today.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function getAccountExpenseTransactions(
  transactions: Transaction[],
  account: Account,
  year?: number,
  month?: number
): Transaction[] {
  let start: Date
  let end: Date

  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()

  if (account.type === 'credit' && account.billingCycleDay > 0) {
    if (year === undefined && month === undefined) {
      start = getCardCycleStart(account.billingCycleDay)
      end = getCardNextReset(account)
    } else {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      if (y === currentYear && m === currentMonth) {
        start = getCardCycleStart(account.billingCycleDay)
        end = getCardNextReset(account)
      } else {
        start = new Date(y, m, account.billingCycleDay, 0, 0, 0, 0)
        end = new Date(y, m + 1, account.billingCycleDay, 23, 59, 59, 999)
      }
    }
  } else {
    // Debit/cash: calendar month
    start = new Date(y, m, 1, 0, 0, 0, 0)
    end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  }

  return filterByDateRange(transactions, start, end)
    .filter(t => t.type === 'expense' && t.accountId === account.id)
}

/** Total spending on a specific account in its billing cycle or month */
export function getAccountSpending(
  transactions: Transaction[],
  account: Account,
  year?: number,
  month?: number
): number {
  return getAccountExpenseTransactions(transactions, account, year, month)
    .reduce((sum, t) => sum + t.amount, 0)
}

/** Total base spending on a specific account in its billing cycle or month */
export function getAccountBaseSpending(
  transactions: Transaction[],
  account: Account,
  year?: number,
  month?: number
): number {
  return getAccountExpenseTransactions(transactions, account, year, month)
    .filter(t => t.fundingSource === 'base')
    .reduce((sum, t) => sum + t.amount, 0)
}

/** Total extra spending on a specific account in its billing cycle or month */
export function getAccountExtraSpending(
  transactions: Transaction[],
  account: Account,
  year?: number,
  month?: number
): number {
  return getAccountExpenseTransactions(transactions, account, year, month)
    .filter(t => t.fundingSource === 'extra')
    .reduce((sum, t) => sum + t.amount, 0)
}

// =============================================
// Trend / Chart Data
// =============================================

/** Cumulative daily spending for a month (for area chart) */
export function getCumulativeTrendData(
  transactions: Transaction[],
  year?: number,
  month?: number
): { day: number; amount: number }[] {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()

  const monthTx = getMonthTransactions(transactions, y, m)
  const expenses = filterExpenses(monthTx)

  // Build a map: day → total spent on that day
  const dailyTotals = new Map<number, number>()
  for (const t of expenses) {
    const day = new Date(t.date + 'T00:00:00').getDate()
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + t.amount)
  }

  // Build cumulative array up to today (or end of month if past)
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const lastDay = (y === now.getFullYear() && m === now.getMonth())
    ? now.getDate()
    : daysInMonth

  const result: { day: number; amount: number }[] = []
  let cumulative = 0
  for (let d = 1; d <= lastDay; d++) {
    cumulative += dailyTotals.get(d) ?? 0
    result.push({ day: d, amount: cumulative })
  }

  return result
}

// =============================================
// Category Breakdown
// =============================================

/** Spending per category for a set of transactions */
export function getCategoryBreakdown(
  transactions: Transaction[]
): { categoryId: string; name: string; icon: string; amount: number }[] {
  const expenses = filterExpenses(transactions)
  const totals = new Map<string, number>()

  for (const t of expenses) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
  }

  return Array.from(totals.entries())
    .map(([categoryId, amount]) => {
      const cat = getCategoryById(categoryId)
      return {
        categoryId,
        name: cat?.name ?? categoryId,
        icon: cat?.icon ?? '📦',
        amount,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

// =============================================
// Review System
// =============================================

/** Transactions needing review */
export function getPendingReviewTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.status === 'pending')
}

// =============================================
// Savings & Historical Rollover
// =============================================

/**
 * Total savings balance across all time.
 * Formula: 
 *   Manual Deposits - Manual Withdrawals
 *   + Reimbursements
 *   - Savings-Funded Expenses (across all time)
 *   + Accumulated Leftovers from all PAST months (Base unused + Extra unused)
 */
export function getTotalSavingsBalance(transactions: Transaction[], accounts: Account[]): number {
  const monthlyBudget = getBaseBudget(accounts)
  let balance = 0

  // 1. All-time explicit actions & expenses
  for (const t of transactions) {
    if (t.type === 'savings_deposit' && !t.transferSourceAccountId) balance += t.amount
    if (t.type === 'savings_withdrawal' && !t.transferSourceAccountId) balance -= t.amount
    if (t.type === 'reimbursement') balance += t.amount
    if (t.type === 'expense' && t.fundingSource === 'savings') balance -= t.amount
  }

  // 2. Accumulated leftover capacity from past months
  // Find the earliest transaction to determine how far back to loop
  if (transactions.length > 0) {
    let earliest = new Date()
    for (const t of transactions) {
      const d = new Date(t.date + 'T00:00:00')
      if (!isNaN(d.getTime()) && d < earliest) earliest = d
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // Clamp earliest scan year to max 5 years ago to avoid infinite loop / performance lag from typos (e.g. year 2000)
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(now.getFullYear() - 5)
    if (earliest < fiveYearsAgo) {
      earliest = fiveYearsAgo
    }

    let y = earliest.getFullYear()
    let m = earliest.getMonth()

    while (y < currentYear || (y === currentYear && m < currentMonth)) {
      const monthTx = getMonthTransactions(transactions, y, m)
      
      const baseSpent = sumBaseExpenses(monthTx)
      const extraSpent = sumExtraExpenses(monthTx)
      const extraInflow = sumExtraAllowance(monthTx)

      // Unused base budget flows to savings (but doesn't go negative to drain savings, overspend handled below)
      const baseRemaining = monthlyBudget - baseSpent
      
      // Unused extra flows to savings
      const extraRemaining = extraInflow - extraSpent

      if (baseRemaining > 0) balance += baseRemaining
      if (baseRemaining < 0) balance += baseRemaining // Overspend reduces savings
      if (extraRemaining > 0) balance += extraRemaining

      m++
      if (m > 11) {
        m = 0
        y++
      }
    }
  }

  return balance
}

/** Balance for a specific savings goal */
export function getSavingsGoalBalance(
  transactions: Transaction[],
  goalId: string
): number {
  return transactions
    .filter(t => t.savingsGoalId === goalId)
    .reduce((balance, t) => {
      if (t.type === 'savings_deposit') return balance + t.amount
      if (t.type === 'savings_withdrawal') return balance - t.amount
      return balance
    }, 0)
}

/** Net savings activity for a specific month */
export function getMonthlySavingsActivity(
  transactions: Transaction[],
  year?: number,
  month?: number
): number {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth()
  const monthTx = getMonthTransactions(transactions, y, m)

  return monthTx.reduce((net, t) => {
    if (t.type === 'savings_deposit') return net + t.amount
    if (t.type === 'savings_withdrawal') return net - t.amount
    return net
  }, 0)
}

// =============================================
// Formatting Utilities
// =============================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  })
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getCurrentMonthLabel(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Calculate a friend's net balance dynamically: direct debts + splits */
export function getFriendBalance(
  friendId: string,
  debts: FriendDebt[],
  transactions: Transaction[]
): number {
  // 1. Sum up direct debts
  const directSum = debts
    .filter(d => d.friendId === friendId)
    .reduce((sum, d) => sum + d.amount, 0)

  // 2. Sum up splits where friend is involved
  const splitsSum = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => {
      if (t.splits && t.splits.length > 0) {
        const friendSplit = t.splits.find(s => s.friendId === friendId)
        if (friendSplit) {
          return sum + friendSplit.amount
        }
      }
      if (t.splitWithFriendId === friendId) {
        return sum + (t.friendOwedAmount || 0)
      }
      return sum
    }, 0)

  return directSum + splitsSum
}

/** Calculate transferable savings: debit account available balance - protected reserve */
export function getTransferableSavings(state: AppState): number {
  const mainDebit = state.accounts.find(a => a.type === 'debit' && a.isActive)
  const balance = mainDebit ? (mainDebit.availableBalance || 0) : 0
  const reserve = state.settings.protectedReserve ?? 10000
  return Math.max(0, balance - reserve)
}
