# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebViewClient and WebChromeClient
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient

# Keep Kotlin metadata
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }

# Keep Biometric library
-keep class androidx.biometric.** { *; }
-dontwarn androidx.biometric.**

# Keep JavaScript Interface classes
-keep class com.embrobill.app.MainActivity$** { *; }
