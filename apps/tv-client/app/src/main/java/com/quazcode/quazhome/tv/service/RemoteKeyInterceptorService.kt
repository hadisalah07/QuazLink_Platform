package com.quazcode.quazhome.tv.service

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.overlay.OverlayManager

class RemoteKeyInterceptorService : AccessibilityService() {

    companion object {
        private const val TAG = "QuazHomeRemote"
        private const val LONG_PRESS_TIMEOUT_MS = 500L
        private const val DOUBLE_CLICK_TIMEOUT_MS = 350L
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    // Long press tracking
    private var isLongPressTriggered = false
    private val longPressRunnable = Runnable {
        isLongPressTriggered = true
        Log.i(TAG, "🎯 Long press detected (500ms) on remote button! Toggling QuazHome Quick Menu...")
        OverlayManager.toggle(this)
    }

    // Double press tracking
    private var lastClickTime = 0L

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "QuazHome TV RemoteKeyInterceptorService onCreate")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        try {
            val info = serviceInfo ?: android.accessibilityservice.AccessibilityServiceInfo()
            info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            info.feedbackType = android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_GENERIC
            info.flags = android.accessibilityservice.AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            info.notificationTimeout = 100
            serviceInfo = info
            Log.i(TAG, "✨ QuazHome TV Accessibility Service connected & configured successfully!")
        } catch (e: Throwable) {
            Log.e(TAG, "Error in onServiceConnected: ${e.message}", e)
        }
    }

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null) return false

        // CRITICAL GUARD: NEVER intercept system navigation, OK, Enter, or power keys!
        if (com.quazcode.quazhome.tv.QuazHomeApp.isForbiddenKey(event.keyCode)) {
            return false
        }

        try {
            val configuredKey = QuazHomeApp.instance.triggerKeyCode
            val mode = QuazHomeApp.instance.triggerMode

            // 1. If Overlay is active and user presses BACK, dismiss it cleanly
            if (OverlayManager.isOverlayShowing() && event.keyCode == KeyEvent.KEYCODE_BACK) {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    Log.d(TAG, "Back pressed while overlay active -> dismissing overlay")
                    OverlayManager.dismiss()
                    return true
                }
            }

            // 2. Check if pressed key matches configured trigger key or default TV keys
            val isTargetKey = (event.keyCode == configuredKey) ||
                    (configuredKey == KeyEvent.KEYCODE_PROG_BLUE && (event.keyCode == KeyEvent.KEYCODE_PROG_BLUE || event.keyCode == 134))

            if (!isTargetKey) {
                return false
            }

            // 3. Handle configured trigger mode (Single, Long Press, or Double Click)
            when (mode) {
                QuazHomeApp.MODE_LONG_PRESS -> {
                    val isArrowKey = event.keyCode in setOf(
                        KeyEvent.KEYCODE_DPAD_UP,
                        KeyEvent.KEYCODE_DPAD_DOWN,
                        KeyEvent.KEYCODE_DPAD_LEFT,
                        KeyEvent.KEYCODE_DPAD_RIGHT
                    )
                    when (event.action) {
                        KeyEvent.ACTION_DOWN -> {
                            if (event.repeatCount == 0) {
                                isLongPressTriggered = false
                                mainHandler.removeCallbacks(longPressRunnable)
                                mainHandler.postDelayed(longPressRunnable, LONG_PRESS_TIMEOUT_MS)
                            }
                            // For arrow keys, don't consume normal quick down events so navigation still works
                            return if (isArrowKey) false else true
                        }
                        KeyEvent.ACTION_UP -> {
                            mainHandler.removeCallbacks(longPressRunnable)
                            if (isLongPressTriggered) {
                                isLongPressTriggered = false
                                return true // Handled by long press
                            }
                            return if (isArrowKey) false else true
                        }
                    }
                }

                QuazHomeApp.MODE_DOUBLE_PRESS -> {
                    if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                        val now = System.currentTimeMillis()
                        val delta = now - lastClickTime
                        if (delta in 50..DOUBLE_CLICK_TIMEOUT_MS) {
                            Log.i(TAG, "⚡ Double press detected ($delta ms)! Toggling QuazHome Quick Menu...")
                            lastClickTime = 0L
                            OverlayManager.toggle(this)
                            return true
                        } else {
                            lastClickTime = now
                            return true
                        }
                    }
                }

                else -> {
                    // Default: MODE_SINGLE (ضغطة عادية)
                    if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                        Log.i(TAG, "🎯 Single press detected on trigger key! Toggling QuazHome Quick Menu...")
                        OverlayManager.toggle(this)
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in onKeyEvent: ${e.message}", e)
        }

        return false
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Safe no-op - service is purely for global TV remote key filtering
    }

    override fun onInterrupt() {
        Log.w(TAG, "RemoteKeyInterceptorService interrupted")
        mainHandler.removeCallbacks(longPressRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(longPressRunnable)
    }
}
