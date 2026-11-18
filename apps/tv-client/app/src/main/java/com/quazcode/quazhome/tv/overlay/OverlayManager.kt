package com.quazcode.quazhome.tv.overlay

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.PixelFormat
import android.graphics.Shader
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.data.model.DeviceItem
import com.quazcode.quazhome.tv.data.repository.DeviceRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object OverlayManager {

    private const val TAG = "OverlayManager"
    private const val AFK_TIMEOUT_MS = 10_000L // 10 seconds auto-close AFK

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isShowing = false

    private val repository = DeviceRepository()
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val handler = Handler(Looper.getMainLooper())
    private val cachedMenuItems = mutableListOf<MenuItem>()

    private val afkRunnable = Runnable {
        Log.i(TAG, "⏰ 10 seconds AFK timeout reached -> auto-closing quick menu overlay")
        dismiss()
    }

    private var adapter: DeviceAdapter? = null

    fun isOverlayShowing(): Boolean = isShowing

    fun resetAfkTimer() {
        handler.removeCallbacks(afkRunnable)
        if (isShowing) {
            handler.postDelayed(afkRunnable, AFK_TIMEOUT_MS)
        }
    }

    fun toggle(context: Context) {
        if (isShowing) {
            dismiss()
        } else {
            show(context)
        }
    }

    fun show(context: Context) {
        if (isShowing) return

        val isAccessibility = context is AccessibilityService

        // Verify overlay permission only if not an AccessibilityService (which has native overlay privileges)
        if (!isAccessibility && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            Toast.makeText(context, "الرجاء منح صلاحية الظهور فوق التطبيقات أولاً", Toast.LENGTH_LONG).show()
            return
        }

        windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val inflater = LayoutInflater.from(context)
        val view = inflater.inflate(R.layout.layout_quick_menu_overlay, null)
        overlayView = view

        // Use TYPE_ACCESSIBILITY_OVERLAY for AccessibilityService, TYPE_APPLICATION_OVERLAY for Activity
        val layoutType = if (isAccessibility) {
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            // Width: 420dp in pixels
            (420 * context.resources.displayMetrics.density).toInt(),
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            // FLAG_NOT_TOUCH_MODAL allows outside clicks to dismiss, focusable so remote works
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.END
            windowAnimations = android.R.style.Animation_Dialog
        }

        // Setup clock
        val tvClock = view.findViewById<TextView>(R.id.tvClock)
        val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        tvClock.text = timeFormat.format(Date())

        // Apply Brand Typography Gradient Shaders
        val tvOverlayLogoQ = view.findViewById<TextView>(R.id.tvOverlayLogoQ)
        tvOverlayLogoQ?.post {
            val w = tvOverlayLogoQ.paint.measureText("Q").coerceAtLeast(1f)
            val h = tvOverlayLogoQ.textSize.coerceAtLeast(1f)
            val shader = LinearGradient(
                0f, 0f, w, h,
                intArrayOf(Color.parseColor("#38BDF8"), Color.parseColor("#A855F7")),
                floatArrayOf(0.1f, 0.95f),
                Shader.TileMode.CLAMP
            )
            tvOverlayLogoQ.paint.shader = shader
            tvOverlayLogoQ.invalidate()
        }

        val tvOverlayLogoHome = view.findViewById<TextView>(R.id.tvOverlayLogoHome)
        tvOverlayLogoHome?.post {
            val w = tvOverlayLogoHome.paint.measureText("Home").coerceAtLeast(1f)
            val shader = LinearGradient(
                0f, 0f, w, 0f,
                intArrayOf(Color.parseColor("#FFFFFF"), Color.parseColor("#94A3B8")),
                floatArrayOf(0.15f, 0.9f),
                Shader.TileMode.CLAMP
            )
            tvOverlayLogoHome.paint.shader = shader
            tvOverlayLogoHome.invalidate()
        }

        // Setup Close Button
        view.findViewById<Button>(R.id.btnCloseOverlay)?.setOnClickListener {
            dismiss()
        }

        // Setup RecyclerView with zero clipping
        val rvDevices = view.findViewById<RecyclerView>(R.id.rvDevices)
        rvDevices.layoutManager = LinearLayoutManager(context)
        rvDevices.itemAnimator = null
        rvDevices.preserveFocusAfterLayout = true
        rvDevices.clipChildren = false
        rvDevices.clipToPadding = false
        (view as? ViewGroup)?.clipChildren = false
        (view as? ViewGroup)?.clipToPadding = false

        adapter = DeviceAdapter(
            onDeviceToggle = { device ->
                resetAfkTimer()
                handleDeviceToggle(device)
            },
            onTempChange = { device, newTemp ->
                resetAfkTimer()
                handleClimateChange(device, newTemp)
            },
            onBrightnessChange = { device, newPct ->
                resetAfkTimer()
                if (QuazHomeApp.instance.isPaired) {
                    scope.launch {
                        repository.setLightBrightness(device.entityId, newPct)
                    }
                }
            },
            onSubButtonToggle = { entityId, subButton ->
                resetAfkTimer()
                if (QuazHomeApp.instance.isPaired) {
                    scope.launch {
                        repository.toggle(entityId)
                    }
                }
            }
        )
        rvDevices.adapter = adapter

        // Setup Root Key Dispatcher to intercept Back, Escape, and Trigger Button globally
        (view as? OverlayRootLayout)?.onKeyInterceptListener = { event ->
            resetAfkTimer()
            if (event.action == KeyEvent.ACTION_DOWN) {
                val configuredKey = QuazHomeApp.instance.triggerKeyCode
                val isArrowOrEnterKey = event.keyCode in setOf(
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_DPAD_DOWN,
                    KeyEvent.KEYCODE_DPAD_LEFT,
                    KeyEvent.KEYCODE_DPAD_RIGHT,
                    KeyEvent.KEYCODE_DPAD_CENTER,
                    KeyEvent.KEYCODE_ENTER
                )
                val isTriggerKey = !isArrowOrEnterKey && ((event.keyCode == configuredKey) ||
                        (configuredKey == KeyEvent.KEYCODE_PROG_BLUE && (event.keyCode == KeyEvent.KEYCODE_PROG_BLUE || event.keyCode == 134)))

                if (event.keyCode == KeyEvent.KEYCODE_BACK || event.keyCode == KeyEvent.KEYCODE_ESCAPE || isTriggerKey) {
                    Log.d(TAG, "Dismissing overlay on key press: ${event.keyCode}")
                    dismiss()
                    true
                } else {
                    false
                }
            } else {
                false
            }
        }

        // Add to window
        try {
            windowManager?.addView(view, params)
            isShowing = true
            view.isFocusable = true
            view.isFocusableInTouchMode = true
            view.requestFocus()

            // 1. Submit cached real items if available
            if (cachedMenuItems.isNotEmpty()) {
                adapter?.submitData(cachedMenuItems)
                focusFirstDevice()
            }

            // 2. Start 10 seconds AFK auto-close countdown
            resetAfkTimer()

            // 3. Fetch live devices in background
            loadData()
        } catch (e: Exception) {
            Log.e(TAG, "Error adding overlay view: ${e.message}", e)
            isShowing = false
        }
    }

    private fun loadData() {
        scope.launch {
            val result = repository.getQuickMenu()
            result.onSuccess { response ->
                val menuItems = mutableListOf<MenuItem>()
                for (group in response.groups) {
                    val filteredEntities = group.entities.filter { it.entityId != "tv.pairing_status" }
                    if (filteredEntities.isNotEmpty()) {
                        menuItems.add(MenuItem.Header(group.name))
                        for (entity in filteredEntities) {
                            menuItems.add(MenuItem.Device(entity))
                        }
                    }
                }
                if (menuItems.isNotEmpty()) {
                    cachedMenuItems.clear()
                    cachedMenuItems.addAll(menuItems)

                    val rvDevices = overlayView?.findViewById<RecyclerView>(R.id.rvDevices)
                    val focusedView = overlayView?.findFocus()
                    val containingView = focusedView?.let { rvDevices?.findContainingItemView(it) }
                    val focusedPos = containingView?.let { rvDevices?.getChildAdapterPosition(it) } ?: -1

                    adapter?.submitData(menuItems)

                    if (rvDevices != null) {
                        rvDevices.post {
                            val targetPos = if (focusedPos >= 0 && focusedPos < menuItems.size) {
                                focusedPos
                            } else {
                                adapter?.getFirstDevicePosition() ?: 0
                            }
                            val holder = rvDevices.findViewHolderForAdapterPosition(targetPos)
                            val target = holder?.itemView?.findViewById<View>(R.id.cardContainer) ?: holder?.itemView
                            target?.requestFocus()
                        }
                    }
                }
            }
        }
    }

    private fun focusFirstDevice() {
        val view = overlayView ?: return
        val rvDevices = view.findViewById<RecyclerView>(R.id.rvDevices) ?: return
        rvDevices.postDelayed({
            val firstDevicePos = adapter?.getFirstDevicePosition() ?: 1
            rvDevices.scrollToPosition(firstDevicePos)
            val holder = rvDevices.findViewHolderForAdapterPosition(firstDevicePos)
            val target = holder?.itemView?.findViewById<View>(R.id.cardContainer) ?: holder?.itemView
            target?.requestFocus()
        }, 120)
    }

    private fun handleDeviceToggle(device: DeviceItem) {
        if (device.type == "scene") {
            scope.launch {
                Toast.makeText(overlayView?.context ?: return@launch, "تم تشغيل ${device.name} ✨", Toast.LENGTH_SHORT).show()
                if (QuazHomeApp.instance.isPaired) {
                    repository.triggerScene(device.entityId)
                }
                delay(400)
                dismiss() // Auto close on scene activate
            }
            return
        }

        // Note: optimistic in-place UI toggle & bind were already performed in DeviceViewHolder
        // to guarantee 100% focus retention with ZERO RecyclerView view recycling!

        if (QuazHomeApp.instance.isPaired) {
            scope.launch {
                val result = repository.toggle(device.entityId)
                if (result.isFailure) {
                    // Revert state if backend call failed
                    val rv = overlayView?.findViewById<RecyclerView>(R.id.rvDevices)
                    adapter?.revertDeviceState(device.entityId, rv)
                    Toast.makeText(overlayView?.context ?: return@launch, "تعذر تحديث حالة الجهاز", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun handleClimateChange(device: DeviceItem, newTemp: Double) {
        if (QuazHomeApp.instance.isPaired) {
            scope.launch {
                repository.setClimateTemp(device.entityId, newTemp)
            }
        }
    }

    fun dismiss() {
        if (!isShowing) return
        handler.removeCallbacks(afkRunnable)
        overlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay view: ${e.message}", e)
            }
        }
        overlayView = null
        isShowing = false
    }
}
