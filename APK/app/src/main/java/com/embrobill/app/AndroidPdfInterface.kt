package com.embrobill.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

class AndroidPdfInterface(private val context: Context) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun downloadPdf(base64Data: String?, fileName: String?) {
        if (base64Data.isNullOrBlank()) {
            mainHandler.post {
                Toast.makeText(context, "Download failed: Empty data", Toast.LENGTH_SHORT).show()
            }
            return
        }

        val name = sanitizeFileName(fileName)

        Thread {
            try {
                val bytes = decodeBase64(base64Data)
                val success = saveFileToDownloads(bytes, name)

                mainHandler.post {
                    if (success) {
                        Toast.makeText(context, "Saved to Downloads: $name", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, "Failed to save file to Downloads", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("EmbroBillPDF", "Error saving PDF download", e)
                mainHandler.post {
                    Toast.makeText(context, "Error saving file: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    @JavascriptInterface
    fun previewPdf(base64Data: String?, fileName: String?) {
        if (base64Data.isNullOrBlank()) {
            mainHandler.post {
                Toast.makeText(context, "Cannot preview: Empty data", Toast.LENGTH_SHORT).show()
            }
            return
        }

        val name = sanitizeFileName(fileName)

        Thread {
            try {
                val bytes = decodeBase64(base64Data)
                val cacheDir = File(context.cacheDir, "pdf_previews")
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs()
                }
                val previewFile = File(cacheDir, name)
                FileOutputStream(previewFile).use { it.write(bytes) }

                val uri: Uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    previewFile
                )

                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/pdf")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                mainHandler.post {
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        try {
                            val chooser = Intent.createChooser(intent, "Open Bill PDF")
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            context.startActivity(chooser)
                        } catch (ex: Exception) {
                            Log.e("EmbroBillPDF", "No PDF reader app found", ex)
                            Toast.makeText(context, "No PDF viewer found. Saving to Downloads...", Toast.LENGTH_SHORT).show()
                            downloadPdf(base64Data, name)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("EmbroBillPDF", "Error preparing PDF preview", e)
                mainHandler.post {
                    Toast.makeText(context, "Error opening PDF preview: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    private fun decodeBase64(base64Data: String): ByteArray {
        val cleanData = if (base64Data.contains(",")) {
            base64Data.substringAfter(",")
        } else {
            base64Data
        }
        return Base64.decode(cleanData.trim(), Base64.DEFAULT)
    }

    private fun sanitizeFileName(fileName: String?): String {
        var name = (fileName ?: "Invoice_${System.currentTimeMillis()}.pdf").trim()
        name = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
        if (!name.lowercase().endsWith(".pdf")) {
            name += ".pdf"
        }
        return name
    }

    private fun saveFileToDownloads(bytes: ByteArray, fileName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return false

                resolver.openOutputStream(uri)?.use { os ->
                    os.write(bytes)
                    os.flush()
                }
                true
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs()
                }
                val targetFile = File(downloadsDir, fileName)
                FileOutputStream(targetFile).use { os ->
                    os.write(bytes)
                    os.flush()
                }
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(targetFile.absolutePath),
                    arrayOf("application/pdf"),
                    null
                )
                true
            }
        } catch (e: Exception) {
            Log.e("EmbroBillPDF", "Failed to save file to Downloads", e)
            false
        }
    }
}
