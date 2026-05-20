import { parseSms } from '../lib/sms-parser'
import type { Account } from '../lib/types'

const accounts: Account[] = [
  {
    id: 'ubi-debit',
    name: 'UBI Debit',
    type: 'debit',
    limit: 0,
    availableBalance: 24000,
    billingCycleDay: 0,
    color: 'bg-blue-500',
    isActive: true,
    sortOrder: 0,
    smsIdentifier: '6732',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sib-vault',
    name: 'SIB Vault',
    type: 'debit',
    limit: 0,
    availableBalance: 5000,
    billingCycleDay: 0,
    color: 'bg-green-500',
    isActive: true,
    isSavingsHolding: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
  },
]

console.log('═'.repeat(60))
console.log('  SMS BALANCE EXTRACTION & CREDIT FLOW TEST')
console.log('═'.repeat(60))

// --- TEST 1: Debit SMS with "Avl Bal Rs:0.03" ---
const debitSms = `A/c *6732 Debited for Rs:174.00 on 16-05-2026 13:35:52 by Mob Bk ref no 283772101366 Avl Bal Rs:0.03.If not you, Call 1800222243 -Union Bank of India`

console.log('\n--- TEST 1: Debit SMS ---')
console.log(`SMS: "${debitSms}"`)
const debitResult = parseSms(debitSms, accounts)
console.log(`  Direction:  ${debitResult.direction}`)
console.log(`  Amount:     ${debitResult.amount}`)
console.log(`  Balance:    ${debitResult.availableBalance}`)
console.log(`  Account:    ${debitResult.accountId}`)
console.log(`  Identifier: ${debitResult.detectedIdentifier}`)
console.log(`  Date:       ${debitResult.date}`)
console.log(`  Timestamp:  ${debitResult.parsedTimestamp ? new Date(debitResult.parsedTimestamp).toISOString() : 'none'}`)
console.log(`  Ref No:     ${debitResult.referenceNumber}`)
console.log(`  Confidence: ${debitResult.confidence}`)
console.log(`  Category:   ${debitResult.suggestedCategory}`)
console.log(`  Funding:    ${debitResult.suggestedFundingSource}`)

if (debitResult.direction === 'debit') console.log('  ✅ Direction: debit')
else console.log(`  ❌ Direction should be debit, got: ${debitResult.direction}`)

if (debitResult.amount === 174) console.log('  ✅ Amount: ₹174')
else console.log(`  ❌ Amount should be 174, got: ${debitResult.amount}`)

if (debitResult.availableBalance === 0.03) console.log('  ✅ Balance: ₹0.03')
else console.log(`  ❌ Balance should be 0.03, got: ${debitResult.availableBalance}`)

if (debitResult.accountId === 'ubi-debit') console.log('  ✅ Account matched: UBI Debit')
else console.log(`  ❌ Account should be ubi-debit, got: ${debitResult.accountId}`)

if (debitResult.date === '2026-05-16') console.log('  ✅ Date: 2026-05-16')
else console.log(`  ❌ Date should be 2026-05-16, got: ${debitResult.date}`)


// --- TEST 2: Credit SMS with "Avl Bal Rs:17211.03" ---
const creditSms = `Your SB A/c *6732 Credited for Rs:6233.00 on 20-05-2026 17:59:23 by Transfer Avl Bal Rs:17211.03 -Union Bank of India`

console.log('\n--- TEST 2: Credit SMS ---')
console.log(`SMS: "${creditSms}"`)
const creditResult = parseSms(creditSms, accounts)
console.log(`  Direction:  ${creditResult.direction}`)
console.log(`  Amount:     ${creditResult.amount}`)
console.log(`  Balance:    ${creditResult.availableBalance}`)
console.log(`  Account:    ${creditResult.accountId}`)
console.log(`  Identifier: ${creditResult.detectedIdentifier}`)
console.log(`  Date:       ${creditResult.date}`)
console.log(`  Timestamp:  ${creditResult.parsedTimestamp ? new Date(creditResult.parsedTimestamp).toISOString() : 'none'}`)
console.log(`  Confidence: ${creditResult.confidence}`)
console.log(`  Category:   ${creditResult.suggestedCategory}`)
console.log(`  Funding:    ${creditResult.suggestedFundingSource}`)
console.log(`  Merchant:   ${creditResult.merchant}`)

if (creditResult.direction === 'credit') console.log('  ✅ Direction: credit')
else console.log(`  ❌ Direction should be credit, got: ${creditResult.direction}`)

if (creditResult.amount === 6233) console.log('  ✅ Amount: ₹6233')
else console.log(`  ❌ Amount should be 6233, got: ${creditResult.amount}`)

if (creditResult.availableBalance === 17211.03) console.log('  ✅ Balance: ₹17211.03')
else console.log(`  ❌ Balance should be 17211.03, got: ${creditResult.availableBalance}`)

if (creditResult.accountId === 'ubi-debit') console.log('  ✅ Account matched: UBI Debit')
else console.log(`  ❌ Account should be ubi-debit, got: ${creditResult.accountId}`)

if (creditResult.date === '2026-05-20') console.log('  ✅ Date: 2026-05-20')
else console.log(`  ❌ Date should be 2026-05-20, got: ${creditResult.date}`)


// --- Explain Credit Flow ---
console.log('\n' + '═'.repeat(60))
console.log('  CREDIT SMS FLOW EXPLANATION')
console.log('═'.repeat(60))
console.log(`
When a CREDIT SMS is detected (direction = 'credit'), the app flow is:

1. SMS Sandbox Page: User pastes SMS → parseSms() runs
   - Detects "Credited" keyword → direction = 'credit'
   - Extracts amount (₹6233), date, account (*6732 → UBI Debit)
   - Extracts available balance (₹17211.03)
   - Sets merchant = 'Credit / Deposit', category = 'other', confidence = 1.0

2. Transaction Creation: The SMS import creates a transaction with:
   - type: 'allowance' (incoming money to debit account)
   - The available balance is stored on the transaction
   - Status: auto-finalized (confidence = 1.0)
   - NOT counted as spending

3. Account Balance Update: If the SMS contains an available balance,
   the account's availableBalance is updated to match the bank's
   reported balance (₹17211.03), keeping the app in sync.

4. Dashboard Impact:
   - Does NOT increase spending totals
   - Updates the debit account balance display
   - If paired with a matching debit SMS (same amount, same time window),
     it gets auto-paired as an internal transfer (e.g., savings transfer)
`)
