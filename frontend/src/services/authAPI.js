import api from './api';

export const authAPI = {
  status: async () => {
    try {
      const response = await api.get('/auth/status/');
      if (response.data && response.data.isAuthenticated && response.data.session_key) {
        try {
          localStorage.setItem('embrobill_session_key', response.data.session_key);
        } catch (e) {}
      } else if (response.data && !response.data.isAuthenticated) {
        try {
          localStorage.removeItem('embrobill_session_key');
        } catch (e) {}
      }
      return response.data;
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        try {
          localStorage.removeItem('embrobill_session_key');
        } catch (e) {}
      }
      throw err;
    }
  },

  login: async (username, password) => {
    const response = await api.post('/login/', { username, password });
    if (response.data && response.data.session_key) {
      try {
        localStorage.setItem('embrobill_session_key', response.data.session_key);
      } catch (e) {}
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/register/', userData);
    if (response.data && response.data.session_key) {
      try {
        localStorage.setItem('embrobill_session_key', response.data.session_key);
      } catch (e) {}
    }
    return response.data;
  },

  logout: async () => {
    try {
      const response = await api.post('/logout/');
      return response.data;
    } finally {
      try {
        localStorage.removeItem('embrobill_session_key');
      } catch (e) {}
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/change-password/', { old_password: oldPassword, new_password: newPassword });
    return response.data;
  },

  verifyPassword: async (password) => {
    const response = await api.post('/verify-password/', { password });
    return response.data;
  },

  checkUsername: async (username) => {
    const response = await api.get(`/check-username/?username=${encodeURIComponent(username)}`);
    return response.data;
  }
};

export default authAPI;
