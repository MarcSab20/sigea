import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // cookies HttpOnly pour refresh token
});

function deviceFingerprint(): string {
  let id = localStorage.getItem('sigea-device-id');
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem('sigea-device-id', id);
  }
  return id;
}

// Intercepteur : injecter le token JWT
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-device-fingerprint'] = deviceFingerprint();
  return config;
});

// Intercepteur : refresh automatique sur 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(resolve => {
          refreshQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await api.post<{ access_token: string }>('/auth/refresh');
        useAuthStore.getState().setAccessToken(data.access_token);
        refreshQueue.forEach(cb => cb(data.access_token));
        refreshQueue = [];
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
