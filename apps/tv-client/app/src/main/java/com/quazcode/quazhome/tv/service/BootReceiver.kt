package com.quazcode.quazhome.tv.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver {
    constructor() : super()

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i("QuazHomeBoot", "Android TV rebooted - QuazHome registered and ready.")
        }
    }
}
