package com.quazcode.quazhome.tv.overlay

import android.content.Context
import android.util.AttributeSet
import android.view.KeyEvent
import android.widget.LinearLayout

class OverlayRootLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : LinearLayout(context, attrs, defStyleAttr) {

    var onKeyInterceptListener: ((KeyEvent) -> Boolean)? = null

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (onKeyInterceptListener?.invoke(event) == true) {
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
