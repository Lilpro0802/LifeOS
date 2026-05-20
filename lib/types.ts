// =============================================
// Life OS — Core Type Definitions
// =============================================

// --- Transaction Types ---

export type TransactionType =
  | 'expense'
  | 'allowance'
  | 'extra_allowance'
  | 'savings_deposit'
  | 'savings_withdrawal'
  | 'reimbursement'
  | 'settlement'

export type FundingSource = 'base' | 'extra' | 'savings'

export type ReviewStatus = 'auto_finalized' | 'pending_review' | 'needs_context' | 'manually_corrected' | 'approved' | 'pending' | 'needs_review'

export interface Transaction {
  id: string
  title: string
  amount: number
  type: TransactionType
  category: string                // category ID from constants
  fundingSource?: FundingSource   // relevant for expenses; optional for other types
  accountId: string               // references Account.id
  date: string                    // ISO date (YYYY-MM-DD), user-specified transaction date
  createdAt: string               // ISO datetime, when record was created
  updatedAt: string               // ISO datetime, when record was last modified
  status: ReviewStatus
  confidence: number              // 0–1, how confident the categorization is
  reviewReasons: string[]         // why this needs review (e.g., "uncategorized", "large amount")
  note: string
  tags: string[]                  // future expansion
  savingsGoalId?: string          // for savings_deposit / savings_withdrawal
  // Friend split support
  splitWithFriendId?: string      // ID of friend to split with
  friendOwedAmount?: number       // amount the friend owes us (deprecated in favor of splits)
  splits?: TransactionSplit[]
  source?: 'manual' | 'sms' | 'screenshot'
  rawSms?: string
  availableBalance?: number | null // balance after transaction if parsed from SMS
  parsedTimestamp?: number        // extracted time of the transaction for chronological sorting
  referenceNumber?: string        // extracted reference number / UPI transaction ID
  transferSourceAccountId?: string // references the source account ID in a transfer
  sourceAvailableBalance?: number | null // available balance of the source account after transfer
}

export interface TransactionSplit {
  friendId: string
  amount: number                  // Positive: they owe us, Negative: we owe them
}

// --- Account/Card Types ---

export type AccountType = 'credit' | 'debit' | 'cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  limit: number                   // credit limit or 0 for debit/cash
  availableBalance?: number       // for debit/cash accounts
  lastBalanceUpdateTimestamp?: number // tracks the time of the latest balance update
  lastBalanceUpdateCreatedAt?: string // tracks the database creation timestamp of the transaction that set the balance
  billingCycleDay: number         // day of month for credit card reset (1-31), 0 for debit/cash
  color: string                   // tailwind class (e.g., 'bg-primary')
  isActive: boolean
  isExtra?: boolean               // flag for cards that default to extra allowance
  isSavingsHolding?: boolean      // true if this card holds the physical savings funds
  sortOrder: number
  createdAt: string               // ISO datetime
  smsIdentifier?: string          // card identifier for SMS detection (e.g., "4321", "XX4321")
}



// --- Settings ---

export interface AppSettings {
  monthlyBudget: number
  theme: 'light' | 'dark' | 'system'
  userName: string
  userEmail: string
  university?: string
  budgetPreference?: string
  autoFinalizeThreshold?: number  // ₹ amount below which known merchants auto-finalize (default 150)
  protectedReserve?: number       // ₹ amount kept in debit account (default 10000)
}

// --- Category (reference data) ---

export interface Category {
  id: string
  name: string
  icon: string                    // emoji
}

// --- Funding Source (reference data) ---

export interface FundingSourceDef {
  id: FundingSource
  name: string
  icon: string
}

// --- Savings Wishlist Types ---

export interface WishlistItem {
  id: string
  name: string
  price: number
  link?: string
  createdAt: string
}

// --- Friend & Social Debt Types ---

export interface Friend {
  id: string
  name: string
  balance: number                 // net balance: positive = they owe you, negative = you owe them
  createdAt: string
}

export interface FriendDebt {
  id: string
  friendId: string
  amount: number                  // positive = you lent/paid (they owe you), negative = you borrowed/they paid (you owe them)
  description: string
  date: string
  isSettled: boolean
  createdAt: string
  linkedTransactionId?: string
  source?: 'manual' | 'sms' | 'screenshot'
  referenceNumber?: string
}

// --- Merchant Memory ---

export interface MerchantMemoryEntry {
  category: string
  fundingSource?: FundingSource
  confirmationCount: number     // times user confirmed this mapping
  confidenceScore: number       // 0-1, derived from confirmationCount
  lastUsedTimestamp: string     // ISO datetime of last confirmation
  // Architectural additions:
  averageAmount?: number       // running average of confirmed amounts
  amountsSeen?: number[]       // list of recently confirmed amounts (up to 5)
  isSubscription?: boolean     // flag if detected as subscription
  lastSeenAmount?: number      // last confirmed transaction amount
}

export interface MonthlySnapshot {
  id: string
  year: number
  month: number
  closedAt: string
  spendingTotals: {
    total: number
    base: number
    extra: number
    savings: number
  }
  categoryBreakdown: { categoryId: string; name: string; icon: string; amount: number }[]
  savingsAdded: number
  extraAllowanceUsed: number
  protectedReserveSnapshot: number
  friendBalancesSnapshot: { friendId: string; name: string; balance: number }[]
  settlementActivity: number
  topMerchants: { merchant: string; amount: number; count: number }[]
  pendingReviewCounts: number
}

// --- App State ---

export interface AppState {
  transactions: Transaction[]
  accounts: Account[]
  settings: AppSettings
  wishlist?: WishlistItem[]
  friends?: Friend[]
  debts?: FriendDebt[]
  merchantMemory?: Record<string, MerchantMemoryEntry>
  closedMonths?: MonthlySnapshot[]
}
