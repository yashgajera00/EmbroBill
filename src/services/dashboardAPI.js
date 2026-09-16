import api from './api';

export const dashboardAPI = {
  list: async () => {
    const response = await api.get('/dashboard-items/');
    return response.data;
  },
  add: async (data) => {
    const response = await api.post('/dashboard-items/add/', data);
    return response.data;
  },
  edit: async (id, data) => {
    const response = await api.post(`/dashboard-items/edit/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.post(`/dashboard-items/delete/${id}/`);
    return response.data;
  },
};

export default dashboardAPI;
