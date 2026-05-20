// ============================================================================
// Life OS — SMS Annotation Engine Verification Suite
// ============================================================================

import { parseSms } from '../lib/sms-parser'
import { annotateSms } from '../lib/sms-annotations'
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
    id: 'sbi-card',
    name: 'SBI Credit Card',
    type: 'credit',
    limit: 50000,
    availableBalance: 45000,
    billingCycleDay: 20,
    color: 'bg-green-500',
    isActive: true,
    sortOrder: 1,
    smsIdentifier: '9812',
    createdAt: new Date().toISOString(),
  }
]

console.log('═'.repeat(70))
console.log('             SMS ANNOTATION ENGINE VERIFICATION SUITE')
console.log('═'.repeat(70))

const testCases = [
  {
    name: 'Union Bank Debit SMS (UPI / Transfer)',
    sms: 'A/c *6732 Debited for Rs:174.00 on 16-05-2026 13:35:52 by Mob Bk ref no 283772101366 Avl Bal Rs:0.03.If not you, Call 1800222243 -Union Bank of India',
    expectedAnnotations: ['account', 'direction', 'amount', 'date', 'time', 'reference', 'balance']
  },
  {
    name: 'SBI Credit Card spent SMS',
    sms: 'Spent Rs. 1,250.00 on SBI Credit Card XX9812 at Amazon India on 19-May-26. Avail Lmt Rs. 45,000.00',
    expectedAnnotations: ['direction', 'amount', 'account', 'merchant', 'date', 'balance']
  },
  {
    name: 'Union Bank SB Credit SMS',
    sms: 'Your SB A/c *6732 Credited for Rs:6233.00 on 20-05-2026 17:59:23 by Transfer Avl Bal Rs:17211.03 -Union Bank of India',
    expectedAnnotations: ['account', 'direction', 'amount', 'date', 'time', 'balance']
  }
]

let passedCount = 0
let failedCount = 0

testCases.forEach((tc, idx) => {
  console.log(`\n[TEST ${idx + 1}] ${tc.name}`)
  console.log(`SMS: "${tc.sms}"`)

  const parsed = parseSms(tc.sms, accounts)
  const annotations = annotateSms(tc.sms, parsed)

  console.log('Parsed Output Fields:')
  console.log(`  - Amount:     ${parsed.amount}`)
  console.log(`  - Direction:  ${parsed.direction}`)
  console.log(`  - AccountId:  ${parsed.accountId}`)
  console.log(`  - Merchant:   ${parsed.merchant}`)
  console.log(`  - Balance:    ${parsed.availableBalance}`)

  console.log('Generated Annotations:')
  annotations.forEach(ann => {
    console.log(`  • [${ann.field.toUpperCase()}] Text: "${tc.sms.substring(ann.start, ann.end)}" | Value: "${ann.value}" (Range: ${ann.start} - ${ann.end})`)
  })

  // Verify fields are present
  const annotatedFields = annotations.map(a => a.field)
  let success = true

  tc.expectedAnnotations.forEach(field => {
    if (annotatedFields.includes(field as any)) {
      console.log(`  ✅ Verified field: ${field}`)
    } else {
      console.log(`  ❌ Missing expected field annotation: ${field}`)
      success = false
    }
  })

  // Verify no overlaps
  let overlapFound = false
  for (let i = 0; i < annotations.length; i++) {
    for (let j = i + 1; j < annotations.length; j++) {
      const a = annotations[i]
      const b = annotations[j]
      if (a.start < b.end && b.start < a.end) {
        console.log(`  ❌ OVERLAP DETECTED between [${a.field}] and [${b.field}]!`)
        overlapFound = true
        success = false
      }
    }
  }

  if (!overlapFound) {
    console.log('  ✅ No overlapping annotations detected.')
  }

  if (success) {
    console.log(`🎉 TEST ${idx + 1} PASSED!`)
    passedCount++
  } else {
    console.log(`🚨 TEST ${idx + 1} FAILED!`)
    failedCount++
  }
})

console.log('\n' + '═'.repeat(70))
console.log(`Verification completed: ${passedCount} passed, ${failedCount} failed.`)
console.log('═'.repeat(70))

if (failedCount > 0) {
  process.exit(1)
} else {
  console.log('All SMS annotation engine test assertions passed successfully!')
  process.exit(0)
}
