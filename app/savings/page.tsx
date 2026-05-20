'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { formatCurrency, getTotalSavingsBalance } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { PiggyBank, ArrowUpRight, ArrowDownRight, Plus, Gift, Trash2, ExternalLink } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'

export default function SavingsPage() {
  const { state, isHydrated, addWishlistItem, deleteWishlistItem } = useApp()
  const [wishName, setWishName] = useState('')
  const [wishPrice, setWishPrice] = useState('')
  const [wishLink, setWishLink] = useState('')
  const [showAddWish, setShowAddWish] = useState(false)

  if (!isHydrated) return null

  const totalSavings = getTotalSavingsBalance(state.transactions, state.accounts)
  
  const recentSavingsActivity = state.transactions
    .filter(t => t.type === 'savings_deposit' || t.type === 'savings_withdrawal' || (t.type === 'expense' && t.fundingSource === 'savings'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const handleAddWish = (e: React.FormEvent) => {
    e.preventDefault()
    if (!wishName || !wishPrice) return
    addWishlistItem({
      name: wishName,
      price: parseFloat(wishPrice),
      link: wishLink || undefined
    })
    setWishName('')
    setWishPrice('')
    setWishLink('')
    setShowAddWish(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <h1 className="text-lg lg:text-xl font-semibold text-foreground">Savings</h1>
            <Link 
              href="/add"
              className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all-smooth tap-target"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add money</span>
            </Link>
          </div>
        </header>

        <div className="p-4 lg:p-6 overflow-x-hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-center">
              <div className="w-full bg-card rounded-3xl p-8 border border-border dark:card-glow flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <PiggyBank className="w-7 h-7 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Savings Balance</span>
                <p className="text-4xl lg:text-5xl font-bold tabular-nums text-foreground">{formatCurrency(totalSavings)}</p>
              </div>
            </div>

            {/* Linked Account Status Card */}
            {(() => {
              const savingsAccount = state.accounts.find(a => a.isSavingsHolding)
              if (!savingsAccount) {
                return (
                  <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No savings account linked. Go to <Link href="/cards" className="text-primary hover:underline font-medium">Cards</Link> and toggle "Designate as Savings Holding Account" on your SIB card.
                    </p>
                  </div>
                )
              }

              const physicalBalance = savingsAccount.availableBalance ?? 0
              const diff = physicalBalance - totalSavings
              const inSync = diff === 0

              return (
                <div className="bg-card rounded-2xl p-5 border border-border dark:card-glow space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">Linked Savings Account</h3>
                      <p className="text-xs text-muted-foreground">{savingsAccount.name}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-full",
                      inSync 
                        ? "bg-green-500/10 text-green-600 dark:text-green-500" 
                        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                    )}>
                      {inSync ? "Perfect Sync ✓" : "Sync Mismatch ⚠️"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Tracked Digital Savings</p>
                      <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totalSavings)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Physical SIB Balance</p>
                      <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(physicalBalance)}</p>
                    </div>
                  </div>

                  {!inSync && (
                    <div className="mt-2 text-[10px] text-muted-foreground leading-relaxed bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3">
                      Discrepancy of <strong className="font-bold text-yellow-600 dark:text-yellow-500">{formatCurrency(Math.abs(diff))}</strong> detected. 
                      {diff > 0 
                        ? " Your physical SIB card has more money than tracked savings. Did you deposit extra cash or skip logging a transfer?"
                        : " Your physical SIB card has less money than tracked savings. Did you make an expense from savings or skip importing a debit SMS?"
                      }
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Recent Activity */}
            <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
              <div className="px-4 lg:px-5 py-3 border-b border-border">
                <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Recent Activity</h2>
              </div>
              <div className="divide-y divide-border">
                {recentSavingsActivity.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">No recent savings activity.</p>
                  </div>
                )}
                {recentSavingsActivity.map((activity) => (
                  <Link 
                    key={activity.id}
                    href={`/edit/${activity.id}`}
                    className="px-4 lg:px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-all-smooth cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        activity.type === 'savings_deposit' ? 'bg-green-500/10' : 'bg-destructive/10'
                      )}>
                        {activity.type === 'savings_deposit' 
                          ? <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-500" />
                          : <ArrowDownRight className="w-4 h-4 text-destructive" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(activity.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'font-semibold tabular-nums text-sm shrink-0 ml-2',
                      activity.type === 'savings_deposit' ? 'text-green-600 dark:text-green-500' : 'text-foreground'
                    )}>
                      {activity.type === 'savings_deposit' ? '+' : '-'}{formatCurrency(activity.amount)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Wishlist Sidebar Column */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
              <div className="px-4 lg:px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-primary" /> Savings Wishlist
                </h2>
                <button 
                  onClick={() => setShowAddWish(!showAddWish)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  {showAddWish ? 'Cancel' : '+ Add Wish'}
                </button>
              </div>
              
              {showAddWish && (
                <form onSubmit={handleAddWish} className="p-4 border-b border-border space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Item Name" 
                      value={wishName} 
                      onChange={e => setWishName(e.target.value)}
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input 
                      type="number" 
                      placeholder="Price (₹)" 
                      value={wishPrice} 
                      onChange={e => setWishPrice(e.target.value)}
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <input 
                    type="url" 
                    placeholder="Product Link (optional)" 
                    value={wishLink} 
                    onChange={e => setWishLink(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-xl text-xs hover:bg-primary/90 transition-all-smooth"
                  >
                    Save Wish
                  </button>
                </form>
              )}

              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {(state.wishlist || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No wishes saved yet. Dream big!</p>
                ) : (
                  (state.wishlist || []).map(item => {
                    const percentSaved = Math.min(100, Math.round((totalSavings / item.price) * 100))
                    const remaining = Math.max(0, item.price - totalSavings)
                    const isAffordable = totalSavings >= item.price

                    return (
                      <div key={item.id} className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <span className="truncate">{item.name}</span>
                              {item.link && (
                                <a 
                                  href={item.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:opacity-80 shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Target: {formatCurrency(item.price)}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {isAffordable ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-500 rounded-full">
                                Affordable! 🎉
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-500 rounded-full">
                                ₹{remaining} left
                              </span>
                            )}
                            <button 
                              onClick={() => deleteWishlistItem(item.id)}
                              className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-destructive transition-all-smooth"
                              title="Remove Wish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{percentSaved}% saved</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isAffordable ? "bg-green-500" : "bg-primary"
                              )}
                              style={{ width: `${percentSaved}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
