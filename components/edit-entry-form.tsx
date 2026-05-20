'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { categories, fundingSources } from '@/lib/data'
import { ArrowLeft, Calendar, Trash2, Camera, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'
import type { ReviewStatus } from '@/lib/types'
import { extractScreenshotData, type ParsedOcrResult } from '@/lib/ocr-parser'

type TransactionType = 'expense' | 'extra' | 'save'

const transactionTypes = [
  { id: 'expense', label: 'Expense', icon: '💸' },
  { id: 'save', label: 'Add to Savings', icon: '🏦' },
  { id: 'extra', label: 'Add Extra Allowance', icon: '🎁' },
]

export function EditEntryForm({ id }: { id: string }) {
  const router = useRouter()
  const { state, updateTransaction, deleteTransaction } = useApp()

  const [type, setType] = useState<TransactionType>('expense')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [fundedBy, setFundedBy] = useState('base')
  const [paidWith, setPaidWith] = useState(state.accounts[0]?.id || '')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const isClosed = state.closedMonths?.some(s => {
    const d = new Date(date + 'T00:00:00')
    return !isNaN(d.getTime()) && s.year === d.getFullYear() && (s.month - 1) === d.getMonth()
  })
  const [status, setStatus] = useState<ReviewStatus>('auto_finalized')
  const [confidence, setConfidence] = useState(0.9)
  const [reviewReasons, setReviewReasons] = useState<string[]>([])
  const [parsedTimestamp, setParsedTimestamp] = useState<number | null>(null)
  const [time, setTime] = useState('')
  const [referenceNumber, setReferenceNumber] = useState<string | undefined>(undefined)
  const [ssRefMatched, setSsRefMatched] = useState<boolean | null>(null)
  
  // OCR Context States
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<ParsedOcrResult | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isInitializedRef = useRef(false)

  // Split states
  const [splitChecked, setSplitChecked] = useState(false)
  const [splitFriendId, setSplitFriendId] = useState('')
  const [whoPaid, setWhoPaid] = useState<'me' | 'friend'>('me')
  const [splitAmount, setSplitAmount] = useState('')

  // Multi-friend splits state
  const [friendShares, setFriendShares] = useState<Record<string, string>>({})

  const handleAmountChange = (val: string) => {
    setAmount(val)
    const num = parseFloat(val)
    if (!isNaN(num)) {
      setSplitAmount((num / 2).toFixed(2))
    } else {
      setSplitAmount('')
    }
  }

  const toggleFriendSelection = (friendId: string) => {
    const updated = { ...friendShares }
    if (updated[friendId] !== undefined) {
      delete updated[friendId]
    } else {
      const num = parseFloat(amount)
      const count = Object.keys(updated).length + 2
      const defaultShare = isNaN(num) ? '' : (num / count).toFixed(2)
      updated[friendId] = defaultShare
    }
    setFriendShares(updated)
  }

  const handleFriendShareChange = (friendId: string, val: string) => {
    setFriendShares(prev => ({
      ...prev,
      [friendId]: val
    }))
  }

  const splitEqually = () => {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return
    const activeFriendIds = Object.keys(friendShares)
    if (activeFriendIds.length === 0) return
    const share = (num / (activeFriendIds.length + 1)).toFixed(2)
    const updated: Record<string, string> = {}
    activeFriendIds.forEach(id => {
      updated[id] = share
    })
    setFriendShares(updated)
  }

  const processScreenshotFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewImage(url)
    setOcrLoading(true)

    try {
      const result = await extractScreenshotData(file, state.accounts)
      setOcrResult(result)

      if (result.merchant) setName(result.merchant)
      if (result.amount !== null) setAmount(result.amount.toString())
      if (result.date) setDate(result.date)
      if (result.accountId) {
        setPaidWith(result.accountId)
        const acc = state.accounts.find(a => a.id === result.accountId)
        const isSbiCredit = acc?.name.toLowerCase().includes('sbi') && acc?.type === 'credit'
        if (acc?.isExtra || isSbiCredit) {
          setFundedBy('extra')
        }
      }
      if (result.parsedTimestamp) {
        setParsedTimestamp(result.parsedTimestamp)
        const d = new Date(result.parsedTimestamp)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setTime(`${hh}:${mm}`)
      }
      
      const originalTx = state.transactions.find(t => t.id === id)
      if (result.referenceNumber) {
        setReferenceNumber(result.referenceNumber)
        if (originalTx?.referenceNumber) {
          if (originalTx.referenceNumber === result.referenceNumber) {
            setSsRefMatched(true)
            setConfidence(1.0)
            setStatus('auto_finalized')
          } else {
            setSsRefMatched(false)
          }
        } else {
          setSsRefMatched(true)
        }
      } else {
        setSsRefMatched(null)
      }

      if (result.confidence > 0.8 || (result.referenceNumber && originalTx?.referenceNumber === result.referenceNumber)) {
        setStatus('auto_finalized')
      }
    } catch (err) {
      console.error('OCR Error', err)
    } finally {
      setOcrLoading(false)
    }
  }

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processScreenshotFile(file)
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (status !== 'pending') return
      const items = e.clipboardData?.items
      if (!items) return
      
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            processScreenshotFile(file)
          }
          break
        }
      }
    }
    
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [state.accounts, status])

  // Load transaction once on mount or when ID changes
  useEffect(() => {
    isInitializedRef.current = false
  }, [id])

  useEffect(() => {
    if (isInitializedRef.current) return

    const tx = state.transactions.find(t => t.id === id)
    if (tx) {
      setName(tx.title)
      setAmount(tx.amount.toString())
      setCategory(tx.category)
      setPaidWith(tx.accountId || state.accounts[0]?.id || '')
      setNote(tx.note || '')
      setDate(tx.date)
      setStatus(tx.status || 'auto_finalized')
      setConfidence(tx.confidence || 0.9)
      setReviewReasons(tx.reviewReasons || [])
      setParsedTimestamp(tx.parsedTimestamp || null)
      if (tx.parsedTimestamp) {
        const d = new Date(tx.parsedTimestamp)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setTime(`${hh}:${mm}`)
      } else {
        setTime('')
      }
      setReferenceNumber(tx.referenceNumber || undefined)
      
      let localType: TransactionType = 'expense'
      if (tx.type === 'extra_allowance') localType = 'extra'
      if (tx.type === 'savings_deposit') localType = 'save'
      setType(localType)
      
      if (tx.fundingSource) setFundedBy(tx.fundingSource)

      if (tx.splits && tx.splits.length > 0) {
        setSplitChecked(true)
        // If it's a negative amount split, it means a friend paid and we owe them
        const isNegative = tx.splits.some(s => s.amount < 0)
        if (isNegative) {
          setWhoPaid('friend')
          const firstNeg = tx.splits.find(s => s.amount < 0)
          setSplitFriendId(firstNeg?.friendId || '')
          setSplitAmount(Math.abs(firstNeg?.amount || 0).toString())
          setFriendShares({})
        } else {
          setWhoPaid('me')
          const shares: Record<string, string> = {}
          tx.splits.forEach(s => {
            shares[s.friendId] = s.amount.toString()
          })
          setFriendShares(shares)
          setSplitFriendId('')
          setSplitAmount('')
        }
      } else if (tx.splitWithFriendId) {
        // Fallback for legacy single-friend splits
        setSplitChecked(true)
        const owed = tx.friendOwedAmount || 0
        if (owed < 0) {
          setWhoPaid('friend')
          setSplitFriendId(tx.splitWithFriendId)
          setSplitAmount(Math.abs(owed).toString())
          setFriendShares({})
        } else {
          setWhoPaid('me')
          const shares: Record<string, string> = {}
          shares[tx.splitWithFriendId] = owed.toString()
          setFriendShares(shares)
          setSplitFriendId('')
          setSplitAmount('')
        }
      } else {
        setSplitChecked(false)
        setSplitFriendId('')
        setWhoPaid('me')
        setSplitAmount('')
        setFriendShares({})
      }

      isInitializedRef.current = true
    }
  }, [id, state.transactions])

  // Keep splits in sync with amount changes (such as OCR updates or manual edits)
  useEffect(() => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return

    if (splitChecked) {
      if (whoPaid === 'friend') {
        setSplitAmount((parsed / 2).toFixed(2))
      } else if (whoPaid === 'me') {
        const activeFriendIds = Object.keys(friendShares)
        if (activeFriendIds.length > 0) {
          const share = (parsed / (activeFriendIds.length + 1)).toFixed(2)
          // Only update if the share actually changed to prevent infinite loops
          const firstFriendId = activeFriendIds[0]
          if (friendShares[firstFriendId] !== share) {
            const updated: Record<string, string> = {}
            activeFriendIds.forEach(id => {
              updated[id] = share
            })
            setFriendShares(updated)
          }
        }
      }
    }
  }, [amount, splitChecked, whoPaid, Object.keys(friendShares).join(',')])


  const handleSubmit = () => {
    if (!name || !amount) return

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    // Auto-review logic
    let status: ReviewStatus = 'auto_finalized'
    let confidence = 0.9
    const reviewReasons: string[] = []

    const autoApproveCategories = ['food', 'groceries', 'transport', 'subscriptions']
    
    if (type === 'expense') {
      if (parsedAmount > 5000) {
        status = 'pending'
        confidence = 0.5
        reviewReasons.push('Unusually large amount')
      } else if (!category) {
        status = 'pending'
        confidence = 0.3
        reviewReasons.push('Missing category')
      } else if (!autoApproveCategories.includes(category) && parsedAmount > 1500) {
        status = 'pending'
        confidence = 0.7
        reviewReasons.push('Ambiguous category / large amount')
      }
    }

    let globalType: import('@/lib/types').TransactionType = 'expense'
    if (type === 'extra') globalType = 'extra_allowance'
    if (type === 'save') globalType = 'savings_deposit'

    let splitWithFriendId: string | undefined = undefined
    let friendOwedAmount: number | undefined = undefined
    let splits: import('@/lib/types').TransactionSplit[] | undefined = undefined
    let finalAccountId = type === 'expense' ? paidWith : state.accounts[0]?.id

    if (type === 'expense' && splitChecked) {
      if (whoPaid === 'me') {
        const activeSplits = Object.entries(friendShares)
          .map(([friendId, share]) => ({
            friendId,
            amount: parseFloat(share) || 0
          }))
          .filter(s => s.amount > 0)
        
        if (activeSplits.length > 0) {
          splits = activeSplits
          // Legacy properties fallback to first friend in the splits list
          splitWithFriendId = activeSplits[0].friendId
          friendOwedAmount = activeSplits[0].amount
        }
      } else if (whoPaid === 'friend' && splitFriendId) {
        const owed = parseFloat(splitAmount) || 0
        splits = [{ friendId: splitFriendId, amount: -owed }]
        splitWithFriendId = splitFriendId
        friendOwedAmount = -owed
        finalAccountId = 'friend-paid' // Virtual Account ID so it does not deduct from real cards
      }
    }

    let finalTimestamp = parsedTimestamp || undefined
    if (time) {
      const dt = new Date(`${date}T${time}:00`)
      if (!isNaN(dt.getTime())) {
        finalTimestamp = dt.getTime()
      }
    }

    updateTransaction(id, {
      title: name,
      amount: parsedAmount,
      type: globalType,
      category: category || 'other',
      fundingSource: globalType === 'expense' ? (fundedBy as any) : undefined,
      accountId: finalAccountId,
      date,
      status,
      confidence,
      reviewReasons,
      note,
      splitWithFriendId,
      friendOwedAmount,
      splits,
      parsedTimestamp: finalTimestamp,
      referenceNumber,
    })

    router.push('/')
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id)
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-pt">
        <div className="flex items-center gap-3 px-4 h-14 lg:h-16">
          <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-muted rounded-xl transition-all-smooth tap-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg lg:text-xl font-semibold flex-1">Edit Entry</h1>
          <button onClick={handleDelete} className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-all-smooth tap-target">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 lg:py-6 pb-24 lg:pb-8 overflow-x-hidden">
        {/* Needs Context / OCR Upload Section */}
        {status === 'pending' && (
          <section className="mb-6 bg-card border border-border dark:card-glow rounded-2xl p-4 lg:p-5 relative">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-primary" /> Provide Context
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Missing merchant details? Attach or <span className="font-bold text-foreground">Paste (Ctrl+V)</span> a GPay or UPI screenshot to automatically extract transaction details.
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleScreenshotUpload} 
            />
            
            {!previewImage && !ocrLoading ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border border-dashed border-border rounded-xl text-xs font-medium text-foreground hover:bg-muted/50 transition-all-smooth flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" /> Upload UPI Screenshot
              </button>
            ) : null}

            {ocrLoading && (
              <div className="flex flex-col items-center justify-center py-6 bg-muted/20 rounded-xl border border-dashed border-border">
                <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Extracting details with OCR...</p>
              </div>
            )}

            {previewImage && !ocrLoading && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-border bg-muted flex justify-center max-h-40">
                  <img src={previewImage} alt="Screenshot Preview" className="object-contain h-full max-h-40" />
                </div>
                
                {ocrResult && (
                  <div className={cn(
                    "border rounded-xl p-3",
                    ocrResult.confidence > 0.3 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"
                  )}>
                    <p className={cn(
                      "text-[10px] font-bold uppercase mb-2 flex items-center gap-1.5",
                      ocrResult.confidence > 0.3 ? "text-primary" : "text-destructive"
                    )}>
                      <Sparkles className="w-3 h-3" /> 
                      {ocrResult.confidence > 0.3 ? 'Extracted from Image' : 'Low Confidence - Image Might Be Blurry'}
                    </p>
                    <ul className="text-xs space-y-1.5 text-foreground/80">
                      <li><strong>Merchant:</strong> {ocrResult.merchant || <span className="text-muted-foreground">Not found</span>}</li>
                      <li><strong>Amount:</strong> {ocrResult.amount ? `₹${ocrResult.amount}` : <span className="text-muted-foreground">Not found</span>}</li>
                      <li><strong>Date:</strong> {ocrResult.date || <span className="text-muted-foreground">Not found</span>}</li>
                      {ocrResult.referenceNumber && (
                        <li><strong>UPI Ref ID:</strong> {ocrResult.referenceNumber}</li>
                      )}
                    </ul>
                    {ssRefMatched === true && (
                      <div className="mt-3 p-2.5 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl text-[10px] font-medium flex items-center gap-1.5">
                        <span>✅</span> Connected to SMS via Reference No: <span className="font-mono">{ocrResult.referenceNumber}</span>
                      </div>
                    )}
                    {ssRefMatched === false && (
                      <div className="mt-3 p-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-xl text-[10px] font-medium flex items-center gap-1.5">
                        <span>⚠️</span> Mismatched Ref ID: SS has <span className="font-mono">{ocrResult.referenceNumber}</span> but SMS has <span className="font-mono">{referenceNumber}</span>
                      </div>
                    )}
                    {ocrResult.confidence <= 0.3 && (
                      <p className="text-[10px] mt-2 text-destructive">Please clear the image and try re-uploading a clearer screenshot.</p>
                    )}
                    <button 
                      onClick={() => {
                        setPreviewImage(null)
                        setOcrResult(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="mt-3 text-[10px] font-medium text-destructive hover:underline"
                    >
                      Clear Image
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Transaction Type - horizontal scroll on mobile */}
        <section className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-3 block">
            Type
          </label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
            {transactionTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as TransactionType)}
                className={cn(
                  'flex items-center gap-2 px-3 lg:px-4 py-2.5 rounded-xl text-sm font-medium transition-all-smooth border shrink-0 tap-target',
                  type === t.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:border-primary/50 text-foreground active:scale-95'
                )}
              >
                <span>{t.icon}</span>
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Transaction Name */}
        <section className="mb-5">
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
            Transaction name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Swiggy, Amazon, Uber..."
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth"
          />
        </section>

        {/* Amount, Date & Time */}
        <section className="mb-5 grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-6 pr-2 py-2.5 bg-card border border-border rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth tabular-nums text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-1.5 py-2.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth appearance-none text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-2 py-2.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth text-foreground"
            />
          </div>
        </section>

        {isClosed && (
          <div className="mb-5 p-3.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-xl text-xs font-semibold leading-relaxed flex items-center gap-2">
            <span>⚠️</span>
            <span>This date falls in a closed financial period. Reopen the month in history before editing.</span>
          </div>
        )}

        {/* Category */}
        {type === 'expense' && (
          <section className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all-smooth border tap-target',
                    category === cat.id
                      ? 'bg-primary/10 border-primary text-foreground'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground active:scale-95'
                  )}
                >
                  <span className="text-lg lg:text-xl">{cat.icon}</span>
                  <span className="text-[9px] lg:text-[10px] font-medium text-center leading-tight line-clamp-1">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Funded By */}
        {type === 'expense' && (
          <section className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Funded by
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
              {fundingSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setFundedBy(source.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all-smooth border shrink-0 tap-target',
                    fundedBy === source.id
                      ? 'bg-primary/10 border-primary text-foreground'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground active:scale-95'
                  )}
                >
                  <span>{source.icon}</span>
                  <span className="whitespace-nowrap">{source.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Paid With */}
        {type === 'expense' && (
          <section className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
              Paid with
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
              {state.accounts.map((card) => (
                <button
                  key={card.id}
                  onClick={() => {
                    setPaidWith(card.id)
                    const isSbiCredit = card.name.toLowerCase().includes('sbi') && card.type === 'credit'
                    if (card.isExtra || isSbiCredit) {
                      setFundedBy('extra')
                    } else {
                      setFundedBy('base')
                    }
                  }}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium transition-all-smooth border shrink-0 tap-target',
                    paidWith === card.id
                      ? 'bg-primary/10 border-primary text-foreground'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground active:scale-95'
                  )}
                >
                  <span className="whitespace-nowrap">{card.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Split with Friends */}
        {type === 'expense' && state.friends && state.friends.length > 0 && (
          <section className="mb-5 p-4 bg-muted/40 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  Split with Friends
                </label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Share this bill and track peer balances</p>
              </div>
              <input
                type="checkbox"
                checked={splitChecked}
                onChange={(e) => setSplitChecked(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border bg-card transition-all-smooth"
              />
            </div>

            {splitChecked && (
              <div className="space-y-4 pt-4 border-t border-border mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1.5">Who Paid?</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWhoPaid('me')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-medium border transition-all-smooth tap-target",
                        whoPaid === 'me'
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-card border-border hover:bg-muted text-muted-foreground"
                      )}
                    >
                      I Paid (They owe me)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhoPaid('friend')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-medium border transition-all-smooth tap-target",
                        whoPaid === 'friend'
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-card border-border hover:bg-muted text-muted-foreground"
                      )}
                    >
                      Friend Paid (I owe them)
                    </button>
                  </div>
                </div>

                {whoPaid === 'me' ? (
                  // I Paid: Checklist of friends with custom amount inputs
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Select Friends & Enter Shares</label>
                      <button
                        type="button"
                        onClick={splitEqually}
                        className="text-[10px] font-semibold text-primary hover:underline tap-target"
                      >
                        Split Equally
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {state.friends.map(friend => {
                        const isChecked = friendShares[friend.id] !== undefined
                        return (
                          <div key={friend.id} className="flex items-center gap-3 p-2 bg-card border border-border rounded-xl">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFriendSelection(friend.id)}
                              className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border bg-muted transition-all-smooth"
                            />
                            <span className="text-xs font-medium flex-1 text-foreground">{friend.name}</span>
                            {isChecked && (
                              <div className="relative w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  value={friendShares[friend.id] || ''}
                                  onChange={(e) => handleFriendShareChange(friend.id, e.target.value)}
                                  className="w-full pl-5 pr-2 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  // Friend Paid: Select paid friend and type your share
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Select Friend</label>
                      <select
                        value={splitFriendId}
                        onChange={(e) => setSplitFriendId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Choose friend...</option>
                        {state.friends.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">My Share (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={splitAmount}
                        onChange={(e) => setSplitAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Note */}
        <section className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2.5 block">
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note..."
            rows={2}
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all-smooth resize-none"
          />
        </section>

        {/* Submit Button - Fixed on mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border lg:relative lg:p-0 lg:bg-transparent lg:border-0 safe-area-pb">
          <button 
            onClick={handleSubmit}
            disabled={!name || !amount || isClosed}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all-smooth focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
