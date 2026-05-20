'use client'

import { Sidebar } from '@/components/sidebar'
import { User, LogOut, ChevronRight, Database, Trash2, RefreshCw } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const { state, isHydrated, updateSettings, pruneTransactions, clearTransactions, clearAllData } = useApp()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [university, setUniversity] = useState('')
  const [budgetPreference, setBudgetPreference] = useState('')

  // Load state when hydrated
  useEffect(() => {
    if (isHydrated && state.settings) {
      setName(state.settings.userName || '')
      setEmail(state.settings.userEmail || '')
      setUniversity(state.settings.university || '')
      setBudgetPreference(state.settings.budgetPreference || '')
    }
  }, [isHydrated, state.settings])

  if (!isHydrated) return null

  const handlePrune = () => {
    if (confirm('Are you sure you want to delete all transactions older than 3 months? This action is irreversible.')) {
      pruneTransactions()
      alert('Older transactions pruned successfully!')
    }
  }

  const handleClearTransactions = () => {
    if (confirm('Are you sure you want to clear your entire transaction history? Your settings, cards, and friends will be kept. This action is irreversible.')) {
      clearTransactions()
      alert('Transaction history cleared successfully!')
    }
  }

  const handleClear = () => {
    if (confirm('⚠️ CRITICAL WARNING ⚠️\n\nThis will completely reset all transactions, cards, friends, savings, and custom configurations. Everything will be permanently deleted.\n\nAre you absolutely sure you want to proceed?')) {
      clearAllData()
      alert('All application data cleared.')
    }
  }

  const getInitials = (n: string) => {
    return n
      ? n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
      : 'JS'
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center px-4 lg:px-6 h-14 lg:h-16">
            <h1 className="text-lg lg:text-xl font-semibold text-foreground">Settings & Profile</h1>
          </div>
        </header>

        <div className="p-4 lg:p-6 max-w-lg mx-auto lg:mx-0 overflow-x-hidden space-y-6">
          {/* Profile Card */}
          <div className="bg-card rounded-2xl p-4 lg:p-5 border border-border dark:card-glow">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold shrink-0">
                {getInitials(state.settings.userName)}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{state.settings.userName || 'Guest User'}</h2>
                <p className="text-xs text-muted-foreground truncate">{state.settings.userEmail || 'no-email@provided.com'}</p>
                {state.settings.university && (
                  <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">🏫 {state.settings.university}</p>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="bg-card rounded-2xl p-5 border border-border dark:card-glow space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" /> Personal Information
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. John Student"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. john@university.edu"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">College / University</label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. Stanford University"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Budget Preference / Goal</label>
                <input
                  type="text"
                  value={budgetPreference}
                  onChange={(e) => setBudgetPreference(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. Savings Oriented / Moderate"
                />
              </div>
            </div>

            <button
              onClick={() => {
                updateSettings({
                  userName: name,
                  userEmail: email,
                  university,
                  budgetPreference,
                })
                alert('Profile updated successfully!')
              }}
              className="w-full mt-2 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-all-smooth"
            >
              Save Profile Details
            </button>
          </div>

          {/* Review & Automation Settings */}
          <div className="bg-card rounded-2xl p-5 border border-border dark:card-glow space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-primary" /> Review & Automation
            </h3>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Auto-Finalize Threshold (₹)</label>
              <p className="text-[10px] text-muted-foreground/80 mb-2">
                Transactions below this amount from known merchants (3+ confirmations) will skip the review queue.
              </p>
              <input
                type="number"
                min={0}
                step={50}
                value={state.settings.autoFinalizeThreshold ?? 150}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  updateSettings({ autoFinalizeThreshold: val })
                }}
                className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                placeholder="150"
              />
            </div>

            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> When you approve a transaction, the system remembers the merchant→category mapping. After 3 approvals of the same merchant, future transactions from that merchant below ₹{state.settings.autoFinalizeThreshold ?? 150} will be automatically finalized — no review needed.
              </p>
            </div>
          </div>

          {/* Month Lifecycle Settings */}
          <div className="bg-card rounded-2xl p-5 border border-border dark:card-glow space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1 flex items-center gap-1.5">
              <span>📅</span> Month Lifecycle & Reserve
            </h3>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Protected Monthly Reserve (₹)</label>
              <p className="text-[10px] text-muted-foreground/80 mb-2">
                The minimum amount of money to keep in your main debit account. Any amount above this will be marked as Transferable Savings.
              </p>
              <input
                type="number"
                min={0}
                step={1000}
                value={state.settings.protectedReserve ?? 10000}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  updateSettings({ protectedReserve: val })
                }}
                className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                placeholder="10000"
              />
            </div>
          </div>

          {/* Database & Storage Maintenance */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 px-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" /> Storage & Database
            </h3>
            <div className="bg-card rounded-2xl border border-border p-4 lg:p-5 dark:card-glow space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your data is stored <strong>completely offline</strong> in browser local storage (<code>localStorage</code>). It runs entirely on your device with <strong>zero external tracking or cloud latency</strong>.
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handlePrune}
                  className="w-full flex items-center justify-between p-3 bg-muted/40 border border-border hover:bg-muted/70 rounded-xl transition-all-smooth text-left tap-target"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" /> Prune Older Data
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Delete transactions older than 3 months</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button
                  onClick={handleClearTransactions}
                  className="w-full flex items-center justify-between p-3 bg-muted/40 border border-border hover:bg-muted/70 rounded-xl transition-all-smooth text-left tap-target"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-orange-500" /> Clear Transaction History
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Delete all transactions while preserving cards and settings</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button
                  onClick={handleClear}
                  className="w-full flex items-center justify-between p-3 bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 rounded-xl transition-all-smooth text-left tap-target"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-destructive flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> Clear All Data
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">Reset app completely and clear localStorage</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button className="w-full flex items-center justify-center gap-2 p-3.5 bg-destructive/10 text-destructive rounded-2xl font-medium hover:bg-destructive/20 transition-all-smooth tap-target active:scale-[0.98]">
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Log out</span>
          </button>

          {/* Version */}
          <p className="text-center text-[11px] text-muted-foreground">
            Life OS v1.0.0
          </p>
        </div>
      </main>
    </div>
  )
}
