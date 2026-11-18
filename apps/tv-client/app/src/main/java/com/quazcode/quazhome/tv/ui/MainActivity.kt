package com.quazcode.quazhome.tv.ui

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.data.model.DeviceItem
import com.quazcode.quazhome.tv.data.model.UpdateCheckResponse
import com.quazcode.quazhome.tv.data.repository.DeviceRepository
import com.quazcode.quazhome.tv.overlay.DeviceAdapter
import com.quazcode.quazhome.tv.overlay.MenuItem
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

    // Main View Containers (Setup vs Dashboard)
    private lateinit var containerPairingSetup: LinearLayout
    private lateinit var containerDashboard: LinearLayout
    private lateinit var btnBackToDashboard: Button

    // Dashboard UI elements
    private lateinit var tvDashboardStatus: TextView
    private lateinit var btnDashboardRefresh: Button
    private lateinit var btnDashboardOverlay: Button
    private lateinit var btnDashboardSettings: Button
    private lateinit var rvDashboardDevices: RecyclerView
    private lateinit var dashboardAdapter: DeviceAdapter

    // Remote Button Customization UI elements
    private lateinit var tvCurrentRemoteKey: TextView
    private lateinit var btnCaptureRemoteKey: Button
    private lateinit var btnModeSingle: Button
    private lateinit var btnModeHold: Button
    private lateinit var btnModeDouble: Button
    private var isCapturingKey = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isLongPressTriggered = false
    private val activityLongPressRunnable = Runnable {
        isLongPressTriggered = true
        OverlayManager.toggle(this)
    }
    private var lastClickTime = 0L

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

        // 1. Check if TV is already paired: show live Dashboard or Pairing Session
        if (QuazHomeApp.instance.isPaired) {
            showDashboardState()
        } else {
            showPairingSetupState()
        }

        // 2. Refresh Remote Button & Mode UI
        updateKeyDisplay()
        updateModeUI()

        // 3. Check for OTA in-app updates in the background
        checkForUpdates()
    }

    override fun onResume() {
        super.onResume()
        updateAccessibilityStatus()
    }

    private fun updateAccessibilityStatus() {
        val isEnabled = isAccessibilityServiceEnabled()
        btnOpenAccessibility.backgroundTintList = null
        if (isEnabled) {
            btnOpenAccessibility.text = "✓ خدمة الريموت مفعلة بنجاح (Accessibility: Active)"
            btnOpenAccessibility.setBackgroundResource(R.drawable.bg_platform_button_emerald)
            btnOpenAccessibility.setTextColor(androidx.core.content.ContextCompat.getColorStateList(this, R.color.color_btn_emerald_text))
        } else {
            btnOpenAccessibility.text = "⚠️ تفعيل خدمة التقاط أزرار الريموت (Accessibility)"
            btnOpenAccessibility.setBackgroundResource(R.drawable.bg_platform_button_slate)
            btnOpenAccessibility.setTextColor(androidx.core.content.ContextCompat.getColorStateList(this, R.color.color_btn_slate_text))
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        return try {
            val enabledServicesSetting = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            val accessibilityEnabled = Settings.Secure.getInt(
                contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED,
                0
            )
            if (accessibilityEnabled == 1 && enabledServicesSetting.contains(packageName)) {
                return true
            }

            val am = getSystemService(ACCESSIBILITY_SERVICE) as AccessibilityManager
            val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            enabledServices.any { it.resolveInfo?.serviceInfo?.packageName == packageName }
        } catch (e: Exception) {
            false
        }
    }

    private fun initViews() {
        val tvAppVersion = findViewById<TextView>(R.id.tvAppVersion)
        val vName = try { packageManager.getPackageInfo(packageName, 0).versionName } catch (e: Exception) { "1.1.6" }
        tvAppVersion?.text = "الإصدار: v$vName (Official Edition)"

        containerPairingSetup = findViewById(R.id.containerPairingSetup)
        containerDashboard = findViewById(R.id.containerDashboard)
        btnBackToDashboard = findViewById(R.id.btnBackToDashboard)

        tvDashboardStatus = findViewById(R.id.tvDashboardStatus)
        btnDashboardRefresh = findViewById(R.id.btnDashboardRefresh)
        btnDashboardOverlay = findViewById(R.id.btnDashboardOverlay)
        btnDashboardSettings = findViewById(R.id.btnDashboardSettings)
        rvDashboardDevices = findViewById(R.id.rvDashboardDevices)

        // Setup 2-Column Grid for Smart Home Dashboard
        dashboardAdapter = DeviceAdapter(
            onDeviceToggle = { device ->
                handleDashboardDeviceToggle(device)
            },
            onTempChange = { device, newTemp ->
                handleDashboardClimateChange(device, newTemp)
            }
        )

        val gridLayout = GridLayoutManager(this, 2)
        gridLayout.spanSizeLookup = object : GridLayoutManager.SpanSizeLookup() {
            override fun getSpanSize(position: Int): Int {
                return if (dashboardAdapter.getItemViewType(position) == DeviceAdapter.TYPE_HEADER) 2 else 1
            }
        }
        rvDashboardDevices.layoutManager = gridLayout
        rvDashboardDevices.itemAnimator = null
        rvDashboardDevices.preserveFocusAfterLayout = true
        rvDashboardDevices.clipChildren = false
        rvDashboardDevices.clipToPadding = false
        rvDashboardDevices.adapter = dashboardAdapter

        ivQrCode = findViewById(R.id.ivQrCode)
        pbQrLoading = findViewById(R.id.pbQrLoading)
        tvPairingCode = findViewById(R.id.tvPairingCode)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)
        btnTestOverlay = findViewById(R.id.btnTestOverlay)
        btnOpenAccessibility = findViewById(R.id.btnOpenAccessibility)
        btnResetPairing = findViewById(R.id.btnResetPairing)

        // Remote Button Controls
        tvCurrentRemoteKey = findViewById(R.id.tvCurrentRemoteKey)
        btnCaptureRemoteKey = findViewById(R.id.btnCaptureRemoteKey)
        btnModeSingle = findViewById(R.id.btnModeSingle)
        btnModeHold = findViewById(R.id.btnModeHold)
        btnModeDouble = findViewById(R.id.btnModeDouble)

        // OTA
        cardUpdateAvailable = findViewById(R.id.cardUpdateAvailable)
        tvUpdateTitle = findViewById(R.id.tvUpdateTitle)
        btnUpdateNow = findViewById(R.id.btnUpdateNow)
        pbUpdateDownload = findViewById(R.id.pbUpdateDownload)

        // Clear framework tint so custom glassmorphism drawables render 100% faithfully
        listOf(
            btnUpdateNow,
            btnCaptureRemoteKey,
            btnModeSingle,
            btnModeHold,
            btnModeDouble,
            btnTestOverlay,
            btnOpenAccessibility,
            btnResetPairing,
            btnBackToDashboard,
            btnDashboardRefresh,
            btnDashboardOverlay,
            btnDashboardSettings
        ).forEach { it.backgroundTintList = null }

        // Apply Gradient Shader to Brand Logo Typography (Matching Platform Hero 1:1)
        val tvLogoQ = findViewById<TextView>(R.id.tvLogoQ)
        tvLogoQ?.post {
            val w = tvLogoQ.paint.measureText("Q").coerceAtLeast(1f)
            val h = tvLogoQ.textSize.coerceAtLeast(1f)
            val shader = LinearGradient(
                0f, 0f, w, h,
                intArrayOf(Color.parseColor("#38BDF8"), Color.parseColor("#A855F7")),
                floatArrayOf(0.1f, 0.95f),
                Shader.TileMode.CLAMP
            )
            tvLogoQ.paint.shader = shader
            tvLogoQ.invalidate()
        }

        val tvLogoHome = findViewById<TextView>(R.id.tvLogoHome)
        tvLogoHome?.post {
            val w = tvLogoHome.paint.measureText("Home").coerceAtLeast(1f)
            val shader = LinearGradient(
                0f, 0f, w, 0f,
                intArrayOf(Color.parseColor("#FFFFFF"), Color.parseColor("#94A3B8")),
                floatArrayOf(0.15f, 0.9f),
                Shader.TileMode.CLAMP
            )
            tvLogoHome.paint.shader = shader
            tvLogoHome.invalidate()
        }

        // Apply D-Pad Neon Focus Scale & Glow Effect to all interactive buttons
        applyNeonFocusAnimation(
            btnUpdateNow,
            btnCaptureRemoteKey,
            btnModeSingle,
            btnModeHold,
            btnModeDouble,
            btnTestOverlay,
            btnOpenAccessibility,
            btnResetPairing,
            btnBackToDashboard,
            btnDashboardRefresh,
            btnDashboardOverlay,
            btnDashboardSettings
        )
    }

    private fun applyNeonFocusAnimation(vararg views: View) {
        for (v in views) {
            v.setOnFocusChangeListener { view, hasFocus ->
                if (hasFocus) {
                    view.animate()
                        .scaleX(1.03f)
                        .scaleY(1.03f)
                        .translationZ(8f)
                        .setDuration(120)
                        .start()
                } else {
                    view.animate()
                        .scaleX(1.0f)
                        .scaleY(1.0f)
                        .translationZ(0f)
                        .setDuration(120)
                        .start()
                }
            }
        }
    }

    private fun setupListeners() {
        btnBackToDashboard.setOnClickListener {
            showDashboardState()
        }

        btnDashboardRefresh.setOnClickListener {
            loadDashboardData()
            Toast.makeText(this, "🔄 جاري تحديث حالة الأجهزة...", Toast.LENGTH_SHORT).show()
        }

        btnDashboardOverlay.setOnClickListener {
            checkOverlayPermissionAndShow()
        }

        btnDashboardSettings.setOnClickListener {
            showPairingSetupState()
        }

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

        // Remote Button Capture Trigger
        btnCaptureRemoteKey.setOnClickListener {
            if (!isCapturingKey) {
                isCapturingKey = true
                btnCaptureRemoteKey.backgroundTintList = null
                btnCaptureRemoteKey.text = "⏳ اضغط الآن بالريموت..."
                btnCaptureRemoteKey.setBackgroundResource(R.drawable.bg_platform_button_emerald)
                btnCaptureRemoteKey.setTextColor(Color.parseColor("#34D399"))
                Toast.makeText(this, "اضغط على الزر المراد تعيينه في الريموت الآن", Toast.LENGTH_SHORT).show()
            } else {
                isCapturingKey = false
                btnCaptureRemoteKey.backgroundTintList = null
                btnCaptureRemoteKey.text = "🎯 تسجيل زر جديد"
                btnCaptureRemoteKey.setBackgroundResource(R.drawable.bg_platform_button_cyan)
                btnCaptureRemoteKey.setTextColor(Color.parseColor("#38BDF8"))
            }
        }

        // Mode Selectors
        btnModeSingle.setOnClickListener {
            QuazHomeApp.instance.triggerMode = QuazHomeApp.MODE_SINGLE
            updateModeUI()
            Toast.makeText(this, "تم تفعيل: ضغطة عادية (Single Click)", Toast.LENGTH_SHORT).show()
        }

        btnModeHold.setOnClickListener {
            QuazHomeApp.instance.triggerMode = QuazHomeApp.MODE_LONG_PRESS
            updateModeUI()
            Toast.makeText(this, "تم تفعيل: ضغطة مطولة 500ms (Hold)", Toast.LENGTH_SHORT).show()
        }

        btnModeDouble.setOnClickListener {
            QuazHomeApp.instance.triggerMode = QuazHomeApp.MODE_DOUBLE_PRESS
            updateModeUI()
            Toast.makeText(this, "تم تفعيل: ضغطتان متتاليتان 350ms (Double Click)", Toast.LENGTH_SHORT).show()
        }

        btnUpdateNow.setOnClickListener {
            val update = activeUpdate ?: return@setOnClickListener
            triggerOtaUpdate(update.downloadUrl)
        }
    }

    private fun updateKeyDisplay() {
        tvCurrentRemoteKey.text = QuazHomeApp.instance.triggerKeyName
    }

    private fun updateModeUI() {
        val currentMode = QuazHomeApp.instance.triggerMode

        val isSingle = currentMode == QuazHomeApp.MODE_SINGLE
        btnModeSingle.backgroundTintList = null
        btnModeSingle.setBackgroundResource(if (isSingle) R.drawable.bg_neon_mode_selected else R.drawable.bg_neon_mode_unselected)
        btnModeSingle.setTextColor(Color.parseColor(if (isSingle) "#38BDF8" else "#64748B"))
        btnModeSingle.text = if (isSingle) "✓ ضغطة عادية" else "ضغطة عادية"

        val isHold = currentMode == QuazHomeApp.MODE_LONG_PRESS
        btnModeHold.backgroundTintList = null
        btnModeHold.setBackgroundResource(if (isHold) R.drawable.bg_neon_mode_selected else R.drawable.bg_neon_mode_unselected)
        btnModeHold.setTextColor(Color.parseColor(if (isHold) "#38BDF8" else "#64748B"))
        btnModeHold.text = if (isHold) "✓ مطولة 500ms" else "مطولة 500ms"

        val isDouble = currentMode == QuazHomeApp.MODE_DOUBLE_PRESS
        btnModeDouble.backgroundTintList = null
        btnModeDouble.setBackgroundResource(if (isDouble) R.drawable.bg_neon_mode_selected else R.drawable.bg_neon_mode_unselected)
        btnModeDouble.setTextColor(Color.parseColor(if (isDouble) "#38BDF8" else "#64748B"))
        btnModeDouble.text = if (isDouble) "✓ ضغطتان 350ms" else "ضغطتان 350ms"
    }

    private fun getFriendlyKeyName(keyCode: Int): String {
        return when (keyCode) {
            KeyEvent.KEYCODE_PROG_BLUE, 134 -> "الزر الأزرق (Blue Key - 134)"
            KeyEvent.KEYCODE_PROG_RED, 183 -> "الزر الأحمر (Red Key - 183)"
            KeyEvent.KEYCODE_PROG_GREEN, 184 -> "الزر الأخضر (Green Key - 184)"
            KeyEvent.KEYCODE_PROG_YELLOW, 185 -> "الزر الأصفر (Yellow Key - 185)"
            KeyEvent.KEYCODE_MENU, 82 -> "زر القائمة (Menu Key - 82)"
            KeyEvent.KEYCODE_GUIDE, 172 -> "دليل القنوات (Guide - 172)"
            KeyEvent.KEYCODE_INFO, 165 -> "معلومات (Info - 165)"
            KeyEvent.KEYCODE_BOOKMARK, 174 -> "إشارة مرجعية (Bookmark - 174)"
            KeyEvent.KEYCODE_CAPTIONS, 175 -> "الترجمة (Captions - 175)"
            KeyEvent.KEYCODE_HELP, 259 -> "مساعدة (Help - 259)"
            KeyEvent.KEYCODE_SETTINGS, 176 -> "إعدادات (Settings - 176)"
            KeyEvent.KEYCODE_WINDOW, 171 -> "النوافذ (Window - 171)"
            KeyEvent.KEYCODE_CHANNEL_UP, 166 -> "القناة للأعلى (Ch Up - 166)"
            KeyEvent.KEYCODE_CHANNEL_DOWN, 167 -> "القناة للأسفل (Ch Down - 167)"
            else -> {
                val label = KeyEvent.keyCodeToString(keyCode).removePrefix("KEYCODE_")
                "زر الريموت ($label - $keyCode)"
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // 1. If actively capturing a new remote button:
        if (isCapturingKey) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                if (event.keyCode == KeyEvent.KEYCODE_BACK) {
                    isCapturingKey = false
                    btnCaptureRemoteKey.backgroundTintList = null
                    btnCaptureRemoteKey.text = "🎯 تسجيل زر جديد"
                    btnCaptureRemoteKey.setBackgroundResource(R.drawable.bg_platform_button_cyan)
                    btnCaptureRemoteKey.setTextColor(Color.parseColor("#38BDF8"))
                    Toast.makeText(this, "تم إلغاء التقاط الزر", Toast.LENGTH_SHORT).show()
                    return true
                }

                if (QuazHomeApp.isForbiddenKey(event.keyCode)) {
                    Toast.makeText(this, "⚠️ لا يمكن تعيين زر (OK / Enter) أو الرجوع كزر اختصار لمنع التعليق!", Toast.LENGTH_LONG).show()
                    return true
                }

                val friendlyName = getFriendlyKeyName(event.keyCode)
                QuazHomeApp.instance.triggerKeyCode = event.keyCode
                QuazHomeApp.instance.triggerKeyName = friendlyName

                isCapturingKey = false
                btnCaptureRemoteKey.backgroundTintList = null
                btnCaptureRemoteKey.text = "🎯 تسجيل زر جديد"
                btnCaptureRemoteKey.setBackgroundResource(R.drawable.bg_platform_button_cyan)
                btnCaptureRemoteKey.setTextColor(Color.parseColor("#38BDF8"))
                updateKeyDisplay()

                val isArrow = event.keyCode in setOf(19, 20, 21, 22)
                if (isArrow) {
                    Toast.makeText(this, "✨ تم تعيين: $friendlyName (يُنصح بضغطة مطولة لتجنب التضارب مع التصفح)", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this, "✨ تم بنجاح تعيين: $friendlyName - اضغط عليه الآن لتجربته!", Toast.LENGTH_LONG).show()
                }
                return true
            }
            return true
        }

        // 2. If Overlay is active and user presses BACK, dismiss it cleanly
        if (OverlayManager.isOverlayShowing() && event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                OverlayManager.dismiss()
                return true
            }
        }

        // 3. If in Setup/Settings screen and TV is already paired, pressing Back returns to Dashboard!
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
            if (containerPairingSetup.visibility == View.VISIBLE && QuazHomeApp.instance.isPaired) {
                showDashboardState()
                return true
            }
        }

        // 3. Test configured trigger key directly inside MainActivity ONLY if Accessibility Service is NOT active
        if (!isAccessibilityServiceEnabled()) {
            val configuredKey = QuazHomeApp.instance.triggerKeyCode
            val isTargetKey = (event.keyCode == configuredKey) ||
                    (configuredKey == KeyEvent.KEYCODE_PROG_BLUE && (event.keyCode == KeyEvent.KEYCODE_PROG_BLUE || event.keyCode == 134))

            if (isTargetKey) {
                val isArrowKey = event.keyCode in setOf(
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_DPAD_DOWN,
                    KeyEvent.KEYCODE_DPAD_LEFT,
                    KeyEvent.KEYCODE_DPAD_RIGHT
                )
                val mode = QuazHomeApp.instance.triggerMode
                when (mode) {
                    QuazHomeApp.MODE_LONG_PRESS -> {
                        when (event.action) {
                            KeyEvent.ACTION_DOWN -> {
                                if (event.repeatCount == 0) {
                                    isLongPressTriggered = false
                                    mainHandler.removeCallbacks(activityLongPressRunnable)
                                    mainHandler.postDelayed(activityLongPressRunnable, 500L)
                                } else if (isLongPressTriggered) {
                                    return true
                                }
                                // Arrow key must navigate normally on single press!
                                if (isArrowKey) {
                                    return super.dispatchKeyEvent(event)
                                }
                                return true
                            }
                            KeyEvent.ACTION_UP -> {
                                mainHandler.removeCallbacks(activityLongPressRunnable)
                                if (isLongPressTriggered) {
                                    isLongPressTriggered = false
                                    return true
                                }
                                // Arrow key must finish normal click navigation!
                                if (isArrowKey) {
                                    return super.dispatchKeyEvent(event)
                                }
                                return true
                            }
                        }
                    }
                    QuazHomeApp.MODE_DOUBLE_PRESS -> {
                        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                            val now = System.currentTimeMillis()
                            val delta = now - lastClickTime
                            if (delta in 50..350) {
                                lastClickTime = 0L
                                OverlayManager.toggle(this)
                                return true
                            } else {
                                lastClickTime = now
                                if (isArrowKey) {
                                    return super.dispatchKeyEvent(event)
                                }
                                return true
                            }
                        } else if (isArrowKey) {
                            return super.dispatchKeyEvent(event)
                        }
                    }
                    else -> {
                        // Default Single click
                        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                            OverlayManager.toggle(this)
                            return true
                        }
                    }
                }
            }
        }

        return super.dispatchKeyEvent(event)
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
                        showDashboardState()
                        Toast.makeText(this@MainActivity, "✨ تم تسجيل الدخول وربط أجهزة المنزل بنجاح!", Toast.LENGTH_LONG).show()
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

    private fun showDashboardState() {
        containerPairingSetup.visibility = View.GONE
        containerDashboard.visibility = View.VISIBLE
        btnBackToDashboard.visibility = View.VISIBLE

        val domain = QuazHomeApp.instance.haDomain.ifEmpty { "Home Assistant" }
        tvDashboardStatus.text = "🟢 متصل بـ $domain بنجاح ✨"
        tvDashboardStatus.setTextColor(Color.parseColor("#34D399"))

        loadDashboardData()
    }

    private fun showPairingSetupState() {
        containerDashboard.visibility = View.GONE
        containerPairingSetup.visibility = View.VISIBLE

        if (QuazHomeApp.instance.isPaired) {
            btnBackToDashboard.visibility = View.VISIBLE
            showPairedState()
        } else {
            btnBackToDashboard.visibility = View.GONE
            startPairingSession()
        }
    }

    private fun loadDashboardData() {
        lifecycleScope.launch {
            val result = repository.getQuickMenu()
            result.onSuccess { response ->
                val menuItems = mutableListOf<MenuItem>()
                for (group in response.groups) {
                    val filtered = group.entities.filter { it.entityId != "tv.pairing_status" }
                    if (filtered.isNotEmpty()) {
                        menuItems.add(MenuItem.Header(group.name))
                        for (entity in filtered) {
                            menuItems.add(MenuItem.Device(entity))
                        }
                    }
                }
                if (menuItems.isNotEmpty()) {
                    val focusedView = currentFocus
                    val containingView = focusedView?.let { rvDashboardDevices.findContainingItemView(it) }
                    val currentPos = containingView?.let { rvDashboardDevices.getChildAdapterPosition(it) } ?: -1

                    dashboardAdapter.submitData(menuItems)

                    if (currentPos >= 0 && currentPos < menuItems.size) {
                        rvDashboardDevices.post {
                            val holder = rvDashboardDevices.findViewHolderForAdapterPosition(currentPos)
                            val target = holder?.itemView?.findViewById<View>(R.id.cardContainer) ?: holder?.itemView
                            target?.requestFocus()
                        }
                    }
                } else if (dashboardAdapter.itemCount == 0) {
                    dashboardAdapter.submitData(getDemoMenuItems())
                }
            }.onFailure {
                if (dashboardAdapter.itemCount == 0) {
                    dashboardAdapter.submitData(getDemoMenuItems())
                }
            }
        }
    }

    private fun handleDashboardDeviceToggle(device: DeviceItem) {
        if (device.type == "scene") {
            lifecycleScope.launch {
                Toast.makeText(this@MainActivity, "تم تشغيل ${device.name} ✨", Toast.LENGTH_SHORT).show()
                if (QuazHomeApp.instance.isPaired) {
                    repository.triggerScene(device.entityId)
                }
            }
            return
        }

        if (QuazHomeApp.instance.isPaired) {
            lifecycleScope.launch {
                val result = repository.toggle(device.entityId)
                if (result.isFailure) {
                    dashboardAdapter.revertDeviceState(device.entityId, rvDashboardDevices)
                    Toast.makeText(this@MainActivity, "تعذر تحديث حالة الجهاز", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun handleDashboardClimateChange(device: DeviceItem, newTemp: Double) {
        if (QuazHomeApp.instance.isPaired) {
            lifecycleScope.launch {
                repository.setClimateTemp(device.entityId, newTemp)
            }
        }
    }

    private fun getDemoMenuItems(): List<MenuItem> {
        return listOf(
            MenuItem.Header("الإضاءة والإنارة"),
            MenuItem.Device(DeviceItem("light.living_room", "إضاءة الصالة الرئيسية", "light", "lamp", "on", true, null, null, null, null, null, null)),
            MenuItem.Device(DeviceItem("light.kitchen_strip", "شريط ليد المطبخ", "light", "led", "off", false, null, null, null, null, null, null)),
            MenuItem.Header("التكييف والمناخ"),
            MenuItem.Device(DeviceItem("climate.living_room", "تكييف غرفة المعيشة", "climate", "air-conditioner", "22°C", true, null, 24.0, 22.0, 16.0, 30.0, null)),
            MenuItem.Header("الأجهزة والمفاتيح"),
            MenuItem.Device(DeviceItem("switch.water_heater", "سخان المياه الذكي", "switch", "power", "off", false, null, null, null, null, null, null)),
            MenuItem.Header("السيناريوهات والوضعيات"),
            MenuItem.Device(DeviceItem("scene.movie_night", "وضع السينما والمشاهدة", "scene", "movie", "active", false, null, null, null, null, null, null)),
            MenuItem.Device(DeviceItem("scene.goodnight", "وضع النوم والهدوء", "scene", "sleep", "active", false, null, null, null, null, null, null))
        )
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
            val currentVersion = try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.5"
            } catch (e: Exception) {
                "1.0.5"
            }

            // Sync visual version badge with actual installed version
            findViewById<TextView>(R.id.tvAppVersion)?.text = "الإصدار: v$currentVersion (Official Edition)"

            val update = AppUpdater.checkForUpdate(currentVersion)
            if (update != null && update.hasUpdate) {
                activeUpdate = update
                cardUpdateAvailable.visibility = View.VISIBLE
                tvUpdateTitle.text = "🚀 يتوفر تحديث جديد (${update.latestVersion})! اضغط للتحديث الفوري"
            } else {
                cardUpdateAvailable.visibility = View.GONE
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
                val launched = AppUpdater.installApk(this@MainActivity, apkFile)
                if (launched) {
                    btnUpdateNow.text = "تثبيت الآن..."
                } else {
                    btnUpdateNow.isEnabled = true
                    btnUpdateNow.text = "السماح بالتثبيت ثم الضغط مجدداً"
                    Toast.makeText(
                        this@MainActivity,
                        "يرجى السماح لـ QuazHome TV بتثبيت التطبيقات (Install unknown apps)",
                        Toast.LENGTH_LONG
                    ).show()
                }
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

    override fun onDestroy() {
        super.onDestroy()
        pairingJob?.cancel()
    }
}
