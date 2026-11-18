package com.quazcode.quazhome.tv.overlay

import android.content.res.ColorStateList
import android.graphics.Color
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.widget.AppCompatButton
import androidx.recyclerview.widget.RecyclerView
import com.quazcode.quazhome.tv.R
import com.quazcode.quazhome.tv.data.model.DeviceItem
import com.quazcode.quazhome.tv.data.model.SubButton

sealed class MenuItem {
    data class Header(val title: String) : MenuItem()
    data class Device(val item: DeviceItem) : MenuItem()
}

class DeviceAdapter(
    private val onDeviceToggle: (DeviceItem) -> Unit,
    private val onTempChange: (DeviceItem, Double) -> Unit,
    private val onBrightnessChange: (DeviceItem, Int) -> Unit = { _, _ -> },
    private val onSubButtonToggle: (String, SubButton) -> Unit = { _, _ -> }
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val TYPE_HEADER = 0
        const val TYPE_DEVICE = 1
        const val TYPE_LIGHT = 2
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
            val holder = rv?.findViewHolderForAdapterPosition(index)
            if (holder is LightViewHolder) {
                holder.bind(dev)
            } else if (holder is DeviceViewHolder) {
                holder.bind(dev)
            } else {
                notifyItemChanged(index)
            }
        }
    }

    override fun getItemViewType(position: Int): Int {
        return when (val item = items[position]) {
            is MenuItem.Header -> TYPE_HEADER
            is MenuItem.Device -> {
                if (item.item.type == "light") TYPE_LIGHT else TYPE_DEVICE
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_HEADER -> {
                val view = inflater.inflate(R.layout.item_group_header, parent, false)
                HeaderViewHolder(view)
            }
            TYPE_LIGHT -> {
                val view = inflater.inflate(R.layout.item_light_bubble_card, parent, false)
                LightViewHolder(view)
            }
            else -> {
                val view = inflater.inflate(R.layout.item_device_card, parent, false)
                DeviceViewHolder(view)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is MenuItem.Header -> (holder as HeaderViewHolder).bind(item.title)
            is MenuItem.Device -> {
                if (holder is LightViewHolder) {
                    holder.bind(item.item)
                } else if (holder is DeviceViewHolder) {
                    holder.bind(item.item)
                }
            }
        }
    }

    override fun getItemCount(): Int = items.size

    class HeaderViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvTitle: TextView = view.findViewById(R.id.tvGroupHeader)
        fun bind(title: String) {
            tvTitle.text = title
        }
    }

    // --- Bubble Card Style Dimmer Light with Slider & Sub-Buttons (Matching Image 3, 4, 5 & YAML) ---
    inner class LightViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val container: View = view.findViewById(R.id.cardContainer)
        private val sliderZone: View = view.findViewById(R.id.layoutSliderZone)
        private val viewSliderFill: View = view.findViewById(R.id.viewSliderFill)
        private val tvLightIcon: TextView = view.findViewById(R.id.tvLightIcon)
        private val tvLightName: TextView = view.findViewById(R.id.tvLightName)
        private val tvLightEntityId: TextView = view.findViewById(R.id.tvLightEntityId)
        private val tvBrightnessPercent: TextView = view.findViewById(R.id.tvBrightnessPercent)
        private val ivLightPower: ImageView = view.findViewById(R.id.ivLightPower)

        private val layoutSubButtonsRow: View = view.findViewById(R.id.layoutSubButtonsRow)
        private val btnMusicMode: AppCompatButton = view.findViewById(R.id.btnMusicMode)
        private val btnReactBass: AppCompatButton = view.findViewById(R.id.btnReactBass)
        private val btnReactMids: AppCompatButton = view.findViewById(R.id.btnReactMids)
        private val btnReactTreble: AppCompatButton = view.findViewById(R.id.btnReactTreble)

        fun bind(light: DeviceItem) {
            tvLightName.text = light.name
            tvLightEntityId.text = light.entityId

            val brightness = light.brightnessPercent ?: if (light.isOn) 100 else 0
            tvBrightnessPercent.text = if (light.isOn) "$brightness%" else "OFF"

            // Compute slider fill width based on brightness percentage
            sliderZone.post {
                val totalWidth = sliderZone.width
                val targetWidth = if (light.isOn && brightness > 0) {
                    ((totalWidth * brightness) / 100).coerceAtLeast(1)
                } else {
                    0
                }
                val lp = viewSliderFill.layoutParams
                lp.width = targetWidth
                viewSliderFill.layoutParams = lp
            }

            if (light.isOn) {
                tvLightIcon.text = "💡"
                tvLightIcon.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                ivLightPower.imageTintList = ColorStateList.valueOf(Color.parseColor("#22D3EE"))
                ivLightPower.setBackgroundResource(R.drawable.bg_pill_cyan_active)
                tvBrightnessPercent.setTextColor(Color.parseColor("#FFCA7B"))
                tvBrightnessPercent.setBackgroundResource(R.drawable.bg_pill_cyan_active)
            } else {
                tvLightIcon.text = "🌑"
                tvLightIcon.setBackgroundResource(R.drawable.bg_platform_pill)
                ivLightPower.imageTintList = ColorStateList.valueOf(Color.parseColor("#64748B"))
                ivLightPower.setBackgroundResource(R.drawable.bg_platform_pill)
                tvBrightnessPercent.setTextColor(Color.parseColor("#64748B"))
                tvBrightnessPercent.setBackgroundResource(R.drawable.bg_platform_pill)
            }

            // Sub-buttons (Music Mode + 3 Reacts: Bass, Mids, Treble)
            val subs = light.subButtons
            if (subs != null && (subs.musicMode != null || subs.reactBass != null || subs.reactMids != null || subs.reactTreble != null)) {
                layoutSubButtonsRow.visibility = View.VISIBLE

                // 1. Music Mode
                val music = subs.musicMode
                if (music != null) {
                    btnMusicMode.visibility = View.VISIBLE
                    btnMusicMode.text = if (music.isOn) "♪ Music Mode • ON" else "♪ Music Mode • OFF"
                    btnMusicMode.backgroundTintList = null
                    btnMusicMode.setBackgroundResource(if (music.isOn) R.drawable.bg_sub_button_active else R.drawable.bg_sub_button_selector)
                    btnMusicMode.setTextColor(Color.parseColor(if (music.isOn) "#0F172A" else "#CBD5E1"))
                    btnMusicMode.setOnClickListener {
                        music.isOn = !music.isOn
                        music.state = if (music.isOn) "on" else "off"
                        bind(light)
                        btnMusicMode.requestFocus()
                        onSubButtonToggle(music.entityId, music)
                    }
                } else {
                    btnMusicMode.visibility = View.GONE
                }

                // 2. React to Bass
                val bass = subs.reactBass
                if (bass != null) {
                    btnReactBass.visibility = View.VISIBLE
                    btnReactBass.backgroundTintList = null
                    btnReactBass.setBackgroundResource(if (bass.isOn) R.drawable.bg_sub_button_round_active else R.drawable.bg_sub_button_round_selector)
                    btnReactBass.setOnClickListener {
                        bass.isOn = !bass.isOn
                        bass.state = if (bass.isOn) "on" else "off"
                        bind(light)
                        btnReactBass.requestFocus()
                        onSubButtonToggle(bass.entityId, bass)
                    }
                } else {
                    btnReactBass.visibility = View.GONE
                }

                // 3. React to Mids
                val mids = subs.reactMids
                if (mids != null) {
                    btnReactMids.visibility = View.VISIBLE
                    btnReactMids.backgroundTintList = null
                    btnReactMids.setBackgroundResource(if (mids.isOn) R.drawable.bg_sub_button_round_active else R.drawable.bg_sub_button_round_selector)
                    btnReactMids.setTextColor(Color.parseColor(if (mids.isOn) "#0F172A" else "#FFFFFF"))
                    btnReactMids.setOnClickListener {
                        mids.isOn = !mids.isOn
                        mids.state = if (mids.isOn) "on" else "off"
                        bind(light)
                        btnReactMids.requestFocus()
                        onSubButtonToggle(mids.entityId, mids)
                    }
                } else {
                    btnReactMids.visibility = View.GONE
                }

                // 4. React to Treble
                val treble = subs.reactTreble
                if (treble != null) {
                    btnReactTreble.visibility = View.VISIBLE
                    btnReactTreble.backgroundTintList = null
                    btnReactTreble.setBackgroundResource(if (treble.isOn) R.drawable.bg_sub_button_round_active else R.drawable.bg_sub_button_round_selector)
                    btnReactTreble.setTextColor(Color.parseColor(if (treble.isOn) "#0F172A" else "#FFFFFF"))
                    btnReactTreble.setOnClickListener {
                        treble.isOn = !treble.isOn
                        treble.state = if (treble.isOn) "on" else "off"
                        bind(light)
                        btnReactTreble.requestFocus()
                        onSubButtonToggle(treble.entityId, treble)
                    }
                } else {
                    btnReactTreble.visibility = View.GONE
                }
            } else {
                layoutSubButtonsRow.visibility = View.GONE
            }

            // Slider Zone Click = Toggle Power
            sliderZone.setOnClickListener {
                light.isOn = !light.isOn
                light.state = if (light.isOn) "on" else "off"
                if (light.isOn && (light.brightnessPercent == null || light.brightnessPercent == 0)) {
                    light.brightnessPercent = 100
                }
                bind(light)
                sliderZone.requestFocus()
                onDeviceToggle(light)
            }

            // D-Pad Focus scaling on the slider zone
            sliderZone.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    sliderZone.animate().scaleX(1.02f).scaleY(1.02f).translationZ(6f).setDuration(120).start()
                    tvLightName.setTextColor(Color.WHITE)
                } else {
                    sliderZone.animate().scaleX(1.0f).scaleY(1.0f).translationZ(0f).setDuration(120).start()
                    tvLightName.setTextColor(Color.parseColor("#F8FAFC"))
                }
            }

            // D-Pad Left/Right for smooth 0-100% dimming
            sliderZone.setOnKeyListener { _, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN) {
                    when (keyCode) {
                        KeyEvent.KEYCODE_DPAD_RIGHT -> {
                            val cur = light.brightnessPercent ?: if (light.isOn) 100 else 0
                            if (cur < 100) {
                                val newPct = (cur + 10).coerceAtMost(100)
                                light.brightnessPercent = newPct
                                light.isOn = true
                                light.state = "on"
                                bind(light)
                                sliderZone.requestFocus()
                                onBrightnessChange(light, newPct)
                            }
                            return@setOnKeyListener true
                        }
                        KeyEvent.KEYCODE_DPAD_LEFT -> {
                            val cur = light.brightnessPercent ?: if (light.isOn) 100 else 0
                            if (cur > 0) {
                                val newPct = (cur - 10).coerceAtLeast(0)
                                light.brightnessPercent = newPct
                                if (newPct == 0) {
                                    light.isOn = false
                                    light.state = "off"
                                }
                                bind(light)
                                sliderZone.requestFocus()
                                onBrightnessChange(light, newPct)
                            }
                            return@setOnKeyListener true
                        }
                    }
                }
                false
            }
        }
    }

    // --- Standard Device Card (Switches, Climate, Scenes) ---
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
