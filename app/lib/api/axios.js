import axios from 'axios';
import { refreshTokenApi, silentLoginApi } from './auth';
import { useAuthStore } from '../../stores/authStore';
import {
    getSecureSession,
    saveSecureSession,
    hasSecureSession,
    clearSecureSession,
} from '../auth/secureSession';

const api = axios.create({
    baseURL: (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, ''),
    withCredentials: true,
    timeout: 15000,
});

const getTokens = () => {
    if (typeof window !== 'undefined') {
        const localAccess = localStorage.getItem('accessToken');
        const localRefresh = localStorage.getItem('refreshToken');
        if (localAccess !== null || localRefresh !== null) {
            return {
                accessToken: localAccess,
                refreshToken: localRefresh,
            };
        }
    }
    const { accessToken, refreshToken } = useAuthStore.getState();
    return { accessToken, refreshToken };
};

const saveTokens = (access, refresh) => {
    useAuthStore.getState().setTokens(access, refresh);
    if (typeof window !== 'undefined') {
        if (access) localStorage.setItem('accessToken', access);
        if (refresh) localStorage.setItem('refreshToken', refresh);
    }
};

/**
 * Xóa tokens + dispatch event để useAuthLogout redirect về /login
 * Chặn văng: nếu máy còn Secure Session (chưa bấm Đăng xuất) thì không bao giờ xóa
 */
