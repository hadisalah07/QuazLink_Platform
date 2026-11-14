package com.quazcode.quazhome.tv.overlay

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
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

        // Setup Close Button
        view.findViewById<Button>(R.id.btnCloseOverlay)?.setOnClickListener {
            dismiss()
        }

        // Setup RecyclerView
        val rvDevices = view.findViewById<RecyclerView>(R.id.rvDevices)
        rvDevices.layoutManager = LinearLayoutManager(context)

        adapter = DeviceAdapter(
            onDeviceToggle = { device ->
                resetAfkTimer()
                handleDeviceToggle(device)
            },
            onTempChange = { device, newTemp ->
                resetAfkTimer()
                handleClimateChange(device, newTemp)
            }
        )
        rvDevices.adapter = adapter

        // Setup Root Key Dispatcher to intercept Back, Escape, and Trigger Button globally
        (view as? OverlayRootLayout)?.onKeyInterceptListener = { event ->
            resetAfkTimer()
            if (event.action == KeyEvent.ACTION_DOWN) {
                val configuredKey = QuazHomeApp.instance.triggerKeyCode
                val isTriggerKey = (event.keyCode == configuredKey) ||
                        (configuredKey == KeyEvent.KEYCODE_PROG_BLUE && (event.keyCode == KeyEvent.KEYCODE_PROG_BLUE || event.keyCode == 134))

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
            view.requestFocus()

            // Start 10 seconds AFK auto-close countdown
            resetAfkTimer()

            // Fetch live devices from Fastify Gateway
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
                    menuItems.add(MenuItem.Header(group.name))
                    for (entity in group.entities) {
                        menuItems.add(MenuItem.Device(entity))
                    }
                }
                adapter?.submitData(menuItems)
            }.onFailure { err ->
                // Fallback demo items if backend isn't reached yet
                val demoItems = listOf(
                    MenuItem.Header("الإضاءة (Offline Fallback)"),
                    MenuItem.Device(DeviceItem("light.living_room", "إضاءة الصالة", "light", "lamp", "off", false, null, null, null, null, null, null)),
                    MenuItem.Header("التكييف"),
                    MenuItem.Device(DeviceItem("climate.living_room", "تكييف الصالة", "climate", "air-conditioner", "22°C", true, 22.0, 24.0, "cool", "auto", null, null)),
                    MenuItem.Header("السيناريوهات"),
                    MenuItem.Device(DeviceItem("scene.movie_night", "وضع السينما", "scene", "movie", "active", false, null, null, null, null, null, null))
                )
                adapter?.submitData(demoItems)
            }
        }
    }

    private fun handleDeviceToggle(device: DeviceItem) {
        if (device.domain == "scene") {
            scope.launch {
                repository.activateScene(device.entityId)
                dismiss() // Auto close on scene activate
            }
            return
        }

        // Optimistic UI update
        device.isOn = !device.isOn
        device.state = if (device.isOn) "on" else "off"
        adapter?.notifyDataSetChanged()

        scope.launch {
            val result = repository.toggle(device.entityId)
            if (result.isFailure) {
                // Revert if failed
                device.isOn = !device.isOn
                device.state = if (device.isOn) "on" else "off"
                adapter?.notifyDataSetChanged()
            }
        }
    }

    private fun handleClimateChange(device: DeviceItem, newTemp: Double) {
        scope.launch {
            repository.setClimateTemp(device.entityId, newTemp)
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
