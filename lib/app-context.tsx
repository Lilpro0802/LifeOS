'use client'

// =============================================
// Life OS — App Context (State + Persistence)
// =============================================

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type {
  AppState,
  Transaction,
  Account,
  AppSettings,
  TransactionType,
  FundingSource,
  ReviewStatus,
  WishlistItem,
  Friend,
  FriendDebt,
  MerchantMemoryEntry,
  MonthlySnapshot,
} from './types'
import { DEFAULT_STATE, SCHEMA_VERSION, STORAGE_KEY } from './constants'
import {
  computeReviewStatus,
  getMerchantConfidenceFromMemory,
  updateMerchantMemoryEntry,
} from './confidence'

// =============================================
// Action Types
// =============================================

type AppAction =
  // Transactions
  | { type: 'ADD_TRANSACTION'; payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TRANSACTION'; payload: { id: string; updates: Partial<Transaction> } }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'APPROVE_TRANSACTION'; payload: string }
  // Accounts
  | { type: 'ADD_ACCOUNT'; payload: Omit<Account, 'id' | 'createdAt'> }
  | { type: 'UPDATE_ACCOUNT'; payload: { id: string; updates: Partial<Account> } }
  | { type: 'DELETE_ACCOUNT'; payload: string }
  // Settings
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  // Wishlist
  | { type: 'ADD_WISHLIST_ITEM'; payload: Omit<WishlistItem, 'id' | 'createdAt'> }
  | { type: 'DELETE_WISHLIST_ITEM'; payload: string }
  // Friends
  | { type: 'ADD_FRIEND'; payload: { name: string } }
  | { type: 'DELETE_FRIEND'; payload: string }
  | { type: 'ADD_DEBT'; payload: Omit<FriendDebt, 'id' | 'createdAt' | 'isSettled'> }
  | { type: 'SETTLE_DEBT'; payload: { friendId: string; amount: number; description: string; date: string } }
  | { type: 'DELETE_DEBT'; payload: string }
  // Data maintenance
  | { type: 'PRUNE_TRANSACTIONS' }
  | { type: 'CLEAR_TRANSACTIONS' }
  | { type: 'CLEAR_ALL_DATA' }
  // Persistence
  | { type: 'HYDRATE'; payload: AppState }
  // Merchant memory
  | { type: 'SAVE_MERCHANT_MEMORY'; payload: { merchant: string; category: string; fundingSource?: FundingSource; amount?: number } }
  // Month Lifecycle
  | { type: 'CLOSE_MONTH'; payload: { year: number; month: number; snapshot: MonthlySnapshot } }
  | { type: 'REOPEN_MONTH'; payload: { year: number; month: number } }

// =============================================
// ID Generator
// =============================================

function generateId(): string {
  // crypto.randomUUID() with fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// =============================================
// Reducer
// =============================================

export function appReducer(state: AppState, action: AppAction): AppState {
  const now = new Date().toISOString()

  switch (action.type) {
    // --- Transactions ---
    case 'ADD_TRANSACTION': {
      const newTx: Transaction = {
        ...action.payload,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      let finalTx = newTx
      let remainingTransactions = state.transactions
      let matchedPair = false

      // Helper functions to identify incoming/outgoing transactions
      const isIncoming = (tx: Transaction) => 
        tx.type === 'allowance' || tx.type === 'extra_allowance' || tx.type === 'savings_deposit' || tx.type === 'reimbursement'
      const isOutgoing = (tx: Transaction) => 
        tx.type === 'expense' || tx.type === 'savings_withdrawal'

      const newIsIncoming = isIncoming(newTx)
      const newIsOutgoing = isOutgoing(newTx)

      if (newIsIncoming || newIsOutgoing) {
        const newTime = newTx.parsedTimestamp || new Date(newTx.date + 'T00:00:00').getTime()
        
        // Find matching pending transaction in existing list
        const matchIdx = state.transactions.findIndex(t => {
          if ((t.status as string) !== 'pending' && t.status !== 'pending_review' && (t.status as string) !== 'needs_review') return false
          if (t.amount !== newTx.amount) return false
          
          const matchIsIncoming = isIncoming(t)
          const matchIsOutgoing = isOutgoing(t)
          
          // Must be opposite directions
          if (newIsIncoming && !matchIsOutgoing) return false
          if (newIsOutgoing && !matchIsIncoming) return false

          const matchTime = t.parsedTimestamp || new Date(t.date + 'T00:00:00').getTime()
          const timeDiff = Math.abs(newTime - matchTime)

          // If both have parsedTimestamp, match within 5 minutes. Otherwise match same date.
          if (newTx.parsedTimestamp && t.parsedTimestamp) {
            return timeDiff <= 5 * 60 * 1000
          } else {
            return newTx.date === t.date
          }
        })

        if (matchIdx !== -1) {
          const matchTx = state.transactions[matchIdx]
          
          // We found a match! Let's check if one of these accounts is the savings holding account.
          const debitTx = newIsOutgoing ? newTx : matchTx
          const creditTx = newIsIncoming ? newTx : matchTx

          const debitAcc = state.accounts.find(a => a.id === debitTx.accountId)
          const creditAcc = state.accounts.find(a => a.id === creditTx.accountId)

          if (creditAcc?.isSavingsHolding) {
            // It is a savings transfer from debitAcc -> creditAcc! (Savings Deposit)
            matchedPair = true
            remainingTransactions = state.transactions.filter((_, idx) => idx !== matchIdx)

            finalTx = {
              id: generateId(),
              title: `Savings Deposit (Transfer from ${debitAcc?.name || 'Debit Account'})`,
              amount: newTx.amount,
              type: 'savings_deposit',
              category: 'savings',
              accountId: creditTx.accountId,
              transferSourceAccountId: debitTx.accountId,
              date: creditTx.date,
              createdAt: now,
              updatedAt: now,
              status: 'pending_review',
              confidence: 1.0,
              reviewReasons: ['automated_transfer_pairing'],
              note: `Automated pairing of UBI Debit & SIB Credit SMS alerts.`,
              tags: ['sms', 'transfer'],
              source: 'sms',
              rawSms: `Debit SMS:\n"${debitTx.rawSms || ''}"\n\nCredit SMS:\n"${creditTx.rawSms || ''}"`,
              availableBalance: creditTx.availableBalance, // SIB balance
              sourceAvailableBalance: debitTx.availableBalance, // UBI balance
              parsedTimestamp: creditTx.parsedTimestamp || debitTx.parsedTimestamp,
              referenceNumber: creditTx.referenceNumber || debitTx.referenceNumber
            }
          } else if (debitAcc?.isSavingsHolding) {
            // It is a savings withdrawal from savings account -> debit account! (Savings Withdrawal)
            matchedPair = true
            remainingTransactions = state.transactions.filter((_, idx) => idx !== matchIdx)

            finalTx = {
              id: generateId(),
              title: `Savings Withdrawal (Transfer to ${creditAcc?.name || 'Debit Account'})`,
              amount: newTx.amount,
              type: 'savings_withdrawal',
              category: 'savings',
              accountId: creditTx.accountId,
              transferSourceAccountId: debitTx.accountId,
              date: creditTx.date,
              createdAt: now,
              updatedAt: now,
              status: 'pending_review',
              confidence: 1.0,
              reviewReasons: ['automated_transfer_pairing'],
              note: `Automated pairing of SIB Debit & UBI Credit SMS alerts.`,
              tags: ['sms', 'transfer'],
              source: 'sms',
              rawSms: `Debit SMS:\n"${debitTx.rawSms || ''}"\n\nCredit SMS:\n"${creditTx.rawSms || ''}"`,
              availableBalance: creditTx.availableBalance, // UBI balance
              sourceAvailableBalance: debitTx.availableBalance, // SIB balance
              parsedTimestamp: creditTx.parsedTimestamp || debitTx.parsedTimestamp,
              referenceNumber: creditTx.referenceNumber || debitTx.referenceNumber
            }
          }
        }
      }

      // Update debit card available balance if applicable
      let updatedAccounts = state.accounts
      const txTimestamp = finalTx.parsedTimestamp || new Date(finalTx.date).getTime()

      if (finalTx.transferSourceAccountId) {
        // Paired transfer: update both accounts
        updatedAccounts = state.accounts.map(acc => {
          // Update destination account (credit)
          if (acc.id === finalTx.accountId) {
            if (finalTx.availableBalance !== undefined && finalTx.availableBalance !== null) {
              const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
              if (txTimestamp >= currentLastUpdate) {
                return {
                  ...acc,
                  availableBalance: finalTx.availableBalance ?? acc.availableBalance,
                  lastBalanceUpdateTimestamp: txTimestamp,
                  lastBalanceUpdateCreatedAt: now,
                }
              }
            } else if (acc.availableBalance !== undefined && acc.availableBalance !== null) {
              return { ...acc, availableBalance: (acc.availableBalance || 0) + finalTx.amount }
            }
          }

          // Update source account (debit)
          if (acc.id === finalTx.transferSourceAccountId) {
            if (finalTx.sourceAvailableBalance !== undefined && finalTx.sourceAvailableBalance !== null) {
              const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
              if (txTimestamp >= currentLastUpdate) {
                return {
                  ...acc,
                  availableBalance: finalTx.sourceAvailableBalance ?? acc.availableBalance,
                  lastBalanceUpdateTimestamp: txTimestamp,
                  lastBalanceUpdateCreatedAt: now,
                }
              }
            } else if (acc.availableBalance !== undefined && acc.availableBalance !== null) {
              return { ...acc, availableBalance: Math.max(0, (acc.availableBalance || 0) - finalTx.amount) }
            }
          }

          return acc
        })
      } else {
        // Standard non-transfer transaction update
        const isCreditType = finalTx.type === 'allowance' || finalTx.type === 'extra_allowance' || finalTx.type === 'reimbursement' || finalTx.type === 'settlement'
        if (finalTx.accountId && (finalTx.type === 'expense' || isCreditType)) {
          const account = state.accounts.find(a => a.id === finalTx.accountId)
          if (account && account.type === 'debit') {
            if (
              finalTx.availableBalance !== undefined &&
              finalTx.availableBalance !== null
            ) {
              updatedAccounts = state.accounts.map(acc => {
                if (acc.id === finalTx.accountId) {
                  const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
                  if (txTimestamp >= currentLastUpdate) {
                    return {
                      ...acc,
                      availableBalance: finalTx.availableBalance ?? acc.availableBalance,
                      lastBalanceUpdateTimestamp: txTimestamp,
                      lastBalanceUpdateCreatedAt: now,
                    }
                  }
                }
                return acc
              })
            } else if (account.availableBalance !== undefined && account.availableBalance !== null) {
              updatedAccounts = state.accounts.map(acc =>
                acc.id === finalTx.accountId
                  ? { 
                      ...acc, 
                      availableBalance: finalTx.type === 'expense'
                        ? Math.max(0, (acc.availableBalance || 0) - finalTx.amount)
                        : (acc.availableBalance || 0) + finalTx.amount 
                    }
                  : acc
              )
            }
          }
        }
      }


      const merchantLookup = getMerchantConfidenceFromMemory(
        state.merchantMemory,
        finalTx.title
      )

      if (merchantLookup.isKnown && merchantLookup.entry) {
        if (!finalTx.category || finalTx.category === 'other') {
          finalTx.category = merchantLookup.entry.category
        }
        if (!finalTx.fundingSource) {
          finalTx.fundingSource = merchantLookup.entry.fundingSource
        }
      }

      const autoThreshold = state.settings.autoFinalizeThreshold ?? 150

      const routedStatus = computeReviewStatus({
        confidence: merchantLookup.confidence,
        isUPI: finalTx.tags?.includes('upi') ?? false,
        merchantName: finalTx.title,
        amount: finalTx.amount,
        threshold: autoThreshold,
        isKnownMerchant: merchantLookup.isKnown,
        hasCategory: !!finalTx.category && finalTx.category !== 'other',
        direction: (finalTx.type === 'allowance' || finalTx.type === 'extra_allowance' || finalTx.type === 'reimbursement' || finalTx.type === 'settlement') ? 'credit' : 'debit',
        averageAmount: merchantLookup.entry?.averageAmount,
        confirmationCount: merchantLookup.entry?.confirmationCount,
        isSubscription: merchantLookup.entry?.isSubscription,
      })

      // Apply routed status and confidence — only override if the incoming status
      // is a default/pending value (don't override explicit statuses from transfer pairing)
      if (!finalTx.status || finalTx.status === 'pending_review' || (finalTx.status as string) === 'pending') {
        finalTx = {
          ...finalTx,
          status: routedStatus,
          confidence: merchantLookup.isKnown ? merchantLookup.confidence : finalTx.confidence,
        }
      }

      // If auto-finalized AND known merchant, also update the merchant memory's lastUsedTimestamp
      let updatedMerchantMemory = state.merchantMemory || {}
      if (routedStatus === 'auto_finalized' && merchantLookup.isKnown && merchantLookup.entry) {
        const key = finalTx.title.trim().toLowerCase()
        updatedMerchantMemory = {
          ...updatedMerchantMemory,
          [key]: {
            ...merchantLookup.entry,
            lastUsedTimestamp: now,
          }
        }
      }

      let updatedDebts = state.debts || []
      let updatedFriends = state.friends || []
      if (finalTx.status === 'auto_finalized' && finalTx.type === 'settlement' && finalTx.splitWithFriendId) {
        const friendId = finalTx.splitWithFriendId
        const newSettlement: FriendDebt = {
          id: generateId(),
          friendId,
          amount: -finalTx.amount,
          description: `Settled via transaction: ${finalTx.title}`,
          date: finalTx.date,
          isSettled: true,
          createdAt: now,
          linkedTransactionId: finalTx.id,
          source: finalTx.source || 'manual',
          referenceNumber: finalTx.referenceNumber,
        }
        updatedDebts = [...updatedDebts, newSettlement]
        updatedFriends = updatedFriends.map(f =>
          f.id === friendId ? { ...f, balance: f.balance - finalTx.amount } : f
        )
      }

      return {
        ...state,
        transactions: [finalTx, ...remainingTransactions],
        accounts: updatedAccounts,
        merchantMemory: updatedMerchantMemory,
        debts: updatedDebts,
        friends: updatedFriends,
      }
    }

    case 'UPDATE_TRANSACTION': {
      const updates = action.payload.updates
      const existingTx = state.transactions.find(t => t.id === action.payload.id)

      // Detect if user is making a manual correction to key fields
      const isCorrection = existingTx && existingTx.status !== 'approved' && (
        (updates.category !== undefined && updates.category !== existingTx.category) ||
        (updates.fundingSource !== undefined && updates.fundingSource !== existingTx.fundingSource) ||
        (updates.accountId !== undefined && updates.accountId !== existingTx.accountId) ||
        (updates.title !== undefined && updates.title !== existingTx.title)
      )

      const statusOverride = isCorrection ? 'manually_corrected' as ReviewStatus : undefined

      // If user corrected the merchant→category mapping, also update merchant memory
      let correctedMemory = state.merchantMemory || {}
      if (isCorrection && updates.category && (updates.title || existingTx?.title)) {
        const merchantName = (updates.title || existingTx?.title || '').trim().toLowerCase()
        if (merchantName) {
          const existing = correctedMemory[merchantName]
          correctedMemory = {
            ...correctedMemory,
            [merchantName]: updateMerchantMemoryEntry(
              existing,
              updates.category,
              updates.fundingSource || existingTx?.fundingSource
            )
          }
        }
      }

      return {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.payload.id
            ? {
                ...t,
                ...updates,
                ...(statusOverride ? { status: statusOverride } : {}),
                updatedAt: now,
              }
            : t
        ),
        merchantMemory: correctedMemory,
      }
    }

    case 'DELETE_TRANSACTION': {
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload),
      }
    }

    case 'APPROVE_TRANSACTION': {
      const transactionToApprove = state.transactions.find(t => t.id === action.payload)
      if (!transactionToApprove) return state

      const updatedTransactions = state.transactions.map(t =>
        t.id === action.payload
          ? { ...t, status: 'approved' as ReviewStatus, updatedAt: now }
          : t
      )

      let updatedAccounts = state.accounts
      const txTimestamp = transactionToApprove.parsedTimestamp || new Date(transactionToApprove.date).getTime()

      if (transactionToApprove.transferSourceAccountId) {
        // Paired transfer approval: update both accounts
        updatedAccounts = state.accounts.map(acc => {
          // Update destination account (credit)
          if (acc.id === transactionToApprove.accountId) {
            if (transactionToApprove.availableBalance !== undefined && transactionToApprove.availableBalance !== null) {
              const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
              const currentLastCreatedAt = acc.lastBalanceUpdateCreatedAt || ''
              const isNewer = txTimestamp > currentLastUpdate || (txTimestamp === currentLastUpdate && transactionToApprove.createdAt >= currentLastCreatedAt)
              if (isNewer) {
                return {
                  ...acc,
                  availableBalance: transactionToApprove.availableBalance ?? acc.availableBalance,
                  lastBalanceUpdateTimestamp: txTimestamp,
                  lastBalanceUpdateCreatedAt: transactionToApprove.createdAt
                }
              }
            } else if (acc.availableBalance !== undefined && acc.availableBalance !== null) {
              return { ...acc, availableBalance: (acc.availableBalance || 0) + transactionToApprove.amount }
            }
          }

          // Update source account (debit)
          if (acc.id === transactionToApprove.transferSourceAccountId) {
            if (transactionToApprove.sourceAvailableBalance !== undefined && transactionToApprove.sourceAvailableBalance !== null) {
              const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
              const currentLastCreatedAt = acc.lastBalanceUpdateCreatedAt || ''
              const isNewer = txTimestamp > currentLastUpdate || (txTimestamp === currentLastUpdate && transactionToApprove.createdAt >= currentLastCreatedAt)
              if (isNewer) {
                return {
                  ...acc,
                  availableBalance: transactionToApprove.sourceAvailableBalance ?? acc.availableBalance,
                  lastBalanceUpdateTimestamp: txTimestamp,
                  lastBalanceUpdateCreatedAt: transactionToApprove.createdAt
                }
              }
            } else if (acc.availableBalance !== undefined && acc.availableBalance !== null) {
              return { ...acc, availableBalance: Math.max(0, (acc.availableBalance || 0) - transactionToApprove.amount) }
            }
          }
          return acc
        })
      } else if (
        transactionToApprove.accountId &&
        transactionToApprove.availableBalance !== undefined &&
        transactionToApprove.availableBalance !== null
      ) {
        // Standard non-transfer account update
        updatedAccounts = state.accounts.map(acc => {
          if (acc.id === transactionToApprove.accountId) {
            const currentLastUpdate = acc.lastBalanceUpdateTimestamp || 0
            const currentLastCreatedAt = acc.lastBalanceUpdateCreatedAt || ''
            
            const isNewerTimestamp = txTimestamp > currentLastUpdate
            const isSameTimestampButNewerCreated = txTimestamp === currentLastUpdate && transactionToApprove.createdAt >= currentLastCreatedAt

            if (isNewerTimestamp || isSameTimestampButNewerCreated) {
              return { 
                ...acc, 
                availableBalance: transactionToApprove.availableBalance ?? acc.availableBalance,
                lastBalanceUpdateTimestamp: txTimestamp,
                lastBalanceUpdateCreatedAt: transactionToApprove.createdAt
              }
            }
          }
          return acc
        })
      }
      // Auto-update merchant memory on approval
      let approveMemory = state.merchantMemory || {}
      if (transactionToApprove.title && transactionToApprove.category) {
        const key = transactionToApprove.title.trim().toLowerCase()
        const existing = approveMemory[key]
        approveMemory = {
          ...approveMemory,
          [key]: updateMerchantMemoryEntry(
            existing,
            transactionToApprove.category,
            transactionToApprove.fundingSource,
            transactionToApprove.amount
          )
        }
      }

      let updatedDebts = state.debts || []
      let updatedFriends = state.friends || []
      if (transactionToApprove.type === 'settlement' && transactionToApprove.splitWithFriendId) {
        const friendId = transactionToApprove.splitWithFriendId
        const newSettlement: FriendDebt = {
          id: generateId(),
          friendId,
          amount: -transactionToApprove.amount,
          description: `Settled via transaction: ${transactionToApprove.title}`,
          date: transactionToApprove.date,
          isSettled: true,
          createdAt: now,
          linkedTransactionId: transactionToApprove.id,
          source: transactionToApprove.source || 'manual',
          referenceNumber: transactionToApprove.referenceNumber,
        }
        updatedDebts = [...updatedDebts, newSettlement]
        updatedFriends = updatedFriends.map(f =>
          f.id === friendId ? { ...f, balance: f.balance - transactionToApprove.amount } : f
        )
      }

      return {
        ...state,
        transactions: updatedTransactions,
        accounts: updatedAccounts,
        merchantMemory: approveMemory,
        debts: updatedDebts,
        friends: updatedFriends,
      }
    }

    // --- Accounts ---
    case 'ADD_ACCOUNT': {
      const isSaving = !!action.payload.isSavingsHolding
      const cleanAccounts = isSaving
        ? state.accounts.map(a => ({ ...a, isSavingsHolding: false }))
        : state.accounts
      const newAccount: Account = {
        ...action.payload,
        id: generateId(),
        createdAt: now,
      }
      return {
        ...state,
        accounts: [...cleanAccounts, newAccount],
      }
    }

    case 'UPDATE_ACCOUNT': {
      const isSaving = !!action.payload.updates.isSavingsHolding
      const updatedAccounts = state.accounts.map(a =>
        a.id === action.payload.id
          ? { ...a, ...action.payload.updates }
          : a
      )
      const finalAccounts = isSaving
        ? updatedAccounts.map(a => a.id === action.payload.id ? a : { ...a, isSavingsHolding: false })
        : updatedAccounts
      return {
        ...state,
        accounts: finalAccounts,
      }
    }

    case 'DELETE_ACCOUNT': {
      return {
        ...state,
        accounts: state.accounts.filter(a => a.id !== action.payload),
      }
    }

    // --- Settings ---
    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }
    }

    // --- Wishlist ---
    case 'ADD_WISHLIST_ITEM': {
      const newItem: WishlistItem = {
        ...action.payload,
        id: generateId(),
        createdAt: now,
      }
      return {
        ...state,
        wishlist: [...(state.wishlist || []), newItem],
      }
    }

    case 'DELETE_WISHLIST_ITEM': {
      return {
        ...state,
        wishlist: (state.wishlist || []).filter(item => item.id !== action.payload),
      }
    }

    // --- Friends ---
    case 'ADD_FRIEND': {
      const newFriend: Friend = {
        id: generateId(),
        name: action.payload.name,
        balance: 0,
        createdAt: now,
      }
      return {
        ...state,
        friends: [...(state.friends || []), newFriend],
      }
    }

    case 'DELETE_FRIEND': {
      return {
        ...state,
        friends: (state.friends || []).filter(f => f.id !== action.payload),
        debts: (state.debts || []).filter(d => d.friendId !== action.payload),
      }
    }

    case 'ADD_DEBT': {
      const newDebt: FriendDebt = {
        ...action.payload,
        id: generateId(),
        isSettled: false,
        createdAt: now,
      }
      const updatedFriends = (state.friends || []).map(f =>
        f.id === action.payload.friendId
          ? { ...f, balance: f.balance + action.payload.amount }
          : f
      )
      return {
        ...state,
        friends: updatedFriends,
        debts: [...(state.debts || []), newDebt],
      }
    }

    case 'SETTLE_DEBT': {
      const newSettlement: FriendDebt = {
        id: generateId(),
        friendId: action.payload.friendId,
        amount: -action.payload.amount,
        description: action.payload.description,
        date: action.payload.date,
        isSettled: true,
        createdAt: now,
        source: 'manual',
      }
      const updatedFriends = (state.friends || []).map(f =>
        f.id === action.payload.friendId
          ? { ...f, balance: f.balance - action.payload.amount }
          : f
      )
      return {
        ...state,
        friends: updatedFriends,
        debts: [...(state.debts || []), newSettlement],
      }
    }

    case 'DELETE_DEBT': {
      const debtToDelete = (state.debts || []).find(d => d.id === action.payload)
      if (!debtToDelete) return state
      
      const updatedFriends = (state.friends || []).map(f =>
        f.id === debtToDelete.friendId
          ? { ...f, balance: f.balance - debtToDelete.amount }
          : f
      )
      return {
        ...state,
        friends: updatedFriends,
        debts: (state.debts || []).filter(d => d.id !== action.payload),
      }
    }

    case 'PRUNE_TRANSACTIONS': {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const dateLimit = threeMonthsAgo.toISOString().split('T')[0]
      return {
        ...state,
        transactions: state.transactions.filter(t => t.date >= dateLimit)
      }
    }

    case 'CLEAR_TRANSACTIONS': {
      return {
        ...state,
        transactions: [],
      }
    }

    case 'CLEAR_ALL_DATA': {
      return DEFAULT_STATE
    }

    case 'SAVE_MERCHANT_MEMORY': {
      const memory = state.merchantMemory || {}
      const key = action.payload.merchant.trim().toLowerCase()
      const existing = memory[key]
      return {
        ...state,
        merchantMemory: {
          ...memory,
          [key]: updateMerchantMemoryEntry(
            existing,
            action.payload.category,
            action.payload.fundingSource,
            action.payload.amount
          )
        }
      }
    }

    // --- Hydration ---
    case 'HYDRATE': {
      return action.payload
    }

    // --- Month Lifecycle ---
    case 'CLOSE_MONTH': {
      const existing = state.closedMonths || []
      const filtered = existing.filter(
        s => !(s.year === action.payload.year && s.month === action.payload.month)
      )
      return {
        ...state,
        closedMonths: [...filtered, action.payload.snapshot]
      }
    }

    case 'REOPEN_MONTH': {
      const existing = state.closedMonths || []
      const filtered = existing.filter(
        s => !(s.year === action.payload.year && s.month === action.payload.month)
      )
      return {
        ...state,
        closedMonths: filtered
      }
    }

    default:
      return state
  }
}

