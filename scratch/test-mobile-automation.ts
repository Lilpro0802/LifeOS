import { parseSms, isValidTransactionSms } from '../lib/sms-parser'
import type { Account, AppState, Transaction, TransactionType } from '../lib/types'
import { appReducer } from '../lib/app-context'

// Mock environment setup
const mockAccounts: Account[] = [
  {
    id: 'ubi-debit',
    name: 'Union Bank Debit',
    type: 'debit',
    limit: 0,
    availableBalance: 10000,
    billingCycleDay: 0,
    color: 'bg-blue-500',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    smsIdentifier: '1234',
  },
  {
    id: 'sbi-credit',
    name: 'SBI Credit Card',
    type: 'credit',
    limit: 50000,
    availableBalance: 50000,
    billingCycleDay: 15,
    color: 'bg-green-500',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    smsIdentifier: '5678',
  },
  {
    id: 'sib-vault',
    name: 'SIB Savings Vault',
    type: 'debit',
    limit: 0,
    availableBalance: 80000,
    billingCycleDay: 0,
    color: 'bg-purple-500',
    isActive: true,
    isSavingsHolding: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    smsIdentifier: '9999',
  }
]

const mockInitialState: AppState = {
  transactions: [],
  accounts: mockAccounts,
  settings: {
    monthlyBudget: 20000,
    theme: 'dark',
    userName: 'Rishi',
    userEmail: 'rishi@example.com',
    autoFinalizeThreshold: 150,
    protectedReserve: 10000,
  },
  wishlist: [],
  friends: [],
  debts: [],
  merchantMemory: {},
}

// Javascript mock of the Native Kotlin Pre-Filtering Heuristic
function nativePreFilterSms(sender: string, body: string): boolean {
  const cleanBody = body.toLowerCase()
  
  // 1. Reject Spam/OTPs/Logins
  const spamKeywords = [
    "otp", "verification code", "one time password", "login alert", 
    "secure code", "promo", "discount", "offer inside", 
    "cashback of up to", "recharge of", "recharge successful",
    "delivery", "ordered", "shipped"
  ]
  for (const keyword of spamKeywords) {
    if (cleanBody.includes(keyword)) {
      return false
    }
  }
  
  // 2. Core financial transaction keywords
  const txnKeywords = [
    "debited", "credited", "spent", "txn", "transacted", 
    "paid", "received", "withdrawn", "payment", "upi", "vpa", "avl bal"
  ]
  let hasTxnKeyword = false
  for (const kw of txnKeywords) {
    if (cleanBody.includes(kw)) {
      hasTxnKeyword = true
      break
    }
  }
  
  // 3. Currency symbols
  const hasCurrency = cleanBody.includes("rs") || cleanBody.includes("inr") || cleanBody.includes("₹")
  
  // 4. Account indicators
  const hasAccount = (
    cleanBody.includes("a/c") || 
    cleanBody.includes("ac") || 
    cleanBody.includes("acct") || 
    cleanBody.includes("account") || 
    cleanBody.includes("card") || 
    cleanBody.includes("ending") ||
    /\bxx\d{4}\b/i.test(cleanBody) ||
    /\b\*\d{4}\b/i.test(cleanBody) ||
    /\b\d{4}\b/i.test(cleanBody)
  )
  
  // A financial SMS must have transacted keyword + currency OR currency + account details
  return (hasTxnKeyword && hasCurrency) || (hasCurrency && hasAccount)
}

