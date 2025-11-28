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

    // Không add Authorization vào refresh
    if (!config.url.includes('/refresh') && accessToken) {
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

        // Không xử lý lỗi của chính endpoint refresh
        if (originalRequest.url.includes('/refresh')) {
            return Promise.reject(error);
        }

        // Nếu request lỗi 401 và chưa retry
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();

            // Không có refreshToken -> user hết phiên thực sự -> logout
            if (!refreshToken) {
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            // Nếu refresh đang chạy -> xếp hàng đợi
            if (isRefreshing) {
                return new Promise((resolve) => {
                    pendingRequests.push((newToken) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            // Bắt đầu refresh
            isRefreshing = true;

            try {
                const data = await refreshTokenApi(refreshToken);

                const newAccess = data.accessToken;
                const newRefresh = data.refreshToken;

                // Lưu token mới
                saveTokens(newAccess, newRefresh);

                // Xử lý các request đang chờ
                pendingRequests.forEach((cb) => cb(newAccess));
                pendingRequests = [];
                isRefreshing = false;

                // Retry request gốc
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return api(originalRequest);
            } catch (err) {
                console.error('RefreshToken ERROR:', err);

                // Refresh token lỗi -> user hết phiên -> logout
                isRefreshing = false;
                pendingRequests = [];
                localStorage.clear();
                window.location.href = '/login';

                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    },
);

export default api;
