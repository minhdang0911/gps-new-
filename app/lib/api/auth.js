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

export const refreshTokenApi = async (refreshToken) => {
    const token = localStorage.getItem('accessToken');

    const res = await fetch('https://gps-bms-tracking.iky.vn/refresh', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
};
