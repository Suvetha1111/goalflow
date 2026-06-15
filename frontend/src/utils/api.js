/**
 * Axios instance with base URL and interceptors
 */
import axios from 'axios';

const api = axios.create({
  // In production: VITE_API_URL=https://goalflow-nine.vercel.app/api
  // In local dev: leave unset — Vite proxy handles /api
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token from localStorage as fallback
api.interceptors.request.use((config) => {
  if (!config.headers['Authorization']) {
    const token = localStorage.getItem('gf_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: auto-handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear stale auth on 401
      localStorage.removeItem('gf_token');
      localStorage.removeItem('gf_user');
      delete api.defaults.headers.common['Authorization'];
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
