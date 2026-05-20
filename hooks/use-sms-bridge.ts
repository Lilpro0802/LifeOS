'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useApp } from '../lib/app-context'
import { parseSms } from '../lib/sms-parser'
import type { Transaction, TransactionType, ReviewStatus } from '../lib/types'

// Declarations for native bridge interface
interface NativeSms {
  id: string
  sender: string
  body: string
  timestamp: number
}

interface AndroidSMSBridgeType {
  getPendingSms: () => string
  clearPendingSms: (idsJson: string) => void
  showToast: (msg: string) => void
}

declare global {
  interface Window {
    AndroidSMSBridge?: AndroidSMSBridgeType
    onAndroidSMSReceived?: () => void
  }
}

export function useSmsBridge() {
  const { state, addTransaction } = useApp()
  
  // Keep latest state in ref to avoid recreating the effect or losing closures
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const processPendingSms = useCallback(() => {
    if (typeof window === 'undefined' || !window.AndroidSMSBridge) {
      return
    }

    try {
      const pendingSmsJson = window.AndroidSMSBridge.getPendingSms()
      if (!pendingSmsJson) return

      const smsList: NativeSms[] = JSON.parse(pendingSmsJson)
      if (!smsList || smsList.length === 0) return

      const processedIds: string[] = []
      let ingestedCount = 0

      smsList.forEach(sms => {
        // 1. Check for duplicates in existing state transactions
        // We check by referenceNumber (if present in SMS) or rawSms match
        const parsed = parseSms(sms.body, stateRef.current.accounts || [], stateRef.current.merchantMemory || {})
        
        const isDuplicate = stateRef.current.transactions.some(tx => {
          if (parsed.referenceNumber && tx.referenceNumber === parsed.referenceNumber) {
            return true
          }
          // Fallback check on rawSms matches if ref is not found
          return tx.rawSms === sms.body
        })

        if (!isDuplicate) {
          // Determine transaction type
          const isCredit = parsed.direction === 'credit'
          const txType: TransactionType = isCredit ? 'allowance' : 'expense'
          
          // Build transaction payload
          const txPayload = {
            title: parsed.merchant || (isCredit ? 'Credit / Deposit' : 'Expense Alert'),
            amount: parsed.amount || 0,
            type: txType,
            category: parsed.suggestedCategory || 'other',
            fundingSource: parsed.suggestedFundingSource || 'base',
            accountId: parsed.accountId || (stateRef.current.accounts && stateRef.current.accounts[0]?.id) || '',
            date: parsed.date,
            status: 'pending_review' as ReviewStatus,
            confidence: parsed.confidence,
            reviewReasons: parsed.amount === null ? ['uncategorized_amount'] : [],
            note: `Ingested automatically via Android SMS Bridge from ${sms.sender}.`,
            tags: parsed.isUPI ? ['sms', 'upi'] : ['sms'],
            rawSms: sms.body,
            availableBalance: parsed.availableBalance,
            parsedTimestamp: parsed.parsedTimestamp || sms.timestamp,
            referenceNumber: parsed.referenceNumber,
          }

          addTransaction(txPayload)
          ingestedCount++
        }

        // Add to processed queue anyway so we don't fetch it again
        processedIds.push(sms.id)
      })

      // Flush queue native-side
      if (processedIds.length > 0) {
        window.AndroidSMSBridge.clearPendingSms(JSON.stringify(processedIds))
        if (ingestedCount > 0) {
          window.AndroidSMSBridge.showToast(`Ingested ${ingestedCount} financial SMS alerts.`)
        }
      }
    } catch (error) {
      console.error('Error processing pending SMS from native bridge:', error)
    }
  }, [addTransaction])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Initial process of pending SMS alerts
    setTimeout(() => {
      processPendingSms()
    }, 1500) // Small delay to let app hydrate successfully

    // 2. Bind global callback for live foreground reception
    window.onAndroidSMSReceived = () => {
      console.log('Native SMS signal received in foreground')
      processPendingSms()
    }

    // 3. Re-check whenever the app comes back to foreground (focus/resume)
    const handleFocus = () => {
      processPendingSms()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      if (window.onAndroidSMSReceived === processPendingSms) {
        window.onAndroidSMSReceived = undefined
      }
    }
  }, [processPendingSms])

  return { triggerFetch: processPendingSms }
}
