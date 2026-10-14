import axios from 'axios';

const api = axios.create({
  // Same-origin /api works behind a production reverse proxy. Local Vite proxies it to Express.
  // Set VITE_API_BASE_URL only when frontend and API are hosted on separate origins.
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, error => Promise.reject(error));

export default api;
