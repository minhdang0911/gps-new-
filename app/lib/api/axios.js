import axios from 'axios';
import { refreshTokenApi } from './auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
});

// ===== TOKEN UTILS =====
const getTokens = () => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
});

const saveTokens = (access, refresh) => {
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
};

// ===== REQUEST INTERCEPTOR =====
api.interceptors.request.use((config) => {
    const { accessToken } = getTokens();

    // Thêm Authorization cho tất cả request trừ /refresh
    if (!config.url.includes('/refresh') && accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

// ===== RESPONSE INTERCEPTOR - XỬ LÝ 401 =====
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Nếu là lỗi của endpoint /refresh -> không xử lý
        if (originalRequest.url.includes('/refresh')) {
            return Promise.reject(error);
        }

        // ✅ XỬ LÝ 401: Token hết hạn
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();

            // Không có refreshToken -> logout
            if (!refreshToken) {
                console.warn('❌ Không có refreshToken, redirect to login');
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            // ✅ Nếu đang refresh -> xếp hàng chờ
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            // ✅ Bắt đầu refresh token
            isRefreshing = true;

            try {
                console.log('🔄 Token hết hạn (401), đang refresh...');

                const data = await refreshTokenApi(refreshToken);

                const newAccess = data.accessToken;
                const newRefresh = data.refreshToken;

                // Lưu token mới
                saveTokens(newAccess, newRefresh);

                // Xử lý các request đang chờ
                processQueue(null, newAccess);

                // Retry request gốc với token mới
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;

                console.log('✅ Token refreshed, retry request');

                return api(originalRequest);
            } catch (err) {
                console.error('❌ Refresh token thất bại:', err);

                // Refresh thất bại -> logout
                processQueue(err, null);
                localStorage.clear();
                window.location.href = '/login';

                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

export default api;
