const sms = `Dear Customer,
Rs. 1099 was spent on your Credit Card ending 2683 at AMAZON INDIA on 19-MAY-26 18:50:04. Available Limit is 74163.34. Not you? Call 18002333 or email:
cyber.incidents@unionbankofindia.bank.in
-Union Bank of India`;

const cleanText = sms.replace(/[\n\r]/g, ' ');

// 1. Amount
const amountRegexes = [
  /(?:rs\.?:?|inr:?|amt:?|rs\s*:)\s*([\d,]+(?:\.\d{2})?)/i,
  /(?:spent|debited|credited|amounted to|for)\s*(?:rs\.?:?|inr:?|amt:?|rs\s*:)??\s*([\d,]+(?:\.\d{2})?)/i,
];
let amount = null;
for (const regex of amountRegexes) {
  const match = cleanText.match(regex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
    break;
  }
}

// 2. Direction
let direction = 'debit';
const creditRegex = /\b(?:credited|received|refund|refunded|added|deposited)\b/i;
const creditAltRegex = /\bcredit(?!(\s+)?card)\b/i;
const isCredit1 = creditRegex.test(cleanText);
const isCredit2 = creditAltRegex.test(cleanText);
if (isCredit1 || isCredit2) {
  direction = 'credit';
}

// 3. Merchant
const merchantRegexes = [
  /\bat\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
  /\bto\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\busing\b|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
  /\btowards\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
  /\bpayment\s+to\s+([A-Za-z0-9\s&.\-_]+?)(?:\s+on|\s+at|\s+by|\.|\s+Info|\s+avl|\s+ref|\s+upi)/i,
];
let merchant = null;
for (const regex of merchantRegexes) {
  const match = cleanText.match(regex);
  if (match && match[1]) {
    merchant = match[1].trim();
    break;
  }
}

console.log('Result:', {
  amount,
  direction,
  isCredit1,
  isCredit2,
  merchant
});
