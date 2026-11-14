package com.quazcode.quazhome.tv.data.api

import com.quazcode.quazhome.tv.data.model.ClimateSetTempRequest
import com.quazcode.quazhome.tv.data.model.QuickMenuResponse
import com.quazcode.quazhome.tv.data.model.SceneTriggerRequest
import com.quazcode.quazhome.tv.data.model.ToggleRequest
import com.quazcode.quazhome.tv.data.model.ToggleResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface QuazHomeApi {

    @GET("/api/tv/quick-menu")
    suspend fun getTvQuickMenu(): Response<QuickMenuResponse>

    @POST("/api/device/toggle")
    suspend fun toggleDevice(
        @Body body: ToggleRequest
    ): Response<ToggleResponse>

    @POST("/api/device/climate/set-temp")
    suspend fun setClimateTemp(
        @Body body: ClimateSetTempRequest
    ): Response<ResponseBody>

    @POST("/api/device/scene/trigger")
    suspend fun triggerScene(
        @Body body: SceneTriggerRequest
    ): Response<ResponseBody>
}
