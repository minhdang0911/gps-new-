import axios from 'axios';
import api from './axios';
import { useAuthStore } from '../../stores/authStore';
import { saveSecureSession, clearSecureSession } from '../auth/secureSession';

export const login = async (username, password, device = '') => {
    try {
        const res = await api.post('/login', { username, password, device });
        const { accessToken, refreshToken, user } = res.data;

        // Lưu vào Zustand store (persist middleware tự mirror sang localStorage)
        const store = useAuthStore.getState();
        store.setTokens(accessToken, refreshToken);
        store.setUser(user);

        // Lưu phiên bảo mật mã hóa vĩnh viễn (chống văng login theo chuẩn QMS)
        saveSecureSession({
            username,
            password,
            device,
            user,
            accessToken,
            refreshToken,
        });

        return { user, accessToken, refreshToken };
    } catch (err) {
        console.error('Login error:', err);
        throw err;
    }
};

/**
 * Đăng nhập ngầm (Silent Login) dùng instance axios tách biệt để không loop qua interceptor
 */
export const silentLoginApi = async (username, password, device = '') => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const res = await axios.post(
        `${baseUrl}/login`,
        { username, password, device },
        {
            withCredentials: true,
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' },
        }
    );
    return res.data; // { accessToken, refreshToken, user }
};

export const refreshTokenApi = (refreshToken) =>
    api.post('/refresh', { refreshToken }).then((res) => res.data);

export const logoutApi = async () => {
    // Xóa sạch session bảo mật ngay khi người dùng chủ động đăng xuất
    clearSecureSession();

    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return;
    try {
        await api.post('/logout', { refreshToken });
    } catch (err) {
        console.error('Logout error:', err);
    }
};
