// =============================================
// Life OS — Constants & Default Data
// =============================================

import type { Category, FundingSourceDef, Account, AppSettings, AppState } from './types'

// --- Schema Version (for localStorage migrations) ---
export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'life-os-data'

// --- Categories (reference data) ---

export const CATEGORIES: Category[] = [
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

// --- Funding Sources (reference data) ---

export const FUNDING_SOURCES: FundingSourceDef[] = [
  { id: 'base', name: 'Base Budget', icon: '💰' },
  { id: 'extra', name: 'Extra Allowance', icon: '🎁' },
  { id: 'savings', name: 'Savings', icon: '🏦' },
]

// --- Lookup helpers ---

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}

export function getCategoryIcon(id: string): string {
  return getCategoryById(id)?.icon ?? '📦'
}

// --- Default/seed accounts ---

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc_main_cc',
    name: 'Main Credit Card',
    type: 'credit',
    limit: 10000,
    billingCycleDay: 3,
    color: 'bg-primary',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc_extra_cc',
    name: 'Credit Card 2 (Extra)',
    type: 'credit',
    limit: 10000,
    billingCycleDay: 15,
    color: 'bg-chart-3',
    isActive: true,
    isExtra: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc_debit',
    name: 'Debit Card',
    type: 'debit',
    limit: 0,
    availableBalance: 20000,
    billingCycleDay: 0,
    color: 'bg-chart-2',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
  },
]

// --- Default settings ---

export const DEFAULT_SETTINGS: AppSettings = {
  monthlyBudget: 30000,
  theme: 'system',
  userName: 'John Student',
  userEmail: 'john.student@email.com',
  university: 'Stanford University',
  budgetPreference: 'Frugal / Savings Oriented',
  autoFinalizeThreshold: 150,
  protectedReserve: 10000,
}

// --- Default app state (fresh install) ---

export const DEFAULT_STATE: AppState = {
  transactions: [],
  accounts: DEFAULT_ACCOUNTS,
  settings: DEFAULT_SETTINGS,
  wishlist: [],
  friends: [],
  debts: [],
  merchantMemory: {},
  closedMonths: [],
}
