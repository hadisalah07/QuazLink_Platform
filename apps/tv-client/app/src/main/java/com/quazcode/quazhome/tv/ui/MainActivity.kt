package com.quazcode.quazhome.tv.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.overlay.OverlayManager

class MainActivity : AppCompatActivity() {

    private lateinit var etGatewayUrl: EditText
    private lateinit var btnTestOverlay: Button
    private lateinit var btnOpenAccessibility: Button
    private lateinit var tvStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        etGatewayUrl = findViewById(R.id.etGatewayUrl)
        btnTestOverlay = findViewById(R.id.btnTestOverlay)
        btnOpenAccessibility = findViewById(R.id.btnOpenAccessibility)
        tvStatus = findViewById(R.id.tvStatus)

        // Load saved gateway URL
        etGatewayUrl.setText(QuazHomeApp.instance.gatewayUrl)

        // Save URL on focus change
        etGatewayUrl.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                saveGatewayUrl()
            }
        }

        // Test Overlay button
        btnTestOverlay.setOnClickListener {
            saveGatewayUrl()
            checkOverlayPermissionAndShow()
        }

        // Open Accessibility settings button
        btnOpenAccessibility.setOnClickListener {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
            Toast.makeText(this, "ابحث عن 'QuazHome TV' وفعّل الخدمة", Toast.LENGTH_LONG).show()
        }
    }

    private fun saveGatewayUrl() {
        val url = etGatewayUrl.text.toString().trim()
        if (url.isNotEmpty()) {
            QuazHomeApp.instance.gatewayUrl = url
            tvStatus.text = "تم حفظ السيرفر: $url"
        }
    }

    private fun checkOverlayPermissionAndShow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
            Toast.makeText(this, "يرجى السماح بالظهور فوق التطبيقات", Toast.LENGTH_LONG).show()
        } else {
            OverlayManager.toggle(this)
        }
    }

    /**
     * Remote Key Learning Feature:
     * While in the settings screen, pressing any remote button will show its KeyCode and set it as trigger!
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Ignore navigation keys inside settings
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            keyCode == KeyEvent.KEYCODE_BACK
        ) {
            return super.onKeyDown(keyCode, event)
        }

        // Save custom remote button
        QuazHomeApp.instance.triggerKeyCode = keyCode
        tvStatus.text = "✨ تم تعيين زرار الريموت بنجاح! (KeyCode: $keyCode)"
        Toast.makeText(this, "تم حفظ هذا الزرار لفتح القائمة في أي وقت!", Toast.LENGTH_SHORT).show()
        return true
    }
}
