package com.quazcode.quazhome.tv.data.repository

import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.data.api.QuazHomeApi
import com.quazcode.quazhome.tv.data.model.ClimateSetTempRequest
import com.quazcode.quazhome.tv.data.model.QuickMenuResponse
import com.quazcode.quazhome.tv.data.model.SceneTriggerRequest
import com.quazcode.quazhome.tv.data.model.ToggleRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class DeviceRepository {

    private fun getApi(): QuazHomeApi {
        val baseUrl = QuazHomeApp.instance.gatewayUrl.trim().let {
            if (it.endsWith("/")) it else "$it/"
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(2, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(QuazHomeApi::class.java)
    }

    suspend fun getQuickMenu(): Result<QuickMenuResponse> = withContext(Dispatchers.IO) {
        try {
            val response = getApi().getTvQuickMenu()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to load menu: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun toggle(entityId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val response = getApi().toggleDevice(ToggleRequest(entityId))
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Toggle failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun setClimateTemp(entityId: String, temperature: Double): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val response = getApi().setClimateTemp(ClimateSetTempRequest(entityId, temperature))
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun triggerScene(sceneId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val response = getApi().triggerScene(SceneTriggerRequest(sceneId))
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
