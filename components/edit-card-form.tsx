'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountType } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { getCategoryIcon } from '@/lib/constants'

export function EditCardForm({ id }: { id: string }) {
  const router = useRouter()
  const { state, updateAccount, deleteAccount } = useApp()

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('credit')
  const [limit, setLimit] = useState('')
  const [availableBalance, setAvailableBalance] = useState('')
  const [billingCycleDay, setBillingCycleDay] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [smsIdentifier, setSmsIdentifier] = useState('')
  const [isExtra, setIsExtra] = useState(false)
  const [isSavingsHolding, setIsSavingsHolding] = useState(false)

  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (!isInitializedRef.current && state.accounts.length > 0) {
      const card = state.accounts.find(a => a.id === id)
      if (card) {
        setName(card.name)
        setType(card.type)
        setLimit(card.limit ? card.limit.toString() : '')
        setAvailableBalance(card.availableBalance !== undefined ? card.availableBalance.toString() : '')
        setBillingCycleDay(card.billingCycleDay ? card.billingCycleDay.toString() : '')
        setIsActive(card.isActive)
        setSmsIdentifier(card.smsIdentifier || '')
        setIsExtra(!!card.isExtra)
        setIsSavingsHolding(!!card.isSavingsHolding)
        isInitializedRef.current = true
      }
    }
  }, [id, state.accounts])

  const handleSubmit = () => {
    if (!name) return

    updateAccount(id, {
      name,
      type,
      limit: parseInt(limit) || 0,
      availableBalance: type === 'debit' ? (parseInt(availableBalance) || 0) : undefined,
      billingCycleDay: type === 'credit' ? (parseInt(billingCycleDay) || 0) : 0,
      isActive,
      smsIdentifier: smsIdentifier.trim() || undefined,
      isExtra,
      isSavingsHolding: type !== 'credit' ? isSavingsHolding : false,
    })

    router.push('/cards')
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this card? This may affect historical transactions.')) {
      deleteAccount(id)
      router.push('/cards')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 lg:h-16 max-w-lg mx-auto">
          <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-muted rounded-xl transition-all-smooth"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg lg:text-xl font-semibold flex-1">Edit Account</h1>
          <button onClick={handleDelete} className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-all-smooth">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
            Account Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
            Account Type
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setType('credit')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all-smooth border',
                type === 'credit' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
              )}
            >
              Credit Card
            </button>
            <button
              onClick={() => setType('debit')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all-smooth border',
                type === 'debit' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
              )}
            >
              Debit / Cash
            </button>
          </div>
        </div>

        {type === 'credit' && (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
                Credit Limit
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
                Billing Cycle Day (1-31)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={billingCycleDay}
                onChange={(e) => setBillingCycleDay(e.target.value)}
                placeholder="e.g. 5 for the 5th of every month"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums text-foreground"
              />
            </div>
          </>
        )}

        {type === 'debit' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
                Available Balance
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={availableBalance}
                onChange={(e) => setAvailableBalance(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
                Monthly Spending Budget
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums text-foreground"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Budget limit for monthly base spending. Resets at end of month.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 block">
            SMS Identifier / Last 4 Digits
          </label>
          <input
            type="text"
            value={smsIdentifier}
            onChange={(e) => setSmsIdentifier(e.target.value)}
            placeholder="e.g. 4321 or XX4321"
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Last 4 digits or masked identifier present in SMS text (e.g. XX4321 or 4321).
          </p>
        </div>

        {/* Default to Extra Allowance Toggle */}
        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl mt-4">
          <div>
            <p className="font-medium text-sm">Default to Extra Allowance</p>
            <p className="text-xs text-muted-foreground">Transactions on this card default to extra allowance spendings</p>
          </div>
          <button
            onClick={() => setIsExtra(!isExtra)}
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative shrink-0 tap-target',
              isExtra ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              isExtra ? 'left-6' : 'left-1'
            )} />
          </button>
        </div>

        {type !== 'credit' && (
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div>
              <p className="font-medium text-sm">Designate as Savings Holding Account</p>
              <p className="text-xs text-muted-foreground">This card/account holds your physical savings funds</p>
            </div>
            <button
              onClick={() => setIsSavingsHolding(!isSavingsHolding)}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative shrink-0 tap-target',
                isSavingsHolding ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                isSavingsHolding ? 'left-6' : 'left-1'
              )} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
          <div>
            <p className="font-medium text-sm">Account Status</p>
            <p className="text-xs text-muted-foreground">Active accounts appear in lists</p>
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative shrink-0 tap-target',
              isActive ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              isActive ? 'left-6' : 'left-1'
            )} />
          </button>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={!name}
          className="w-full py-3.5 mt-6 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all-smooth"
        >
          Save Account Settings
        </button>

        {/* Card Transactions Section */}
        {(() => {
          const cardTransactions = state.transactions
            .filter(t => t.accountId === id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

          return (
            <div className="border-t border-border pt-6 mt-6">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-4">
                Transaction History ({cardTransactions.length})
              </h2>
              
              {cardTransactions.length === 0 ? (
                <div className="text-center py-8 bg-muted/20 border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">No transactions recorded for this card yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cardTransactions.map(t => {
                    const icon = getCategoryIcon(t.category)
                    const isExpense = t.type === 'expense' || t.type === 'savings_deposit'
                    return (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3.5 bg-card border border-border rounded-xl hover:bg-muted/30 transition-all-smooth"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                            {icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">{t.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{t.date}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            "font-bold text-xs tabular-nums",
                            isExpense ? "text-foreground" : "text-green-600 dark:text-green-500"
                          )}>
                            {isExpense ? '-' : '+'}{formatCurrency(t.amount)}
                          </p>
                          {t.status === 'pending' && (
                            <span className="text-[9px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
