import { appReducer } from '../lib/app-context'
import { AppState, Transaction, Friend, FriendDebt, Account } from '../lib/types'

// Mock state helper
const createInitialState = (): AppState => ({
  accounts: [
    {
      id: 'ubi-debit',
      name: 'UBI Debit',
      type: 'debit',
      availableBalance: 5000,
      createdAt: '2026-05-19T00:00:00.000Z'
    },
    {
      id: 'sib-savings',
      name: 'SIB Savings Vault',
      type: 'debit',
      isSavingsHolding: true,
      availableBalance: 10000,
      createdAt: '2026-05-19T00:00:00.000Z'
    }
  ],
  transactions: [],
  friends: [
    {
      id: 'friend-rahul',
      name: 'Rahul',
      balance: 400, // Rahul owes ₹400
      createdAt: '2026-05-19T00:00:00.000Z'
    }
  ],
  debts: [
    {
      id: 'debt-dinner',
      friendId: 'friend-rahul',
      amount: 400,
      description: 'Dinner split share',
      date: '2026-05-19',
      isSettled: false,
      createdAt: '2026-05-19T00:00:00.000Z'
    }
  ],
  settings: {
    monthlyAllowance: 10000,
    allowanceDay: 1,
    autoFinalizeThreshold: 3, // auto-finalize threshold set to 3 per settings
    theme: 'dark'
  },
  merchantMemory: {}
})

function runTests() {
  console.log('🧪 Starting Phase 11B Automated Integration Tests...\n')

  let state = createInitialState()

  // ==========================================
  // Test 1: Incoming Credit Review Routing
  // ==========================================
  console.log('--- Test 1: Incoming Credit Routing ---')
  
  // Add a standard credit SMS from unknown merchant
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'UPI Credit Alert from Uncle John',
      amount: 1500,
      type: 'reimbursement',
      category: 'other',
      accountId: 'ubi-debit',
      date: '2026-05-20',
      source: 'sms',
      rawSms: 'UPI-Credited: INR 1,500.00 from Uncle John to UBI Debit. Ref: 601234.'
    }
  })

  const tx1 = state.transactions[0]
  console.log(`- Ingested Transaction status: "${tx1.status}" (Expected: "pending_review")`)
  if (tx1.status === 'pending_review') {
    console.log('✅ Test 1 Passed: Credit routed to pending_review correctly!')
  } else {
    console.error('❌ Test 1 Failed: Credit did not route to pending_review.')
  }
  console.log()

  // ==========================================
  // Test 2: Savings Vault Withdrawal Pairing
  // ==========================================
  console.log('--- Test 2: Savings Vault Withdrawal Pairing ---')

  // Ingest Debit SMS on SIB Savings
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'Debit SIB Savings',
      amount: 4000,
      type: 'expense',
      category: 'savings',
      accountId: 'sib-savings',
      date: '2026-05-20',
      source: 'sms',
      rawSms: 'SIB-Debited: INR 4,000.00 on Savings. Bal: INR 6,000.00.',
      availableBalance: 6000,
      parsedTimestamp: 1779264000000 // Fixed timestamp for pairing match
    }
  })

  // Ingest Credit SMS on UBI Debit
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'Credit UBI Debit',
      amount: 4000,
      type: 'reimbursement',
      category: 'other',
      accountId: 'ubi-debit',
      date: '2026-05-20',
      source: 'sms',
      rawSms: 'UBI-Credited: INR 4,000.00. Bal: INR 9,000.00.',
      availableBalance: 9000,
      parsedTimestamp: 1779264000100 // Within 5 minutes
    }
  })

  const pairedTx = state.transactions[0]
  console.log(`- Paired Transaction type: "${pairedTx.type}" (Expected: "savings_withdrawal")`)
  console.log(`- Paired Transaction status: "${pairedTx.status}" (Expected: "pending_review")`)
  console.log(`- Source account balance parsed: ${pairedTx.sourceAvailableBalance} (Expected: 6000)`)
  console.log(`- Destination account balance parsed: ${pairedTx.availableBalance} (Expected: 9000)`)

  if (
    pairedTx.type === 'savings_withdrawal' &&
    pairedTx.status === 'pending_review' &&
    pairedTx.sourceAvailableBalance === 6000 &&
    pairedTx.availableBalance === 9000
  ) {
    console.log('✅ Test 2 Passed: Savings withdrawal paired successfully!')
  } else {
    console.error('❌ Test 2 Failed: Pairing mismatch.')
  }
  console.log()

  // ==========================================
  // Test 3: Approving Paired Savings Transfer Updates Balances
  // ==========================================
  console.log('--- Test 3: Approving Paired Transfer Balances ---')

  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: pairedTx.id
  })

  const ubiAccount = state.accounts.find(a => a.id === 'ubi-debit')
  const sibAccount = state.accounts.find(a => a.id === 'sib-savings')

  console.log(`- UBI Account Balance after approval: ₹${ubiAccount?.availableBalance} (Expected: 9000)`)
  console.log(`- SIB Account Balance after approval: ₹${sibAccount?.availableBalance} (Expected: 6000)`)

  if (ubiAccount?.availableBalance === 9000 && sibAccount?.availableBalance === 6000) {
    console.log('✅ Test 3 Passed: Both balances updated correctly upon transfer approval!')
  } else {
    console.error('❌ Test 3 Failed: Balances not updated correctly.')
  }
  console.log()

  // ==========================================
  // Test 4: Friend Settlement Side Effects
  // ==========================================
  console.log('--- Test 4: Friend Settlement Side Effects ---')

  // Ingest settlement credit transaction
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'Rahul Repayment Dinner',
      amount: 400,
      type: 'settlement',
      category: 'other',
      accountId: 'ubi-debit',
      date: '2026-05-20',
      source: 'sms',
      rawSms: 'UPI-Credited: INR 400.00 from Rahul. Ref: 9876.'
    }
  })

  let settlementTx = state.transactions[0]
  
  // Link friend Rahul to this settlement transaction
  state = appReducer(state, {
    type: 'UPDATE_TRANSACTION',
    payload: {
      id: settlementTx.id,
      updates: {
        splitWithFriendId: 'friend-rahul'
      }
    }
  })

  // Approve the settlement transaction
  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: settlementTx.id
  })

  // Check if a negative debt entry is created
  const newDebt = state.debts.find(d => d.friendId === 'friend-rahul' && d.amount === -400)
  
  // Check if friend's net balance is updated in state.friends
  const rahul = state.friends.find(f => f.id === 'friend-rahul')

  console.log(`- Created negative debt logged in state.debts: ${newDebt ? 'Yes' : 'No'} (Expected: Yes)`)
  console.log(`- Rahul balance in state.friends: ₹${rahul?.balance} (Expected: 0)`)

  if (newDebt && rahul?.balance === 0) {
    console.log('✅ Test 4 Passed: Friend balance settled cleanly without altering original expense splits!')
  } else {
    console.error('❌ Test 4 Failed: Friend balance settlement side effects failed.')
  }
  console.log()

  console.log('🎉 Integration tests complete.')
}

runTests()
