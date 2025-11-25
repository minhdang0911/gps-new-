import axios from 'axios';
import { refreshTokenApi } from './auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
});

// ----- LẤY TOKEN TỪ LOCAL STORAGE -----
const getTokens = () => {
    return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
    };
};

// ----- LƯU TOKEN -----
const saveTokens = (access, refresh) => {
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
};

// ----- REQUEST INTERCEPTOR -----
api.interceptors.request.use((config) => {
    const { accessToken } = getTokens();
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// ===== RESPONSE INTERCEPTOR =====
let isRefreshing = false;
let pendingRequests = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Nếu 401 → thử refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();
            if (!refreshToken) {
                console.warn('Không có refreshToken → phải login lại');
                window.location.href = '/login';
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve) => {
                    pendingRequests.push((newToken) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            isRefreshing = true;

            try {
                const data = await refreshTokenApi(refreshToken);
                const newAccess = data.accessToken;
                const newRefresh = data.refreshToken;

                saveTokens(newAccess, newRefresh);

                pendingRequests.forEach((cb) => cb(newAccess));
                pendingRequests = [];
                isRefreshing = false;

                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return api(originalRequest);
            } catch (e) {
                console.error('Refresh fail', e);
                isRefreshing = false;
                pendingRequests = [];
                window.location.href = '/login';
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    },
);

export default api;