// =============================================
// Context
// =============================================

interface AppContextValue {
  // Raw state
  state: AppState
  isHydrated: boolean

  // Transaction actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  approveTransaction: (id: string) => void

  // Account actions
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  deleteAccount: (id: string) => void

  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void

  // Wishlist actions
  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'createdAt'>) => void
  deleteWishlistItem: (id: string) => void

  // Friend actions
  addFriend: (name: string) => void
  deleteFriend: (id: string) => void
  addDebt: (debt: Omit<FriendDebt, 'id' | 'createdAt' | 'isSettled'>) => void
  settleDebt: (friendId: string, amount: number, description: string, date: string) => void
  deleteDebt: (id: string) => void

  // Data maintenance
  pruneTransactions: () => void
  clearTransactions: () => void
  clearAllData: () => void

  // Merchant Memory
  saveMerchantMemory: (merchant: string, category: string, fundingSource?: FundingSource, amount?: number) => void

  // Month Lifecycle
  closeMonth: (year: number, month: number, snapshot: MonthlySnapshot) => void
  reopenMonth: (year: number, month: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// =============================================
// Persistence helpers
// =============================================

function loadState(): AppState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    if (parsed?._version !== SCHEMA_VERSION) {
      // Future: migration logic goes here
      console.warn(`[Life OS] Schema version mismatch: stored=${parsed?._version}, current=${SCHEMA_VERSION}. Using defaults.`)
      return null
    }

    const state = parsed.state as AppState
    return {
      ...state,
      wishlist: state.wishlist || [],
      friends: state.friends || [],
      debts: state.debts || [],
      merchantMemory: state.merchantMemory || {},
      closedMonths: state.closedMonths || [],
    }
  } catch (e) {
    console.error('[Life OS] Failed to load state from localStorage:', e)
    return null
  }
}

