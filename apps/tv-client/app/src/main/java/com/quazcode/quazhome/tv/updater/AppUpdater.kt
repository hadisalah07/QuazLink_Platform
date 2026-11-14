package com.quazcode.quazhome.tv.updater

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.quazcode.quazhome.tv.QuazHomeApp
import com.quazcode.quazhome.tv.data.model.UpdateCheckResponse
import com.quazcode.quazhome.tv.data.repository.DeviceRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

object AppUpdater {

    private val repository = DeviceRepository()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Checks if a newer version of QuazHome TV is available on the server
     */
    suspend fun checkForUpdate(currentVersion: String): UpdateCheckResponse? {
        val result = repository.checkUpdate(currentVersion)
        return result.getOrNull()
    }

    /**
     * Downloads the APK file in the background and reports progress
     */
    suspend fun downloadApk(
        context: Context,
        downloadUrl: String,
        onProgress: (Int) -> Unit
    ): File? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(downloadUrl).build()
            val response = httpClient.newCall(request).execute()

            if (!response.isSuccessful || response.body == null) {
                return@withContext null
            }

            val body = response.body!!
            val totalBytes = body.contentLength()
            val destFile = File(context.cacheDir, "QuazHomeTV-update.apk")
            if (destFile.exists()) destFile.delete()

            body.byteStream().use { input ->
                FileOutputStream(destFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    var totalRead: Long = 0

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        totalRead += bytesRead
                        if (totalBytes > 0) {
                            val percent = ((totalRead * 100) / totalBytes).toInt()
                            withContext(Dispatchers.Main) {
                                onProgress(percent)
                            }
                        }
                    }
                    output.flush()
                }
            }
            destFile
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Launches the native Android Package Installer for 1-click update
     */
    fun installApk(context: Context, apkFile: File): Boolean {
        try {
            // Android 8.0+ (API 26+) check for unknown app install permission
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${context.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(settingsIntent)
                    return false
                }
            }

            val authority = "${context.packageName}.provider"
            val apkUri: Uri = FileProvider.getUriForFile(context, authority, apkFile)

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            }

            // Explicitly grant read URI permission to all resolving package installer handlers
            val resolvedActivities = context.packageManager.queryIntentActivities(
                intent,
                android.content.pm.PackageManager.MATCH_DEFAULT_ONLY
            )
            for (info in resolvedActivities) {
                context.grantUriPermission(
                    info.activityInfo.packageName,
                    apkUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }

            context.startActivity(intent)
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }
}
