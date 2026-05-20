// =============================================
// Life OS — Confidence Engine (Deterministic)
// =============================================
// NO AI. Pure rule-based scoring.

import type { MerchantMemoryEntry, ReviewStatus, FundingSource } from './types'

// =============================================
// Confidence Scoring
// =============================================

/**
 * Computes a confidence score from 0-1 based on how many times
 * the user has confirmed this merchant→category mapping.
 *
 * 0 confirms → 0.50  (unknown)
 * 1 confirm  → 0.65
 * 2 confirms → 0.80
 * 3 confirms → 0.90  (auto-finalize eligible)
 * 4 confirms → 0.93
 * 5+ confirms→ 0.95  (cap)
 */
export function computeMerchantConfidence(confirmationCount: number): number {
  if (confirmationCount <= 0) return 0.5
  if (confirmationCount === 1) return 0.65
  if (confirmationCount === 2) return 0.80
  if (confirmationCount === 3) return 0.90
  if (confirmationCount === 4) return 0.93
  return 0.95 // 5+
}

// Auto-Finalization Logic is implemented below.

// =============================================
// Review Status Routing
// =============================================

interface ReviewRoutingParams {
  confidence: number
  isUPI: boolean
  merchantName: string        // the parsed/assigned merchant name
  amount: number
  threshold: number           // auto-finalize threshold from settings
  isKnownMerchant: boolean
  hasCategory: boolean
  direction: 'debit' | 'credit'
  averageAmount?: number
  confirmationCount?: number
  isSubscription?: boolean
}

/**
 * Determines if a transaction should skip the review queue entirely.
 * Requires ALL conditions:
 * 1. Amount ≤ threshold OR is a confirmed expected subscription amount
 * 2. Merchant confidence ≥ 0.85 (i.e., at least 3 confirmations)
 * 3. Merchant is known (exists in memory)
 * 4. Has a real category (not 'other')
 */
export function shouldAutoFinalize(params: {
  amount: number
  merchantConfidence: number
  threshold: number
  isKnownMerchant: boolean
  hasCategory: boolean
  isExpectedSubscription?: boolean
}): boolean {
  const { amount, merchantConfidence, threshold, isKnownMerchant, hasCategory, isExpectedSubscription } = params

  if (!isKnownMerchant) return false
  if (!hasCategory) return false
  
  if (isExpectedSubscription) return true

  if (amount > threshold) return false
  if (merchantConfidence < 0.85) return false

  return true
}

/**
 * Determines the initial ReviewStatus for a new transaction.
 *
 * Routes:
 * - auto_finalized: small amount + high confidence + known merchant
 * - needs_context:  UPI with no merchant name, or missing critical info
 * - pending_review: everything else (default review inbox)
 */
export function computeReviewStatus(params: ReviewRoutingParams): ReviewStatus {
  const {
    confidence,
    isUPI,
    merchantName,
    amount,
    threshold,
    isKnownMerchant,
    hasCategory,
    direction,
    averageAmount,
    confirmationCount,
    isSubscription,
  } = params

  // 1. Anomaly Spike Detection:
  // If we have seen this merchant 2+ times before and the current amount is
  // a spike of > 2.0x the historical average, force review.
  const isAnomalySpike =
    confirmationCount !== undefined &&
    confirmationCount >= 2 &&
    averageAmount !== undefined &&
    averageAmount > 0 &&
    amount > averageAmount * 2.0

  if (isAnomalySpike) {
    return 'pending_review'
  }

  // 2. Expected Subscription Check:
  // If the merchant is flagged as a subscription and the amount is within 2%
  // of the average historical amount, it is expected recurring behavior.
  const isExpectedSubscription =
    isSubscription &&
    averageAmount !== undefined &&
    Math.abs(amount - averageAmount) / averageAmount < 0.02

  // Check auto-finalize first
  if (shouldAutoFinalize({
    amount,
    merchantConfidence: confidence,
    threshold,
    isKnownMerchant,
    hasCategory,
    isExpectedSubscription,
  })) {
    return 'auto_finalized'
  }

  // Credit transactions that aren't auto-finalized go to pending_review
  if (direction === 'credit') {
    return 'pending_review'
  }

  // UPI with no merchant name → needs more context (screenshot)
  const isMissingMerchant = !merchantName ||
    merchantName === 'Unknown Merchant' ||
    merchantName === 'Imported Transaction'

  if (isUPI && isMissingMerchant) {
    return 'needs_context'
  }

  // Everything else goes to the review queue
  return 'pending_review'
}

