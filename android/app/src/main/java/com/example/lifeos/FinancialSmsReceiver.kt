package com.example.lifeos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

data class SmsMessageData(
    val id: String,
    val sender: String,
    val body: String,
    val timestamp: Long
)

class FinancialSmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val sender = sms.displayOriginatingAddress ?: "Unknown"
                val body = sms.messageBody ?: continue
                val timestamp = sms.timestampMillis

                Log.d("LifeOS_SMS", "Received SMS from $sender: $body")

                if (isFinancialSms(sender, body)) {
                    Log.d("LifeOS_SMS", "SMS matches financial pre-filters. Queueing...")
                    
                    // 1. Save to SharedPreferences queue
                    val savedMessage = SmsMessageData(
                        id = UUID.randomUUID().toString(),
                        sender = sender,
                        body = body,
                        timestamp = timestamp
                    )
                    queueSmsMessage(context, savedMessage)

                    // 2. Notify Foreground Activity if active
                    MainActivity.instance?.runOnUiThread {
                        MainActivity.instance?.notifySmsReceived()
                    }

                    // 3. Post a non-intrusive local notification
                    showTransactionNotification(context, body)
                } else {
                    Log.d("LifeOS_SMS", "SMS discarded: Non-financial or spam.")
                }
            }
        } catch (e: Exception) {
            Log.e("LifeOS_SMS", "Error processing received SMS", e)
        }
    }

    private fun isFinancialSms(sender: String, body: String): Boolean {
        val cleanBody = body.lowercase()

        // 1. Reject Spam/OTPs/Logins
        val spamKeywords = listOf(
            "otp", "verification code", "one time password", "login alert", 
            "secure code", "promo", "discount", "offer inside", 
            "cashback of up to", "recharge of", "recharge successful"
        )
        for (keyword in spamKeywords) {
            if (cleanBody.contains(keyword)) {
                return false
            }
        }

        // 2. Core financial transaction keywords
        val txnKeywords = listOf(
            "debited", "credited", "spent", "txn", "transacted", 
            "paid", "received", "withdrawn", "payment", "upi", "vpa", "avl bal"
        )
        var hasTxnKeyword = false
        for (kw in txnKeywords) {
            if (cleanBody.contains(kw)) {
                hasTxnKeyword = true
                break
            }
        }

        // 3. Currency symbols
        val hasCurrency = cleanBody.contains("rs") || cleanBody.contains("inr") || cleanBody.contains("₹")

        // 4. Account indicators
        val hasAccount = (
            cleanBody.contains("a/c") || 
            cleanBody.contains("ac") || 
            cleanBody.contains("acct") || 
            cleanBody.contains("account") || 
            cleanBody.contains("card") || 
            cleanBody.contains("ending") ||
            cleanBody.contains("no.") ||
            cleanBody.contains("no ") ||
            cleanBody.contains("xx") ||
            cleanBody.contains("a/c ")
        )

        return (hasTxnKeyword && hasCurrency) || (hasCurrency && hasAccount)
    }

    private fun queueSmsMessage(context: Context, sms: SmsMessageData) {
        val prefs = context.getSharedPreferences("LifeOS_Prefs", Context.MODE_PRIVATE)
        val gson = Gson()
        
        val currentQueueJson = prefs.getString("pending_sms_queue", "[]")
        val type = object : TypeToken<ArrayList<SmsMessageData>>() {}.type
        val queue: ArrayList<SmsMessageData> = gson.fromJson(currentQueueJson, type) ?: ArrayList()
        
        queue.add(sms)
        
        prefs.edit().putString("pending_sms_queue", gson.toJson(queue)).apply()
        Log.d("LifeOS_SMS", "Successfully queued message. Current queue size: ${queue.size}")
    }

    private fun showTransactionNotification(context: Context, body: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "lifeos_tx_alerts"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Transaction Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifies you when new financial transactions are ready for review."
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Try to extract amount for brief notification summary
        val amountRegex = "(?:rs\\.?|inr|₹)\\s*([\\d,]+(?:\\.\\d{2})?)".toRegex(RegexOption.IGNORE_CASE)
        val match = amountRegex.find(body)
        val amountStr = match?.groupValues?.get(1) ?: ""
        
        val contentTitle = if (amountStr.isNotEmpty()) {
            "New alert of Rs. $amountStr ready for review"
        } else {
            "New transaction ready for review"
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // System standard fallback icon
            .setContentTitle(contentTitle)
            .setContentText("Tap to finalize and categorize this transaction.")
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
