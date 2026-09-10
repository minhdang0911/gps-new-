import api from './axios';
import { useAuthStore } from '../../stores/authStore';

export const login = async (username, password, device = '') => {
    try {
        const res = await api.post('/login', { username, password, device });
        const { accessToken, refreshToken, user } = res.data;

        // Lưu vào Zustand store (persist middleware tự mirror sang localStorage)
        const store = useAuthStore.getState();
        store.setTokens(accessToken, refreshToken);
        store.setUser(user);

        return { user, accessToken, refreshToken };
    } catch (err) {
        console.error('Login error:', err);
        throw err;
    }
};

export const refreshTokenApi = (refreshToken) =>
    api.post('/refresh', { refreshToken }).then((res) => res.data);

export const logoutApi = async () => {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return;
    try {
        await api.post('/logout', { refreshToken });
    } catch (err) {
        console.error('Logout error:', err);
    }
};
