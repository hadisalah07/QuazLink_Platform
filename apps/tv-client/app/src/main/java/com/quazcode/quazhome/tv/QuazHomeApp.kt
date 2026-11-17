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
        private const val KEY_TRIGGER_KEY_NAME = "trigger_key_name"
        private const val KEY_TRIGGER_MODE = "trigger_mode"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_PAIRING_CODE = "pairing_code"
        private const val KEY_PAIRING_SECRET = "pairing_secret"
        private const val KEY_HA_DOMAIN = "ha_domain"

        // Default to production QuazLink Cloud Hub
        const val DEFAULT_CLOUD_URL = "https://api.quazlink.site"
        // Default trigger keycode (TV blue button = 134)
        const val DEFAULT_KEY = 134
        const val DEFAULT_KEY_NAME = "الزر الأزرق (Blue Key - 134)"

        // Trigger Modes
        const val MODE_SINGLE = "single"
        const val MODE_LONG_PRESS = "long_press"
        const val MODE_DOUBLE_PRESS = "double_press"

        // System & Navigation Keys that MUST NEVER be intercepted
        val FORBIDDEN_KEYS = setOf(
            23,  // KEYCODE_DPAD_CENTER
            66,  // KEYCODE_ENTER
            160, // KEYCODE_NUMPAD_ENTER
            19,  // KEYCODE_DPAD_UP
            20,  // KEYCODE_DPAD_DOWN
            21,  // KEYCODE_DPAD_LEFT
            22,  // KEYCODE_DPAD_RIGHT
            4,   // KEYCODE_BACK
            3,   // KEYCODE_HOME
            24,  // KEYCODE_VOLUME_UP
            25,  // KEYCODE_VOLUME_DOWN
            164, // KEYCODE_VOLUME_MUTE
            26   // KEYCODE_POWER
        )

        fun isForbiddenKey(keyCode: Int): Boolean = FORBIDDEN_KEYS.contains(keyCode)
    }

    private lateinit var prefs: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    var gatewayUrl: String
        get() = prefs.getString(KEY_GATEWAY_URL, DEFAULT_CLOUD_URL) ?: DEFAULT_CLOUD_URL
        set(value) = prefs.edit().putString(KEY_GATEWAY_URL, value).apply()

    var triggerKeyCode: Int
        get() {
            val key = prefs.getInt(KEY_TRIGGER_KEY, DEFAULT_KEY)
            return if (isForbiddenKey(key)) DEFAULT_KEY else key
        }
        set(value) {
            val safeValue = if (isForbiddenKey(value)) DEFAULT_KEY else value
            prefs.edit().putInt(KEY_TRIGGER_KEY, safeValue).apply()
        }

    var triggerKeyName: String
        get() {
            val key = prefs.getInt(KEY_TRIGGER_KEY, DEFAULT_KEY)
            return if (isForbiddenKey(key)) DEFAULT_KEY_NAME else prefs.getString(KEY_TRIGGER_KEY_NAME, DEFAULT_KEY_NAME) ?: DEFAULT_KEY_NAME
        }
        set(value) = prefs.edit().putString(KEY_TRIGGER_KEY_NAME, value).apply()

    var triggerMode: String
        get() = prefs.getString(KEY_TRIGGER_MODE, MODE_SINGLE) ?: MODE_SINGLE
        set(value) = prefs.edit().putString(KEY_TRIGGER_MODE, value).apply()

    var deviceToken: String
        get() = prefs.getString(KEY_DEVICE_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DEVICE_TOKEN, value).apply()

    var pairingCode: String
        get() = prefs.getString(KEY_PAIRING_CODE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PAIRING_CODE, value).apply()

    var pairingSecret: String
        get() = prefs.getString(KEY_PAIRING_SECRET, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PAIRING_SECRET, value).apply()

    var haDomain: String
        get() = prefs.getString(KEY_HA_DOMAIN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_HA_DOMAIN, value).apply()

    val isPaired: Boolean
        get() = deviceToken.isNotEmpty()

    fun resetPairing() {
        prefs.edit()
            .remove(KEY_DEVICE_TOKEN)
            .remove(KEY_PAIRING_CODE)
            .remove(KEY_PAIRING_SECRET)
            .remove(KEY_HA_DOMAIN)
            .apply()
    }
}
