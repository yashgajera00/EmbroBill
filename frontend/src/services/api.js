import axios from 'axios';

// Determine base URL: Always use PythonAnywhere production URL,
// only falling back to localhost if running specifically on localhost in local dev mode.
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  import.meta.env.VITE_USE_LOCAL_API === 'true';

const api = axios.create({
  baseURL: isLocalhost
    ? 'http://127.0.0.1:8000/api'
    : 'https://embrobill00.pythonanywhere.com/api',
  withCredentials: true,
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Read session key from localStorage if available.
    // This provides fallback authentication on mobile browsers (iOS Safari ITP, Android Chrome)
    // where third-party / cross-site cookies are blocked by default.
    try {
      const sessionKey = localStorage.getItem('embrobill_session_key');
      if (sessionKey) {
        config.headers['X-Session-ID'] = sessionKey;
        config.headers['Authorization'] = `Session ${sessionKey}`;
      }
    } catch (e) {
      // Ignore errors if localStorage is restricted
    }

    // Prevent caching of GET requests in browser / Electron
    if (config.method && config.method.toLowerCase() === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Configure Axios to automatically read the CSRF token from the Django cookie
api.defaults.xsrfCookieName = 'csrftoken';
api.defaults.xsrfHeaderName = 'X-CSRFToken';

// Add response interceptor for handling common errors, such as 403 Forbidden or 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        try {
          localStorage.removeItem('embrobill_session_key');
        } catch (e) {}
      }
    }
    return Promise.reject(error);
  }
);

export default api;
