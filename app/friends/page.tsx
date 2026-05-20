'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { formatCurrency, getFriendBalance } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { Users, UserPlus, HandCoins, Trash2, CheckCircle, X, ArrowUpRight, ArrowDownRight, User } from 'lucide-react'
import { useApp } from '@/lib/app-context'

export default function FriendsPage() {
  const { state, isHydrated, addFriend, deleteFriend, addDebt, settleDebt, deleteDebt } = useApp()

  // Form states
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendName, setFriendName] = useState('')

  const [activeFriendId, setActiveFriendId] = useState<string | null>(null)
  const [showLogDebt, setShowLogDebt] = useState(false)
  const [debtAmount, setDebtAmount] = useState('')
  const [debtDescription, setDebtDescription] = useState('')
  const [debtDirection, setDebtDirection] = useState<'lent' | 'borrowed'>('lent')

  const [showSettle, setShowSettle] = useState(false)
  const [settleAmount, setSettleAmount] = useState('')
  
  const [showDetails, setShowDetails] = useState(false)

  if (!isHydrated) return null

  const rawFriends = state.friends || []
  const debts = state.debts || []
  const transactions = state.transactions || []

  // Compute friend balances dynamically (direct debts + transaction splits)
  const friends = rawFriends.map(f => ({
    ...f,
    balance: getFriendBalance(f.id, debts, transactions)
  }))

  // Calculations
  const netOwedToMe = friends
    .filter(f => f.balance > 0)
    .reduce((sum, f) => sum + f.balance, 0)

  const netIOwe = friends
    .filter(f => f.balance < 0)
    .reduce((sum, f) => sum + Math.abs(f.balance), 0)

  const handleCreateFriend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendName.trim()) return
    addFriend(friendName.trim())
    setFriendName('')
    setShowAddFriend(false)
  }

  const handleLogDebt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeFriendId || !debtAmount || !debtDescription) return

    const amt = parseFloat(debtAmount)
    // Positive if lent (they owe you), negative if borrowed (you owe them)
    const finalAmount = debtDirection === 'lent' ? amt : -amt

    addDebt({
      friendId: activeFriendId,
      amount: finalAmount,
      description: debtDescription,
      date: new Date().toISOString().split('T')[0]
    })

    setDebtAmount('')
    setDebtDescription('')
    setShowLogDebt(false)
    setActiveFriendId(null)
  }

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeFriendId || !settleAmount) return

    const amt = parseFloat(settleAmount)
    const friend = friends.find(f => f.id === activeFriendId)
    if (!friend) return

    // Settle debt records positive amount for settlement
    settleDebt(
      activeFriendId,
      amt,
      `Settled balance`,
      new Date().toISOString().split('T')[0]
    )

    setSettleAmount('')
    setShowSettle(false)
    setActiveFriendId(null)
  }

  const activeFriend = friends.find(f => f.id === activeFriendId)

  const getRelatedEntries = (friendId: string) => {
    // 1. Direct debts
    const friendDebts = debts
      .filter(d => d.friendId === friendId)
      .map(d => ({
        id: d.id,
        title: d.description,
        amount: d.amount,
        date: d.date,
        type: 'debt',
        isSettled: d.isSettled,
        createdAt: d.createdAt
      }))

    // 2. Transaction splits
    const friendSplits = transactions
      .filter(t => t.type === 'expense')
      .map(t => {
        if (t.splits && t.splits.length > 0) {
          const split = t.splits.find(s => s.friendId === friendId)
          if (split) {
            return {
              id: t.id,
              title: `${t.title} (Split)`,
              amount: split.amount,
              date: t.date,
              type: 'split',
              isSettled: false,
              createdAt: t.createdAt
            }
          }
        }
        if (t.splitWithFriendId === friendId) {
          return {
            id: t.id,
            title: `${t.title} (Split)`,
            amount: t.friendOwedAmount || 0,
            date: t.date,
            type: 'split',
            isSettled: false,
            createdAt: t.createdAt
          }
        }
        return null
      })
      .filter(Boolean) as any[]

    // Combine and sort by date descending
    return [...friendDebts, ...friendSplits].sort((a, b) => {
      const dateA = new Date(a.date + 'T' + (a.createdAt?.split('T')[1] || '00:00:00')).getTime()
      const dateB = new Date(b.date + 'T' + (b.createdAt?.split('T')[1] || '00:00:00')).getTime()
      return dateB - dateA
    })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            <h1 className="text-lg lg:text-xl font-semibold text-foreground">Friend Balances</h1>
            <button 
              onClick={() => setShowAddFriend(true)}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all-smooth tap-target"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Friend</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-6 overflow-x-hidden space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider">People Owe You</span>
              <p className="text-2xl lg:text-3xl font-extrabold text-foreground mt-2 tabular-nums">{formatCurrency(netOwedToMe)}</p>
            </div>
            <div className="bg-card border border-border dark:card-glow rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-wider">You Owe People</span>
              <p className="text-2xl lg:text-3xl font-extrabold text-foreground mt-2 tabular-nums">{formatCurrency(netIOwe)}</p>
            </div>
          </div>

          {/* Grid Layout of Friends */}
          <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" /> College Crew Ledger
              </h2>
            </div>
            
            <div className="p-4">
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
                  <p className="text-sm text-muted-foreground">No friends added yet. Split some lunch expenses!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map((friend) => {
                    const absBalance = Math.abs(friend.balance)
                    const relationship = friend.balance > 0 
                      ? 'owes you' 
                      : friend.balance < 0 
                      ? 'you owe' 
                      : 'settled'

                    return (
                      <div 
                        key={friend.id}
                        className="p-4 rounded-2xl bg-muted/30 border border-border hover:bg-muted/50 transition-all-smooth space-y-4 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div 
                            onClick={() => {
                              setActiveFriendId(friend.id)
                              setShowDetails(true)
                            }}
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                            title="View social ledger details"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm text-foreground truncate">{friend.name}</h3>
                              <p className={cn(
                                "text-xs font-medium capitalize mt-0.5 truncate",
                                friend.balance > 0 ? "text-green-600 dark:text-green-500" : friend.balance < 0 ? "text-orange-500" : "text-muted-foreground"
                              )}>
                                {relationship} {friend.balance !== 0 && formatCurrency(absBalance)}
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={() => deleteFriend(friend.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-muted transition-all-smooth shrink-0"
                            title="Remove Friend"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveFriendId(friend.id)
                              setShowLogDebt(true)
                            }}
                            className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold transition-all-smooth"
                          >
                            Add Debt
                          </button>
                          {friend.balance !== 0 && (
                            <button
                              onClick={() => {
                                setActiveFriendId(friend.id)
                                setSettleAmount(absBalance.toString())
                                setShowSettle(true)
                              }}
                              className="flex-1 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-500 rounded-xl text-xs font-semibold transition-all-smooth"
                            >
                              Settle Up
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Ledger History of Debt Changes */}
          <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Ledger History</h2>
            </div>
            
            <div className="divide-y divide-border">
              {debts.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground">No transaction logs in your social ledger yet.</p>
                </div>
              ) : (
                [...debts]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((log) => {
                    const friend = friends.find(f => f.id === log.friendId)
                    const isSettledEntry = log.isSettled
                    const isPositive = log.amount > 0

                    return (
                      <div key={log.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                            isSettledEntry 
                              ? "bg-green-500/10 text-green-600 dark:text-green-500" 
                              : isPositive 
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-500" 
                              : "bg-orange-500/10 text-orange-500"
                          )}>
                            {isSettledEntry ? '🤝' : isPositive ? '↗' : '↙'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {friend?.name || 'Deleted Friend'}: {log.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(log.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "font-bold text-xs tabular-nums",
                            isSettledEntry ? "text-green-600 dark:text-green-500" : isPositive ? "text-blue-600 dark:text-blue-400" : "text-orange-500"
                          )}>
                            {isSettledEntry ? 'Settled' : isPositive ? '+' : ''}{formatCurrency(log.amount)}
                          </span>
                          
                          <button
                            onClick={() => deleteDebt(log.id)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-all-smooth"
                            title="Undo Log"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          {/* Settlement History */}
          <div className="bg-card rounded-2xl border border-border dark:card-glow overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                🤝 Settlement History
              </h2>
            </div>
            
            <div className="divide-y divide-border">
              {debts.filter(d => d.isSettled).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">No settlements recorded yet.</p>
                </div>
              ) : (
                [...debts]
                  .filter(d => d.isSettled)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((log) => {
                    const friend = friends.find(f => f.id === log.friendId)
                    
                    return (
                      <div key={log.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-muted/10 transition-colors gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 dark:text-green-500 flex items-center justify-center shrink-0 text-sm font-semibold">
                            🤝
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {friend?.name || 'Deleted Friend'} settled <span className="text-green-600 dark:text-green-500 font-bold">{formatCurrency(Math.abs(log.amount))}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(log.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center ml-11 sm:ml-0">
                          {log.source === 'sms' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" title="Settled via automatic SMS credit ingestion">
                              📱 SMS Ingestion
                            </span>
                          ) : log.source === 'screenshot' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" title="Settled via screenshot upload">
                              📸 Screenshot
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20" title="Settled manually by user">
                              ✍️ Manual
                            </span>
                          )}

                          {log.referenceNumber && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 tabular-nums">
                              Ref: {log.referenceNumber}
                            </span>
                          )}

                          <button
                            onClick={() => deleteDebt(log.id)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-all-smooth ml-1"
                            title="Undo Settlement"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Add Friend */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border dark:card-glow rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-foreground">Add New Friend</h3>
              <button onClick={() => setShowAddFriend(false)} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFriend} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Friend Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={friendName}
                  onChange={e => setFriendName(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:bg-primary/90 transition-all-smooth"
              >
                Add Friend
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Log Debt */}
      {showLogDebt && activeFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border dark:card-glow rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-foreground">Log Debt</h3>
                <p className="text-[10px] text-muted-foreground">For {activeFriend.name}</p>
              </div>
              <button onClick={() => setShowLogDebt(false)} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleLogDebt} className="space-y-4">
              <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setDebtDirection('lent')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all-smooth",
                    debtDirection === 'lent' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  I Lent
                </button>
                <button
                  type="button"
                  onClick={() => setDebtDirection('borrowed')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all-smooth",
                    debtDirection === 'borrowed' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  I Borrowed
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Amount (₹)</label>
                <input 
                  type="number"
                  required
                  placeholder="0.00"
                  value={debtAmount}
                  onChange={e => setDebtAmount(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Description</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Swiggy Lunch split"
                  value={debtDescription}
                  onChange={e => setDebtDescription(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:bg-primary/90 transition-all-smooth"
              >
                Log Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Settle Up */}
      {showSettle && activeFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border dark:card-glow rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-foreground">Settle Up Balance</h3>
                <p className="text-[10px] text-muted-foreground">With {activeFriend.name}</p>
              </div>
              <button onClick={() => setShowSettle(false)} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSettle} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Repayment Amount (₹)</label>
                <input 
                  type="number"
                  required
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <button 
                type="submit"
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-all-smooth"
              >
                Confirm Settlement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Social Ledger Details */}
      {showDetails && activeFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border dark:card-glow rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-foreground">{activeFriend.name}&apos;s Ledger</h3>
                <p className="text-[10px] text-muted-foreground">Social transaction details</p>
              </div>
              <button 
                onClick={() => {
                  setShowDetails(false)
                  setActiveFriendId(null)
                }} 
                className="p-1.5 hover:bg-muted rounded-full text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-muted/30 rounded-2xl border border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Current Balance</span>
              <span className={cn(
                "font-extrabold text-sm tabular-nums",
                activeFriend.balance > 0 ? "text-green-600 dark:text-green-500" : activeFriend.balance < 0 ? "text-orange-500" : "text-muted-foreground"
              )}>
                {activeFriend.balance > 0 ? 'Owes you ' : activeFriend.balance < 0 ? 'You owe ' : 'Settled '}{formatCurrency(Math.abs(activeFriend.balance))}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase px-1">Ledger History</h4>
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 divide-y divide-border">
                {getRelatedEntries(activeFriend.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No transaction splits or logged debts.</p>
                ) : (
                  getRelatedEntries(activeFriend.id).map((entry) => {
                    const isSettledEntry = entry.isSettled
                    const isPositive = entry.amount > 0
                    return (
                      <div key={entry.id} className="pt-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{entry.title}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={cn(
                          "font-bold text-xs tabular-nums ml-2 shrink-0",
                          isSettledEntry ? "text-green-600 dark:text-green-500" : isPositive ? "text-blue-600 dark:text-blue-400" : "text-orange-500"
                        )}>
                          {isSettledEntry ? 'Settled' : isPositive ? '+' : ''}{formatCurrency(entry.amount)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
