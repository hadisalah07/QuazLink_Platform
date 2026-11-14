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
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_PAIRING_CODE = "pairing_code"
        private const val KEY_PAIRING_SECRET = "pairing_secret"
        private const val KEY_HA_DOMAIN = "ha_domain"

        // Default to production QuazLink Cloud Hub
        const val DEFAULT_CLOUD_URL = "https://api.quazlink.site"
        // Default trigger keycode (TV blue button = 134)
        private const val DEFAULT_KEY = 134 
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
        get() = prefs.getInt(KEY_TRIGGER_KEY, DEFAULT_KEY)
        set(value) = prefs.edit().putInt(KEY_TRIGGER_KEY, value).apply()

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