function saveState(state: AppState): void {
  if (typeof window === 'undefined') return

  try {
    const payload = JSON.stringify({
      _version: SCHEMA_VERSION,
      _savedAt: new Date().toISOString(),
      state,
    })
    localStorage.setItem(STORAGE_KEY, payload)
  } catch (e) {
    console.error('[Life OS] Failed to save state to localStorage:', e)
  }
}

// =============================================
// Provider Component
// =============================================

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, DEFAULT_STATE)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadState()
    if (stored) {
      dispatch({ type: 'HYDRATE', payload: stored })
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage on every state change (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveState(state)
    }
  }, [state, isHydrated])

  // --- Stable action creators (memoized with useCallback) ---

  const addTransaction = useCallback(
    (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) =>
      dispatch({ type: 'ADD_TRANSACTION', payload: tx }),
    []
  )

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Transaction>) =>
      dispatch({ type: 'UPDATE_TRANSACTION', payload: { id, updates } }),
    []
  )

  const deleteTransaction = useCallback(
    (id: string) => dispatch({ type: 'DELETE_TRANSACTION', payload: id }),
    []
  )

  const approveTransaction = useCallback(
    (id: string) => dispatch({ type: 'APPROVE_TRANSACTION', payload: id }),
    []
  )

  const addAccount = useCallback(
    (account: Omit<Account, 'id' | 'createdAt'>) =>
      dispatch({ type: 'ADD_ACCOUNT', payload: account }),
    []
  )

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) =>
      dispatch({ type: 'UPDATE_ACCOUNT', payload: { id, updates } }),
    []
  )

  const deleteAccount = useCallback(
    (id: string) => dispatch({ type: 'DELETE_ACCOUNT', payload: id }),
    []
  )

  const updateSettings = useCallback(
    (settings: Partial<AppSettings>) =>
      dispatch({ type: 'UPDATE_SETTINGS', payload: settings }),
    []
  )

  const addWishlistItem = useCallback(
    (item: Omit<WishlistItem, 'id' | 'createdAt'>) =>
      dispatch({ type: 'ADD_WISHLIST_ITEM', payload: item }),
    []
  )

  const deleteWishlistItem = useCallback(
    (id: string) =>
      dispatch({ type: 'DELETE_WISHLIST_ITEM', payload: id }),
    []
  )

  const addFriend = useCallback(
    (name: string) =>
      dispatch({ type: 'ADD_FRIEND', payload: { name } }),
    []
  )

  const deleteFriend = useCallback(
    (id: string) =>
      dispatch({ type: 'DELETE_FRIEND', payload: id }),
    []
  )

  const addDebt = useCallback(
    (debt: Omit<FriendDebt, 'id' | 'createdAt' | 'isSettled'>) =>
      dispatch({ type: 'ADD_DEBT', payload: debt }),
    []
  )

  const settleDebt = useCallback(
    (friendId: string, amount: number, description: string, date: string) =>
      dispatch({ type: 'SETTLE_DEBT', payload: { friendId, amount, description, date } }),
    []
  )

  const deleteDebt = useCallback(
    (id: string) =>
      dispatch({ type: 'DELETE_DEBT', payload: id }),
    []
  )

  const pruneTransactions = useCallback(
    () => dispatch({ type: 'PRUNE_TRANSACTIONS' }),
    []
  )

  const clearTransactions = useCallback(
    () => dispatch({ type: 'CLEAR_TRANSACTIONS' }),
    []
  )

  const clearAllData = useCallback(
    () => dispatch({ type: 'CLEAR_ALL_DATA' }),
    []
  )

  const saveMerchantMemory = useCallback(
    (merchant: string, category: string, fundingSource?: FundingSource, amount?: number) =>
      dispatch({ type: 'SAVE_MERCHANT_MEMORY', payload: { merchant, category, fundingSource, amount } }),
    []
  )

  const closeMonth = useCallback(
    (year: number, month: number, snapshot: MonthlySnapshot) =>
      dispatch({ type: 'CLOSE_MONTH', payload: { year, month, snapshot } }),
    []
  )

  const reopenMonth = useCallback(
    (year: number, month: number) =>
      dispatch({ type: 'REOPEN_MONTH', payload: { year, month } }),
    []
  )

  const value: AppContextValue = {
    state,
    isHydrated,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    approveTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    addWishlistItem,
    deleteWishlistItem,
    addFriend,
    deleteFriend,
    addDebt,
    settleDebt,
    deleteDebt,
    pruneTransactions,
    clearTransactions,
    clearAllData,
    saveMerchantMemory,
    closeMonth,
    reopenMonth,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// =============================================
// Consumer Hook
// =============================================

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp() must be used within an <AppProvider>')
  }
  return context
}
