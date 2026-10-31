import axios from 'axios';

// Support both VITE_API_URL and VITE_API_BASE_URL (standard across hosting platforms)
const rawApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';
const baseURL = (typeof rawApiUrl === 'string' && rawApiUrl.endsWith('/') && rawApiUrl.length > 1) 
  ? rawApiUrl.slice(0, -1) 
  : rawApiUrl;

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, error => Promise.reject(error));

export default api;
