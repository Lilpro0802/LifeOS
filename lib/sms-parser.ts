import type { Account, FundingSource, MerchantMemoryEntry } from './types'

export interface ParsedSmsResult {
  amount: number | null
  merchant: string | null
  accountId: string | null
  detectedIdentifier: string | null
  direction: 'debit' | 'credit'
  availableBalance: number | null
  date: string // YYYY-MM-DD
  confidence: number // 0 to 1
  rawText: string
  suggestedCategory?: string
  suggestedFundingSource?: FundingSource
  isUPI?: boolean
  parsedTimestamp?: number
  referenceNumber?: string
}

/**
 * Normalizes text to lowercase, removes punctuation/whitespace for comparison.
 */
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Main SMS transaction parsing utility (Rule-based & Regex)
 */
export function parseSms(
  text: string,
  accounts: Account[],
  merchantMemory: Record<string, MerchantMemoryEntry> = {}
): ParsedSmsResult {
  const result: ParsedSmsResult = {
    amount: null,
    merchant: null,
    accountId: null,
    detectedIdentifier: null,
    direction: 'debit',
    availableBalance: null,
    date: new Date().toISOString().split('T')[0], // Default: today
    confidence: 0.5,
    rawText: text,
    isUPI: false,
  }

  if (!text) return result

  const cleanText = text.replace(/[\n\r]/g, ' ')
  
  result.isUPI = /\b(?:upi|mob bk|mob bk ref|ref no|vpa|gpay|phonepe|paytm)\b/i.test(cleanText)

  // 1. Amount Extraction
  const amountRegexes = [
    /(?:rs\.?:?|inr:?|amt:?|rs\s*:)\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:spent|debited|credited|amounted to|for)\s*(?:rs\.?:?|inr:?|amt:?|rs\s*:)??\s*([\d,]+(?:\.\d{2})?)/i,
  ]
  for (const regex of amountRegexes) {
    const match = cleanText.match(regex)
    if (match && match[1]) {
      const amt = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amt)) {
        result.amount = amt
        break
      }
    }
  }

  // 2. Debit/Credit Direction
  if (/\b(?:credited|received|refund|refunded|added|deposited)\b/i.test(cleanText) || /\bcredit(?!(\s+)?card)\b/i.test(cleanText)) {
    result.direction = 'credit'
  } else if (/\b(?:debit|debited|spent|paid|payment|withdrawn|charged)\b/i.test(cleanText)) {
    result.direction = 'debit'
  }

  // 3. Account/Card detection
  const cardRegexes = [
    /(?:card|a\/c|ac|acct|account|no\.?|ending in)\s*(?:xx|XX|x|X|\*|-)?\s*(\d{4})\b/i,
    /\b(?:xx|XX|x|X|\*|-)(\d{4})\b/i,
    /\b(\d{4})\b/i,
  ]
  let detectedCardId: string | null = null
  for (const regex of cardRegexes) {
    const match = cleanText.match(regex)
    if (match && match[1]) {
      detectedCardId = match[1].toUpperCase()
      result.detectedIdentifier = detectedCardId
      break
    }
  }

  let finalMatchedAccount: Account | undefined = undefined

  // Map to account using smsIdentifier or last 4 digits
  if (detectedCardId) {
    const normalizedId = normalizeString(detectedCardId)
    // Find account
    finalMatchedAccount = accounts.find(acc => {
      if (acc.smsIdentifier) {
        return normalizeString(acc.smsIdentifier).includes(normalizedId) || 
               normalizedId.includes(normalizeString(acc.smsIdentifier))
      }
      // Fallback to name match (e.g. if name contains "4321")
      return normalizeString(acc.name).includes(normalizedId)
    })
    
    if (finalMatchedAccount) {
      result.accountId = finalMatchedAccount.id
    }
  }

  // If no account matched, fallback to the first active credit card or debit card
  if (!result.accountId && accounts.length > 0) {
    const activeAccounts = accounts.filter(a => a.isActive)
    if (activeAccounts.length > 0) {
      finalMatchedAccount = activeAccounts[0]
      result.accountId = finalMatchedAccount.id
    }
  }

  // 4. Merchant Extraction
  // Look for "at [Merchant]", "to [Merchant]", "towards [Merchant]", "payment to [Merchant]"
  const merchantRegexes = [
    /\bat\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
    /\bto\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
    /\btowards\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
    /\bpayment\s+to\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
  ]
  for (const regex of merchantRegexes) {
    const match = cleanText.match(regex)
    if (match && match[1]) {
      const merchant = match[1].trim()
      // Skip generic small words or numbers
      if (merchant.length > 2 && !/^\d+$/.test(merchant)) {
        result.merchant = merchant
        break
      }
    }
  }

  // 5. Available Balance
  const balRegexes = [
    /(?:avl bal|available balance|bal|avail lmt|bal\s+is)\s*(?:rs\.?:?|inr:?)?\s*([\d,]+(?:\.\d{2})?)/i,
  ]
  for (const regex of balRegexes) {
    const match = cleanText.match(regex)
    if (match && match[1]) {
      const bal = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(bal)) {
        result.availableBalance = bal
        break
      }
    }
  }

  // 6. Date & Time Extraction
  // Extract time if present (handles HH:MM:SS, HH:MM, HH:MM AM/PM)
  const timeRegex = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/i
  const timeMatch = cleanText.match(timeRegex)
  let parsedTime = '00:00:00'
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    const minute = timeMatch[2]
    const second = timeMatch[3] || '00'
    const ampm = timeMatch[4]
    
    if (ampm) {
      const ampmLower = ampm.toLowerCase()
      if (ampmLower === 'pm' && hour < 12) hour += 12
      if (ampmLower === 'am' && hour === 12) hour = 0
    }
    parsedTime = `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
  }

  // Matches DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
  const dateRegex = /\b(\d{4}-\d{2}-\d{2})|(\d{2}[-/]\d{2}[-/]\d{2,4})\b/
  const dateMatch = cleanText.match(dateRegex)

  // Matches DD-MMM-YYYY or DD-MMM-YY, e.g. 19-MAY-26, 19-May-2026, 19 MAY 26
  const alphaDateRegex = /\b(\d{1,2})[-/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s](\d{2,4})\b/i
  const alphaDateMatch = cleanText.match(alphaDateRegex)

  if (dateMatch) {
    const matchedDateStr = dateMatch[0]
    // Parse it and format to YYYY-MM-DD
    try {
      let parts: string[] = []
      if (matchedDateStr.includes('-')) parts = matchedDateStr.split('-')
      if (matchedDateStr.includes('/')) parts = matchedDateStr.split('/')
      
      if (parts.length === 3) {
        let year = ''
        let month = ''
        let day = ''

        if (parts[0].length === 4) {
          // YYYY-MM-DD
          year = parts[0]
          month = parts[1]
          day = parts[2]
        } else {
          // DD-MM-YYYY or DD-MM-YY
          day = parts[0]
          month = parts[1]
          year = parts[2]
          if (year.length === 2) year = '20' + year
        }
        
        // Ensure padded
        month = month.padStart(2, '0')
        day = day.padStart(2, '0')
        
        const dateObj = new Date(`${year}-${month}-${day}T${parsedTime}`)
        if (!isNaN(dateObj.getTime())) {
          result.date = `${year}-${month}-${day}`
          result.parsedTimestamp = dateObj.getTime()
        }
      }
    } catch (e) {
      // Keep default
    }
  } else if (alphaDateMatch) {
    try {
      const day = alphaDateMatch[1].padStart(2, '0')
      const monthStr = alphaDateMatch[2].substring(0, 3).toLowerCase()
      let year = alphaDateMatch[3]
      if (year.length === 2) year = '20' + year

      const monthsMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      }
      const month = monthsMap[monthStr] || '01'
      const dateObj = new Date(`${year}-${month}-${day}T${parsedTime}`)
      if (!isNaN(dateObj.getTime())) {
        result.date = `${year}-${month}-${day}`
        result.parsedTimestamp = dateObj.getTime()
      }
    } catch (e) {
      // Keep default
    }
  }

  // 7. Merchant Memory Lookup & Auto-Suggest
  if (result.direction === 'credit') {
    result.merchant = 'Credit / Deposit'
    result.suggestedCategory = 'other'
    result.suggestedFundingSource = undefined
    result.confidence = 1.0
  } else if (result.merchant) {
    const normMerchant = result.merchant.trim().toLowerCase()
    const memory = merchantMemory[normMerchant]
    if (memory) {
      result.suggestedCategory = memory.category
      result.suggestedFundingSource = memory.fundingSource as FundingSource | undefined
      result.confidence = memory.confidenceScore ?? 0.9
    } else {
      // Guess category based on keywords
      const guessed = guessCategoryByKeywords(result.merchant)
      result.suggestedCategory = guessed.category
      result.suggestedFundingSource = guessed.fundingSource
      result.confidence = 0.7
    }
  } else {
    result.suggestedCategory = 'other'
    result.suggestedFundingSource = 'base'
  }

  // 6. Reference Number / UPI Ref No / Transaction ID extraction
  const refRegexes = [
    /(?:mob bk ref no|ref no|upi ref no|ref|transaction id|txn id|ref\s*no\.?|reference|txn)\s*([a-zA-Z0-9]{8,16})\b/i,
  ]
  for (const regex of refRegexes) {
    const match = cleanText.match(regex)
    if (match && match[1]) {
      result.referenceNumber = match[1]
      break
    }
  }

  // Override suggested funding source based on the matched account
  const isSbiCreditCard = finalMatchedAccount?.name.toLowerCase().includes('sbi') && finalMatchedAccount?.type === 'credit'
  if (result.direction !== 'credit') {
    if (finalMatchedAccount?.isExtra || isSbiCreditCard) {
      result.suggestedFundingSource = 'extra'
    } else {
      result.suggestedFundingSource = 'base'
    }
  }

  return result
}

/**
 * Simple keyword-based category guesser
 */
function guessCategoryByKeywords(merchant: string): { category: string; fundingSource: FundingSource } {
  const norm = merchant.toLowerCase()
  
  if (/(?:swiggy|zomato|ubereats|food|restaurant|dine|cafe|starbucks|pizza|burger|canteen|vk|bakery|eats)/.test(norm)) {
    return { category: 'food', fundingSource: 'base' }
  }
  if (/(?:uber|ola|cab|auto|metro|irctc|railway|train|flight|indigo|airindia|rapido)/.test(norm)) {
    return { category: 'transport', fundingSource: 'base' }
  }
  if (/(?:fuel|petrol|shell|hpcl|bpcl|iocl|cng|gasoline)/.test(norm)) {
    return { category: 'fuel', fundingSource: 'base' }
  }
  if (/(?:amazon|flipkart|myntra|zara|h&m|decathlon|nike|adidas|shopping|mall|trends|retail)/.test(norm)) {
    return { category: 'shopping', fundingSource: 'extra' }
  }
  if (/(?:netflix|spotify|youtube|hotstar|amazonprime|disney)/.test(norm)) {
    return { category: 'subscriptions', fundingSource: 'base' }
  }
  if (/(?:ticketnew|bookmyshow|movie|cinema|fun|multiplex|outing|club|pub|bar|party|gaming|arcade|bowling|park|makemytrip|goibibo|hotel|stay|resort|airbnb|travel|tour)/.test(norm)) {
    return { category: 'outing', fundingSource: 'extra' }
  }
  if (/(?:blinkit|zepto|instamart|grocery|mart|reliance|bigbasket|vegetable|fruit|dairy)/.test(norm)) {
    return { category: 'groceries', fundingSource: 'base' }
  }
  if (/(?:bescom|airtel|jio|vi|broadband|utility|water|electricity|gas|bill|recharge)/.test(norm)) {
    return { category: 'bills', fundingSource: 'base' }
  }
  if (/(?:coursera|udemy|college|tuition|books|exam|stationery|xerox)/.test(norm)) {
    return { category: 'education', fundingSource: 'base' }
  }
  if (/(?:apollo|pharmacy|hospital|doctor|clinic|medplus|medical|health)/.test(norm)) {
    return { category: 'health', fundingSource: 'base' }
  }
  if (/(?:trek|camp|mountain|adventure|climb|hiking|forest|wildlife|gear)/.test(norm)) {
    return { category: 'trek', fundingSource: 'base' }
  }

  return { category: 'other', fundingSource: 'base' }
}

/**
 * Checks if a raw SMS message text represents a valid bank transaction notification.
 * Filters out spam/delivery/non-transaction messages.
 */
export function isValidTransactionSms(text: string): boolean {
  if (!text) return false
  
  // 1. Must contain rupee/currency keywords
  const hasRupee = /(?:rs\.?:?|inr:?|amt:?|rs\s*:|₹|rupees?|amounted)/i.test(text)
  
  // 2. Must contain account or card identifiers (masked pattern, "card", "a/c", "acct", "ending", "no")
  const hasAccount = /(?:a\/c|ac|acct|account|card|ending|no\.?|\bxx\d{4}\b|\b\*\d{4}\b|\b\d{4}\b)/i.test(text)
  
  return hasRupee && hasAccount
}