const clearAuthAndLogout = () => {
    if (hasSecureSession()) {
        console.warn('[axios] clearAuthAndLogout skipped — active secure session detected');
        return;
    }
    useAuthStore.getState().clearAll();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
};

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
    (config) => {
        const { accessToken } = getTokens();
        if (accessToken && !config.url?.includes('/refresh') && !config.url?.includes('/login')) {
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

        if (!originalRequest || originalRequest.url?.includes('/login') || originalRequest.url?.includes('/refresh')) {
            return Promise.reject(error);
        }

        // ── Xử lý 401 (Hệ thống chống văng chuẩn QMS IKY 24/7) ───────
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Đang refresh hoặc silent-login dở → xếp hàng chờ
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
                let newAccessToken = null;
                let newRefreshToken = null;

                // 1. Thử refresh token thông thường
                const { refreshToken } = getTokens();
                if (refreshToken) {
                    try {
                        const data = await refreshTokenApi(refreshToken);
                        newAccessToken = data.accessToken;
                        newRefreshToken = data.refreshToken;
                    } catch (refreshErr) {
                        console.warn('[axios] Refresh token failed, initiating silent re-login...', refreshErr?.message);
                    }
                }

                // 2. Nếu refresh token hết hạn / không có -> Tự động đăng nhập ngầm qua Secure Session
                if (!newAccessToken) {
                    const session = getSecureSession();
                    if (session?.username && session?.password) {
                        try {
                            const deviceId = session.device || (typeof window !== 'undefined' ? localStorage.getItem('device') : '') || ('dev_' + Math.random().toString(36).substring(2, 12));
                            const loginRes = await silentLoginApi(session.username, session.password, deviceId);

                            if (loginRes?.accessToken) {
                                newAccessToken = loginRes.accessToken;
                                newRefreshToken = loginRes.refreshToken;

                                if (loginRes.user) {
                                    useAuthStore.getState().setUser(loginRes.user);
                                    if (typeof window !== 'undefined') {
                                        const r = loginRes.user.position || loginRes.user.role || '';
                                        if (r) localStorage.setItem('role', r);
                                        if (loginRes.user._id) localStorage.setItem('userid', String(loginRes.user._id));
                                    }
                                }
                                saveSecureSession({
                                    ...session,
                                    device: deviceId,
                                    accessToken: newAccessToken,
                                    refreshToken: newRefreshToken,
                                    user: loginRes.user || session.user,
                                });
                                console.log('[axios] Silent auto-login succeeded! Session seamlessly restored.');
                            }
                        } catch (silentLoginErr) {
                            console.warn('[axios] Silent auto-login failed:', silentLoginErr?.message);
                            // Nếu đổi mật khẩu thật trên server (400/401 trực tiếp từ /login) -> xóa session
                            const loginStatus = silentLoginErr?.response?.status;
                            if (loginStatus === 400 || loginStatus === 401) {
                                clearSecureSession();
                                processQueue(silentLoginErr, null);
                                clearAuthAndLogout();
                                return Promise.reject(silentLoginErr);
                            }
                        }
                    }
                }

                // 3. Nếu lấy được token mới -> Cập nhật store & replay request
                if (newAccessToken) {
                    saveTokens(newAccessToken, newRefreshToken);
                    processQueue(null, newAccessToken);
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                }

                // 4. Nếu không lấy được do lỗi mạng tạm thời hoặc server restart:
                // TUYỆT ĐỐI KHÔNG VĂNG VỀ LOGIN nếu thiết bị có Secure Session
                if (hasSecureSession()) {
                    console.warn('[axios] Network/Server temporary issue — preserving session, NOT kicking to /login');
                    processQueue(error, null);
                    return Promise.reject(error);
                }

                // Chỉ đá về login khi không hề có session trên máy
                processQueue(error, null);
                clearAuthAndLogout();
                return Promise.reject(error);

            } catch (err) {
                processQueue(err, null);
                if (hasSecureSession()) {
                    console.warn('[axios] Auth recovery error — preserving session');
                    return Promise.reject(err);
                }
                clearAuthAndLogout();
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

    setRefreshing(true);
    try {
        let success = false;
        const { refreshToken } = getTokens();

        if (refreshToken) {
            try {
                const data = await refreshTokenApi(refreshToken);
                saveTokens(data.accessToken, data.refreshToken);
                processQueue(null, data.accessToken);
                success = true;
            } catch (err) {
                console.warn('[proactiveRefresh] Token refresh failed, falling back to silent login...');
            }
        }

        // Fallback: silent login qua Secure Session
        if (!success) {
            const session = getSecureSession();
            if (session?.username && session?.password) {
                try {
                    const deviceId = session.device || (typeof window !== 'undefined' ? localStorage.getItem('device') : '') || ('dev_' + Math.random().toString(36).substring(2, 12));
                    const loginRes = await silentLoginApi(session.username, session.password, deviceId);

                    if (loginRes?.accessToken) {
                        saveTokens(loginRes.accessToken, loginRes.refreshToken);
                        if (loginRes.user) {
                            useAuthStore.getState().setUser(loginRes.user);
                            if (typeof window !== 'undefined') {
                                const r = loginRes.user.position || loginRes.user.role || '';
                                if (r) localStorage.setItem('role', r);
                                if (loginRes.user._id) localStorage.setItem('userid', String(loginRes.user._id));
                            }
                        }
                        saveSecureSession({
                            ...session,
                            device: deviceId,
                            accessToken: loginRes.accessToken,
                            refreshToken: loginRes.refreshToken,
                            user: loginRes.user || session.user,
                        });
                        processQueue(null, loginRes.accessToken);
                        success = true;
                        console.log('[proactiveRefresh] Silent auto-login succeeded!');
                    }
                } catch (silentErr) {
                    console.warn('[proactiveRefresh] Silent auto-login failed:', silentErr?.message);
                    const loginStatus = silentErr?.response?.status;
                    if (loginStatus === 400 || loginStatus === 401) {
                        clearSecureSession();
                        clearAuthAndLogout();
                        throw silentErr;
                    }
                }
            }
        }

        if (!success) {
            if (hasSecureSession()) {
                console.warn('[proactiveRefresh] Preserving session on temporary issue');
                return;
            }
            clearAuthAndLogout();
        }
    } catch (err) {
        const status = err?.response?.status;
        processQueue(err, null);
        if ((status === 401 || status === 403) && !hasSecureSession()) {
            clearAuthAndLogout();
        }
        throw err;
    } finally {
        setRefreshing(false);
    }
};

if (typeof window !== 'undefined') {
    window.testApi = api;
}

export default api;
