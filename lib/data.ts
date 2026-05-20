// Mock data for the Life OS finance app

export interface Transaction {
  id: string
  name: string
  amount: number
  date: string
  category: string
  categoryIcon: string
  account: string
  accountType: 'credit' | 'debit' | 'cash'
  type: 'expense' | 'income' | 'saving'
  fundedBy: 'base' | 'extra' | 'savings'
  note?: string
}

export interface Card {
  id: string
  name: string
  type: 'credit' | 'debit'
  limit: number
  spent: number
  resetDate: string
  color: string
}

export interface Budget {
  total: number
  spent: number
  savings: number
  extraAllowance: number
}

export const categories = [
  { id: 'food', name: 'Food & Dining', icon: '🍔' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'fuel', name: 'Fuel', icon: '⛽' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'outing', name: 'Outing', icon: '🎪' },
  { id: 'groceries', name: 'Groceries', icon: '🥬' },
  { id: 'bills', name: 'Bills & Utilities', icon: '📋' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'health', name: 'Health', icon: '💊' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '📱' },
  { id: 'trek', name: 'Trek', icon: '🥾' },
  { id: 'other', name: 'Other', icon: '📦' },
]

export const fundingSources = [
  { id: 'base', name: 'Base Budget', icon: '💰' },
  { id: 'extra', name: 'Extra Allowance', icon: '🎁' },
  { id: 'savings', name: 'Savings', icon: '🏦' },
]

export const cards: Card[] = [
  { id: '1', name: 'Main Credit Card', type: 'credit', limit: 10000, spent: 3240, resetDate: '2026-06-03', color: 'bg-primary' },
  { id: '2', name: 'Credit Card 2 (Extra)', type: 'credit', limit: 10000, spent: 1850, resetDate: '2026-06-15', color: 'bg-chart-3' },
  { id: '3', name: 'Debit Card', type: 'debit', limit: 30000, spent: 5400, resetDate: '2026-05-31', color: 'bg-chart-2' },
]

export const budget: Budget = {
  total: 30000,
  spent: 10490,
  savings: 2500,
  extraAllowance: 5000,
}

export const transactions: Transaction[] = [
  { id: '1', name: 'Swiggy', amount: 450, date: '2026-05-19', category: 'food', categoryIcon: '🍔', account: 'Main Credit Card', accountType: 'credit', type: 'expense', fundedBy: 'base' },
  { id: '2', name: 'Uber', amount: 280, date: '2026-05-19', category: 'transport', categoryIcon: '🚗', account: 'Debit Card', accountType: 'debit', type: 'expense', fundedBy: 'base' },
  { id: '3', name: 'Amazon', amount: 1200, date: '2026-05-18', category: 'shopping', categoryIcon: '🛍️', account: 'Credit Card 2 (Extra)', accountType: 'credit', type: 'expense', fundedBy: 'extra' },
  { id: '4', name: 'Netflix', amount: 199, date: '2026-05-18', category: 'subscriptions', categoryIcon: '📱', account: 'Main Credit Card', accountType: 'credit', type: 'expense', fundedBy: 'base' },
  { id: '5', name: 'Grocery Store', amount: 850, date: '2026-05-17', category: 'groceries', categoryIcon: '🥬', account: 'Debit Card', accountType: 'debit', type: 'expense', fundedBy: 'base' },
  { id: '6', name: 'Electricity Bill', amount: 1500, date: '2026-05-15', category: 'bills', categoryIcon: '📋', account: 'Debit Card', accountType: 'debit', type: 'expense', fundedBy: 'base' },
  { id: '7', name: 'Monthly Allowance', amount: 30000, date: '2026-05-01', category: 'other', categoryIcon: '💰', account: 'Debit Card', accountType: 'debit', type: 'income', fundedBy: 'base' },
  { id: '8', name: 'Extra from Parents', amount: 5000, date: '2026-05-05', category: 'other', categoryIcon: '🎁', account: 'Debit Card', accountType: 'debit', type: 'income', fundedBy: 'extra' },
  { id: '9', name: 'Cinema', amount: 600, date: '2026-05-16', category: 'outing', categoryIcon: '🎪', account: 'Main Credit Card', accountType: 'credit', type: 'expense', fundedBy: 'base' },
  { id: '10', name: 'Books', amount: 450, date: '2026-05-14', category: 'education', categoryIcon: '📚', account: 'Debit Card', accountType: 'debit', type: 'expense', fundedBy: 'base' },
]

export const trendData = [
  { day: 1, amount: 0 },
  { day: 2, amount: 450 },
  { day: 3, amount: 890 },
  { day: 4, amount: 1200 },
  { day: 5, amount: 1850 },
  { day: 6, amount: 2100 },
  { day: 7, amount: 2800 },
  { day: 8, amount: 3400 },
  { day: 9, amount: 3900 },
  { day: 10, amount: 4500 },
  { day: 11, amount: 5200 },
  { day: 12, amount: 5800 },
  { day: 13, amount: 6400 },
  { day: 14, amount: 7100 },
  { day: 15, amount: 7800 },
  { day: 16, amount: 8500 },
  { day: 17, amount: 9200 },
  { day: 18, amount: 9800 },
  { day: 19, amount: 10490 },
]

export const categorySpending = [
  { name: 'Food & Dining', value: 2800, color: 'var(--chart-1)' },
  { name: 'Transport', value: 1500, color: 'var(--chart-2)' },
  { name: 'Shopping', value: 2200, color: 'var(--chart-3)' },
  { name: 'Outing', value: 1200, color: 'var(--chart-4)' },
  { name: 'Bills', value: 1800, color: 'var(--chart-5)' },
  { name: 'Other', value: 990, color: 'var(--muted-foreground)' },
]

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getDaysUntil(dateString: string): number {
  const today = new Date()
  const target = new Date(dateString)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
