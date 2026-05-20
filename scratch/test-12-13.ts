// ============================================================================
// Phase 12-13 Friend Settlement & Refinement Verification Suite
// ============================================================================
import { appReducer } from '../lib/app-context'
import { DEFAULT_STATE } from '../lib/constants'
import { getFriendBalance } from '../lib/calculations'
import type { AppState, Transaction, Friend, FriendDebt } from '../lib/types'

// Helper mock functions
const generateId = () => Math.random().toString(36).substr(2, 9)
const now = new Date().toISOString()

function runTests() {
  console.log('🧪 Starting Phase 12 & 13 Refinements Automated Integration Tests...\n')

  let state: AppState = {
    ...DEFAULT_STATE,
    accounts: [
      {
        id: 'acc_debit_1',
        name: 'HDFC Debit Card',
        type: 'debit',
        availableBalance: 5000,
        limit: 0,
        billingCycleDay: 0,
        color: 'bg-blue-500',
        isActive: true,
        sortOrder: 1,
        createdAt: now,
      }
    ],
    friends: [],
    debts: [],
    transactions: [],
  }

  // --- Step 1: Add a Friend ---
  console.log('--- Test 1: Add Friend ---')
  state = appReducer(state, {
    type: 'ADD_FRIEND',
    payload: { name: 'Rahul Sharma' }
  })

  const rahul = state.friends?.[0]
  if (!rahul || rahul.name !== 'Rahul Sharma') {
    throw new Error('❌ Test 1 Failed: Rahul Sharma was not added correctly.')
  }
  console.log(`✅ Friend Added: ${rahul.name} (ID: ${rahul.id})`)
  console.log('')

  // --- Step 2: Split an Expense ---
  console.log('--- Test 2: Split an Expense ---')
  // We pay a dinner bill of ₹1200, split with Rahul. Rahul owes us ₹600.
  const splitTxId = 'tx_split_1'
  const splitTx: Transaction = {
    id: splitTxId,
    title: 'Dinner at Royal Cafe',
    amount: 1200,
    type: 'expense',
    category: 'food',
    accountId: 'acc_debit_1',
    date: '2026-05-20',
    createdAt: now,
    updatedAt: now,
    status: 'approved',
    confidence: 1.0,
    reviewReasons: [],
    note: 'Dinner with Rahul',
    tags: [],
    splitWithFriendId: rahul.id,
    friendOwedAmount: 600, // Rahul's share
    splits: [
      { friendId: rahul.id, amount: 600 }
    ],
    source: 'manual'
  }

  // Add the transaction to state
  state = {
    ...state,
    transactions: [splitTx, ...state.transactions]
  }

  const initialBalance = getFriendBalance(rahul.id, state.debts || [], state.transactions)
  console.log(`- Rahul's initial balance: ₹${initialBalance} (Expected: ₹600)`)
  if (initialBalance !== 600) {
    throw new Error(`❌ Test 2 Failed: Balance was ${initialBalance}, expected 600`)
  }
  console.log('✅ Test 2 Passed: Expense successfully split with friend!')
  console.log('')

  // --- Step 3: Partial Repayment via SMS credit Ingestion ---
  console.log('--- Test 3: Partial Repayment via SMS Credit Ingestion ---')
  // Ingest an incoming SMS credit of ₹200 from Rahul
  const partialSettleTxId = 'tx_settle_partial'
  const incomingCreditTx: Transaction = {
    id: partialSettleTxId,
    title: 'Rahul Repayment UPI',
    amount: 200,
    type: 'settlement',
    category: 'other',
    accountId: 'acc_debit_1',
    date: '2026-05-21',
    createdAt: now,
    updatedAt: now,
    status: 'pending_review', // Initially pending review
    confidence: 0.8,
    reviewReasons: ['uncategorized'],
    note: '',
    tags: ['upi'],
    splitWithFriendId: rahul.id, // Linked to Rahul
    source: 'sms',
    rawSms: 'UPI money transfer of INR 200.00 received',
    referenceNumber: 'UPI9876543210'
  }

  // Add the pending transaction to state
  state = {
    ...state,
    transactions: [incomingCreditTx, ...state.transactions]
  }

  // User approves the settlement transaction
  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: partialSettleTxId
  })

  // Let's verify:
  // 1. Rahul's balance should go from ₹600 to ₹400
  const afterPartialBalance = getFriendBalance(rahul.id, state.debts || [], state.transactions)
  console.log(`- Rahul's balance after ₹200 repayment: ₹${afterPartialBalance} (Expected: ₹400)`)
  if (afterPartialBalance !== 400) {
    throw new Error(`❌ Test 3 Failed: Balance was ${afterPartialBalance}, expected 400`)
  }

  // 2. A settlement record should be in state.debts with metadata
  const settlementDebt = state.debts?.find(d => d.linkedTransactionId === partialSettleTxId)
  if (!settlementDebt) {
    throw new Error('❌ Test 3 Failed: FriendDebt settlement record was not created.')
  }
  console.log(`- Settlement record created: amount=${settlementDebt.amount}, isSettled=${settlementDebt.isSettled}`)
  console.log(`- Settlement source: "${settlementDebt.source}" (Expected: "sms")`)
  console.log(`- Reference number: "${settlementDebt.referenceNumber}" (Expected: "UPI9876543210")`)

  if (settlementDebt.amount !== -200 || !settlementDebt.isSettled) {
    throw new Error('❌ Test 3 Failed: Settlement record amount or status is wrong.')
  }
  if (settlementDebt.source !== 'sms' || settlementDebt.referenceNumber !== 'UPI9876543210') {
    throw new Error('❌ Test 3 Failed: Settlement record source or referenceNumber is wrong.')
  }
  console.log('✅ Test 3 Passed: Partial repayment SMS ingestion works flawlessly!')
  console.log('')

  // --- Step 4: Manual Settlement ---
  console.log('--- Test 4: Manual Settle Up ---')
  // Settle ₹150 manually from the friends page
  state = appReducer(state, {
    type: 'SETTLE_DEBT',
    payload: {
      friendId: rahul.id,
      amount: 150,
      description: 'Settle Cash Repayment',
      date: '2026-05-21'
    }
  })

  const afterManualBalance = getFriendBalance(rahul.id, state.debts || [], state.transactions)
  console.log(`- Rahul's balance after ₹150 manual repayment: ₹${afterManualBalance} (Expected: ₹250)`)
  if (afterManualBalance !== 250) {
    throw new Error(`❌ Test 4 Failed: Balance was ${afterManualBalance}, expected 250`)
  }

  // Verify manual settlement metadata
  const manualSettle = state.debts?.find(d => d.description === 'Settle Cash Repayment')
  if (!manualSettle) {
    throw new Error('❌ Test 4 Failed: Manual FriendDebt record was not found.')
  }
  console.log(`- Manual Settlement source: "${manualSettle.source}" (Expected: "manual")`)
  if (manualSettle.source !== 'manual') {
    throw new Error('❌ Test 4 Failed: Manual settlement record has wrong source type.')
  }
  console.log('✅ Test 4 Passed: Manual settlement logging works perfectly!')
  console.log('')

  // --- Step 5: Summary Calculations (Friend Summary Card Stats) ---
  console.log('--- Test 5: Dashboard Summary Calculations ---')
  const testFriends = (state.friends || []).map(f => ({
    ...f,
    balance: getFriendBalance(f.id, state.debts || [], state.transactions)
  }))

  const totalOwedToMe = testFriends
    .filter(f => f.balance > 0)
    .reduce((sum, f) => sum + f.balance, 0)
  const totalIOwe = testFriends
    .filter(f => f.balance < 0)
    .reduce((sum, f) => sum + Math.abs(f.balance), 0)
  const netPosition = totalOwedToMe - totalIOwe

  console.log(`- Total Owed To You: ₹${totalOwedToMe} (Expected: ₹250)`)
  console.log(`- Total You Owe: ₹${totalIOwe} (Expected: ₹0)`)
  console.log(`- Net Position: ₹${netPosition} (Expected: ₹250)`)

  if (totalOwedToMe !== 250 || totalIOwe !== 0 || netPosition !== 250) {
    throw new Error('❌ Test 5 Failed: Summary stats are incorrect.')
  }
  console.log('✅ Test 5 Passed: Dashboard card summary calculations are correct!')
  console.log('')

  console.log('🎉 All Phase 12 & 13 automated tests passed successfully!')
}

try {
  runTests()
} catch (e: any) {
  console.error(e.message)
  process.exit(1)
}
