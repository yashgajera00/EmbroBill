import api from './api';

export const invoiceAPI = {
  list: async (filters = {}) => {
    const response = await api.get('/invoices/', { params: filters });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/invoices/view/${id}/`);
    return response.data;
  },
  add: async (data) => {
    const response = await api.post('/invoices/add/', data);
    return response.data;
  },
  edit: async (id, data) => {
    const response = await api.post(`/invoices/edit/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.post(`/invoices/delete/${id}/`);
    return response.data;
  },
  updatePayment: async (id, data) => {
    const response = await api.post(`/invoices/update-payment/${id}/`, data);
    return response.data;
  },
  getPdfBlob: async (id) => {
    const response = await api.get(`/invoices/pdf/${id}/`, {
      responseType: 'blob', // Important for downloading PDF files
    });
    return response.data;
  },
  getBulkPdfBlob: async (ids) => {
    const response = await api.get('/invoices/pdf/bulk/', {
      params: { ids: ids.join(',') },
      responseType: 'blob', // Important for downloading PDF files
    });
    return response.data;
  }
};

export default invoiceAPI;
