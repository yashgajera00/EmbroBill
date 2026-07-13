import api from './api';

export const customersAPI = {
  list: async (query = '') => {
    const response = await api.get('/customers/', { params: { q: query } });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/customers/${id}/`);
    return response.data;
  },
  add: async (data) => {
    const response = await api.post('/customers/add/', data);
    return response.data;
  },
  edit: async (id, data) => {
    const response = await api.post(`/customers/edit/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.post(`/customers/delete/${id}/`);
    return response.data;
  },
  history: async (id) => {
    const response = await api.get(`/customers/history/${id}/`);
    return response.data;
  }
};

export default customersAPI;
