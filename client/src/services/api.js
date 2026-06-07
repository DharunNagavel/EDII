import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const auth = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

export const logistics = {
  getWarehouses: async () => {
    const response = await api.get('/logistics/warehouses');
    return response.data;
  },
  addWarehouse: async (data) => {
    const response = await api.post('/logistics/warehouses', data);
    return response.data;
  },
  getVehicles: async () => {
    const response = await api.get('/logistics/vehicles');
    return response.data;
  },
  addVehicle: async (data) => {
    const response = await api.post('/logistics/vehicles', data);
    return response.data;
  },
  getAvailableDrivers: async () => {
    const response = await api.get('/logistics/drivers/available');
    return response.data;
  },
  getShops: async () => {
    const response = await api.get('/logistics/shops');
    return response.data;
  },
  addShop: async (data) => {
    const response = await api.post('/logistics/shops', data);
    return response.data;
  },
};

export const inventory = {
  getWarehouseStock: async (warehouseId) => {
    const response = await api.get(`/inventory/warehouse/${warehouseId}`);
    return response.data;
  },
  updateStock: async (data) => {
    const response = await api.post('/inventory/update', data);
    return response.data;
  },
  getHistory: async (warehouseId = '') => {
    const path = warehouseId ? `/inventory/history/${warehouseId}` : '/inventory/history';
    const response = await api.get(path);
    return response.data;
  },
};

export const shipments = {
  getShipments: async () => {
    const response = await api.get('/shipments');
    return response.data;
  },
  getShipmentById: async (id) => {
    const response = await api.get(`/shipments/${id}`);
    return response.data;
  },
  createShipment: async (data) => {
    const response = await api.post('/shipments/create', data);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await api.patch(`/shipments/${id}/status`, { status });
    return response.data;
  },
  confirmDelivery: async (id, data) => {
    const response = await api.post(`/shipments/${id}/confirm`, data);
    return response.data;
  },
};

export const gps = {
  postLocation: async (data) => {
    const response = await api.post('/gps/update', data);
    return response.data;
  },
};

export const alerts = {
  getAlerts: async () => {
    const response = await api.get('/alerts');
    return response.data;
  },
  resolveAlert: async (id) => {
    const response = await api.patch(`/alerts/${id}/resolve`);
    return response.data;
  },
};

export const dashboard = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
};

export const reports = {
  downloadUrl: (type, district = '', state = '') => {
    const token = localStorage.getItem('token');
    return `${API_URL}/reports/${type}?token=${token}&district=${district}&state=${state}`;
  },
  // We can fetch via axios if we want to process it in front-end, but simple window.open works best for native browser downloads!
};

export default api;
