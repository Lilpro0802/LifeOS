import Tesseract from 'tesseract.js'
import type { Account } from './types'

export interface ParsedOcrResult {
  merchant: string | null
  amount: number | null
  date: string | null
  parsedTimestamp?: number | null
  accountId: string | null
  rawText: string
  confidence: number
  referenceNumber?: string | null
}

/**
 * Parses OCR text from a typical UPI/GPay screenshot.
 */
export function parseOcrText(text: string, accounts: Account[]): ParsedOcrResult {
  const result: ParsedOcrResult = {
    merchant: null,
    amount: null,
    date: null,
    accountId: null,
    rawText: text,
    confidence: 0,
    referenceNumber: null,
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // 1. Extract Amount
  // Often shown as "₹5" or "₹ 5.00" or "Rs. 5" on a line by itself
  for (const line of lines) {
    const amtMatch = line.match(/^(?:₹|rs\.?|inr|z|f|\?|-|~)?\s*([\d,]+(?:\.\d{2})?)\s*(?:\/-)?$/i)
    if (amtMatch && amtMatch[1]) {
      const cleanStr = amtMatch[1].replace(/,/g, '')
      const parsedAmt = parseFloat(cleanStr)
      // Ignore if it's likely a year (4 digits starting with 20) or a Transaction ID (8+ digits)
      const isYear = parsedAmt >= 2000 && parsedAmt <= 2050 && !line.includes('.')
      const isId = cleanStr.match(/^\d{8,}$/) !== null && !line.includes('.')
      
      if (!isNaN(parsedAmt) && result.amount === null && !isYear && !isId) {
        result.amount = parsedAmt
        break
      }
    }
  }

  // Fallback amount regex if it wasn't on its own line
  if (result.amount === null) {
    for (const line of lines) {
      const amtMatch = line.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{2})?)/i)
      if (amtMatch && amtMatch[1]) {
        const cleanStr = amtMatch[1].replace(/,/g, '')
        const parsedAmt = parseFloat(cleanStr)
        const isId = cleanStr.match(/^\d{8,}$/) !== null && !line.includes('.')
        
        if (!isNaN(parsedAmt) && result.amount === null && !isId) {
          result.amount = parsedAmt
          break
        }
      }
    }
  }

  // 2. Extract Merchant
  // Look for "To [Merchant]" or "Paid to [Merchant]"
  for (const line of lines) {
    const toMatch = line.match(/^(?:To|Paid to)\s+(.+)$/i)
    if (toMatch && toMatch[1]) {
      const merchant = toMatch[1].trim()
      // Skip if it looks like an ID/UPI string instead of a name
      if (merchant.length > 2 && !merchant.includes('@')) {
        result.merchant = merchant
      }
    }
  }

  // Fallback merchant logic: often the first or second line if it doesn't match common stop words
  if (!result.merchant) {
    const stopWords = [
      'pay again', 'completed', 'successful', 'failed', 'processing', 'upi',
      'google pay', 'payment details', 'transaction details', 'to', 'paid to',
      'from', 'received from', 'payment from', 'success'
    ]
    for (const line of lines) {
      if (
        line.length > 2 && 
        !line.match(/₹|rs|inr|\d/i) && 
        !stopWords.some(sw => line.toLowerCase().includes(sw))
      ) {
        result.merchant = line
        break
      }
    }
  }

  // 3. Extract Date & Time
  // e.g. "9 May 2026, 9:53 am" or "May 19, 2026, 9:33 PM" or "09-05-2026"
  let parsedTime = '00:00:00'
  
  // Look for time in any line, e.g. 9:53 am, 9:33 PM, 18:50:04
  for (const line of lines) {
    const timeMatch = line.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/i)
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
      break
    }
  }

  for (const line of lines) {
    // 9 May 2026
    const dateMatch = line.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i)
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0')
      const monthStr = dateMatch[2].substring(0, 3).toLowerCase()
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      }
      const month = months[monthStr] || '01'
      const year = dateMatch[3]
      result.date = `${year}-${month}-${day}`
      break
    }
    
    // May 19, 2026
    const monthDayYearMatch = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i)
    if (monthDayYearMatch) {
      const monthStr = monthDayYearMatch[1].substring(0, 3).toLowerCase()
      const day = monthDayYearMatch[2].padStart(2, '0')
      const year = monthDayYearMatch[3]
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      }
      const month = months[monthStr] || '01'
      result.date = `${year}-${month}-${day}`
      break
    }
    
    // YYYY-MM-DD or DD-MM-YYYY
    const numericDateMatch = line.match(/\b(\d{2,4})[-/](\d{2})[-/](\d{2,4})\b/)
    if (numericDateMatch) {
      const parts = numericDateMatch[0].split(/[-/]/)
      if (parts[0].length === 4) {
        result.date = `${parts[0]}-${parts[1]}-${parts[2]}`
      } else {
        let y = parts[2]
        if (y.length === 2) y = '20' + y
        result.date = `${y}-${parts[1]}-${parts[0]}`
      }
      break
    }
  }

  // If we found a date, build the full timestamp
  if (result.date) {
    const dt = new Date(`${result.date}T${parsedTime}`)
    if (!isNaN(dt.getTime())) {
      result.parsedTimestamp = dt.getTime()
    }
  }

  // 4. Extract Account / Card clues (preventing reference IDs)
  for (const line of lines) {
    if (/transaction id|ref no|ref\b/i.test(line)) continue
    const accMatch = line.match(/\b(\d{4})\b/)
    if (accMatch) {
      const last4 = accMatch[1]
      const matchedAccount = accounts.find(a => a.smsIdentifier?.includes(last4) || a.name.includes(last4))
      if (matchedAccount) {
        result.accountId = matchedAccount.id
        break
      }
    }
  }

  // 5. Extract Reference Number / UPI Transaction ID
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/upi\s*transaction\s*id/i.test(line)) {
      const sameLineMatch = line.match(/(?:upi\s*transaction\s*id)\s*:?\s*(\d{10,16})\b/i)
      if (sameLineMatch) {
        result.referenceNumber = sameLineMatch[1]
        break
      }
      if (i + 1 < lines.length) {
        const nextLineMatch = lines[i + 1].match(/^\s*(\d{10,16})\b/)
        if (nextLineMatch) {
          result.referenceNumber = nextLineMatch[1]
          break
        }
      }
    }
  }

  // Fallback: search for any 12-digit number in the OCR lines that isn't already used
  if (!result.referenceNumber) {
    for (const line of lines) {
      const match = line.match(/\b(\d{12})\b/)
      if (match) {
        result.referenceNumber = match[1]
        break
      }
    }
  }

  // Calculate a basic confidence score based on how many fields we found
  let score = 0
  if (result.amount !== null) score += 0.4
  if (result.merchant !== null) score += 0.3
  if (result.date !== null) score += 0.15
  if (result.accountId !== null) score += 0.1
  if (result.referenceNumber !== null) score += 0.05
  result.confidence = score

  return result
}

export async function extractScreenshotData(imageFile: File, accounts: Account[]): Promise<ParsedOcrResult> {
  const worker = await Tesseract.createWorker('eng')
  const ret = await worker.recognize(imageFile)
  await worker.terminate()
  
  return parseOcrText(ret.data.text, accounts)
}
