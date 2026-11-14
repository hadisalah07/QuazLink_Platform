package com.quazcode.quazhome.tv

import android.app.Application
import android.content.Context
import android.content.SharedPreferences

class QuazHomeApp : Application() {

    companion object {
        lateinit var instance: QuazHomeApp
            private set

        private const val PREFS_NAME = "quazhome_prefs"
        private const val KEY_GATEWAY_URL = "gateway_url"
        private const val KEY_TRIGGER_KEY = "trigger_keycode"

        // Default to localhost or fallback LAN IP
        private const val DEFAULT_URL = "http://192.168.1.2:3001"
        // Default trigger keycode (can be changed in settings)
        // 134 = KEYCODE_PROG_BLUE (TV blue button) or 82 = KEYCODE_MENU or 164 = KEYCODE_VOLUME_MUTE
        private const val DEFAULT_KEY = 134 
    }

    private lateinit var prefs: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    var gatewayUrl: String
        get() = prefs.getString(KEY_GATEWAY_URL, DEFAULT_URL) ?: DEFAULT_URL
        set(value) = prefs.edit().putString(KEY_GATEWAY_URL, value).apply()

    var triggerKeyCode: Int
        get() = prefs.getInt(KEY_TRIGGER_KEY, DEFAULT_KEY)
        set(value) = prefs.edit().putInt(KEY_TRIGGER_KEY, value).apply()
}
