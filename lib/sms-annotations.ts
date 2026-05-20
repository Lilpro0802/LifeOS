// =============================================
// Life OS — SMS Annotation Engine
// Maps parsed SMS fields to character positions
// for interactive visual highlighting in the Trainer.
// =============================================

import type { ParsedSmsResult } from './sms-parser'

export interface SmsAnnotation {
  start: number
  end: number
  field: 'amount' | 'account' | 'merchant' | 'balance' | 'date' | 'direction' | 'reference' | 'time'
  label: string
  value: string
}

export const FIELD_COLORS: Record<string, { text: string; bg: string; border: string; icon: string }> = {
  amount:    { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: '💰' },
  account:   { text: 'text-blue-700 dark:text-blue-400',      bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    icon: '💳' },
  merchant:  { text: 'text-violet-700 dark:text-violet-400',   bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  icon: '🏪' },
  balance:   { text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   icon: '🏦' },
  date:      { text: 'text-cyan-700 dark:text-cyan-400',       bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    icon: '📅' },
  direction: { text: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    icon: '↕️' },
  reference: { text: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-500/15',   border: 'border-slate-500/30',   icon: '🔖' },
  time:      { text: 'text-indigo-700 dark:text-indigo-400',   bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  icon: '🕐' },
}

export const FIELD_META: Record<string, { label: string; icon: string; description: string }> = {
  amount:    { label: 'Amount',    icon: '💰', description: 'Transaction amount' },
  account:   { label: 'Account',   icon: '💳', description: 'Card or account identifier' },
  merchant:  { label: 'Merchant',  icon: '🏪', description: 'Payee or merchant name' },
  balance:   { label: 'Balance',   icon: '🏦', description: 'Available balance after transaction' },
  date:      { label: 'Date',      icon: '📅', description: 'Transaction date' },
  time:      { label: 'Time',      icon: '🕐', description: 'Transaction time' },
  direction: { label: 'Direction', icon: '↕️', description: 'Debit or Credit' },
  reference: { label: 'Reference', icon: '🔖', description: 'Transaction reference number' },
}

/**
 * Annotates raw SMS text with character-level field positions.
 * Re-applies the same regex patterns used by parseSms() but captures
 * start/end indices for rendering color-coded highlights.
 */
export function annotateSms(text: string, parsed: ParsedSmsResult): SmsAnnotation[] {
  const annotations: SmsAnnotation[] = []
  const usedRanges: [number, number][] = []

  const overlaps = (s: number, e: number) =>
    usedRanges.some(([us, ue]) => s < ue && e > us)

  const add = (s: number, e: number, field: SmsAnnotation['field'], label: string, value: string): boolean => {
    if (s >= 0 && e > s && !overlaps(s, e)) {
      annotations.push({ start: s, end: e, field, label, value })
      usedRanges.push([s, e])
      return true
    }
    return false
  }

  let m: RegExpExecArray | null

  // ── 1. Balance: "Avl Bal Rs:XXXX.XX" (most distinctive — annotate first) ──
  const balRegex = /(?:avl\s*bal|available\s*balance|bal\s+is|avail\s*lmt)\s*(?::?\s*)?(?:rs\.?:?|inr:?)?\s*[\d,]+(?:\.\d{2})?/gi
  while ((m = balRegex.exec(text)) !== null) {
    add(m.index, m.index + m[0].length, 'balance', 'Available Balance',
      parsed.availableBalance !== null ? parsed.availableBalance.toString() : '')
  }

  // ── 2. Transaction Amount: first Rs:XXX that doesn't overlap with balance ──
  const amtRegex = /(?:rs\.?:?|inr:?|amt:?|rs\s*:)\s*[\d,]+(?:\.\d{2})?/gi
  while ((m = amtRegex.exec(text)) !== null) {
    if (!overlaps(m.index, m.index + m[0].length)) {
      add(m.index, m.index + m[0].length, 'amount', 'Transaction Amount',
        parsed.amount?.toString() || '')
      break // only the first non-balance amount
    }
  }

  // ── 3. Direction keywords ──
  const dirRegex = /\b(credited|received|refund|refunded|added|deposited|debit|debited|spent|paid|payment|withdrawn|charged)\b/gi
  while ((m = dirRegex.exec(text)) !== null) {
    add(m.index, m.index + m[0].length, 'direction', 'Direction', parsed.direction)
  }

  // ── 4. Account / Card identifier ──
  const acctPatterns = [
    /(?:card|a\/c|ac|acct|account)\s*(?:xx|XX|x|X|\*|-)?(\d{4})\b/gi,
    /(?:xx|XX|\*)\s*(\d{4})\b/g,
  ]
  let acctFound = false
  for (const regex of acctPatterns) {
    if (acctFound) break
    while ((m = regex.exec(text)) !== null) {
      if (add(m.index, m.index + m[0].length, 'account', 'Account', m[1])) {
        acctFound = true
        break
      }
    }
  }

  // ── 5. Date ──
  const datePatterns = [
    /\b\d{2}[-/]\d{2}[-/]\d{4}\b/g,
    /\b\d{2}[-/]\d{2}[-/]\d{2}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[-/\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s]\d{2,4}\b/gi,
  ]
  for (const regex of datePatterns) {
    while ((m = regex.exec(text)) !== null) {
      add(m.index, m.index + m[0].length, 'date', 'Date', parsed.date)
    }
  }

  // ── 6. Time ──
  const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi
  while ((m = timeRegex.exec(text)) !== null) {
    add(m.index, m.index + m[0].length, 'time', 'Time', m[0])
  }

  // ── 7. Reference number ──
  const refRegex = /(?:mob\s*bk\s*ref\s*no|ref\s*no|upi\s*ref\s*no|txn\s*id|ref\s*no\.?|reference)\s*([a-zA-Z0-9]{6,16})\b/gi
  while ((m = refRegex.exec(text)) !== null) {
    add(m.index, m.index + m[0].length, 'reference', 'Reference', m[1])
  }

  // ── 8. Merchant (via parser regexes or indexOf fallback) ──
  const merchantRegexes = [
    /\bat\s+([A-Za-z0-9\s&.\-_]+?)(?=\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/gi,
    /\bto\s+([A-Za-z0-9\s&.\-_]+?)(?=\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/gi,
    /\btowards\s+([A-Za-z0-9\s&.\-_]+?)(?=\s+on|\s+at|\s+by|\.|\s+Info|\s+avl|\s+ref|\s+upi)/gi,
  ]
  let merchantFound = false
  for (const regex of merchantRegexes) {
    if (merchantFound) break
    while ((m = regex.exec(text)) !== null) {
      if (add(m.index, m.index + m[0].length, 'merchant', 'Merchant', m[1]?.trim() || '')) {
        merchantFound = true
        break
      }
    }
  }
  // Fallback: if parser found a merchant but regex annotation missed it
  if (!merchantFound && parsed.merchant && parsed.merchant !== 'Credit / Deposit' && parsed.merchant !== 'Unknown Merchant') {
    const idx = text.toLowerCase().indexOf(parsed.merchant.toLowerCase())
    if (idx >= 0) {
      add(idx, idx + parsed.merchant.length, 'merchant', 'Merchant', parsed.merchant)
    }
  }

  // Sort by position for sequential rendering
  annotations.sort((a, b) => a.start - b.start)
  return annotations
}
