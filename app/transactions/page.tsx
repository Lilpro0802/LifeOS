'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { formatCurrency, formatDate } from '@/lib/calculations'
import { getCategoryIcon, getCategoryById, CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Search, Filter, Download, Edit2, Calendar, CreditCard, Tag, ArrowUpDown } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function TransactionsPage() {
  const { state, isHydrated } = useApp()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest') // newest, oldest, highest, lowest
  const [dateFilter, setDateFilter] = useState('all') // all, today, this-week, this-month
  const [customDateQuery, setCustomDateQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  if (!isHydrated) return null

  // 1. Filtering logic
  const filteredTransactions = state.transactions.filter(t => {
    const titleMatch = t.title.toLowerCase().includes(searchQuery.toLowerCase())
    const noteMatch = (t.note || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSearch = titleMatch || noteMatch

    const matchesAccount = selectedAccount === 'all' || t.accountId === selectedAccount
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory

    let matchesDate = true
    const txDate = new Date(t.date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (dateFilter === 'today') {
      matchesDate = txDate.getTime() === today.getTime()
    } else if (dateFilter === 'this-week') {
      const startOfWeek = new Date(today)
      const day = today.getDay()
      const diff = day === 0 ? 6 : day - 1
      startOfWeek.setDate(today.getDate() - diff)
      matchesDate = txDate >= startOfWeek
    } else if (dateFilter === 'this-month') {
      matchesDate = txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear()
    }

    let matchesCustomDate = true
    if (customDateQuery) {
      const q = customDateQuery.toLowerCase()
      const rawDate = t.date.toLowerCase()
      const readableDate = formatDate(t.date).toLowerCase()
      matchesCustomDate = rawDate.includes(q) || readableDate.includes(q)
    }

    return matchesSearch && matchesAccount && matchesCategory && matchesDate && matchesCustomDate
  })

  // 2. Sorting logic
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aTime = a.parsedTimestamp || new Date(a.date + 'T00:00:00').getTime()
    const bTime = b.parsedTimestamp || new Date(b.date + 'T00:00:00').getTime()

    if (sortBy === 'newest') {
      return bTime - aTime
    }
    if (sortBy === 'oldest') {
      return aTime - bTime
    }
    if (sortBy === 'highest') {
      return b.amount - a.amount
    }
    if (sortBy === 'lowest') {
      return a.amount - b.amount
    }
    return 0
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <h1 className="text-lg lg:text-xl font-semibold text-foreground">Transactions</h1>
            <button className="p-2 hover:bg-muted rounded-xl transition-all-smooth tap-target">
              <Download className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-6 overflow-x-hidden space-y-4">
          {/* Search and Filters Toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 bg-card border rounded-xl text-sm font-medium transition-all-smooth shrink-0 tap-target',
                showFilters ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-muted text-muted-foreground'
              )}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          {/* Collapsible Filters Panel */}
          {showFilters && (
            <div className="p-4 bg-card border border-border rounded-2xl dark:card-glow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date Range
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                </select>
              </div>

              {/* Custom Date / Month Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Type Date / Month
                </label>
                <input
                  type="text"
                  placeholder="e.g. May 2026, 2026-05, 19 May"
                  value={customDateQuery}
                  onChange={(e) => setCustomDateQuery(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Card Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Card / Account
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Cards</option>
                  {state.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" /> Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>
              </div>
            </div>
          )}

          {/* Transactions List - Mobile-first card layout */}
          <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
            <div className="divide-y divide-border">
              {sortedTransactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No transactions found matching your criteria.
                </div>
              ) : (
                sortedTransactions.map((transaction) => {
                  const accountName = state.accounts.find(a => a.id === transaction.accountId)?.name || 'Unknown Account'
                  const isPositive =
                    transaction.type === 'allowance' ||
                    transaction.type === 'extra_allowance' ||
                    transaction.type === 'savings_withdrawal' ||
                    transaction.type === 'reimbursement'
                  const categoryName = getCategoryById(transaction.category)?.name || transaction.category

                  return (
                    <div 
                      key={transaction.id}
                      className="group flex items-center gap-3 p-4 hover:bg-muted/30 transition-all-smooth cursor-pointer active:scale-[0.99]"
                      onClick={() => router.push(`/edit/${transaction.id}`)}
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
                          <span className="capitalize truncate">{categoryName}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0 tabular-nums">
                            {formatDate(transaction.date)}
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

                      {/* Small edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/edit/${transaction.id}`)
                        }}
                        className="opacity-60 hover:opacity-100 p-2 hover:bg-muted rounded-lg transition-all-smooth shrink-0 md:opacity-0 group-hover:opacity-100"
                        title="Edit Transaction"
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
