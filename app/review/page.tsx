'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { formatCurrency, formatDate, getFriendBalance } from '@/lib/calculations'
import { getCategoryIcon, getCategoryById, CATEGORIES, FUNDING_SOURCES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Edit2, ChevronDown, ChevronUp, Zap, AlertTriangle, Eye, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'
import type { FundingSource, ReviewStatus } from '@/lib/types'

export default function ReviewPage() {
  const { state, isHydrated, approveTransaction, deleteTransaction, updateTransaction, saveMerchantMemory } = useApp()
  const [showAutoFinalized, setShowAutoFinalized] = useState(false)

  const isFromPreviousMonth = (txDate: string) => {
    const dateObj = new Date(txDate + 'T00:00:00')
    if (isNaN(dateObj.getTime())) return false
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const txYear = dateObj.getFullYear()
    const txMonth = dateObj.getMonth()
    return txYear < currentYear || (txYear === currentYear && txMonth < currentMonth)
  }

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Inline editing state for outgoing cards — keyed by transaction ID
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingFunding, setEditingFunding] = useState<string | null>(null)
  const [editingMerchant, setEditingMerchant] = useState<string | null>(null)
  const [merchantDraft, setMerchantDraft] = useState('')

  if (!isHydrated) return null

  // ---- Categorize transactions by review status ----
  const autoFinalized = state.transactions.filter(t => t.status === 'auto_finalized')
  const pendingReview = state.transactions.filter(
    t => t.status === 'pending_review' || (t.status as string) === 'pending' || t.status === 'manually_corrected'
  )
  const needsContext = state.transactions.filter(t => t.status === 'needs_context')

  // Helper to distinguish incoming credits vs outgoing expenses
  const isIncomingTx = (t: any) =>
    t.type === 'allowance' ||
    t.type === 'extra_allowance' ||
    t.type === 'savings_deposit' ||
    t.type === 'reimbursement' ||
    t.type === 'settlement'

  const incomingPending = pendingReview.filter(isIncomingTx)
  const outgoingPending = pendingReview.filter(t => !isIncomingTx(t))
  const outgoingNeedsContext = needsContext.filter(t => !isIncomingTx(t))

  // Today's auto-finalized count
  const today = new Date().toISOString().split('T')[0]
  const todayAutoFinalized = autoFinalized.filter(t => t.date === today || t.createdAt?.startsWith(today))

  const handleApprove = (tx: any) => {
    approveTransaction(tx.id)
    if (tx.title && tx.category && tx.category !== 'other') {
      saveMerchantMemory(tx.title, tx.category, tx.fundingSource, tx.amount)
    }
    // Remove from selection if approved individually
    setSelectedIds(prev => prev.filter(id => id !== tx.id))
  }

  const handleInlineCategory = (txId: string, newCategory: string) => {
    updateTransaction(txId, { category: newCategory })
    setEditingCategory(null)
  }

  const handleInlineFunding = (txId: string, newFunding: FundingSource) => {
    updateTransaction(txId, { fundingSource: newFunding })
    setEditingFunding(null)
  }

  const handleInlineMerchant = (txId: string) => {
    if (merchantDraft.trim()) {
      updateTransaction(txId, { title: merchantDraft.trim() })
    }
    setEditingMerchant(null)
    setMerchantDraft('')
  }

  // Toggle selection for a card
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Bulk Actions
  const handleBulkApprove = () => {
    const allPending = [...state.transactions].filter(t => selectedIds.includes(t.id))
    allPending.forEach(tx => {
      approveTransaction(tx.id)
      if (tx.title && tx.category && tx.category !== 'other') {
        saveMerchantMemory(tx.title, tx.category, tx.fundingSource, tx.amount)
      }
    })
    setSelectedIds([])
  }

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteTransaction(id))
    setSelectedIds([])
  }

  // Approve all that have a category assigned
  const handleApproveAllCategorized = () => {
    const toApprove = [...incomingPending, ...outgoingPending].filter(
      tx => tx.category && tx.category !== 'other'
    )
    toApprove.forEach(tx => handleApprove(tx))
  }

  // ---- Render Incoming Credit Card with Quick Select & Settle ----
  const renderIncomingCard = (transaction: any) => {
    const accountName = state.accounts.find(a => a.id === transaction.accountId)?.name || 'Unknown'
    const isSelected = selectedIds.includes(transaction.id)

    // Determine current selected type option
    let selectedOption: 'allowance' | 'settlement' | 'transfer' | 'other' | null = null
    if (transaction.type === 'allowance' || transaction.type === 'extra_allowance') {
      selectedOption = 'allowance'
    } else if (transaction.type === 'settlement') {
      selectedOption = 'settlement'
    } else if (transaction.type === 'savings_deposit' || transaction.type === 'savings_withdrawal') {
      selectedOption = 'transfer'
    } else if (transaction.type === 'reimbursement') {
      selectedOption = 'other'
    }

    const setClassification = (option: 'allowance' | 'settlement' | 'transfer' | 'other') => {
      let type: any = 'reimbursement'
      let category = 'other'
      let fundingSource: FundingSource = 'base'

      if (option === 'allowance') {
        type = 'allowance'
        category = 'other'
      } else if (option === 'settlement') {
        type = 'settlement'
        category = 'other'
      } else if (option === 'transfer') {
        const acc = state.accounts.find(a => a.id === transaction.accountId)
        type = acc?.isSavingsHolding ? 'savings_deposit' : 'savings_withdrawal'
        category = 'savings'
        fundingSource = 'savings'
      } else if (option === 'other') {
        type = 'reimbursement'
        category = 'other'
      }

      updateTransaction(transaction.id, {
        type,
        category,
        fundingSource,
        ...(option !== 'settlement' ? { splitWithFriendId: undefined } : {})
      })
    }

    // Friend settlement suggestions
    const rawFriends = state.friends || []
    const debts = state.debts || []
    const txs = state.transactions || []

    const friendsOwed = rawFriends
      .map(f => ({
        id: f.id,
        name: f.name,
        balance: getFriendBalance(f.id, debts, txs)
      }))
      .filter(f => f.balance > 0)

    const exactMatch = friendsOwed.find(f => Math.abs(f.balance - transaction.amount) < 0.01)
    const suggestedFriends = friendsOwed.filter(f => f.id !== exactMatch?.id)

    // Suggestion Badge (from memory)
    const memoryEntry = state.merchantMemory?.[transaction.title.toLowerCase()]
    const suggestedCategory = memoryEntry && getCategoryById(memoryEntry.category)

    return (
      <div
        key={transaction.id}
        className={cn(
          "bg-card rounded-2xl p-5 border transition-all-smooth dark:card-glow space-y-4 relative",
          isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:shadow-lg"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(transaction.id)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0 mt-1 cursor-pointer"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-xl shrink-0">
                  📥
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{transaction.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(transaction.date)} · Account: {accountName}
                  </p>
                  {isFromPreviousMonth(transaction.date) && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-md text-[9px] font-bold border border-yellow-500/20">
                        ⏳ Pending from previous month
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-base font-extrabold text-green-600 dark:text-green-500 tabular-nums shrink-0">
                +{formatCurrency(transaction.amount)}
              </span>
            </div>
          </div>
        </div>

        {transaction.rawSms && (
          <div className="ml-7 p-2.5 bg-muted/40 border border-border/50 rounded-xl text-[10px] text-muted-foreground italic leading-relaxed break-words">
            &ldquo;{transaction.rawSms}&rdquo;
          </div>
        )}

        {/* Suggestion Badge (Quick Auto-Fill Category suggestion) */}
        {suggestedCategory && (transaction.category === 'other' || !transaction.category) && (
          <div className="ml-7">
            <button
              onClick={() => {
                updateTransaction(transaction.id, {
                  category: memoryEntry.category,
                  fundingSource: memoryEntry.fundingSource || 'base'
                })
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-[11px] text-primary font-bold rounded-full transition-all-smooth"
            >
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>Suggest: {suggestedCategory.icon} {suggestedCategory.name}</span>
            </button>
          </div>
        )}

        {/* Classification Select Bar */}
        <div className="ml-7 space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Classify Incoming Money
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setClassification('allowance')}
              className={cn(
                "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all-smooth tap-target",
                selectedOption === 'allowance'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted border-border text-foreground"
              )}
            >
              <span>💰</span>
              <span>Allowance</span>
            </button>
            <button
              onClick={() => setClassification('settlement')}
              className={cn(
                "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all-smooth tap-target",
                selectedOption === 'settlement'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted border-border text-foreground"
              )}
            >
              <span>🤝</span>
              <span>Settlement</span>
            </button>
            <button
              onClick={() => setClassification('other')}
              className={cn(
                "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all-smooth tap-target",
                selectedOption === 'other'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted border-border text-foreground"
              )}
            >
              <span>📦</span>
              <span>Other Income</span>
            </button>
          </div>
        </div>

        {/* Friend Settlement Contextual Matcher */}
        {selectedOption === 'settlement' && (
          <div className="ml-7 p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Contextual Match suggestions:
            </span>
            
            <div className="flex flex-wrap gap-2">
              {exactMatch && (
                <button
                  onClick={() => updateTransaction(transaction.id, { splitWithFriendId: exactMatch.id })}
                  className={cn(
                    "py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all-smooth tap-target",
                    transaction.splitWithFriendId === exactMatch.id
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                  )}
                >
                  ⭐ {exactMatch.name} (owes {formatCurrency(exactMatch.balance)}) [Best Match]
                </button>
              )}
              {suggestedFriends.map(f => (
                <button
                  key={f.id}
                  onClick={() => updateTransaction(transaction.id, { splitWithFriendId: f.id })}
                  className={cn(
                    "py-1.5 px-3 rounded-lg text-xs font-medium border flex items-center gap-1 transition-all-smooth tap-target",
                    transaction.splitWithFriendId === f.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border hover:bg-muted text-foreground"
                  )}
                >
                  {f.name} (owes {formatCurrency(f.balance)})
                </button>
              ))}
              {friendsOwed.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">No crew members owe you money right now.</p>
              )}
            </div>

            {/* Fallback Crew List Selector */}
            {rawFriends.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-muted-foreground">Select Crew:</span>
                <select
                  value={transaction.splitWithFriendId || ''}
                  onChange={e => updateTransaction(transaction.id, { splitWithFriendId: e.target.value || undefined })}
                  className="bg-card border border-border text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="">-- Select Crew Member --</option>
                  {rawFriends.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Settlement Preview and Badge */}
            {transaction.splitWithFriendId && (
              (() => {
                const friend = rawFriends.find(f => f.id === transaction.splitWithFriendId)
                if (!friend) return null
                
                const friendOwes = friend.balance
                const newBalance = friendOwes - transaction.amount
                
                let badgeText = "📝 Partial Settlement"
                let badgeColor = "bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-500/20"
                
                if (friendOwes > 0) {
                  if (transaction.amount === friendOwes) {
                    badgeText = "✅ Full Settlement"
                    badgeColor = "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20"
                  } else if (transaction.amount > friendOwes) {
                    badgeText = "🎁 Overpayment Repayment"
                    badgeColor = "bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20"
                  }
                } else {
                  badgeText = "➕ Balance Adjustment"
                  badgeColor = "bg-purple-500/10 text-purple-600 dark:text-purple-500 border-purple-500/20"
                }

                return (
                  <div className="mt-3 p-3 bg-card border border-border/85 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Settlement Type</span>
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold border", badgeColor)}>
                        {badgeText}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-1.5 bg-muted/40 rounded-lg">
                        <span className="text-[9px] text-muted-foreground block">Current Balance</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          {formatCurrency(friendOwes)}
                        </span>
                      </div>
                      <div className="p-1.5 bg-muted/40 rounded-lg border border-primary/10">
                        <span className="text-[9px] text-primary font-semibold block">Repayment</span>
                        <span className="text-xs font-bold text-primary tabular-nums">
                          -{formatCurrency(transaction.amount)}
                        </span>
                      </div>
                      <div className="p-1.5 bg-muted/40 rounded-lg">
                        <span className="text-[9px] text-muted-foreground block">Remaining</span>
                        <span className={cn(
                          "text-xs font-bold tabular-nums",
                          newBalance > 0 ? "text-green-600 dark:text-green-500" : newBalance < 0 ? "text-orange-500" : "text-muted-foreground"
                        )}>
                          {formatCurrency(newBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="ml-7 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApprove(transaction)}
              disabled={!selectedOption || (selectedOption === 'settlement' && !transaction.splitWithFriendId)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all-smooth tap-target",
                (!selectedOption || (selectedOption === 'settlement' && !transaction.splitWithFriendId))
                  ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{selectedOption === 'settlement' ? 'Confirm & Settle' : 'Approve & Finalize'}</span>
            </button>
            <button
              onClick={() => deleteTransaction(transaction.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-xs font-medium transition-all-smooth tap-target"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>

          {selectedOption === 'settlement' && transaction.splitWithFriendId && (
            <span className="text-[11px] font-semibold text-green-600 dark:text-green-500">
              Linked: {rawFriends.find(f => f.id === transaction.splitWithFriendId)?.name}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ---- Render Outgoing Debit Card (normal behavior) ----
  const renderReviewCard = (transaction: any, section: 'pending' | 'needs_context' | 'auto_finalized') => {
    const accountName = state.accounts.find(a => a.id === transaction.accountId)?.name || 'Unknown'
    const categoryName = getCategoryById(transaction.category)?.name || transaction.category
    const isEditingCat = editingCategory === transaction.id
    const isEditingFund = editingFunding === transaction.id
    const isEditingMerch = editingMerchant === transaction.id
    const isSelected = selectedIds.includes(transaction.id)

    // Suggestion Badge (from memory)
    const memoryEntry = state.merchantMemory?.[transaction.title.toLowerCase()]
    const suggestedCategory = memoryEntry && getCategoryById(memoryEntry.category)

    return (
      <div 
        key={transaction.id}
        className={cn(
          "bg-card rounded-2xl p-4 border transition-all-smooth dark:card-glow",
          isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:shadow-md",
          section === 'needs_context' && "border-yellow-500/30"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox (only show for pending review/needs context) */}
          {section !== 'auto_finalized' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(transaction.id)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0 mt-1 cursor-pointer"
            />
          )}

          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
            {getCategoryIcon(transaction.category)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title + Amount */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                {isEditingMerch ? (
                  <input
                    autoFocus
                    value={merchantDraft}
                    onChange={e => setMerchantDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleInlineMerchant(transaction.id)
                      if (e.key === 'Escape') { setEditingMerchant(null); setMerchantDraft('') }
                    }}
                    onBlur={() => handleInlineMerchant(transaction.id)}
                    className="bg-muted border border-border rounded-lg px-2 py-1 text-sm font-semibold w-full focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <h3
                    className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                      if (section !== 'auto_finalized') {
                        setEditingMerchant(transaction.id)
                        setMerchantDraft(transaction.title)
                      }
                    }}
                    title="Click to edit merchant name"
                  >
                    {transaction.title}
                  </h3>
                )}
                <p className="text-xs text-muted-foreground">{formatDate(transaction.date)}</p>
                {isFromPreviousMonth(transaction.date) && (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-md text-[9px] font-bold border border-yellow-500/20">
                      ⏳ Pending from previous month
                    </span>
                  </div>
                )}
              </div>
              <span className="text-lg font-bold tabular-nums shrink-0">
                {isIncomingTx(transaction) ? '+' : '-'}{formatCurrency(transaction.amount)}
              </span>
            </div>

            {/* Suggestions Badges (Quick Category fix) */}
            {suggestedCategory && (transaction.category === 'other' || !transaction.category) && (
              <div className="mb-2">
                <button
                  onClick={() => {
                    updateTransaction(transaction.id, {
                      category: memoryEntry.category,
                      fundingSource: memoryEntry.fundingSource || 'base'
                    })
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-[10px] text-primary font-bold rounded-full transition-all-smooth"
                >
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  <span>Suggest: {suggestedCategory.icon} {suggestedCategory.name}</span>
                </button>
              </div>
            )}

            {/* Chips row */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide -mx-1 px-1 flex-wrap">
              {/* Category chip */}
              {isEditingCat ? (
                <div className="flex flex-wrap gap-1 p-1.5 bg-muted/50 rounded-xl border border-border">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleInlineCategory(transaction.id, cat.id)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all",
                        cat.id === transaction.category
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border hover:bg-muted"
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => section !== 'auto_finalized' && setEditingCategory(transaction.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 hover:bg-muted/80 transition-all cursor-pointer"
                >
                  <span>{getCategoryIcon(transaction.category)}</span>
                  <span className="capitalize">{categoryName}</span>
                </button>
              )}

              {/* Account chip */}
              <span className="inline-flex items-center px-2 py-1 bg-muted rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0">
                {accountName}
              </span>

              {/* Funding source chip */}
              {!isIncomingTx(transaction) && (
                isEditingFund ? (
                  <div className="flex gap-1">
                    {FUNDING_SOURCES.map(fs => (
                      <button
                        key={fs.id}
                        onClick={() => handleInlineFunding(transaction.id, fs.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all",
                          fs.id === transaction.fundingSource
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border hover:bg-muted"
                        )}
                      >
                        <span>{fs.icon}</span>
                        <span>{fs.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => section !== 'auto_finalized' && setEditingFunding(transaction.id)}
                    className="inline-flex items-center px-2 py-1 bg-muted rounded-lg text-[10px] font-medium capitalize whitespace-nowrap shrink-0 hover:bg-muted/80 transition-all cursor-pointer"
                  >
                    {transaction.fundingSource === 'base' ? '💰 Base' : transaction.fundingSource === 'extra' ? '🎁 Extra' : '🏦 Savings'}
                  </button>
                )
              )}

              {/* Source badges */}
              {transaction.source === 'sms' && (
                <span className="inline-flex items-center px-2 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0">
                  📱 SMS
                </span>
              )}
              {transaction.tags?.includes('upi') && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0">
                  📸 UPI
                </span>
              )}

              {/* Confidence Indicator */}
              {transaction.confidence !== undefined && (
                <span className={cn(
                  "inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0",
                  transaction.confidence >= 0.85
                    ? "bg-green-500/10 text-green-600 dark:text-green-500"
                    : transaction.confidence >= 0.65
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                    : "bg-red-500/10 text-red-600 dark:text-red-500"
                )}>
                  {Math.round(transaction.confidence * 100)}% conf
                </span>
              )}
            </div>

            {/* Raw SMS */}
            {transaction.rawSms && (
              <div className="mb-3 p-2 bg-muted/30 border border-border/60 rounded-xl text-[10px] text-muted-foreground italic leading-relaxed break-words line-clamp-2">
                &ldquo;{transaction.rawSms}&rdquo;
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {section !== 'auto_finalized' && (
                <button 
                  onClick={() => handleApprove(transaction)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium hover:bg-primary/90 transition-all-smooth tap-target"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
              )}
              <Link 
                href={`/edit/${transaction.id}`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all-smooth tap-target",
                  section === 'needs_context' && transaction.tags?.includes('upi')
                    ? "bg-blue-600 text-white hover:bg-blue-700 animate-pulse-soft"
                    : "bg-muted text-foreground hover:bg-muted/80"
                )}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{section === 'needs_context' && transaction.tags?.includes('upi') ? 'Add Screenshot' : 'Edit'}</span>
              </Link>
              <button 
                onClick={() => deleteTransaction(transaction.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive rounded-xl text-xs font-medium hover:bg-destructive/20 transition-all-smooth tap-target"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalPending = pendingReview.length + needsContext.length

  // Categorized transactions that are ready to be approved in bulk
  const categorizedPendingCount = [...incomingPending, ...outgoingPending].filter(
    tx => tx.category && tx.category !== 'other'
  ).length

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-semibold text-foreground">Review Inbox</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {totalPending} pending · {todayAutoFinalized.length} auto-finalized today
              </p>
            </div>
            
            {/* Quick Finalize Toolbar */}
            {categorizedPendingCount > 0 && (
              <button
                onClick={handleApproveAllCategorized}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-xs font-semibold text-primary rounded-xl transition-all-smooth"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Approve All Categorized ({categorizedPendingCount})</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-4 lg:p-6 overflow-x-hidden space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-2xl p-3 border border-border dark:card-glow text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">Auto-Finalized</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-500">{todayAutoFinalized.length}</p>
              <p className="text-[10px] text-muted-foreground">today</p>
            </div>
            <div className="bg-card rounded-2xl p-3 border border-border dark:card-glow text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Eye className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">Pending Review</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-yellow-600 dark:text-yellow-500">{pendingReview.length}</p>
              <p className="text-[10px] text-muted-foreground">need action</p>
            </div>
            <div className="bg-card rounded-2xl p-3 border border-border dark:card-glow text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">Needs Context</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-500">{needsContext.length}</p>
              <p className="text-[10px] text-muted-foreground">missing info</p>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3 lg:p-4">
            <p className="text-xs lg:text-sm text-foreground">
              Select multiple items using checkboxes to approve or delete in bulk. Clicking <strong>⚡ Suggest</strong> on cards instantly categorizes them.
            </p>
          </div>

          {/* Incoming Money Review Section (Credits) */}
          {incomingPending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-green-600 dark:text-green-500 tracking-wider uppercase flex items-center gap-1.5">
                <span>📥</span> Incoming Money Review ({incomingPending.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingPending.map(tx => renderIncomingCard(tx))}
              </div>
            </div>
          )}

          {/* Payments & Expenses Section (Debits) */}
          {(outgoingPending.length > 0 || outgoingNeedsContext.length > 0) && (
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 border-b border-border pb-2">
                <span>💸</span> Payments & Expenses Review
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Needs Context Column */}
                {outgoingNeedsContext.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-red-600 dark:text-red-500 tracking-wider uppercase mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Needs Context ({outgoingNeedsContext.length})
                    </h3>
                    <div className="space-y-3">
                      {outgoingNeedsContext.map(tx => renderReviewCard(tx, 'needs_context'))}
                    </div>
                  </div>
                )}

                {/* Pending Review Column */}
                {outgoingPending.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground tracking-wider uppercase mb-3 flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" /> Pending Review ({outgoingPending.length})
                    </h3>
                    <div className="space-y-3">
                      {outgoingPending.map(tx => renderReviewCard(tx, 'pending'))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto-Finalized Section — Collapsible */}
          {autoFinalized.length > 0 && (
            <div className="border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowAutoFinalized(!showAutoFinalized)}
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-all-smooth"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <h2 className="text-xs font-bold text-green-600 dark:text-green-500 tracking-wider uppercase">
                    Auto-Finalized ({autoFinalized.length})
                  </h2>
                </div>
                {showAutoFinalized ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showAutoFinalized && (
                <div className="p-4 space-y-3 border-t border-border bg-muted/10">
                  {autoFinalized.slice(0, 20).map(tx => renderReviewCard(tx, 'auto_finalized'))}
                  {autoFinalized.length > 20 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      Showing latest 20 of {autoFinalized.length} auto-finalized transactions.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* All clear state */}
          {totalPending === 0 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">No transactions pending review.</p>
              {todayAutoFinalized.length > 0 && (
                <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                  ⚡ {todayAutoFinalized.length} transactions were auto-finalized today
                </p>
              )}
            </div>
          )}
        </div>

        {/* Floating Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur-md border border-border px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce-in">
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              {selectedIds.length} selected
            </span>
            <button
              onClick={handleBulkApprove}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all-smooth"
            >
              Approve Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold rounded-xl hover:bg-destructive/20 transition-all-smooth"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
