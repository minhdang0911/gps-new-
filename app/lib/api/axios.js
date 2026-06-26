import axios from 'axios';
import { refreshTokenApi } from './auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    timeout: 15000, // 15s timeout — tránh request treo vô thời hạn
});

/* ================= TOKEN UTILS ================= */

const getTokens = () => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
});

const saveTokens = (access, refresh) => {
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
};

const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
};

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
    (config) => {
        const { accessToken } = getTokens();

        // Không gắn token cho refresh/login
        if (accessToken && !config.url.includes('/refresh') && !config.url.includes('/login')) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => Promise.reject(error),
);

/* ================= RESPONSE INTERCEPTOR ================= */

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Bỏ qua login & refresh
        if (originalRequest.url.includes('/login') || originalRequest.url.includes('/refresh')) {
            return Promise.reject(error);
        }

        // Xử lý 401
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();

            if (!refreshToken) {
                clearTokens();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            // Nếu đang refresh → xếp hàng
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            isRefreshing = true;

            try {
                console.log('🔄 Refresh token...');

                const data = await refreshTokenApi(refreshToken);

                saveTokens(data.accessToken, data.refreshToken);

                processQueue(null, data.accessToken);

                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

                return api(originalRequest);
            } catch (err) {
                console.error('❌ Refresh token thất bại');

                processQueue(err, null);
                clearTokens();
                window.location.href = '/login';

                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        // Xử lý lỗi timeout
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.error('⏱️ Request timeout:', originalRequest?.url);
            return Promise.reject({
                ...error,
                isTimeout: true,
                userMessage: 'Yêu cầu quá thời gian — kiểm tra kết nối mạng',
            });
        }

        // Xử lý lỗi không có kết nối mạng
        if (!error.response) {
            console.error('📵 Network error (no response):', originalRequest?.url);
            return Promise.reject({
                ...error,
                isNetworkError: true,
                userMessage: 'Không có kết nối mạng',
            });
        }

        return Promise.reject(error);
    },
);

export default api;
