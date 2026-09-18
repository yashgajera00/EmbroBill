import api from './api';

export const authAPI = {
  status: async () => {
    const response = await api.get('/auth/status/');
    return response.data;
  },
  login: async (username, password) => {
    const response = await api.post('/login/', { username, password });
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/register/', userData);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/logout/');
    return response.data;
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
