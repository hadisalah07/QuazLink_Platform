package com.quazcode.quazhome.tv.overlay

import android.content.res.ColorStateList
import android.graphics.Color
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.data.model.DeviceItem

sealed class MenuItem {
    data class Header(val title: String) : MenuItem()
    data class Device(val item: DeviceItem) : MenuItem()
}

class DeviceAdapter(
    private val onDeviceToggle: (DeviceItem) -> Unit,
    private val onTempChange: (DeviceItem, Double) -> Unit
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val TYPE_HEADER = 0
        const val TYPE_DEVICE = 1
    }

    private val items = mutableListOf<MenuItem>()

    fun submitData(menuItems: List<MenuItem>) {
        items.clear()
        items.addAll(menuItems)
        notifyDataSetChanged()
    }

    fun getFirstDevicePosition(): Int {
        val idx = items.indexOfFirst { it is MenuItem.Device }
        return if (idx >= 0) idx else 0
    }

    fun getItemAt(position: Int): MenuItem? {
        return if (position in 0 until items.size) items[position] else null
    }

    fun findPositionByEntityId(entityId: String): Int {
        return items.indexOfFirst { it is MenuItem.Device && it.item.entityId == entityId }
    }

    fun revertDeviceState(entityId: String, rv: RecyclerView? = null) {
        val index = findPositionByEntityId(entityId)
        if (index >= 0) {
            val dev = (items[index] as? MenuItem.Device)?.item ?: return
            dev.isOn = !dev.isOn
            dev.state = if (dev.isOn) "on" else "off"
            val holder = rv?.findViewHolderForAdapterPosition(index) as? DeviceViewHolder
            if (holder != null) {
                holder.bind(dev)
            } else {
                notifyItemChanged(index)
            }
        }
    }

    override fun getItemViewType(position: Int): Int {
        return when (items[position]) {
            is MenuItem.Header -> TYPE_HEADER
            is MenuItem.Device -> TYPE_DEVICE
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == TYPE_HEADER) {
            val view = inflater.inflate(R.layout.item_group_header, parent, false)
            HeaderViewHolder(view)
        } else {
            val view = inflater.inflate(R.layout.item_device_card, parent, false)
            DeviceViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is MenuItem.Header -> (holder as HeaderViewHolder).bind(item.title)
            is MenuItem.Device -> (holder as DeviceViewHolder).bind(item.item)
        }
    }

    override fun getItemCount(): Int = items.size

    class HeaderViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvTitle: TextView = view.findViewById(R.id.tvGroupHeader)
        fun bind(title: String) {
            tvTitle.text = title
        }
    }

    inner class DeviceViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val container: View = view.findViewById(R.id.cardContainer)
        private val tvIcon: TextView = view.findViewById(R.id.tvDeviceIcon)
        private val tvName: TextView = view.findViewById(R.id.tvDeviceName)
        private val tvStatus: TextView = view.findViewById(R.id.tvDeviceStatus)
        private val tvBadge: TextView = view.findViewById(R.id.tvStateBadge)
        private val ivPowerIcon: ImageView = view.findViewById(R.id.ivPowerIcon)

        fun bind(device: DeviceItem) {
            container.isFocusable = true
            container.isFocusableInTouchMode = true
            tvName.text = device.name

            // Icons, Badge & Theme Styling based on Device Type & State
            when (device.type) {
                "light" -> {
                    tvIcon.text = if (device.isOn) "💡" else "🌑"
                    tvBadge.text = if (device.isOn) "ON" else "OFF"
                    ivPowerIcon.visibility = View.VISIBLE
                    if (device.isOn) {
                        tvBadge.setTextColor(Color.parseColor("#34D399"))
                        tvBadge.setBackgroundResource(R.drawable.bg_pill_emerald_active)
                        ivPowerIcon.imageTintList = ColorStateList.valueOf(Color.parseColor("#22D3EE"))
                        ivPowerIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                        tvIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                    } else {
                        tvBadge.setTextColor(Color.parseColor("#64748B"))
                        tvBadge.setBackgroundResource(R.drawable.bg_platform_pill)
                        ivPowerIcon.imageTintList = ColorStateList.valueOf(Color.parseColor("#64748B"))
                        ivPowerIcon.setBackgroundResource(R.drawable.bg_platform_pill)
                        tvIcon.setBackgroundResource(R.drawable.bg_platform_pill)
                    }
                    tvStatus.text = device.entityId.ifEmpty { "light.living_room" }
                }
                "climate" -> {
                    tvIcon.text = "❄️"
                    val current = device.currentTemp?.toInt() ?: 24
                    val target = device.targetTemp?.toInt() ?: 22
                    tvStatus.text = "التحكم: [◄ ${target}°C ►] • الحالية: ${current}°C"
                    tvBadge.text = "${target}°C"
                    tvBadge.setTextColor(Color.parseColor("#38BDF8"))
                    tvBadge.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                    ivPowerIcon.visibility = View.GONE
                    tvIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                }
                "scene" -> {
                    tvIcon.text = "🎬"
                    tvBadge.text = "تشغيل"
                    tvBadge.setTextColor(Color.parseColor("#A78BFA"))
                    tvBadge.setBackgroundResource(R.drawable.bg_pill_purple_active)
                    ivPowerIcon.visibility = View.GONE
                    tvIcon.setBackgroundResource(R.drawable.bg_pill_purple_active)
                    tvStatus.text = device.entityId.ifEmpty { "scene.living_room" }
                }
                else -> {
                    tvIcon.text = if (device.isOn) "⚡" else "🔌"
                    tvBadge.text = if (device.isOn) "ON" else "OFF"
                    ivPowerIcon.visibility = View.VISIBLE
                    if (device.isOn) {
                        tvBadge.setTextColor(Color.parseColor("#34D399"))
                        tvBadge.setBackgroundResource(R.drawable.bg_pill_emerald_active)
                        ivPowerIcon.imageTintList = ColorStateList.valueOf(Color.parseColor("#22D3EE"))
                        ivPowerIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                        tvIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                    } else {
                        tvBadge.setTextColor(Color.parseColor("#64748B"))
                        tvBadge.setBackgroundResource(R.drawable.bg_platform_pill)
                        ivPowerIcon.imageTintList = ColorStateList.valueOf(Color.parseColor("#64748B"))
                        ivPowerIcon.setBackgroundResource(R.drawable.bg_platform_pill)
                        tvIcon.setBackgroundResource(R.drawable.bg_platform_pill)
                    }
                    tvStatus.text = device.entityId.ifEmpty { "switch.device" }
                }
            }

            // Click action with micro-bounce feedback & 100% focus retention
            container.setOnClickListener {
                container.animate().scaleX(0.97f).scaleY(0.97f).setDuration(60).withEndAction {
                    container.animate().scaleX(1.025f).scaleY(1.025f).setDuration(80).start()
                }.start()

                if (device.type == "scene") {
                    onDeviceToggle(device)
                    return@setOnClickListener
                }

                // In-place UI update without full adapter refresh -> 100% focus retention
                device.isOn = !device.isOn
                device.state = if (device.isOn) "on" else "off"
                bind(device)
                container.requestFocus()

                onDeviceToggle(device)
            }

            // D-Pad Focus scaling & glow animation
            container.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    container.animate()
                        .scaleX(1.025f)
                        .scaleY(1.025f)
                        .translationZ(8f)
                        .setDuration(120)
                        .start()
                    tvName.setTextColor(Color.WHITE)
                } else {
                    container.animate()
                        .scaleX(1.0f)
                        .scaleY(1.0f)
                        .translationZ(0f)
                        .setDuration(120)
                        .start()
                    tvName.setTextColor(Color.parseColor("#F8FAFC"))
                }
            }

            // Special D-Pad Left/Right handling for Climate Temperature
            if (device.type == "climate") {
                container.setOnKeyListener { _, keyCode, event ->
                    if (event.action == KeyEvent.ACTION_DOWN) {
                        when (keyCode) {
                            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                                val currentTarget = device.targetTemp ?: 22.0
                                val max = device.maxTemp ?: 30.0
                                if (currentTarget < max) {
                                    val newTemp = (currentTarget + 1.0).coerceAtMost(max)
                                    device.targetTemp = newTemp
                                    bind(device)
                                    container.requestFocus()
                                    onTempChange(device, newTemp)
                                }
                                return@setOnKeyListener true
                            }
                            KeyEvent.KEYCODE_DPAD_LEFT -> {
                                val currentTarget = device.targetTemp ?: 22.0
                                val min = device.minTemp ?: 16.0
                                if (currentTarget > min) {
                                    val newTemp = (currentTarget - 1.0).coerceAtLeast(min)
                                    device.targetTemp = newTemp
                                    bind(device)
                                    container.requestFocus()
                                    onTempChange(device, newTemp)
                                }
                                return@setOnKeyListener true
                            }
                        }
                    }
                    false
                }
            } else {
                container.setOnKeyListener(null)
            }
        }
    }
}
