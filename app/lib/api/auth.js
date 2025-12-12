import api from './axios';

export const login = async (username, password, device = '') => {
    try {
        const res = await api.post('/login', {
            username,
            password,
            device,
        });

        const { accessToken, refreshToken, user } = res.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('currentUser', JSON.stringify(user));

        return { user, accessToken, refreshToken };
    } catch (err) {
        console.error('Login error:', err);
        throw err;
    }
};

// ✅ Form-urlencoded, không cần Authorization
export const refreshTokenApi = (refreshToken) => api.post('/refresh', { refreshToken }).then((res) => res.data);

export const logoutApi = async () => {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
        return;
    }

    try {
        await api.post('/logout', { refreshToken });
    } catch (err) {
        console.error('Logout error:', err);
    }
};
