'use client'

// =============================================
// Life OS — SMS Parser Trainer
// Interactive visual tool for analyzing, debugging,
// and correcting SMS parser field extractions.
// =============================================

import { useState, useRef } from 'react'
import { Brain, Eye, MousePointerClick, Zap, Check, Undo2, ChevronDown, ChevronUp } from 'lucide-react'
import { parseSms, type ParsedSmsResult } from '@/lib/sms-parser'
import { annotateSms, FIELD_COLORS, FIELD_META, type SmsAnnotation } from '@/lib/sms-annotations'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/calculations'

// ── Sample SMS templates covering diverse bank formats ──
const TRAINER_SAMPLES = [
  {
    bank: 'Union Bank',
    label: 'UBI Debit (UPI)',
    text: 'A/c *6732 Debited for Rs:174.00 on 16-05-2026 13:35:52 by Mob Bk ref no 283772101366 Avl Bal Rs:0.03.If not you, Call 1800222243 -Union Bank of India',
  },
  {
    bank: 'Union Bank',
    label: 'UBI Credit (Transfer)',
    text: 'Your SB A/c *6732 Credited for Rs:6233.00 on 20-05-2026 17:59:23 by Transfer Avl Bal Rs:17211.03 -Union Bank of India',
  },
  {
    bank: 'SBI',
    label: 'SBI Card Purchase',
    text: 'Spent Rs. 1,250.00 on SBI Credit Card XX9812 at Amazon India on 19-May-26. Avail Lmt Rs. 45,000.00',
  },
  {
    bank: 'HDFC',
    label: 'HDFC UPI Debit',
    text: 'HDFC Bank: Rs 500.00 debited from a/c **1234 on 20-05-26 to VPA swiggy@axisbank (UPI Ref No 412345678012). Avl Bal: Rs 12,500.00.',
  },
  {
    bank: 'ICICI',
    label: 'ICICI Credit Card',
    text: 'ICICI Bank Credit Card XX5678 has been used for Rs 890.00 at Zomato on 20-May-2026 13:45:00. Avl Lmt: Rs 72,000.00',
  },
]

// All fields the inspector tracks
const ALL_FIELDS = ['direction', 'amount', 'account', 'merchant', 'date', 'balance', 'reference'] as const

