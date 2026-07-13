const { app, BrowserWindow, protocol, dialog, session, screen } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const netSocket = require('net');
const http = require('http');
const os = require('os');

// Windows version support check (requires Windows 7 SP1 or newer)
function isWindowsVersionSupported() {
  if (process.platform !== 'win32') {
    return true;
  }
  try {
    const release = os.release();
    const parts = release.split('.').map(p => parseInt(p, 10));
    const major = parts[0] || 0;
    const minor = parts[1] || 0;
    const build = parts[2] || 0;

    if (major < 6) {
      return false; // Windows Vista or older
    }
    if (major === 6) {
      if (minor < 1) {
        return false; // Windows Vista (6.0)
      }
      if (minor === 1 && build < 7601) {
        return false; // Windows 7 RTM (6.1.7600), requires SP1 (6.1.7601)
      }
    }
  } catch (e) {
    // If check fails, default to true to allow launch
  }
  return true;
}

if (!isWindowsVersionSupported()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('System Requirements', 'EmbroBill requires Windows 7 SP1 or later.');
    app.quit();
  });
  return;
}


let mainWindow = null;
let djangoProcess = null;

const DJANGO_PORT = 8000;

// Register the app scheme as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Helper to check if a port is open
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const client = new netSocket.Socket();
    client.once('connect', () => {
      client.end();
      resolve(true);
    });
    client.once('error', () => {
      resolve(false);
    });
    client.connect({ port, host });
  });
}

// Helper to wait until a port is open
function waitForPort(port, host = '127.0.0.1', timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      const isOpen = await checkPort(port, host);
      if (isOpen) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for port ${port}`));
      } else {
        setTimeout(check, 250);
      }
    };
    check();
  });
}

// Start Django subprocess
function startDjangoBackend() {
  if (app.isPackaged) {
    const backendPath = path.join(process.resourcesPath, 'backend', 'backend.exe');
    console.log(`[Electron Main] Spawning production backend from: ${backendPath}`);
    
    djangoProcess = spawn(backendPath, [], {
      cwd: path.dirname(backendPath),
      env: { ...process.env }
    });
  } else {
    console.log(`[Electron Main] Spawning development backend...`);
    djangoProcess = spawn('python', ['desktop_launcher.py'], {
      cwd: __dirname,
      env: { ...process.env }
    });
  }

  djangoProcess.stdout.on('data', (data) => {
    console.log(`[Django STDOUT]: ${data.toString().trim()}`);
  });

  djangoProcess.stderr.on('data', (data) => {
    console.error(`[Django STDERR]: ${data.toString().trim()}`);
  });

  djangoProcess.on('close', (code) => {
    console.log(`[Django Backend] Process exited with code ${code}`);
  });
}

// Kill Django subprocess tree (handles Windows process trees properly)
function killDjangoBackend() {
  if (djangoProcess) {
    console.log(`[Electron Main] Terminating Django process tree (PID: ${djangoProcess.pid})...`);
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${djangoProcess.pid} /T /F`, (err, stdout, stderr) => {
        if (err) {
          console.error(`[Electron Main] Error terminating Django process tree: ${err.message}`);
        } else {
          console.log('[Electron Main] Django backend process tree terminated.');
        }
      });
    } else {
      djangoProcess.kill('SIGINT');
    }
    djangoProcess = null;
  }
}

// Calculate the appropriate zoom factor for a given display size
// Design baseline: 1280x800 at 96 DPI (scale factor 1)
function calculateZoomFactor(display) {
  const DESIGN_WIDTH = 1280;
  const DESIGN_HEIGHT = 800;

  const { width: workWidth, height: workHeight } = display.workAreaSize;
  const scaleFactor = display.scaleFactor || 1;

  // Physical pixels available (after OS DPI scaling)
  const effectiveWidth = workWidth;
  const effectiveHeight = workHeight;

  // Calculate zoom based on the most constrained axis
  const zoomByWidth = effectiveWidth / DESIGN_WIDTH;
  const zoomByHeight = effectiveHeight / DESIGN_HEIGHT;
  let zoom = Math.min(zoomByWidth, zoomByHeight);

  // Clamp zoom between 0.5 (very small screens) and 1.5 (very large screens)
  zoom = Math.max(0.5, Math.min(1.5, zoom));

  // Round to 2 decimal places to avoid sub-pixel rendering artifacts
  zoom = Math.round(zoom * 100) / 100;

  console.log(`[Zoom] Display: ${effectiveWidth}x${effectiveHeight}, scaleFactor: ${scaleFactor}, calculated zoom: ${zoom}`);
  return zoom;
}

// Apply zoom factor to the BrowserWindow based on the display it is currently on
function applyZoomForCurrentDisplay(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const winBounds = win.getBounds();
    const currentDisplay = screen.getDisplayNearestPoint({ x: winBounds.x, y: winBounds.y });
    const zoom = calculateZoomFactor(currentDisplay);
    win.webContents.setZoomFactor(zoom);
    console.log(`[Zoom] Applied zoom factor: ${zoom}`);
  } catch (e) {
    console.error(`[Zoom] Error applying zoom: ${e.message}`);
  }
}

