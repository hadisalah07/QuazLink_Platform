package com.quazcode.quazhome.tv.data.api

import com.quazcode.quazhome.tv.data.model.ClimateSetTempRequest
import com.quazcode.quazhome.tv.data.model.HeartbeatRequest
import com.quazcode.quazhome.tv.data.model.HeartbeatResponse
import com.quazcode.quazhome.tv.data.model.PairInitResponse
import com.quazcode.quazhome.tv.data.model.PairStatusResponse
import com.quazcode.quazhome.tv.data.model.QuickMenuResponse
import com.quazcode.quazhome.tv.data.model.SceneTriggerRequest
import com.quazcode.quazhome.tv.data.model.ToggleRequest
import com.quazcode.quazhome.tv.data.model.ToggleResponse
import com.quazcode.quazhome.tv.data.model.UpdateCheckResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface QuazHomeApi {

    // --- Pairing & Setup ---
    @POST("/api/tv/pair/init")
    suspend fun initPairing(): Response<PairInitResponse>

    @GET("/api/tv/pair/status")
    suspend fun getPairStatus(
        @Query("code") code: String,
        @Query("secret") secret: String
    ): Response<PairStatusResponse>

    // --- In-App OTA Auto-Updater & Telemetry ---
    @GET("/api/tv/updates")
    suspend fun checkUpdate(
        @Query("currentVersion") currentVersion: String
    ): Response<UpdateCheckResponse>

    @POST("/api/tv/heartbeat")
    suspend fun sendHeartbeat(
        @Header("x-device-token") deviceToken: String,
        @Body body: HeartbeatRequest
    ): Response<HeartbeatResponse>

    // --- Smart Home Devices (Home Assistant Gateway) ---
    @GET("/api/tv/quick-menu")
    suspend fun getTvQuickMenu(
        @Header("x-device-token") deviceToken: String
    ): Response<QuickMenuResponse>

    @POST("/api/tv/device/toggle")
    suspend fun toggleDevice(
        @Header("x-device-token") deviceToken: String,
        @Body body: ToggleRequest
    ): Response<ToggleResponse>

    @POST("/api/tv/device/climate/set-temp")
    suspend fun setClimateTemp(
        @Header("x-device-token") deviceToken: String,
        @Body body: ClimateSetTempRequest
    ): Response<ResponseBody>

    @POST("/api/tv/device/scene/trigger")
    suspend fun triggerScene(
        @Header("x-device-token") deviceToken: String,
        @Body body: SceneTriggerRequest
    ): Response<ResponseBody>
}
