package com.quazcode.quazhome.tv.service

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.overlay.OverlayManager

class RemoteKeyInterceptorService : AccessibilityService() {

    companion object {
        private const val TAG = "QuazHomeRemote"
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val configuredKey = QuazHomeApp.instance.triggerKeyCode

        if (event.action == KeyEvent.ACTION_DOWN) {
            Log.d(TAG, "Key pressed on TV remote: keyCode=${event.keyCode}, configuredKey=$configuredKey")

            // Check if matches the configured trigger key or default TV keys
            if (event.keyCode == configuredKey ||
                event.keyCode == KeyEvent.KEYCODE_PROG_BLUE ||
                event.keyCode == KeyEvent.KEYCODE_BOOKMARK
            ) {
                Log.i(TAG, "Trigger key matched! Toggling QuazHome Quick Menu...")
                OverlayManager.toggle(this)
                return true // Consume key event
            }

            // Close overlay if Back is pressed while overlay is showing
            if (OverlayManager.isOverlayShowing() && event.keyCode == KeyEvent.KEYCODE_BACK) {
                OverlayManager.dismiss()
                return true
            }
        }

        return super.onKeyEvent(event)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used
    }

    override fun onInterrupt() {
        Log.w(TAG, "RemoteKeyInterceptorService interrupted")
    }
}