// Create BrowserWindow
async function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: workAreaWidth, height: workAreaHeight } = primaryDisplay.workAreaSize;

  const windowWidth = Math.min(1280, workAreaWidth);
  const windowHeight = Math.min(800, workAreaHeight);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 500,
    title: 'EmbroBill',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
      plugins: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Apply zoom after content loads
  mainWindow.webContents.on('did-finish-load', () => {
    applyZoomForCurrentDisplay(mainWindow);
  });

  // Re-apply zoom when window is moved (possibly to a different monitor)
  mainWindow.on('move', () => {
    if (mainWindow._moveDebounce) clearTimeout(mainWindow._moveDebounce);
    mainWindow._moveDebounce = setTimeout(() => {
      applyZoomForCurrentDisplay(mainWindow);
    }, 300);
  });

  // Re-apply zoom when window is resized
  mainWindow.on('resize', () => {
    if (mainWindow._resizeDebounce) clearTimeout(mainWindow._resizeDebounce);
    mainWindow._resizeDebounce = setTimeout(() => {
      applyZoomForCurrentDisplay(mainWindow);
    }, 300);
  });

  startDjangoBackend();

  try {
    console.log('[Electron Main] Waiting for Django server to respond on port 8000...');
    await waitForPort(DJANGO_PORT, '127.0.0.1', 15000);
    console.log('[Electron Main] Django backend is ready.');

    if (app.isPackaged) {
      mainWindow.loadURL('app://./index.html');
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
  } catch (error) {
    console.error(`[Electron Main] Backend failed to start: ${error.message}`);
    mainWindow.loadURL(`data:text/html,<html><body><h2 style="color:red;font-family:sans-serif;text-align:center;margin-top:20%;">Failed to initialize backend services. Please check logs and restart the app.</h2></body></html>`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const appData = process.env.APPDATA || process.env.LOCALAPPDATA;
const desktopDataDir = appData ? path.join(appData, 'SuratTextileBilling') : __dirname;
const cookieFilePath = path.join(desktopDataDir, 'session_cookies.json');

let cookieJar = '';

function getCookieValue(cookieString, name) {
  const matches = cookieString.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

function updateCookieJar(setCookieHeader) {
  if (!setCookieHeader) return;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const jarMap = new Map();
  if (cookieJar) {
    cookieJar.split(';').forEach(c => {
      const parts = c.split('=');
      if (parts.length === 2) {
        jarMap.set(parts[0].trim(), parts[1].trim());
      }
    });
  }
  cookies.forEach(cookieStr => {
    const csrfMatch = cookieStr.match(/csrftoken=([^;,\s]*)/);
    if (csrfMatch) {
      jarMap.set('csrftoken', csrfMatch[1]);
    }
    const sessionMatch = cookieStr.match(/sessionid=([^;,\s]*)/);
    if (sessionMatch) {
      jarMap.set('sessionid', sessionMatch[1]);
    }
  });
  const jarParts = [];
  jarMap.forEach((val, key) => {
    jarParts.push(`${key}=${val}`);
  });
  cookieJar = jarParts.join('; ');
  logToFile(`[Cookie Jar] Updated Cookie Jar: ${cookieJar}`);

  try {
    if (!fs.existsSync(desktopDataDir)) {
      fs.mkdirSync(desktopDataDir, { recursive: true });
    }
    fs.writeFileSync(cookieFilePath, JSON.stringify({ cookieJar }), 'utf8');
    logToFile(`[Cookie Jar] Successfully persisted cookies to disk.`);
  } catch (e) {
    logToFile(`[Cookie Jar] Error persisting cookies: ${e.message}`);
  }
}

let logFilePath = 'e:\\bill_system\\main_process_debug.log';
function logToFile(msg) {
  try {
    fs.appendFileSync(logFilePath, msg + '\n', 'utf8');
  } catch (e) {}
}

// Load persistent cookies on startup
try {
  if (fs.existsSync(cookieFilePath)) {
    const fileData = fs.readFileSync(cookieFilePath, 'utf8');
    const parsed = JSON.parse(fileData);
    cookieJar = parsed.cookieJar || '';
    logToFile(`[Cookie Jar] Loaded persistent cookies: ${cookieJar}`);
  } else {
    logToFile('[Cookie Jar] No persistent cookie file found.');
  }
} catch (e) {
  logToFile(`[Cookie Jar] Error loading persistent cookies: ${e.message}`);
}

app.whenReady().then(() => {
  // Clear session cache and storage caches on startup to prevent loading old cached frontend build
  if (session.defaultSession) {
    session.defaultSession.clearCache().then(() => {
      logToFile('[Session] Cache cleared successfully.');
    }).catch(err => {
      logToFile(`[Session] Failed to clear cache: ${err.message}`);
    });
    session.defaultSession.clearStorageData({
      storages: ['appcache', 'shadercache', 'serviceworkers', 'cachestorage']
    }).then(() => {
      logToFile('[Session] Storage caches cleared successfully.');
    }).catch(err => {
      logToFile(`[Session] Failed to clear storage caches: ${err.message}`);
    });
  }

  // Set up custom app:// protocol handler using registerBufferProtocol for Electron 12 compatibility
  protocol.registerBufferProtocol('app', (request, callback) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    logToFile(`[Protocol Request] URL: ${request.url}, Pathname: ${pathname}, Host: ${url.host}`);

    // 1. Check if it's an API, admin or admin-static request, proxy it to Django backend
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin/') || pathname.startsWith('/static/admin/')) {
      
      // Handle OPTIONS preflight requests directly
      if (request.method === 'OPTIONS') {
        callback({
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-CSRFToken, Cookie, Accept',
            'Access-Control-Allow-Credentials': 'true'
          },
          data: Buffer.alloc(0)
        });
        return;
      }

      const targetUrl = `http://127.0.0.1:${DJANGO_PORT}${pathname}${url.search}`;
      logToFile(`[Protocol Proxy] Proxying ${request.url} to ${targetUrl}`);
      
      const headers = {};
      if (request.headers) {
        for (const [key, val] of Object.entries(request.headers)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey !== 'host') {
            headers[lowerKey] = val;
          }
        }
      }
      headers['host'] = `127.0.0.1:${DJANGO_PORT}`;

      // Calculate Content-Length from uploadData if body is present to prevent chunked encoding issues with Django runserver
      if (request.uploadData && request.uploadData.length > 0) {
        let calculatedLength = 0;
        for (const part of request.uploadData) {
          if (part.bytes) {
            calculatedLength += part.bytes.length;
          } else if (part.file) {
            try {
              const stats = fs.statSync(part.file);
              calculatedLength += stats.size;
            } catch (e) {
              logToFile(`[Protocol Proxy] Error getting file size for content-length: ${e.message}`);
            }
          }
        }
        headers['content-length'] = calculatedLength.toString();
      }

      // Inject cookies and CSRF tokens from the main process jar
      if (cookieJar) {
        headers['cookie'] = cookieJar;
        const csrfToken = getCookieValue(cookieJar, 'csrftoken');
        if (csrfToken) {
          headers['x-csrftoken'] = csrfToken;
        }
      }
      
      logToFile(`[Protocol Proxy] Request Headers for ${targetUrl}: ${JSON.stringify(headers)}`);

      const parsedUrl = new URL(targetUrl);
      const reqOptions = {
        method: request.method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: headers
      };

      const proxyReq = http.request(reqOptions, (res) => {
        logToFile(`[Protocol Proxy] Got response: ${res.statusCode} for ${targetUrl}`);
        
        // Extract set-cookie headers to update the main process Cookie Jar
        const setCookieHeaders = res.headers['set-cookie'];
        logToFile(`[Protocol Proxy] Got Set-Cookie headers: ${JSON.stringify(setCookieHeaders)}`);
        if (setCookieHeaders) {
          updateCookieJar(setCookieHeaders);
        }

        const responseHeaders = { ...res.headers };
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Credentials'] = 'true';

        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const responseData = Buffer.concat(chunks);
          callback({
            statusCode: res.statusCode,
            headers: responseHeaders,
            data: responseData
          });
        });
      });

      proxyReq.on('error', (err) => {
        logToFile(`[Protocol Proxy] Error fetching ${targetUrl}: ${err.stack || err.message}`);
        console.error(`[Protocol Proxy] Error fetching ${targetUrl}:`, err);
        callback({
          statusCode: 502,
          headers: { 'Access-Control-Allow-Origin': '*' },
          data: Buffer.from(`Backend Error: ${err.message}`)
        });
      });

      // Write POST/PUT body if present
      if (request.uploadData && request.uploadData.length > 0) {
        for (const part of request.uploadData) {
          if (part.bytes) {
            proxyReq.write(part.bytes);
          } else if (part.file) {
            try {
              const fileData = fs.readFileSync(part.file);
              proxyReq.write(fileData);
            } catch (e) {
              logToFile(`[Protocol Proxy] Error reading file for body: ${e.message}`);
            }
          }
        }
      }

      proxyReq.end();
      return;
    }

    // 2. Serve static files from the dist/ folder
    const distPath = path.join(__dirname, 'dist');
    const safePath = decodeURIComponent(pathname);
    let filePath = path.join(distPath, safePath);

    // Support SPA routing: serve index.html if the file doesn't exist or is a directory
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`[Protocol File] Error reading ${filePath}:`, err);
        callback({
          statusCode: 404,
          data: Buffer.from('Not Found')
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.pdf': 'application/pdf'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      callback({
        statusCode: 200,
        headers: { 
          'content-type': contentType,
          'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
        },
        data: data
      });
    });
  }, (error) => {
    if (error) console.error('Failed to register protocol', error);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  killDjangoBackend();
});