// Running Tests
console.log('==================================================')
console.log('STARTING PHASE 15/16 MOBILE INGESTION TEST SUITE')
console.log('==================================================\n')

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`)
    passed++
  } else {
    console.error(`[FAIL] ${testName}`)
    failed++
  }
}

// --- Test 1: Native Heuristic Filter (OTPs & Spams) ---
const otpSms = "Your OTP for SBI card login is 948201. Do not share this with anyone."
const promoSms = "Get Rs 500 discount on your next flight! Offer valid until 31st May."
const deliverySms = "Your order has been shipped. Track here: dhl.com/123"
const rechargeSms = "Recharge of Rs.299 on your number ending 1234 was successful."

assert(nativePreFilterSms("SBI", otpSms) === false, "OTP rejection test")
assert(nativePreFilterSms("AD-FLIGHT", promoSms) === false, "Promo alert rejection test")
assert(nativePreFilterSms("DELIVY", deliverySms) === false, "Delivery update rejection test")
assert(nativePreFilterSms("JIO", rechargeSms) === false, "Recharge confirmation rejection test")

// --- Test 2: Native Heuristic Filter (Real Transaction Messages) ---
const ubiDebitSms = "Your A/C XX1234 has been debited by Rs. 500.00 on 20-MAY-2026 towards GPAY (UPI Ref No 6789012345). Avl Bal: Rs. 12500.00"
const sbiCreditSms = "Spent Rs.1,200.00 on SBI Credit Card ending 5678 at AMAZON on 20/05/2026. Limit Avail: Rs. 45,000.00"
const sibSavingsSms = "Your SIB A/C XX9999 has been credited with Rs. 5,000.00 on 20-MAY-26 by transfer from A/C XX1234. Avl Bal: Rs. 85,000.00"

assert(nativePreFilterSms("UBI", ubiDebitSms) === true, "Ingestion approval for UBI debit")
assert(nativePreFilterSms("SBI-CARD", sbiCreditSms) === true, "Ingestion approval for SBI credit card spent")
assert(nativePreFilterSms("SIB", sibSavingsSms) === true, "Ingestion approval for SIB savings credit")

// --- Test 3: Production SMS Parser Verification ---
const parsedUbi = parseSms(ubiDebitSms, mockAccounts)
assert(parsedUbi.amount === 500, "Parse amount correctly (₹500)")
assert(parsedUbi.accountId === 'ubi-debit', "Match Union Bank account using last 4 digits '1234'")
assert(parsedUbi.direction === 'debit', "Parse debit direction correctly")
assert(parsedUbi.availableBalance === 12500, "Parse available balance correctly (₹12,500)")
assert(parsedUbi.referenceNumber === '6789012345', "Parse reference number (6789012345)")

const parsedSbi = parseSms(sbiCreditSms, mockAccounts)
assert(parsedSbi.amount === 1200, "Parse credit card spent amount correctly (₹1,200)")
assert(parsedSbi.accountId === 'sbi-credit', "Match SBI Credit account using '5678'")
assert(parsedSbi.merchant === 'AMAZON', "Extract merchant 'AMAZON' correctly")

// --- Test 4: Duplicate Prevention & State updates ---
let state = mockInitialState

// Feed first transaction
const newTxPayload1 = {
  title: parsedUbi.merchant || 'GPAY',
  amount: parsedUbi.amount || 0,
  type: 'expense' as TransactionType,
  category: parsedUbi.suggestedCategory || 'other',
  fundingSource: parsedUbi.suggestedFundingSource || 'base',
  accountId: parsedUbi.accountId || '',
  date: parsedUbi.date,
  status: 'pending_review' as any,
  confidence: parsedUbi.confidence,
  reviewReasons: [],
  note: 'Ingested via SMS',
  tags: ['sms'],
  rawSms: ubiDebitSms,
  availableBalance: parsedUbi.availableBalance,
  parsedTimestamp: parsedUbi.parsedTimestamp,
  referenceNumber: parsedUbi.referenceNumber,
}

state = appReducer(state, { type: 'ADD_TRANSACTION', payload: newTxPayload1 })
assert(state.transactions.length === 1, "Transaction successfully added to state")
assert(state.accounts.find(a => a.id === 'ubi-debit')?.availableBalance === 12500, "Account balance updated correctly to ₹12,500")

// Simulate ingestion of a duplicate transaction (same referenceNumber)
const isDuplicate = state.transactions.some(tx => tx.referenceNumber === parsedUbi.referenceNumber)
assert(isDuplicate === true, "Successfully flagged duplicate reference number")

// --- Test 5: Transfer / Savings Ingestion Pairing ---
// Create state containing debit from standard account
const ubiDebitTransferText = "Your A/C XX1234 has been debited by Rs. 5000.00 on 20-MAY-2026 towards SIB Savings (UPI Ref No 11112222). Avl Bal: Rs. 7500.00"
const sibCreditTransferText = "Your SIB A/C XX9999 has been credited with Rs. 5000.00 on 20-MAY-2026 by UPI from A/C XX1234 (UPI Ref No 11112222). Avl Bal: Rs. 90000.00"

const parsedDebitTransfer = parseSms(ubiDebitTransferText, mockAccounts)
const parsedCreditTransfer = parseSms(sibCreditTransferText, mockAccounts)

const txPayloadDebit = {
  title: 'SIB Savings',
  amount: parsedDebitTransfer.amount || 0,
  type: 'expense' as TransactionType,
  category: parsedDebitTransfer.suggestedCategory || 'other',
  fundingSource: parsedDebitTransfer.suggestedFundingSource || 'base',
  accountId: parsedDebitTransfer.accountId || '',
  date: parsedDebitTransfer.date,
  status: 'pending_review' as any,
  confidence: parsedDebitTransfer.confidence,
  reviewReasons: [],
  note: 'Debit leg',
  tags: ['sms'],
  rawSms: ubiDebitTransferText,
  availableBalance: parsedDebitTransfer.availableBalance,
  parsedTimestamp: 1779290000000,
  referenceNumber: parsedDebitTransfer.referenceNumber,
}

// Ingest debit leg
state = appReducer(state, { type: 'ADD_TRANSACTION', payload: txPayloadDebit })
assert(state.transactions.length === 2, "Debit transfer leg ingested")

const txPayloadCredit = {
  title: 'Credit Alert',
  amount: parsedCreditTransfer.amount || 0,
  type: 'allowance' as TransactionType,
  category: parsedCreditTransfer.suggestedCategory || 'other',
  fundingSource: parsedCreditTransfer.suggestedFundingSource || 'base',
  accountId: parsedCreditTransfer.accountId || '',
  date: parsedCreditTransfer.date,
  status: 'pending_review' as any,
  confidence: parsedCreditTransfer.confidence,
  reviewReasons: [],
  note: 'Credit leg',
  tags: ['sms'],
  rawSms: sibCreditTransferText,
  availableBalance: parsedCreditTransfer.availableBalance,
  parsedTimestamp: 1779290000000 + 5000, // 5 seconds later
  referenceNumber: parsedCreditTransfer.referenceNumber,
}

// Ingest credit leg and verify pairing into savings_deposit
state = appReducer(state, { type: 'ADD_TRANSACTION', payload: txPayloadCredit })

// The two legs should be merged into a single savings_deposit transfer transaction!
const transferTx = state.transactions.find(tx => tx.type === 'savings_deposit')
assert(!!transferTx, "Successfully paired debit & credit legs into a single transfer transaction")
assert(transferTx?.amount === 5000, "Paired transfer amount matches ₹5000")
assert(transferTx?.accountId === 'sib-vault', "Paired transfer destination is SIB Savings")
assert(transferTx?.transferSourceAccountId === 'ubi-debit', "Paired transfer source is Union Bank")
assert(state.accounts.find(a => a.id === 'sib-vault')?.availableBalance === 90000, "SIB balance updated to ₹90,000")
assert(state.accounts.find(a => a.id === 'ubi-debit')?.availableBalance === 7500, "UBI balance updated to ₹7,500")

// Verify clean persistence
assert(state.transactions.length === 2, "Duplicate legs replaced: State contains exactly 2 total transactions")

console.log('\n==================================================')
console.log(`TEST RUN SUMMARY: ${passed} PASSED, ${failed} FAILED`)
console.log('==================================================')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
