import axios from 'axios';

const api = axios.create({
  baseURL: (window.location.protocol === 'http:' || window.location.protocol === 'https:') ? '/api' : 'http://127.0.0.1:8000/api',
  withCredentials: true, // Crucial for Django session cookie authentication
});

// Add request interceptor to prevent caching of GET requests in browser / Electron
api.interceptors.request.use(
  (config) => {
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
      // If unauthorized, we can handle it or redirect to login (unless checking auth status)
      if (error.response.status === 401 || error.response.status === 403) {
        // Handle unauthorized access globally if required, or let pages handle it
      }
    }
    return Promise.reject(error);
  }
);

export default api;
