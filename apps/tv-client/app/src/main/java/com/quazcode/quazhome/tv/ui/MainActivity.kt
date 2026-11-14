package com.quazcode.quazhome.tv.ui

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.data.model.UpdateCheckResponse
import com.quazcode.quazhome.tv.data.repository.DeviceRepository
import com.quazcode.quazhome.tv.overlay.OverlayManager
import com.quazcode.quazhome.tv.updater.AppUpdater
import com.quazcode.quazhome.tv.util.QrCodeGenerator
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private val repository = DeviceRepository()
    private var pairingJob: Job? = null

    private lateinit var ivQrCode: ImageView
    private lateinit var pbQrLoading: ProgressBar
    private lateinit var tvPairingCode: TextView
    private lateinit var tvPairingStatus: TextView
    private lateinit var btnTestOverlay: Button
    private lateinit var btnOpenAccessibility: Button
    private lateinit var btnResetPairing: Button

    // OTA Update UI elements
    private lateinit var cardUpdateAvailable: LinearLayout
    private lateinit var tvUpdateTitle: TextView
    private lateinit var btnUpdateNow: Button
    private lateinit var pbUpdateDownload: ProgressBar

    private var activeUpdate: UpdateCheckResponse? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        setupListeners()

        // 1. Check if TV is already paired or start pairing session
        if (QuazHomeApp.instance.isPaired) {
            showPairedState()
        } else {
            startPairingSession()
        }

        // 2. Check for OTA in-app updates in the background
        checkForUpdates()
    }

    private fun initViews() {
        ivQrCode = findViewById(R.id.ivQrCode)
        pbQrLoading = findViewById(R.id.pbQrLoading)
        tvPairingCode = findViewById(R.id.tvPairingCode)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)
        btnTestOverlay = findViewById(R.id.btnTestOverlay)
        btnOpenAccessibility = findViewById(R.id.btnOpenAccessibility)
        btnResetPairing = findViewById(R.id.btnResetPairing)

        cardUpdateAvailable = findViewById(R.id.cardUpdateAvailable)
        tvUpdateTitle = findViewById(R.id.tvUpdateTitle)
        btnUpdateNow = findViewById(R.id.btnUpdateNow)
        pbUpdateDownload = findViewById(R.id.pbUpdateDownload)
    }

    private fun setupListeners() {
        btnTestOverlay.setOnClickListener {
            checkOverlayPermissionAndShow()
        }

        btnOpenAccessibility.setOnClickListener {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
            Toast.makeText(this, "ابحث عن 'QuazHome TV' وفعّل الخدمة", Toast.LENGTH_LONG).show()
        }

        btnResetPairing.setOnClickListener {
            QuazHomeApp.instance.resetPairing()
            startPairingSession()
            Toast.makeText(this, "تم إعادة تعيين جلسة الاقتران", Toast.LENGTH_SHORT).show()
        }

        btnUpdateNow.setOnClickListener {
            val update = activeUpdate ?: return@setOnClickListener
            triggerOtaUpdate(update.downloadUrl)
        }
    }

    private fun startPairingSession() {
        pairingJob?.cancel()
        pbQrLoading.visibility = View.VISIBLE
        ivQrCode.setImageBitmap(null)
        tvPairingStatus.text = "الحالة: جاري إنشاء جلسة اقتران آمنة..."
        tvPairingStatus.setTextColor(Color.parseColor("#FBBF24"))

        pairingJob = lifecycleScope.launch {
            val result = repository.initPairing()
            result.onSuccess { session ->
                pbQrLoading.visibility = View.GONE
                tvPairingCode.text = session.code
                QuazHomeApp.instance.pairingCode = session.code
                QuazHomeApp.instance.pairingSecret = session.secret

                // Render high-contrast QR code
                val bitmap = QrCodeGenerator.generateQrBitmap(session.qrUrl, 400, 400)
                if (bitmap != null) {
                    ivQrCode.setImageBitmap(bitmap)
                }

                tvPairingStatus.text = "الحالة: في انتظار المسح من الموبايل..."
                tvPairingStatus.setTextColor(Color.parseColor("#FBBF24"))

                // Poll pairing status every 3 seconds
                pollPairingStatus(session.code, session.secret)
            }.onFailure { err ->
                pbQrLoading.visibility = View.GONE
                tvPairingStatus.text = "تعذر الاتصال بالسيرفر. تحقق من الإنترنت."
                tvPairingStatus.setTextColor(Color.parseColor("#EF4444"))
            }
        }
    }

    private fun pollPairingStatus(code: String, secret: String) {
        lifecycleScope.launch {
            while (isActive && !QuazHomeApp.instance.isPaired) {
                delay(3000)
                val statusResult = repository.getPairStatus(code, secret)
                statusResult.onSuccess { res ->
                    if (res.status == "paired" && !res.deviceToken.isNullOrEmpty()) {
                        QuazHomeApp.instance.deviceToken = res.deviceToken
                        if (!res.haUrl.isNullOrEmpty()) {
                            QuazHomeApp.instance.haDomain = res.haUrl
                        }
                        showPairedState()
                        Toast.makeText(this@MainActivity, "✨ تم ربط التلفزيون بـ Home Assistant بنجاح!", Toast.LENGTH_LONG).show()
                        return@launch
                    } else if (res.status == "expired") {
                        tvPairingStatus.text = "انتهت صلاحية الرمز. اضغط إعادة توليد."
                        tvPairingStatus.setTextColor(Color.parseColor("#EF4444"))
                        return@launch
                    }
                }
            }
        }
    }

    private fun showPairedState() {
        pbQrLoading.visibility = View.GONE
        tvPairingCode.text = "ONLINE"
        val domain = QuazHomeApp.instance.haDomain.ifEmpty { "Home Assistant" }
        tvPairingStatus.text = "الحالة: متصل بـ $domain بنجاح ✨"
        tvPairingStatus.setTextColor(Color.parseColor("#10B981"))
        btnResetPairing.text = "إعادة الاقتران مع سيرفر جديد (Re-pair)"

        // Generate success QR pointing to web portal
        val portalUrl = "https://app.quazlink.site/tv"
        val qrBmp = QrCodeGenerator.generateQrBitmap(portalUrl, 400, 400)
        ivQrCode.setImageBitmap(qrBmp)
    }

    private fun checkForUpdates() {
        lifecycleScope.launch {
            val currentVersion = "1.0.2"
            val update = AppUpdater.checkForUpdate(currentVersion)
            if (update != null && update.hasUpdate) {
                activeUpdate = update
                cardUpdateAvailable.visibility = View.VISIBLE
                tvUpdateTitle.text = "🚀 يتوفر تحديث جديد (${update.latestVersion})! اضغط للتحديث الفوري"
            }
        }
    }

    private fun triggerOtaUpdate(downloadUrl: String) {
        btnUpdateNow.isEnabled = false
        btnUpdateNow.text = "جاري التنزيل..."
        pbUpdateDownload.visibility = View.VISIBLE
        pbUpdateDownload.progress = 0

        lifecycleScope.launch {
            val apkFile = AppUpdater.downloadApk(this@MainActivity, downloadUrl) { progress ->
                pbUpdateDownload.progress = progress
            }

            if (apkFile != null && apkFile.exists()) {
                btnUpdateNow.text = "تثبيت الآن..."
                AppUpdater.installApk(this@MainActivity, apkFile)
            } else {
                btnUpdateNow.isEnabled = true
                btnUpdateNow.text = "فشل التنزيل - إعادة المحاولة"
                Toast.makeText(this@MainActivity, "فشل تنزيل ملف التحديث", Toast.LENGTH_SHORT).show()
            }
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
        Toast.makeText(this, "تم تعيين زرار الريموت (KeyCode: $keyCode) لفتح القائمة في أي وقت!", Toast.LENGTH_SHORT).show()
        return true
    }

    override fun onDestroy() {
        super.onDestroy()
        pairingJob?.cancel()
    }
}
