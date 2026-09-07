import axios from 'axios';
import { refreshTokenApi } from './auth';
import { useAuthStore } from '../../stores/authStore';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    timeout: 15000,
});

/* ================= TOKEN UTILS (qua Zustand store) ================= */

const getTokens = () => {
    const { accessToken, refreshToken } = useAuthStore.getState();
    return { accessToken, refreshToken };
};

const saveTokens = (access, refresh) => {
    useAuthStore.getState().setTokens(access, refresh);
};

/** Xóa tokens + dispatch event để useAuthLogout redirect về /login */
const clearAuthAndLogout = () => {
    useAuthStore.getState().clearAll();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
};

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
    (config) => {
        const { accessToken } = getTokens();
        if (accessToken && !config.url.includes('/refresh') && !config.url.includes('/login')) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

/* ================= RESPONSE INTERCEPTOR ================= */

let isRefreshing = false;
let failedQueue  = [];
let refreshSafetyTimer = null;

const processQueue = (error, token = null) => {
    const queue = failedQueue;
    failedQueue  = [];
    queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
};

const setRefreshing = (value) => {
    isRefreshing = value;
    clearTimeout(refreshSafetyTimer);
    if (value) {
        // Safety: reset nếu isRefreshing bị stuck > 20s
        refreshSafetyTimer = setTimeout(() => {
            if (isRefreshing) {
                console.warn('[axios] isRefreshing stuck >20s — force reset');
                isRefreshing = false;
                processQueue(new Error('Refresh timeout'));
            }
        }, 20_000);
    }
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (originalRequest.url.includes('/login') || originalRequest.url.includes('/refresh')) {
            return Promise.reject(error);
        }

        // ── Xử lý 401 ──────────────────────────────────────────────
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();
            if (!refreshToken) {
                clearAuthAndLogout();
                return Promise.reject(error);
            }

            // Đang refresh → xếp hàng chờ
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            setRefreshing(true);
            try {
                const data = await refreshTokenApi(refreshToken);
                saveTokens(data.accessToken, data.refreshToken);
                processQueue(null, data.accessToken);
                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            } catch (err) {
                const status = err?.response?.status;
                processQueue(err, null);
                if (status === 401 || status === 403) {
                    console.warn('[axios] Refresh token expired — logout');
                    clearAuthAndLogout();
                } else {
                    console.warn('[axios] Refresh failed (network?) — NOT redirecting, status:', status);
                }
                return Promise.reject(err);
            } finally {
                setRefreshing(false);
            }
        }

        // ── Timeout ─────────────────────────────────────────────────
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return Promise.reject({
                ...error,
                isTimeout: true,
                userMessage: 'Yêu cầu quá thời gian — kiểm tra kết nối mạng',
            });
        }

        // ── No network ──────────────────────────────────────────────
        if (!error.response) {
            return Promise.reject({
                ...error,
                isNetworkError: true,
                userMessage: 'Không có kết nối mạng',
            });
        }

        return Promise.reject(error);
    },
);

/* ================= PROACTIVE REFRESH (shared lock) ================= */

export const proactiveRefresh = async () => {
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        }).then(() => {});
    }

    const { refreshToken } = getTokens();
    if (!refreshToken) {
        clearAuthAndLogout();
        return;
    }

    setRefreshing(true);
    try {
        const data = await refreshTokenApi(refreshToken);
        saveTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
    } catch (err) {
        const status = err?.response?.status;
        processQueue(err, null);
        if (status === 401 || status === 403) {
            clearAuthAndLogout();
        }
        throw err;
    } finally {
        setRefreshing(false);
    }
};

export default api;
