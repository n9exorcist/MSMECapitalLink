import axios from 'axios';
import { storage } from './secureStore';

// Fast API backend URL (use your local IP if testing on a physical device, e.g., 192.168.x.x)
const API_URL = 'http://localhost:8000/api/v1';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically inject JWT into every request
api.interceptors.request.use(async (config) => {
    const token = await storage.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Global error handler for 401 Unauthorized (forces logout)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            storage.removeToken();
            // Optional: trigger global Zustand logout here if needed
        }
        return Promise.reject(error);
    }
);