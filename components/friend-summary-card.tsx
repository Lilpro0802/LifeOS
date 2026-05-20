'use client'

import { useApp } from '@/lib/app-context'
import { formatCurrency, getFriendBalance } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { Users, ArrowUpRight, ArrowDownRight, User } from 'lucide-react'
import Link from 'next/link'

export function FriendSummaryCard() {
  const { state, isHydrated } = useApp()

  if (!isHydrated) {
    return (
      <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 animate-pulse h-[260px]" />
    )
  }

  const rawFriends = state.friends || []
  const debts = state.debts || []
  const transactions = state.transactions || []

  // Compute friend balances dynamically
  const friends = rawFriends.map(f => ({
    ...f,
    balance: getFriendBalance(f.id, debts, transactions)
  }))

  const totalOwedToMe = friends
    .filter(f => f.balance > 0)
    .reduce((sum, f) => sum + f.balance, 0)

  const totalIOwe = friends
    .filter(f => f.balance < 0)
    .reduce((sum, f) => sum + Math.abs(f.balance), 0)

  const netPosition = totalOwedToMe - totalIOwe

  // Get top 3 unsettled friends by absolute balance
  const topUnsettled = [...friends]
    .filter(f => f.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 3)

  return (
    <div className="bg-card border border-border dark:card-glow rounded-2xl p-5 lg:p-6 flex flex-col justify-between h-full space-y-4 hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" /> Crew Ledger Summary
        </h3>
        <Link
          href="/friends"
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
        >
          <span>Manage Ledger</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
          <span className="text-[10px] text-muted-foreground font-medium block leading-none">Owed To You</span>
          <span className="text-sm lg:text-base font-extrabold text-foreground mt-2 block tabular-nums">
            {formatCurrency(totalOwedToMe)}
          </span>
        </div>
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
          <span className="text-[10px] text-muted-foreground font-medium block leading-none">You Owe</span>
          <span className="text-sm lg:text-base font-extrabold text-foreground mt-2 block tabular-nums">
            {formatCurrency(totalIOwe)}
          </span>
        </div>
        <div className={cn(
          "p-3 rounded-xl border",
          netPosition >= 0 
            ? "bg-green-500/5 border-green-500/10 text-green-600 dark:text-green-500" 
            : "bg-orange-500/5 border-orange-500/10 text-orange-500"
        )}>
          <span className="text-[10px] font-medium block leading-none">Net Position</span>
          <span className="text-sm lg:text-base font-extrabold mt-2 block tabular-nums">
            {netPosition >= 0 ? '+' : ''}{formatCurrency(netPosition)}
          </span>
        </div>
      </div>

      {/* Top Unsettled Friends */}
      <div className="space-y-2 flex-1">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Top Unsettled Ledger Balances
        </h4>
        {topUnsettled.length === 0 ? (
          <div className="text-center py-4 bg-muted/10 rounded-xl border border-dashed border-border">
            <p className="text-xs text-muted-foreground italic">All social ledger balances settled! 🤝</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topUnsettled.map(f => {
              const absBal = Math.abs(f.balance)
              const owesMe = f.balance > 0
              return (
                <div 
                  key={f.id} 
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none uppercase",
                      owesMe
                        ? "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20"
                        : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                    )}>
                      {owesMe ? "Owes you" : "You owe"}
                    </span>
                    <span className="text-xs font-extrabold text-foreground tabular-nums">
                      {formatCurrency(absBal)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
