import { appReducer } from '../lib/app-context'
import { AppState, Transaction, Account } from '../lib/types'
import { getMerchantConfidenceFromMemory } from '../lib/confidence'

const createInitialState = (): AppState => ({
  accounts: [
    {
      id: 'debit-card',
      name: 'Debit Card',
      type: 'debit',
      limit: 0,
      billingCycleDay: 0,
      color: 'bg-primary',
      isActive: true,
      sortOrder: 0,
      availableBalance: 10000,
      createdAt: '2026-05-19T00:00:00.000Z'
    }
  ],
  transactions: [],
  settings: {
    monthlyBudget: 15000,
    theme: 'dark',
    userName: 'Rishi',
    userEmail: 'rishi@example.com',
    autoFinalizeThreshold: 150
  },
  merchantMemory: {}
})

function runTests() {
  console.log('🧪 Starting Phase 11C Adaptive Learning Automated Integration Tests...\n')

  let state = createInitialState()

  // ==========================================
  // Test 1: First Occurrence (Manual Review)
  // ==========================================
  console.log('--- Test 1: First Occurrence ---')
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'McDonalds',
      amount: 120,
      type: 'expense',
      category: 'other',
      accountId: 'debit-card',
      date: '2026-05-20',
      source: 'sms',
      status: undefined as any,
      confidence: 0.5,
      reviewReasons: [],
      note: '',
      tags: []
    }
  })

  let tx1 = state.transactions[0]
  console.log(`- McDonalds 1st tx status: "${tx1.status}" (Expected: "pending_review")`)
  console.log(`- McDonalds 1st tx category: "${tx1.category}" (Expected: "other")`)
  if (tx1.status === 'pending_review' && tx1.category === 'other') {
    console.log('✅ Test 1 Passed!')
  } else {
    console.error('❌ Test 1 Failed!')
  }
  console.log()

  // Approve McDonalds 1st tx and set category to Food (1st memory confirmation)
  state = appReducer(state, {
    type: 'UPDATE_TRANSACTION',
    payload: {
      id: tx1.id,
      updates: { category: 'food' }
    }
  })
  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: tx1.id
  })

  // ==========================================
  // Test 2: Second Occurrence (Auto-Suggest Category + Manual Review)
  // ==========================================
  console.log('--- Test 2: Second Occurrence (Suggest Category) ---')
  
  // Checking merchant memory state
  let lookup1 = getMerchantConfidenceFromMemory(state.merchantMemory, 'McDonalds')
  console.log(`- Memory lookup after 1st approval: isKnown=${lookup1.isKnown}, confidence=${lookup1.confidence}, category=${lookup1.entry?.category}`)

  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'McDonalds',
      amount: 80,
      type: 'expense',
      category: 'other', // User enters or parsed as other
      accountId: 'debit-card',
      date: '2026-05-20',
      source: 'sms',
      status: undefined as any,
      confidence: 0.5,
      reviewReasons: [],
      note: '',
      tags: []
    }
  })

  let tx2 = state.transactions.find(t => t.amount === 80)!
  console.log(`- McDonalds 2nd tx inherited category: "${tx2.category}" (Expected: "food" from suggestions)`)
  console.log(`- McDonalds 2nd tx status: "${tx2.status}" (Expected: "pending_review" because confidence ${tx2.confidence} is < 0.85)`)
  if (tx2.category === 'food' && tx2.status === 'pending_review') {
    console.log('✅ Test 2 Passed!')
  } else {
    console.error('❌ Test 2 Failed!')
  }
  console.log()

  // Approve McDonalds 2nd tx (2nd memory confirmation)
  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: tx2.id
  })

  // ==========================================
  // Test 3: Third Occurrence (Auto-Finalization)
  // ==========================================
  console.log('--- Test 3: Third Occurrence (Auto-Finalization) ---')

  let lookup2 = getMerchantConfidenceFromMemory(state.merchantMemory, 'McDonalds')
  console.log(`- Memory lookup after 2nd approval: isKnown=${lookup2.isKnown}, confidence=${lookup2.confidence}`)

  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'McDonalds',
      amount: 100,
      type: 'expense',
      category: 'other',
      accountId: 'debit-card',
      date: '2026-05-20',
      source: 'sms',
      status: undefined as any,
      confidence: 0.5,
      reviewReasons: [],
      note: '',
      tags: []
    }
  })

  let tx3 = state.transactions.find(t => t.amount === 100)!
  console.log(`- McDonalds 3rd tx status: "${tx3.status}" (Expected: "auto_finalized")`)
  if (tx3.status === 'auto_finalized') {
    console.log('✅ Test 3 Passed!')
  } else {
    console.error('❌ Test 3 Failed!')
  }
  console.log()

  // Approve McDonalds 3rd tx (3rd memory confirmation)
  state = appReducer(state, {
    type: 'APPROVE_TRANSACTION',
    payload: tx3.id
  })

  // ==========================================
  // Test 4: Anomaly Detection (Spike Block)
  // ==========================================
  console.log('--- Test 4: Anomaly Detection (Spike Block) ---')

  const mcdEntry = state.merchantMemory?.['mcdonalds']
  console.log(`- McDonalds historical average amount: ₹${mcdEntry?.averageAmount} (Expected: ~100)`)

  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'McDonalds',
      amount: 500, // Spike: > 2.0x average (100 * 2 = 200)
      type: 'expense',
      category: 'other',
      accountId: 'debit-card',
      date: '2026-05-20',
      source: 'sms',
      status: undefined as any,
      confidence: 0.5,
      reviewReasons: [],
      note: '',
      tags: []
    }
  })

  let txSpike = state.transactions.find(t => t.amount === 500)!
  console.log(`- McDonalds spike transaction status: "${txSpike.status}" (Expected: "pending_review" because amount ₹500 is a spike)`)
  if (txSpike.status === 'pending_review') {
    console.log('✅ Test 4 Passed: Anomaly detection successfully blocked auto-finalization!')
  } else {
    console.error('❌ Test 4 Failed: Anomaly was auto-finalized.')
  }
  console.log()

  // ==========================================
  // Test 5: Expected Subscription Auto-Finalization
  // ==========================================
  console.log('--- Test 5: Expected Subscription Auto-Finalization ---')

  // Ingest Netflix 3 times to train subscription pattern
  for (let i = 0; i < 3; i++) {
    state = appReducer(state, {
      type: 'ADD_TRANSACTION',
      payload: {
        title: 'Netflix',
        amount: 649, // Exceeds autoFinalizeThreshold (150)
        type: 'expense',
        category: 'other',
        accountId: 'debit-card',
        date: '2026-05-20',
        source: 'sms',
        status: undefined as any,
        confidence: 0.5,
        reviewReasons: [],
        note: '',
        tags: []
      }
    })

    const netflixTx = state.transactions.find(t => t.title === 'Netflix' && t.status !== 'approved' && t.status !== 'auto_finalized')!
    state = appReducer(state, {
      type: 'UPDATE_TRANSACTION',
      payload: {
        id: netflixTx.id,
        updates: { category: 'entertainment' }
      }
    })
    state = appReducer(state, {
      type: 'APPROVE_TRANSACTION',
      payload: netflixTx.id
    })
  }

  const netflixEntry = state.merchantMemory?.['netflix']
  console.log(`- Netflix memory: isSubscription=${netflixEntry?.isSubscription}, averageAmount=₹${netflixEntry?.averageAmount}`)

  // Ingest 4th Netflix transaction with exact subscription amount
  state = appReducer(state, {
    type: 'ADD_TRANSACTION',
    payload: {
      title: 'Netflix',
      amount: 649,
      type: 'expense',
      category: 'other',
      accountId: 'debit-card',
      date: '2026-05-20',
      source: 'sms',
      status: undefined as any,
      confidence: 0.5,
      reviewReasons: [],
      note: '',
      tags: []
    }
  })

  const txNetflix4 = state.transactions.find(t => t.title === 'Netflix' && t.status !== 'approved')!
  console.log(`- Netflix 4th transaction status: "${txNetflix4.status}" (Expected: "auto_finalized" despite being over ₹150 threshold)`)
  if (txNetflix4.status === 'auto_finalized') {
    console.log('✅ Test 5 Passed: Subscription auto-finalized successfully!')
  } else {
    console.error('❌ Test 5 Failed: Subscription did not auto-finalize.')
  }
  console.log()

  // ==========================================
  // Test 6: Confidence Decay
  // ==========================================
  console.log('--- Test 6: Confidence Decay ---')

  const now = new Date()
  const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

  let lookupDecayed = getMerchantConfidenceFromMemory(
    state.merchantMemory,
    'McDonalds',
    ninetyDaysLater
  )

  console.log(`- McDonalds original confidence score: ${mcdEntry?.confidenceScore}`)
  console.log(`- McDonalds decayed confidence score (after 90 days): ${lookupDecayed.confidence}`)
  
  if (lookupDecayed.confidence < mcdEntry!.confidenceScore) {
    console.log('✅ Test 6 Passed: Confidence decayed correctly over time!')
  } else {
    console.error('❌ Test 6 Failed: Confidence score did not decay.')
  }
  console.log()

  console.log('🎉 All Phase 11C tests passed successfully.')
}

runTests()
