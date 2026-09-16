import api from './api';

export const settingsAPI = {
  get: async () => {
    const response = await api.get('/settings/');
    return response.data;
  },
  save: async (data) => {
    const response = await api.post('/settings/', data);
    return response.data;
  },
  activateLicense: async (token) => {
    const response = await api.post('/license/', { token });
    return response.data;
  }
};

export default settingsAPI;
