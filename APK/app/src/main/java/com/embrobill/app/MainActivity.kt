package com.embrobill.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLayout: LinearLayout
    private lateinit var retryButton: Button
    private lateinit var lockOverlayLayout: LinearLayout
    private lateinit var lockStatusMessage: TextView
    private lateinit var unlockButton: Button

    private val BASE_URL = "https://embrobill.vercel.app/"
    private var isPageLoaded = false
    private var keepSplash = true

    // App Lock security configuration
    private val PREFS_NAME = "embrobill_app_lock_prefs"
    private val KEY_ACTIVE_USER = "active_username"
    private val KEY_LOCK_PREFIX = "app_lock_"
    private var isAppLocked = false
    private var isAuthenticating = false

    // Back button state management
    private var lastBackPressTime: Long = 0L
    private val BACK_PRESS_DEBOUNCE_MS: Long = 600L
    private var shouldClearHistoryOnLoad: Boolean = false

    // File upload callback
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1001
    private val STORAGE_PERMISSION_REQUEST_CODE = 1002

    override fun onCreate(savedInstanceState: Bundle?) {
        // Install splash screen before super.onCreate
        val splashScreen = installSplashScreen()

        // Keep splash screen visible until page loads
        splashScreen.setKeepOnScreenCondition { keepSplash }

        super.onCreate(savedInstanceState)
        window.statusBarColor = ContextCompat.getColor(this, R.color.status_bar)
        setContentView(R.layout.activity_main)

        // Initialize views
        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorLayout = findViewById(R.id.errorLayout)
        retryButton = findViewById(R.id.retryButton)
        lockOverlayLayout = findViewById(R.id.lockOverlayLayout)
        lockStatusMessage = findViewById(R.id.lockStatusMessage)
        unlockButton = findViewById(R.id.unlockButton)

        unlockButton.setOnClickListener {
            showBiometricPromptToUnlock()
        }

        // Setup components
        setupWebView()
        setupRetryButton()

        // Check if App Lock is active for the current user on startup
        val activeUser = getActiveUser()
        if (activeUser.isNotEmpty() && isAppLockEnabledForUser(activeUser)) {
            isAppLocked = true
            lockOverlayLayout.visibility = View.VISIBLE
            Handler(Looper.getMainLooper()).postDelayed({
                showBiometricPromptToUnlock()
            }, 300)
        }

        // Load the website
        if (isNetworkAvailable()) {
            webView.loadUrl(BASE_URL)
        } else {
            showError()
            keepSplash = false
        }

        // Safety timeout: dismiss splash after 5 seconds regardless
        Handler(Looper.getMainLooper()).postDelayed({
            keepSplash = false
        }, 5000)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings: WebSettings = webView.settings

        // Enable JavaScript (required for the website)
        webSettings.javaScriptEnabled = true

        // Enable Chrome DevTools remote debugging
        WebView.setWebContentsDebuggingEnabled(true)

        // Enable DOM Storage (required for modern web apps)
        webSettings.domStorageEnabled = true

        // Enable database storage
        webSettings.databaseEnabled = true

        // Cache settings
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT

        // Allow file access
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true

        // Enable zoom controls (hidden)
        webSettings.setSupportZoom(true)
        webSettings.builtInZoomControls = true
        webSettings.displayZoomControls = false

        // Viewport settings for responsive design
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true

        // Mixed content mode (allow HTTPS content)
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Media playback
        webSettings.mediaPlaybackRequiresUserGesture = false

        // User agent - append app identifier
        val defaultUserAgent = webSettings.userAgentString
        webSettings.userAgentString = "$defaultUserAgent EmbroBillApp/1.0"

        // Enable cookies
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Set WebViewClient
        webView.webViewClient = EmbroBillWebViewClient()

        // Set WebChromeClient
        webView.webChromeClient = EmbroBillWebChromeClient()

        // Handle downloads
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            handleDownload(url, userAgent, contentDisposition, mimeType, contentLength)
        }

        // Register JavaScript interface for App Lock & biometric verification
        webView.addJavascriptInterface(AndroidAppLockInterface(this), "AndroidAppLock")

        // 1. Disable password saving & form data saving in WebView
        @Suppress("DEPRECATION")
        webSettings.savePassword = false
        @Suppress("DEPRECATION")
        webSettings.saveFormData = false

        // Disable Google Password Manager & Android Autofill inside the WebView
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }

        // 2. Disable long-press context menu on normal page content (text, links, images)
        // while preserving native long-press editing (like Paste, cursor) inside input fields
        webView.isLongClickable = true
        webView.setOnLongClickListener { view ->
            val hitTest = (view as? WebView)?.hitTestResult
            val type = hitTest?.type ?: WebView.HitTestResult.UNKNOWN_TYPE
            if (type == WebView.HitTestResult.EDIT_TEXT_TYPE) {
                false // Allow default editing behavior in input fields
            } else {
                true // Consume long-press on normal content to block browser menu / selection
            }
        }

        // Enable scrolling without overscroll bounce / pull-to-refresh
        webView.isScrollbarFadingEnabled = true
        webView.scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
        webView.overScrollMode = View.OVER_SCROLL_NEVER
    }

    private fun setupRetryButton() {
        retryButton.setOnClickListener {
            if (isNetworkAvailable()) {
                hideError()
                webView.loadUrl(BASE_URL)
            } else {
                Toast.makeText(this, "Still no internet connection", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ==================== WebViewClient ====================

    private inner class EmbroBillWebViewClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return false

            // Keep EmbroBill URLs inside WebView
            return if (url.startsWith(BASE_URL) || url.contains("embrobill.vercel.app")) {
                false // Load inside WebView
            } else if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:")) {
                // Handle special schemes externally
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Cannot open this link", Toast.LENGTH_SHORT).show()
                }
                true
            } else if (url.startsWith("http://") || url.startsWith("https://")) {
                // Open external URLs in browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Cannot open this link", Toast.LENGTH_SHORT).show()
                }
                true
            } else {
                false
            }
        }

        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            progressBar.visibility = View.VISIBLE
            hideError()
            injectHideFakeStatusBar(view)
            injectDedicatedAppRestrictions(view)
        }

        override fun onPageCommitVisible(view: WebView?, url: String?) {
            super.onPageCommitVisible(view, url)
            if (shouldClearHistoryOnLoad) {
                view?.clearHistory()
            }
            injectHideFakeStatusBar(view)
            injectAppLockCardIfNeeded(view)
            injectDedicatedAppRestrictions(view)
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            progressBar.visibility = View.GONE
            isPageLoaded = true
            keepSplash = false

            if (shouldClearHistoryOnLoad) {
                shouldClearHistoryOnLoad = false
                view?.clearHistory()
            }

            injectHideFakeStatusBar(view)
            injectAppLockCardIfNeeded(view)
            injectDedicatedAppRestrictions(view)

            // Flush cookies to persistent storage
            CookieManager.getInstance().flush()
        }

        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
            super.onReceivedError(view, request, error)
            // Only show error for main frame navigation failures
            if (request?.isForMainFrame == true) {
                progressBar.visibility = View.GONE
                keepSplash = false
                showError()
            }
        }
    }

    // ==================== WebChromeClient ====================

    private inner class EmbroBillWebChromeClient : WebChromeClient() {

        override fun onProgressChanged(view: WebView?, newProgress: Int) {
            super.onProgressChanged(view, newProgress)
            progressBar.progress = newProgress
            if (newProgress in 10..99) {
                injectHideFakeStatusBar(view)
            }
            if (newProgress == 100) {
                progressBar.visibility = View.GONE
                injectHideFakeStatusBar(view)
            }
        }

        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
            consoleMessage?.let {
                val logMsg = "[WebView JS] ${it.message()} (line ${it.lineNumber()} of ${it.sourceId()})"
                when (it.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e("EmbroBillWeb", logMsg)
                    ConsoleMessage.MessageLevel.WARNING -> Log.w("EmbroBillWeb", logMsg)
                    else -> Log.d("EmbroBillWeb", logMsg)
                }
            }
            return true
        }

        // Handle file upload input
        override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?
        ): Boolean {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = filePathCallback

            try {
                val intent = fileChooserParams?.createIntent() ?: run {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                    return false
                }
                startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
            } catch (e: Exception) {
                fileUploadCallback = null
                Toast.makeText(this@MainActivity, "Cannot open file chooser", Toast.LENGTH_SHORT).show()
                return false
            }
            return true
        }
    }

    // ==================== Download Handling ====================

    private fun handleDownload(
        url: String,
        userAgent: String,
        contentDisposition: String,
        mimeType: String,
        contentLength: Long
    ) {
        // Check/request storage permission for older devices
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                    STORAGE_PERMISSION_REQUEST_CODE
                )
                return
            }
        }

        try {
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)

            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                setDescription("Downloading $fileName")
                setTitle(fileName)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }

            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.enqueue(request)

            Toast.makeText(this, "Downloading: $fileName", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            // Fallback: open in browser
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            } catch (ex: Exception) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ==================== Network Check ====================

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ==================== Error Handling ====================

    private fun showError() {
        errorLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
    }

    private fun hideError() {
        errorLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    // ==================== Back Button ====================

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val now = SystemClock.uptimeMillis()
        if (now - lastBackPressTime < BACK_PRESS_DEBOUNCE_MS) {
            return
        }
        lastBackPressTime = now

        // If app is currently locked, Back exits the app (never bypass lock screen)
        if (isAppLocked) {
            finish()
            return
        }

        // If error screen is currently displayed, exit the app
        if (errorLayout.visibility == View.VISIBLE) {
            finish()
            return
        }

        val currentUrl = webView.url

        if (isHomePage(currentUrl) || shouldClearHistoryOnLoad) {
            // User is already on Home page -> Exit/Close the app
            finish()
        } else {
            // User is on any other page -> Go directly to Home page without stepping through history
            shouldClearHistoryOnLoad = true
            webView.clearHistory()
            webView.loadUrl(BASE_URL)
        }
    }

    /**
     * Helper to recognize whether a given URL is the Home page (https://embrobill.vercel.app/).
     * Correctly handles query parameters, fragments, and trailing slash differences.
     */
    private fun isHomePage(url: String?): Boolean {
        if (url.isNullOrBlank()) return true
        return try {
            val uri = Uri.parse(url)
            val host = uri.host?.lowercase() ?: ""
            val path = uri.path ?: ""

            val isTargetHost = host == "embrobill.vercel.app" || host == "www.embrobill.vercel.app"
            val isRootPath = path.isEmpty() || path == "/"

            isTargetHost && isRootPath
        } catch (e: Exception) {
            val clean = url.trim().lowercase().removeSuffix("/")
            clean == "https://embrobill.vercel.app" || clean == "http://embrobill.vercel.app"
        }
    }

    // ==================== Activity Result (File Upload) ====================

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (resultCode == RESULT_OK && data != null) {
                val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                fileUploadCallback?.onReceiveValue(result)
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
            fileUploadCallback = null
        }
    }

    // ==================== Permission Result ====================

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == STORAGE_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Permission granted. Please try downloading again.", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Storage permission required for downloads", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ==================== DOM Adjustments ====================

    /**
     * Injects CSS and a MutationObserver into the WebView to hide any fake
     * in-page status bar (.eb-status-bar) so only the system default Android status bar is shown.
     */
    private fun injectHideFakeStatusBar(view: WebView?) {
        val js = """
            (function() {
                var styleId = 'eb-hide-fake-status-bar-style';
                if (!document.getElementById(styleId)) {
                    var style = document.createElement('style');
                    style.id = styleId;
                    style.type = 'text/css';
                    style.textContent = '.eb-status-bar { display: none !important; } html, body { overscroll-behavior: none !important; overscroll-behavior-y: none !important; -webkit-overscroll-behavior: none !important; }';
                    var target = document.head || document.documentElement || document.body;
                    if (target) {
                        target.appendChild(style);
                    }
                }
                var bars = document.querySelectorAll('.eb-status-bar');
                for (var i = 0; i < bars.length; i++) {
                    bars[i].style.setProperty('display', 'none', 'important');
                }
                if (!window.__ebStatusBarObserverSet && window.MutationObserver) {
                    window.__ebStatusBarObserverSet = true;
                    var observer = new MutationObserver(function() {
                        var elements = document.querySelectorAll('.eb-status-bar');
                        for (var j = 0; j < elements.length; j++) {
                            elements[j].style.setProperty('display', 'none', 'important');
                        }
                    });
                    var root = document.body || document.documentElement;
                    if (root) {
                        observer.observe(root, { childList: true, subtree: true });
                    }
                }
            })();
        """.trimIndent()
        view?.evaluateJavascript(js, null)
    }

    /**
     * Dedicated app restrictions:
     * 1. Disables text selection and touch-callout on all normal page content (headings, paragraphs, buttons, cards, etc.).
     * 2. Preserves full editing, typing, cursor movement, and text selection inside input fields, textareas, and contenteditable elements.
     * 3. Disables password autofill prompts and browser password save suggestions.
     * 4. Suppresses unwanted long-press selection menus on non-editable elements.
     */
    private fun injectDedicatedAppRestrictions(view: WebView?) {
        val js = """
            (function() {
                var styleId = 'embrobill-app-restrictions-style';
                if (!document.getElementById(styleId)) {
                    var style = document.createElement('style');
                    style.id = styleId;
                    style.type = 'text/css';
                    style.innerHTML = 
                        '* {' +
                        '  -webkit-user-select: none !important;' +
                        '  -moz-user-select: none !important;' +
                        '  -ms-user-select: none !important;' +
                        '  user-select: none !important;' +
                        '  -webkit-touch-callout: none !important;' +
                        '}' +
                        'input, textarea, [contenteditable="true"], [contenteditable=""] {' +
                        '  -webkit-user-select: text !important;' +
                        '  -moz-user-select: text !important;' +
                        '  -ms-user-select: text !important;' +
                        '  user-select: text !important;' +
                        '  -webkit-touch-callout: default !important;' +
                        '}';
                    var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
                    if (head) {
                        head.appendChild(style);
                    }
                }

                function enforceAutofillAndInputRules() {
                    try {
                        var forms = document.getElementsByTagName('form');
                        for (var i = 0; i < forms.length; i++) {
                            forms[i].setAttribute('autocomplete', 'off');
                        }
                        var inputs = document.getElementsByTagName('input');
                        for (var j = 0; j < inputs.length; j++) {
                            var inp = inputs[j];
                            var type = (inp.getAttribute('type') || '').toLowerCase();
                            if (type === 'password') {
                                inp.setAttribute('autocomplete', 'new-password');
                                inp.setAttribute('data-lpignore', 'true');
                                inp.setAttribute('data-form-type', 'other');
                            } else if (!inp.hasAttribute('autocomplete') || inp.getAttribute('autocomplete') === 'on') {
                                inp.setAttribute('autocomplete', 'off');
                            }
                        }
                    } catch (e) {}
                }

                enforceAutofillAndInputRules();

                if (!window.__ebDedicatedRestrictionsSet) {
                    window.__ebDedicatedRestrictionsSet = true;

                    // Block long-press context menu on non-editable elements
                    document.addEventListener('contextmenu', function(e) {
                        var target = e.target;
                        var tagName = target ? target.tagName.toLowerCase() : '';
                        var isEditable = tagName === 'input' || tagName === 'textarea' || (target && target.isContentEditable);
                        if (!isEditable) {
                            e.preventDefault();
                            return false;
                        }
                    }, true);

                    // Block text selection start on non-editable elements
                    document.addEventListener('selectstart', function(e) {
                        var target = e.target;
                        var tagName = target ? target.tagName.toLowerCase() : '';
                        var isEditable = tagName === 'input' || tagName === 'textarea' || (target && target.isContentEditable);
                        if (!isEditable) {
                            e.preventDefault();
                            return false;
                        }
                    }, true);
                }

                // Ensure newly rendered React components/modals get autofill restrictions
                if (!window.__ebRestrictionsObserver && window.MutationObserver) {
                    window.__ebRestrictionsObserver = true;
                    var observer = new MutationObserver(function() {
                        enforceAutofillAndInputRules();
                    });
                    var root = document.body || document.documentElement;
                    if (root) {
                        observer.observe(root, { childList: true, subtree: true });
                    }
                }
            })();
        """.trimIndent()
        view?.evaluateJavascript(js, null)
    }

    /**
     * Fallback injector: Ensures the App Lock card is displayed on the Settings screen
     * even if the live cloud website hasn't deployed the new frontend code yet.
     */
    private fun injectAppLockCardIfNeeded(view: WebView?) {
        val js = """
            (function() {
                function checkAndInject() {
                    if (window.location.pathname.indexOf('settings') === -1) return;
                    if (document.getElementById('appLockSwitch')) return;

                    var securityCard = document.querySelector('.settings-card-security');
                    if (!securityCard || !securityCard.parentNode) return;

                    var username = '';
                    try {
                        username = localStorage.getItem('embrobill_remember_username') || '';
                    } catch (e) {}

                    var isEnabled = false;
                    if (window.AndroidAppLock) {
                        try {
                            isEnabled = window.AndroidAppLock.isAppLockEnabled(username);
                        } catch (e) {}
                    }

                    var card = document.createElement('div');
                    card.id = 'native-app-lock-card';
                    card.className = 'settings-card mb-3';
                    card.innerHTML = '<div class="settings-card-header">' +
                        '<div class="settings-card-header-left">' +
                        '<div class="settings-icon-badge blue"><i class="bi bi-shield-check"></i></div>' +
                        '<h6 class="settings-card-title blue">Security</h6>' +
                        '</div>' +
                        '<span class="settings-badge-pill ' + (isEnabled ? 'green' : 'gray') + '" id="injectedAppLockBadge">' +
                        (isEnabled ? 'ACTIVE' : 'OFF') +
                        '</span>' +
                        '</div>' +
                        '<p class="settings-card-desc">Protect your account by requiring Android device authentication (Fingerprint, Face, or Phone PIN/Pattern) before accessing EmbroBill.</p>' +
                        '<div class="settings-app-lock-row d-flex align-items-center justify-content-between p-3 rounded-3" style="background-color: #f8fafc; border: 1px solid #e2e8f0;">' +
                        '<div class="d-flex align-items-center gap-3">' +
                        '<div id="injectedLockIconBox" style="width: 42px; height: 42px; border-radius: 10px; background-color: ' + (isEnabled ? '#dbeafe' : '#e2e8f0') + '; display: flex; align-items: center; justify-content: center; color: ' + (isEnabled ? '#1e40af' : '#64748b') + '; font-size: 20px;">' +
                        '<i id="injectedLockIcon" class="bi ' + (isEnabled ? 'bi-fingerprint' : 'bi-shield-lock') + '"></i>' +
                        '</div>' +
                        '<div>' +
                        '<div class="fw-bold text-dark" style="font-size: 15px;">App Lock</div>' +
                        '<div id="injectedLockSubtitle" class="text-muted" style="font-size: 12px;">' + (isEnabled ? 'Protected by phone screen lock / biometrics' : 'Disabled — opens without device authentication') + '</div>' +
                        '</div>' +
                        '</div>' +
                        '<div class="form-check form-switch mb-0">' +
                        '<input class="form-check-input" type="checkbox" role="switch" id="appLockSwitch" ' + (isEnabled ? 'checked' : '') + ' style="width: 48px; height: 24px; cursor: pointer;" />' +
                        '</div>' +
                        '</div>';

                    securityCard.parentNode.insertBefore(card, securityCard);

                    function showInjectedPillToast(msg, type, duration) {
                        duration = duration || 4500;
                        var existing = document.getElementById('injectedGlobalPillToast');
                        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
                        
                        var container = document.createElement('div');
                        container.id = 'injectedGlobalPillToast';
                        container.className = 'app-pill-toast-container no-print';
                        
                        var iconClass = 'bi-info-circle-fill';
                        if (type === 'success') iconClass = 'bi-check-circle-fill';
                        else if (type === 'danger') iconClass = 'bi-exclamation-circle-fill';
                        else if (type === 'warning') iconClass = 'bi-exclamation-triangle-fill';
                        
                        var isWaiting = (type === 'info' && (msg.indexOf('Waiting') !== -1 || msg.indexOf('Authenticating') !== -1));
                        var iconHtml = isWaiting ? '<span class="spinner-border spinner-border-sm me-1" role="status" style="width: 15px; height: 15px; border-width: 2px;"></span>' : '<i class="bi ' + iconClass + ' app-pill-toast-icon"></i>';
                        
                        container.innerHTML = '<div class="app-pill-toast ' + type + '">' +
                            '<div class="app-pill-toast-left">' +
                            iconHtml +
                            '<span class="app-pill-toast-message">' + msg + '</span>' +
                            '</div>' +
                            '<button type="button" class="app-pill-toast-close" title="Dismiss" aria-label="Dismiss notification">' +
                            '<i class="bi bi-x-lg"></i>' +
                            '</button>' +
                            '</div>';
                            
                        document.body.appendChild(container);
                        
                        var closeBtn = container.querySelector('.app-pill-toast-close');
                        if (closeBtn) {
                            closeBtn.onclick = function() {
                                if (container.parentNode) container.parentNode.removeChild(container);
                            };
                        }
                        
                        if (duration > 0) {
                            setTimeout(function() {
                                if (container.parentNode) container.parentNode.removeChild(container);
                            }, duration);
                        }
                    }

                    var sw = document.getElementById('appLockSwitch');
                    if (sw) {
                        sw.addEventListener('change', function(e) {
                            var checked = e.target.checked;
                            if (window.AndroidAppLock) {
                                if (checked) {
                                    if (window.triggerAlert) {
                                        window.triggerAlert('Waiting for Fingerprint or Phone PIN verification...', 'info', 20000);
                                    } else {
                                        showInjectedPillToast('Waiting for Fingerprint or Phone PIN verification...', 'info', 20000);
                                    }
                                    window.AndroidAppLock.verifyAndEnableAppLock(username);
                                } else {
                                    window.AndroidAppLock.setAppLockEnabled(username, false);
                                    updateUI(false);
                                    if (window.triggerAlert) {
                                        window.triggerAlert('App Lock has been disabled.', 'info');
                                    } else {
                                        showInjectedPillToast('App Lock has been disabled.', 'info');
                                    }
                                }
                            }
                        });
                    }

                    window.onAppLockVerified = function(success, msg) {
                        var toastMsg = msg || (success ? 'App Lock enabled successfully.' : 'App Lock setup cancelled or failed.');
                        var toastType = success ? 'success' : 'danger';
                        if (window.triggerAlert) {
                            window.triggerAlert(toastMsg, toastType);
                        } else {
                            showInjectedPillToast(toastMsg, toastType);
                        }
                        var swEl = document.getElementById('appLockSwitch');
                        if (swEl) swEl.checked = success;
                        updateUI(success);
                    };

                    function updateUI(active) {
                        var badge = document.getElementById('injectedAppLockBadge');
                        if (badge) {
                            badge.className = 'settings-badge-pill ' + (active ? 'green' : 'gray');
                            badge.textContent = active ? 'ACTIVE' : 'OFF';
                        }
                        var box = document.getElementById('injectedLockIconBox');
                        if (box) box.style.backgroundColor = active ? '#dbeafe' : '#e2e8f0';
                        var icon = document.getElementById('injectedLockIcon');
                        if (icon) icon.className = 'bi ' + (active ? 'bi-fingerprint' : 'bi-shield-lock');
                        var sub = document.getElementById('injectedLockSubtitle');
                        if (sub) sub.textContent = active ? 'Protected by phone screen lock / biometrics' : 'Disabled — opens without device authentication';
                    }
                }

                checkAndInject();
                if (!window.__ebSettingsObserverSet && window.MutationObserver) {
                    window.__ebSettingsObserverSet = true;
                    var observer = new MutationObserver(checkAndInject);
                    var root = document.body || document.documentElement;
                    if (root) observer.observe(root, { childList: true, subtree: true });
                }
            })();
        """.trimIndent()
        view?.evaluateJavascript(js, null)
    }

    // ==================== App Lock & Biometrics ====================

    private fun getAuthenticators(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        }
    }

    fun isDeviceSecurityAvailable(): Boolean {
        val manager = BiometricManager.from(this)
        return manager.canAuthenticate(getAuthenticators()) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun isAppLockEnabledForUser(username: String): Boolean {
        if (username.isBlank()) return false
        val cleanUser = username.trim().lowercase()
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_LOCK_PREFIX + cleanUser, false)
    }

    fun setAppLockEnabledForUser(username: String, enabled: Boolean): Boolean {
        if (username.isBlank()) return false
        val cleanUser = username.trim().lowercase()
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_LOCK_PREFIX + cleanUser, enabled)
            if (enabled) {
                putString(KEY_ACTIVE_USER, cleanUser)
            } else if (getActiveUser() == cleanUser) {
                remove(KEY_ACTIVE_USER)
            }
            apply()
        }
        return true
    }

    fun setActiveUser(username: String) {
        if (username.isBlank()) return
        val cleanUser = username.trim().lowercase()
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_ACTIVE_USER, cleanUser).apply()
    }

    fun getActiveUser(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_ACTIVE_USER, "") ?: ""
    }

    fun verifyAndEnableAppLock(username: String) {
        if (!isDeviceSecurityAvailable()) {
            Toast.makeText(this, "Device lock (Fingerprint/Face/PIN) is not set up on this phone", Toast.LENGTH_LONG).show()
            notifyWebVerificationResult(false, "Device lock (Fingerprint, Face, or PIN) is not set up on this phone. Please enable a screen lock in phone settings.")
            return
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Set Up EmbroBill App Lock")
            .setSubtitle("Authenticate using Fingerprint, Face, or Phone PIN")
            .setAllowedAuthenticators(getAuthenticators())
            .build()

        val executor = ContextCompat.getMainExecutor(this)
        val biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                setAppLockEnabledForUser(username, true)
                setActiveUser(username)
                Toast.makeText(this@MainActivity, "App Lock enabled successfully", Toast.LENGTH_SHORT).show()
                notifyWebVerificationResult(true, "App Lock enabled successfully")
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                    Toast.makeText(this@MainActivity, errString.toString(), Toast.LENGTH_SHORT).show()
                }
                notifyWebVerificationResult(false, errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
            }
        })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            notifyWebVerificationResult(false, e.message ?: "Authentication failed")
        }
    }

    fun showBiometricPromptToUnlock() {
        if (!isAppLocked || isAuthenticating) return
        if (!isDeviceSecurityAvailable()) {
            isAppLocked = false
            lockOverlayLayout.visibility = View.GONE
            return
        }

        isAuthenticating = true
        lockStatusMessage.text = "EmbroBill is Locked"

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock EmbroBill")
            .setSubtitle("Use Fingerprint, Face, or Phone PIN to continue")
            .setAllowedAuthenticators(getAuthenticators())
            .build()

        val executor = ContextCompat.getMainExecutor(this)
        val biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                isAuthenticating = false
                isAppLocked = false
                lockOverlayLayout.visibility = View.GONE
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                isAuthenticating = false
                lockStatusMessage.text = errString
                lockOverlayLayout.visibility = View.VISIBLE
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                lockStatusMessage.text = "Authentication failed. Tap Unlock to try again."
            }
        })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            isAuthenticating = false
            lockStatusMessage.text = "Tap Unlock to authenticate"
        }
    }

    fun handleUserLogout(username: String) {
        val cleanUser = username.trim().lowercase()
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_LOCK_PREFIX + cleanUser, false)
            remove(KEY_ACTIVE_USER)
            apply()
        }
        isAppLocked = false
        lockOverlayLayout.visibility = View.GONE
        CookieManager.getInstance().removeAllCookies(null)
        CookieManager.getInstance().flush()
    }

    private fun notifyWebVerificationResult(success: Boolean, message: String) {
        val escaped = message.replace("'", "\\'")
        val js = "window.onAppLockVerified && window.onAppLockVerified($success, '$escaped');"
        webView.evaluateJavascript(js, null)
    }

    // ==================== JavaScript Interface ====================

    inner class AndroidAppLockInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun isAppLockAvailable(): Boolean {
            return activity.isDeviceSecurityAvailable()
        }

        @JavascriptInterface
        fun isAppLockEnabled(username: String): Boolean {
            return activity.isAppLockEnabledForUser(username)
        }

        @JavascriptInterface
        fun setAppLockEnabled(username: String, enabled: Boolean): Boolean {
            return activity.setAppLockEnabledForUser(username, enabled)
        }

        @JavascriptInterface
        fun verifyAndEnableAppLock(username: String) {
            activity.runOnUiThread {
                activity.verifyAndEnableAppLock(username)
            }
        }

        @JavascriptInterface
        fun setActiveUser(username: String) {
            activity.setActiveUser(username)
        }

        @JavascriptInterface
        fun onUserLogout(username: String) {
            activity.runOnUiThread {
                activity.handleUserLogout(username)
            }
        }
    }

    // ==================== Lifecycle ====================

    override fun onStart() {
        super.onStart()
        if (isAppLocked && !isAuthenticating) {
            lockOverlayLayout.visibility = View.VISIBLE
            showBiometricPromptToUnlock()
        }
    }

    override fun onStop() {
        super.onStop()
        val activeUser = getActiveUser()
        if (activeUser.isNotEmpty() && isAppLockEnabledForUser(activeUser)) {
            isAppLocked = true
            lockOverlayLayout.visibility = View.VISIBLE
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        CookieManager.getInstance().setAcceptCookie(true)
        if (isAppLocked && !isAuthenticating) {
            lockOverlayLayout.visibility = View.VISIBLE
            showBiometricPromptToUnlock()
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
