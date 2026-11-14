package com.quazcode.quazhome.tv.overlay

import android.graphics.Color
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
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
        private const val TYPE_HEADER = 0
        private const val TYPE_DEVICE = 1
    }

    private val items = mutableListOf<MenuItem>()

    fun submitData(menuItems: List<MenuItem>) {
        items.clear()
        items.addAll(menuItems)
        notifyDataSetChanged()
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
        private val container: View = view.findViewById(R.id.cardContainer)
        private val tvIcon: TextView = view.findViewById(R.id.tvDeviceIcon)
        private val tvName: TextView = view.findViewById(R.id.tvDeviceName)
        private val tvStatus: TextView = view.findViewById(R.id.tvDeviceStatus)
        private val tvBadge: TextView = view.findViewById(R.id.tvStateBadge)

        fun bind(device: DeviceItem) {
            tvName.text = device.name

            // Icons & Status text based on type
            when (device.type) {
                "light" -> {
                    tvIcon.text = if (device.isOn) "💡" else "🌑"
                    tvStatus.text = if (device.isOn) "مضاءة (${device.brightness ?: 100}%)" else "مطفأة"
                    tvBadge.text = if (device.isOn) "ON" else "OFF"
                    tvBadge.setTextColor(if (device.isOn) Color.parseColor("#22D3EE") else Color.parseColor("#94A3B8"))
                }
                "climate" -> {
                    tvIcon.text = "❄️"
                    val current = device.currentTemp?.toInt() ?: 24
                    val target = device.targetTemp?.toInt() ?: 22
                    tvStatus.text = "الحالي: ${current}°C • الهدف: ${target}°C"
                    tvBadge.text = "${target}°C"
                    tvBadge.setTextColor(Color.parseColor("#22D3EE"))
                }
                "scene" -> {
                    tvIcon.text = "🎬"
                    tvStatus.text = "سيناريو سريع"
                    tvBadge.text = "ACTIVATE"
                    tvBadge.setTextColor(Color.parseColor("#8B5CF6"))
                }
                else -> {
                    tvIcon.text = "🔌"
                    tvStatus.text = if (device.isOn) "يعمل (ON)" else "متوقف (OFF)"
                    tvBadge.text = if (device.isOn) "ON" else "OFF"
                    tvBadge.setTextColor(if (device.isOn) Color.parseColor("#22D3EE") else Color.parseColor("#94A3B8"))
                }
            }

            // Click action
            container.setOnClickListener {
                onDeviceToggle(device)
            }

            // D-Pad Focus scaling animation
            container.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    container.animate().scaleX(1.04f).scaleY(1.04f).setDuration(120).start()
                } else {
                    container.animate().scaleX(1.0f).scaleY(1.0f).setDuration(120).start()
                }
            }

            // Special D-Pad Left/Right handling for Climate Temperature
            if (device.type == "climate") {
                container.setOnKeyListener { _, keyCode, event ->
                    if (event.action == KeyEvent.ACTION_DOWN) {
                        when (keyCode) {
                            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                                val newTemp = (device.targetTemp ?: 22.0) + 1.0
                                if (newTemp <= (device.maxTemp ?: 30.0)) {
                                    device.targetTemp = newTemp
                                    bind(device)
                                    onTempChange(device, newTemp)
                                }
                                return@setOnKeyListener true
                            }
                            KeyEvent.KEYCODE_DPAD_LEFT -> {
                                val newTemp = (device.targetTemp ?: 22.0) - 1.0
                                if (newTemp >= (device.minTemp ?: 16.0)) {
                                    device.targetTemp = newTemp
                                    bind(device)
                                    onTempChange(device, newTemp)
                                }
                                return@setOnKeyListener true
                            }
                        }
                    }
                    false
                }
            }
        }
    }
}
