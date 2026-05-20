'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { useApp } from '@/lib/app-context'
import { parseSms, isValidTransactionSms, type ParsedSmsResult } from '@/lib/sms-parser'
import { CATEGORIES } from '@/lib/constants'
import { ArrowLeft, Sparkles, Plus, AlertCircle, FileText, CheckCircle2, Brain } from 'lucide-react'
import { formatCurrency } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import { SmsTrainer } from '@/components/sms-trainer'

const SAMPLE_TEMPLATES = [
  {
    label: 'Debit Card (Swiggy)',
    text: 'Your debit card XX4321 was spent for Rs. 340 at Swiggy on 19-May-26. Available balance Rs. 14,200.',
  },
  {
    label: 'Credit Card (Amazon Shopping)',
    text: 'Spent Rs. 1,250.00 on Credit Card XX9812 at Amazon India on 2026-05-19. Available limit Rs. 45,000.',
  },
  {
    label: 'Cash Deposit / Credit (Refund)',
    text: 'INR 500.00 credited to Account XX4321 towards refund from Zomato on 19/05/26.',
  },
]

export default function SmsImportPage() {
  const router = useRouter()
  const { state, addTransaction } = useApp()

  const [activeTab, setActiveTab] = useState<'import' | 'trainer'>('import')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedSmsResult | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Editable parsed values
  const [editedTitle, setEditedTitle] = useState('')
  const [editedAmount, setEditedAmount] = useState('')
  const [editedCategory, setEditedCategory] = useState('')
  const [editedAccount, setEditedAccount] = useState('')
  const [editedSource, setEditedSource] = useState<'base' | 'extra' | 'savings'>('base')
  const [editedDate, setEditedDate] = useState('')

  const handleParse = () => {
    if (!rawText.trim()) return

    setImportSuccess(false)

    // Check if the SMS message represents a valid bank transaction notification
    if (!isValidTransactionSms(rawText)) {
      setValidationError('⚠️ This SMS does not appear to be a valid Union Bank or SBI bank transaction alert. It must contain a rupee amount and a card/account identifier.')
      setParsed(null)
      return
    }

    setValidationError(null)
    const res = parseSms(rawText, state.accounts, state.merchantMemory || {})
    setParsed(res)

    // Pre-populate fields
    setEditedTitle(res.merchant || 'Unknown Merchant')
    setEditedAmount(res.amount ? res.amount.toString() : '0')
    setEditedCategory(res.suggestedCategory || 'other')
    setEditedAccount(res.accountId || (state.accounts[0]?.id || ''))
    setEditedSource(res.suggestedFundingSource || 'base')
    setEditedDate(res.date)
  }

  const handleImport = () => {
    if (!parsed) return

    // Create a transaction draft with 'pending' status
    const newDraft = {
      title: editedTitle.trim() || 'Imported Transaction',
      amount: parseFloat(editedAmount) || 0,
      type: parsed.direction === 'credit' ? ('allowance' as const) : ('expense' as const),
      category: editedCategory,
      fundingSource: parsed.direction === 'credit' ? undefined : editedSource,
      accountId: editedAccount,
      date: editedDate,
      status: 'pending_review' as const, // enters confidence engine for routing
      confidence: parsed.confidence,
      reviewReasons: ['imported_sms'],
      note: 'SMS Import Sandbox',
      tags: parsed.isUPI ? ['sms', 'upi'] : ['sms'],
      source: 'sms' as const,
      rawSms: rawText,
      availableBalance: parsed.availableBalance, // copy balance parsed from SMS
      parsedTimestamp: parsed.parsedTimestamp,
      referenceNumber: parsed.referenceNumber,
    }

    addTransaction(newDraft)
    setImportSuccess(true)
    setParsed(null)
    setRawText('')
    
    // Redirect to review page after a short delay
    setTimeout(() => {
      router.push('/review')
    }, 1200)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-pt">
          <div className="flex items-center gap-3 px-4 lg:px-6 h-14 lg:h-16">
            <button 
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-muted rounded-xl transition-all-smooth lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg lg:text-xl font-semibold text-foreground flex items-center gap-2">
              {activeTab === 'import' ? (
                <>
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" /> SMS Sandbox Import
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 text-violet-500 animate-pulse" /> SMS Parser Trainer
                </>
              )}
            </h1>
          </div>
        </header>

        <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-muted/60 border border-border/50 rounded-2xl max-w-md mx-auto">
            <button
              onClick={() => {
                setActiveTab('import')
                setParsed(null)
                setRawText('')
                setImportSuccess(false)
                setValidationError(null)
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300",
                activeTab === 'import'
                  ? "bg-card text-foreground shadow-sm border border-border/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" /> Sandbox Import
            </button>
            <button
              onClick={() => {
                setActiveTab('trainer')
                setParsed(null)
                setRawText('')
                setImportSuccess(false)
                setValidationError(null)
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300",
                activeTab === 'trainer'
                  ? "bg-card text-foreground shadow-sm border border-border/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Brain className="w-3.5 h-3.5" /> Parser Trainer
            </button>
          </div>

          {activeTab === 'import' ? (
            <>
              {/* Instructions */}
              <div className="bg-card rounded-2xl p-4 lg:p-5 border border-border dark:card-glow">
                <h2 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5 text-foreground">
                  <FileText className="w-4 h-4 text-primary" /> Parse SMS Sandbox
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Test the offline SMS transaction processing pipeline. Paste a bank alerts SMS below, or click a sample template to populate instantly. Parsed results are imported directly into the <strong>Review Queue</strong>.
                </p>
              </div>

              {/* Quick Templates */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase px-1">
                  Select Sample SMS Template
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setRawText(tmpl.text)
                        setParsed(null)
                        setImportSuccess(false)
                      }}
                      className="p-3 text-left bg-muted/40 border border-border hover:bg-muted/70 rounded-xl transition-all-smooth text-xs"
                    >
                      <p className="font-semibold text-foreground truncate mb-1">{tmpl.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{tmpl.text}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Box */}
              <div className="bg-card rounded-2xl p-4 border border-border dark:card-glow space-y-3">
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  placeholder="Paste raw SMS text here..."
                  rows={4}
                  className="w-full bg-muted/30 border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
                />
                
                {validationError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </div>
                )}

                <button
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-all-smooth disabled:opacity-50"
                >
                  Parse Transaction Details
                </button>
              </div>

              {/* Success Banner */}
              {importSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-500 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold">Imported Successfully!</p>
                    <p className="opacity-90">Redirecting to the Review Queue...</p>
                  </div>
                </div>
              )}

              {/* Parse Results Preview & Edit Card */}
              {parsed && (
                <div className="bg-card border border-border dark:card-glow rounded-3xl p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Extracted Details</h3>
                      <p className="text-[10px] text-muted-foreground">Confidence: {Math.round(parsed.confidence * 100)}%</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      parsed.direction === 'credit' 
                        ? "bg-green-500/10 text-green-600 dark:text-green-500" 
                        : "bg-orange-500/10 text-orange-500"
                    )}>
                      {parsed.direction}
                    </span>
                  </div>

                  {/* Parsed Values visual card preview */}
                  <div className="bg-muted/30 border border-border rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Extracted Merchant & Amount</p>
                      <p className="font-bold text-sm text-foreground mt-1">{editedTitle || 'Unknown Merchant'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-foreground tabular-nums">
                        {formatCurrency(parseFloat(editedAmount) || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Form editing variables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Payee / Merchant</label>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        value={editedAmount}
                        onChange={(e) => setEditedAmount(e.target.value)}
                        className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Guessed Category</label>
                      <select
                        value={editedCategory}
                        onChange={(e) => setEditedCategory(e.target.value)}
                        className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Detected Account</label>
                      <select
                        value={editedAccount}
                        onChange={(e) => setEditedAccount(e.target.value)}
                        className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      >
                        {state.accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {parsed.direction === 'debit' && (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Funding Source</label>
                        <select
                          value={editedSource}
                          onChange={(e) => setEditedSource(e.target.value as any)}
                          className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        >
                          <option value="base">💰 Base Allowance</option>
                          <option value="extra">🎁 Extra Allowance</option>
                          <option value="savings">🏦 Savings</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Parsed Date</label>
                      <input
                        type="date"
                        value={editedDate}
                        onChange={(e) => setEditedDate(e.target.value)}
                        className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      />
                    </div>
                  </div>

                  {parsed.availableBalance !== null && (
                    <div className="bg-primary/5 rounded-xl p-3 text-[11px] text-muted-foreground border border-primary/10">
                      ℹ️ Available Balance extracted from SMS: <strong>{formatCurrency(parsed.availableBalance)}</strong>
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-xs transition-all-smooth flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Import into Review Queue
                  </button>
                </div>
              )}
            </>
          ) : (
            <SmsTrainer />
          )}
        </div>
      </main>
    </div>
  )
}
