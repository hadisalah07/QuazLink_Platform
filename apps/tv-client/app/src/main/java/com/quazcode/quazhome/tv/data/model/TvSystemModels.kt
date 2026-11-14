package com.quazcode.quazhome.tv.data.model

import com.google.gson.annotations.SerializedName

data class PairInitResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("code") val code: String,
    @SerializedName("secret") val secret: String,
    @SerializedName("qrUrl") val qrUrl: String,
    @SerializedName("expiresInSeconds") val expiresInSeconds: Int
)

data class PairStatusResponse(
    @SerializedName("status") val status: String, // pending, paired, expired
    @SerializedName("deviceToken") val deviceToken: String?,
    @SerializedName("haUrl") val haUrl: String?
)

data class UpdateCheckResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("hasUpdate") val hasUpdate: Boolean,
    @SerializedName("currentVersion") val currentVersion: String,
    @SerializedName("latestVersion") val latestVersion: String,
    @SerializedName("releaseName") val releaseName: String,
    @SerializedName("releaseNotes") val releaseNotes: String,
    @SerializedName("downloadUrl") val downloadUrl: String,
    @SerializedName("mandatory") val mandatory: Boolean
)

data class HeartbeatRequest(
    @SerializedName("appVersion") val appVersion: String
)

data class HeartbeatResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("timestamp") val timestamp: Long
)
