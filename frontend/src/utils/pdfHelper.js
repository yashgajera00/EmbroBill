/**
 * PDF Helper utility for downloading and previewing invoice/challan PDFs
 * seamlessly across both desktop browsers and Android WebView APK.
 */

export const isAndroidApp = () => {
  if (typeof window === 'undefined') return false;
  return !!(
    window.AndroidApp ||
    window.AndroidAppLock ||
    (navigator.userAgent && navigator.userAgent.includes('EmbroBillApp'))
  );
};

export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * Downloads a PDF blob.
 * In Android APK: delegates to native Android download manager to save to the phone's Downloads directory.
 * In Web browser: triggers standard <a> download.
 */
export const downloadPdfBlob = async (blob, filename, triggerAlert) => {
  if (!blob) return;

  const isApp = isAndroidApp();
  const nativeApp = window.AndroidApp || window.AndroidAppLock;

  if (isApp && nativeApp && typeof nativeApp.downloadPdf === 'function') {
    try {
      if (triggerAlert) {
        triggerAlert(`Downloading ${filename}...`, 'info', 2500);
      }
      const base64Data = await blobToBase64(blob);
      nativeApp.downloadPdf(base64Data, filename);
      return;
    } catch (err) {
      console.error('Native PDF download failed, trying browser fallback:', err);
    }
  }

  // Web browser fallback
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2000);

    if (triggerAlert) {
      triggerAlert(`Downloaded ${filename}`, 'success', 3000);
    }
  } catch (err) {
    console.error('Browser PDF download error:', err);
    if (triggerAlert) {
      triggerAlert('Failed to download PDF.', 'danger');
    }
  }
};

/**
 * Previews a PDF blob.
 * In Android APK: launches Android's native system PDF viewer (Drive, Adobe, etc.) via FileProvider.
 * Returns true if native preview was launched, false otherwise.
 */
export const previewPdfBlob = async (blob, filename) => {
  if (!blob) return false;

  const isApp = isAndroidApp();
  const nativeApp = window.AndroidApp || window.AndroidAppLock;

  if (isApp && nativeApp && typeof nativeApp.previewPdf === 'function') {
    try {
      const base64Data = await blobToBase64(blob);
      nativeApp.previewPdf(base64Data, filename);
      return true;
    } catch (err) {
      console.error('Native PDF preview failed:', err);
    }
  }

  return false;
};
