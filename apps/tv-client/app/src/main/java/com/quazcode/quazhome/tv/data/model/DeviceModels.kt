package com.quazcode.quazhome.tv.data.model

import com.google.gson.annotations.SerializedName

data class QuickMenuResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("title") val title: String,
    @SerializedName("groups") val groups: List<DeviceGroup>
)

data class DeviceGroup(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("icon") val icon: String,
    @SerializedName("entities") val entities: List<DeviceItem>
)

data class DeviceItem(
    @SerializedName("entityId") val entityId: String,
    @SerializedName("name") val name: String,
    @SerializedName("type") val type: String, // light, climate, scene, switch
    @SerializedName("icon") val icon: String,
    @SerializedName("state") var state: String,
    @SerializedName("isOn") var isOn: Boolean,
    @SerializedName("brightness") val brightness: Int?,
    @SerializedName("currentTemp") var currentTemp: Double?,
    @SerializedName("targetTemp") var targetTemp: Double?,
    @SerializedName("minTemp") val minTemp: Double?,
    @SerializedName("maxTemp") val maxTemp: Double?,
    @SerializedName("accentColor") val accentColor: String?
)

data class ToggleRequest(
    @SerializedName("entityId") val entityId: String
)

data class ToggleResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("entityId") val entityId: String,
    @SerializedName("newState") val newState: String?
)

data class ClimateSetTempRequest(
    @SerializedName("entityId") val entityId: String,
    @SerializedName("temperature") val temperature: Double
)

data class SceneTriggerRequest(
    @SerializedName("sceneId") val sceneId: String
)