export function SmsTrainer() {
  const { state } = useApp()

  // ── Core state ──
  const [smsText, setSmsText] = useState('')
  const [parsed, setParsed] = useState<ParsedSmsResult | null>(null)
  const [annotations, setAnnotations] = useState<SmsAnnotation[]>([])

  // ── Interactive state ──
  const [activeField, setActiveField] = useState<string | null>(null)        // field being fixed
  const [hoveredField, setHoveredField] = useState<string | null>(null)      // field hovered in inspector
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set())
  const [showSamples, setShowSamples] = useState(true)
  const textRef = useRef<HTMLDivElement>(null)

  // ── Handlers ──

  const handleAnalyze = () => {
    if (!smsText.trim()) return
    const result = parseSms(smsText, state.accounts, state.merchantMemory || {})
    setParsed(result)
    const anns = annotateSms(smsText, result)
    setAnnotations(anns)
    setActiveField(null)
    setConfirmedFields(new Set())
  }

  const handleConfirmField = (field: string) => {
    setConfirmedFields(prev => new Set([...prev, field]))
  }

  const handleFixField = (field: string) => {
    setActiveField(prev => prev === field ? null : field)
  }

  const handleTextSelection = () => {
    if (!activeField || !textRef.current) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    // Find position in the original SMS text
    const start = smsText.indexOf(selectedText)
    if (start === -1) return

    // Replace existing annotation for this field
    const newAnnotations = annotations.filter(a => a.field !== activeField)
    newAnnotations.push({
      start,
      end: start + selectedText.length,
      field: activeField as SmsAnnotation['field'],
      label: FIELD_META[activeField]?.label || activeField,
      value: selectedText,
    })
    newAnnotations.sort((a, b) => a.start - b.start)
    setAnnotations(newAnnotations)

    // Mark as confirmed
    setConfirmedFields(prev => new Set([...prev, activeField!]))
    setActiveField(null)

    // Clear browser selection
    selection.removeAllRanges()
  }

  const handleConfirmAll = () => {
    setConfirmedFields(new Set(ALL_FIELDS))
  }

  const handleReset = () => {
    if (!smsText.trim()) return
    handleAnalyze() // re-analyze from scratch
  }

  // ── Render the annotated SMS text ──
  const renderAnnotatedText = () => {
    if (!smsText) return null

    const sorted = [...annotations].sort((a, b) => a.start - b.start)
    const parts: React.ReactNode[] = []
    let lastIdx = 0

    sorted.forEach((ann, i) => {
      // Plain text before this annotation
      if (ann.start > lastIdx) {
        parts.push(
          <span key={`p-${i}`} className="text-foreground/60">{smsText.substring(lastIdx, ann.start)}</span>
        )
      }

      const colors = FIELD_COLORS[ann.field]
      const isHovered = hoveredField === ann.field
      const isActive = activeField === ann.field

      parts.push(
        <span
          key={`a-${i}`}
          className={cn(
            'px-0.5 rounded-[3px] transition-all duration-200 cursor-help relative font-semibold',
            colors?.bg,
            colors?.text,
            isHovered && 'ring-2 ring-current/40 ring-offset-1 ring-offset-background scale-[1.03]',
            isActive && 'ring-2 ring-primary/60 animate-pulse',
          )}
          title={`${ann.label}: ${ann.value}`}
          onMouseEnter={() => setHoveredField(ann.field)}
          onMouseLeave={() => setHoveredField(null)}
        >
          {smsText.substring(ann.start, ann.end)}
        </span>
      )
      lastIdx = ann.end
    })

    // Remaining text
    if (lastIdx < smsText.length) {
      parts.push(
        <span key="tail" className="text-foreground/60">{smsText.substring(lastIdx)}</span>
      )
    }

    return parts
  }

  // ── Build the field inspector data ──
  const getFieldData = () => {
    if (!parsed) return []
    return [
      { field: 'direction', value: parsed.direction, display: parsed.direction === 'credit' ? '📥 Credit (Incoming)' : '📤 Debit (Outgoing)', detected: true },
      { field: 'amount', value: parsed.amount, display: parsed.amount !== null ? formatCurrency(parsed.amount) : 'Not detected', detected: parsed.amount !== null },
      { field: 'account', value: parsed.detectedIdentifier, display: parsed.detectedIdentifier ? `*${parsed.detectedIdentifier}` : 'Not detected', detected: !!parsed.detectedIdentifier },
      { field: 'merchant', value: parsed.merchant, display: parsed.merchant && parsed.merchant !== 'Credit / Deposit' ? parsed.merchant : (parsed.direction === 'credit' ? 'Credit / Deposit' : 'Not detected'), detected: !!parsed.merchant },
      { field: 'date', value: parsed.date, display: parsed.date || 'Not detected', detected: !!parsed.date },
      { field: 'balance', value: parsed.availableBalance, display: parsed.availableBalance !== null ? formatCurrency(parsed.availableBalance) : 'Not detected', detected: parsed.availableBalance !== null },
      { field: 'reference', value: parsed.referenceNumber, display: parsed.referenceNumber || 'Not detected', detected: !!parsed.referenceNumber },
    ]
  }

  // ── Confidence calculation ──
  const confirmedCount = confirmedFields.size
  const totalFields = ALL_FIELDS.length
  const baseConfidence = parsed ? parsed.confidence * 100 : 0
  const userBoost = (confirmedCount / totalFields) * 40
  const confidencePercent = Math.min(100, Math.round(baseConfidence * 0.6 + userBoost))
  const allConfirmed = confirmedCount === totalFields

  return (
    <div className="space-y-5">
      {/* ── Header Card ── */}
      <div className="bg-card rounded-2xl p-4 lg:p-5 border border-border dark:card-glow">
        <h2 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5 text-foreground">
          <Brain className="w-4 h-4 text-violet-500" /> Parser Trainer
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Paste any bank SMS below to visualize exactly what the parser detects. Confirm correct fields with <strong>✓ Correct</strong>, 
          or fix wrong ones by clicking <strong>✏️ Fix</strong> and highlighting the right text.
        </p>
      </div>

      {/* ── Sample Templates ── */}
      <div className="space-y-2">
        <button
          onClick={() => setShowSamples(!showSamples)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 hover:text-foreground transition-colors"
        >
          Test with Sample SMS
          {showSamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showSamples && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TRAINER_SAMPLES.map((tmpl, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSmsText(tmpl.text)
                  setParsed(null)
                  setAnnotations([])
                  setConfirmedFields(new Set())
                  setActiveField(null)
                }}
                className="p-3 text-left bg-muted/30 border border-border/60 hover:bg-muted/60 hover:border-border rounded-xl transition-all-smooth text-xs group"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded text-[8px] font-bold border border-violet-500/20">
                    {tmpl.bank}
                  </span>
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{tmpl.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{tmpl.text}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="bg-card rounded-2xl p-4 border border-border dark:card-glow space-y-3">
        <textarea
          value={smsText}
          onChange={(e) => {
            setSmsText(e.target.value)
            setParsed(null)
            setAnnotations([])
            setConfirmedFields(new Set())
            setActiveField(null)
          }}
          placeholder="Paste a bank transaction SMS here to analyze..."
          rows={3}
          className="w-full bg-muted/30 border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-foreground resize-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={handleAnalyze}
          disabled={!smsText.trim()}
          className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-xs transition-all-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Analyze &amp; Annotate
        </button>
      </div>

      {/* ── Results (only after analysis) ── */}
      {parsed && (
        <>
          {/* ── Annotated SMS Display ── */}
          <div className="bg-card rounded-2xl p-4 lg:p-5 border border-border dark:card-glow space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                Annotated SMS
              </h3>
              {activeField && (
                <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                  <MousePointerClick className="w-3 h-3" />
                  Highlight the correct &ldquo;{FIELD_META[activeField]?.label}&rdquo; text below
                </span>
              )}
            </div>

            {/* The annotated text block */}
            <div
              ref={textRef}
              onMouseUp={handleTextSelection}
              className={cn(
                'p-4 bg-background/80 backdrop-blur-sm border border-border/60 rounded-xl text-[13px] leading-[1.9] tracking-wide font-mono select-text break-words whitespace-pre-wrap',
                activeField && 'cursor-crosshair ring-2 ring-violet-500/40 bg-violet-500/[0.03]'
              )}
            >
              {renderAnnotatedText()}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(FIELD_COLORS).map(([field, colors]) => {
                const hasAnnotation = annotations.some(a => a.field === field)
                if (!hasAnnotation) return null
                return (
                  <span
                    key={field}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-200 cursor-default',
                      colors.bg, colors.text, colors.border,
                      hoveredField === field && 'scale-110 shadow-sm',
                    )}
                    onMouseEnter={() => setHoveredField(field)}
                    onMouseLeave={() => setHoveredField(null)}
                  >
                    {FIELD_META[field]?.icon} {FIELD_META[field]?.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* ── Field Inspector ── */}
          <div className="bg-card rounded-2xl p-4 lg:p-5 border border-border dark:card-glow space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Detected Fields
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({confirmedCount}/{totalFields} confirmed)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      allConfirmed
                        ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                        : 'bg-gradient-to-r from-violet-500 to-primary'
                    )}
                    style={{ width: `${Math.max(4, (confirmedCount / totalFields) * 100)}%` }}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-bold tabular-nums',
                  allConfirmed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}>
                  {Math.round((confirmedCount / totalFields) * 100)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getFieldData().map(({ field, value, display, detected }) => {
                const colors = FIELD_COLORS[field]
                const isConfirmed = confirmedFields.has(field)
                const isFixing = activeField === field

                return (
                  <div
                    key={field}
                    className={cn(
                      'p-3 rounded-xl border transition-all duration-200',
                      isConfirmed
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : isFixing
                        ? 'bg-violet-500/5 border-violet-500/40 ring-1 ring-violet-500/20'
                        : hoveredField === field
                        ? 'bg-muted/60 border-border/80 shadow-sm'
                        : 'bg-muted/20 border-border/50',
                    )}
                    onMouseEnter={() => setHoveredField(field)}
                    onMouseLeave={() => setHoveredField(null)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'text-[10px] font-bold uppercase flex items-center gap-1 transition-colors',
                        isConfirmed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      )}>
                        {FIELD_META[field]?.icon} {FIELD_META[field]?.label}
                      </span>

                      <div className="flex items-center gap-1">
                        {isConfirmed ? (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                            <Check className="w-2.5 h-2.5" /> Confirmed
                          </span>
                        ) : (
                          <>
                            {detected && !isFixing && (
                              <button
                                onClick={() => handleConfirmField(field)}
                                className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-1.5 py-0.5 rounded-md transition-colors"
                              >
                                ✓ Correct
                              </button>
                            )}
                            <button
                              onClick={() => handleFixField(field)}
                              className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors',
                                isFixing
                                  ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10'
                                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                              )}
                            >
                              {isFixing ? '✕ Cancel' : '✏️ Fix'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className={cn(
                      'text-xs font-semibold truncate',
                      detected ? 'text-foreground' : 'text-muted-foreground italic'
                    )}>
                      {display}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-2">
            {confirmedCount > 0 && !allConfirmed && (
              <button
                onClick={handleConfirmAll}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all-smooth flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Confirm All Fields
              </button>
            )}
            {confirmedCount > 0 && (
              <button
                onClick={handleReset}
                className="py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs transition-all-smooth flex items-center justify-center gap-1.5 border border-border"
              >
                <Undo2 className="w-3.5 h-3.5" /> Re-Analyze
              </button>
            )}
          </div>

          {/* ── Success State ── */}
          {allConfirmed && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                🎉
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">Parser is Accurate!</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  All {totalFields} fields were confirmed as correctly extracted. The parser handles this SMS template perfectly. 
                  Future alerts from this bank will be parsed with high confidence.
                </p>
              </div>
            </div>
          )}

          {/* ── Technical Details (collapsed) ── */}
          <details className="bg-muted/20 border border-border/50 rounded-xl overflow-hidden group">
            <summary className="px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/40 transition-colors flex items-center gap-1.5 select-none">
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
              Raw Parse Output
            </summary>
            <div className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                <div className="text-muted-foreground">Confidence Score</div>
                <div className="font-bold text-foreground tabular-nums">{Math.round(parsed.confidence * 100)}%</div>
                <div className="text-muted-foreground">Direction</div>
                <div className="font-bold text-foreground">{parsed.direction}</div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-bold text-foreground tabular-nums">{parsed.amount !== null ? `₹${parsed.amount}` : '—'}</div>
                <div className="text-muted-foreground">Account Matched</div>
                <div className="font-bold text-foreground">{parsed.accountId || '—'}</div>
                <div className="text-muted-foreground">Detected Identifier</div>
                <div className="font-bold text-foreground">{parsed.detectedIdentifier || '—'}</div>
                <div className="text-muted-foreground">Merchant</div>
                <div className="font-bold text-foreground">{parsed.merchant || '—'}</div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-bold text-foreground">{parsed.date}</div>
                <div className="text-muted-foreground">Available Balance</div>
                <div className="font-bold text-foreground tabular-nums">{parsed.availableBalance !== null ? `₹${parsed.availableBalance}` : '—'}</div>
                <div className="text-muted-foreground">Is UPI</div>
                <div className="font-bold text-foreground">{parsed.isUPI ? 'Yes' : 'No'}</div>
                <div className="text-muted-foreground">Reference</div>
                <div className="font-bold text-foreground">{parsed.referenceNumber || '—'}</div>
                <div className="text-muted-foreground">Suggested Category</div>
                <div className="font-bold text-foreground">{parsed.suggestedCategory || '—'}</div>
                <div className="text-muted-foreground">Suggested Funding</div>
                <div className="font-bold text-foreground">{parsed.suggestedFundingSource || '—'}</div>
                <div className="text-muted-foreground">Annotations Found</div>
                <div className="font-bold text-foreground tabular-nums">{annotations.length}</div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
