'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountType } from '@/lib/types'

export function AddCardForm() {
  const router = useRouter()
  const { addAccount } = useApp()

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('credit')
  const [limit, setLimit] = useState('')
  const [availableBalance, setAvailableBalance] = useState('')
  const [billingCycleDay, setBillingCycleDay] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [smsIdentifier, setSmsIdentifier] = useState('')
  const [isExtra, setIsExtra] = useState(false)
  const [isSavingsHolding, setIsSavingsHolding] = useState(false)

  const handleSubmit = () => {
    if (!name) return

    addAccount({
      name,
      type,
      limit: parseInt(limit) || 0,
      availableBalance: type === 'debit' ? (parseInt(availableBalance) || 0) : undefined,
      billingCycleDay: type === 'credit' ? (parseInt(billingCycleDay) || 0) : 0,
      isActive,
      smsIdentifier: smsIdentifier.trim() || undefined,
      isExtra,
      isSavingsHolding: type !== 'credit' ? isSavingsHolding : false,
      color: type === 'credit' ? 'bg-primary' : 'bg-chart-2',
      sortOrder: 99,
    })

    router.push('/cards')
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
          <h1 className="text-lg lg:text-xl font-semibold flex-1">Add Account</h1>
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
            placeholder="e.g. HDFC Credit Card"
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
          Add Account
        </button>
      </div>
    </div>
  )
}
