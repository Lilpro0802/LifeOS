package com.example.lifeos

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class AndroidSmsBridge(private val context: Context) {

    @JavascriptInterface
    fun getPendingSms(): String {
        try {
            val prefs = context.getSharedPreferences("LifeOS_Prefs", Context.MODE_PRIVATE)
            val queueJson = prefs.getString("pending_sms_queue", "[]")
            Log.d("LifeOS_Bridge", "Frontend requested pending SMS queue. Size: $queueJson")
            return queueJson ?: "[]"
        } catch (e: Exception) {
            Log.e("LifeOS_Bridge", "Error reading pending SMS queue", e)
            return "[]"
        }
    }

    @JavascriptInterface
    fun clearPendingSms(idsJson: String) {
        try {
            val gson = Gson()
            val idsToClear: List<String> = gson.fromJson(idsJson, object : TypeToken<List<String>>() {}.type) ?: emptyList()
            if (idsToClear.isEmpty()) return

            val prefs = context.getSharedPreferences("LifeOS_Prefs", Context.MODE_PRIVATE)
            val currentQueueJson = prefs.getString("pending_sms_queue", "[]")
            val type = object : TypeToken<ArrayList<SmsMessageData>>() {}.type
            val currentQueue: ArrayList<SmsMessageData> = gson.fromJson(currentQueueJson, type) ?: ArrayList()

            // Filter out processed IDs
            val updatedQueue = currentQueue.filter { sms -> !idsToClear.contains(sms.id) }

            prefs.edit().putString("pending_sms_queue", gson.toJson(updatedQueue)).apply()
            Log.d("LifeOS_Bridge", "Cleared processed messages from native queue. Cleared: ${idsToClear.size}, Remaining: ${updatedQueue.size}")
        } catch (e: Exception) {
            Log.e("LifeOS_Bridge", "Error clearing pending SMS queue", e)
        }
    }

    @JavascriptInterface
    fun showToast(msg: String) {
        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
    }
}