// =============================================
// Merchant Memory Helpers
// =============================================

/**
 * Creates or updates a merchant memory entry when a transaction is confirmed.
 * Increments confirmationCount and recalculates confidenceScore.
 */
export function updateMerchantMemoryEntry(
  existing: MerchantMemoryEntry | undefined,
  category: string,
  fundingSource?: FundingSource,
  amount?: number,
): MerchantMemoryEntry {
  const prevCount = existing?.confirmationCount ?? 0
  const newCount = prevCount + 1
  
  // Track amounts history
  let amountsSeen = existing?.amountsSeen ? [...existing.amountsSeen] : []
  if (amount !== undefined && amount > 0) {
    amountsSeen.push(amount)
    if (amountsSeen.length > 5) {
      amountsSeen.shift() // keep latest 5
    }
  }

  // Calculate running average
  const averageAmount = amountsSeen.length > 0 
    ? amountsSeen.reduce((sum, val) => sum + val, 0) / amountsSeen.length
    : undefined

  // Auto-detect subscriptions: if seen 3+ times and max variance is < 1%
  let isSubscription = existing?.isSubscription ?? false
  if (amountsSeen.length >= 3) {
    const minAmt = Math.min(...amountsSeen)
    const maxAmt = Math.max(...amountsSeen)
    const diffPercent = (maxAmt - minAmt) / minAmt
    if (diffPercent < 0.01) {
      isSubscription = true
    }
  }

  return {
    category,
    fundingSource,
    confirmationCount: newCount,
    confidenceScore: computeMerchantConfidence(newCount),
    lastUsedTimestamp: new Date().toISOString(),
    averageAmount,
    amountsSeen,
    isSubscription,
    lastSeenAmount: amount
  }
}

/**
 * Looks up a merchant in memory and returns its confidence (optionally decayed),
 * or 0.5 (unknown) if not found.
 */
export function getMerchantConfidenceFromMemory(
  merchantMemory: Record<string, MerchantMemoryEntry> | undefined,
  merchantName: string,
  nowStr: string = new Date().toISOString(),
): { entry: MerchantMemoryEntry | undefined; confidence: number; isKnown: boolean } {
  if (!merchantMemory || !merchantName) {
    return { entry: undefined, confidence: 0.5, isKnown: false }
  }
  const key = merchantName.trim().toLowerCase()
  const entry = merchantMemory[key]
  if (entry) {
    const confidence = getDecayedConfidence(entry, nowStr)
    return { entry, confidence, isKnown: true }
  }
  return { entry: undefined, confidence: 0.5, isKnown: false }
}

/**
 * Calculates confidence score with time-based decay.
 * Decays the score by 0.05 for every 30 days of inactivity, up to a maximum decay of 0.20.
 */
export function getDecayedConfidence(entry: MerchantMemoryEntry, nowStr: string): number {
  const lastUsed = new Date(entry.lastUsedTimestamp).getTime()
  const now = new Date(nowStr).getTime()
  const daysPassed = Math.max(0, (now - lastUsed) / (1000 * 60 * 60 * 24))
  
  const decayCycles = Math.floor(daysPassed / 30)
  const decayAmount = Math.min(0.20, decayCycles * 0.05)
  
  return Math.max(0.5, entry.confidenceScore - decayAmount)
}
