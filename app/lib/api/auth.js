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
export const refreshTokenApi = async (refreshToken) => {
    console.log('🔄 Refreshing token...');

    if (!refreshToken) {
        throw new Error('No refresh token provided');
    }

    try {
        const formData = new URLSearchParams();
        formData.append('refreshToken', refreshToken);

        const res = await fetch('https://gps-bms-tracking.iky.vn/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('❌ Refresh failed:', errorData);
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('✅ Token refreshed successfully');

        return data;
    } catch (err) {
        console.error('❌ Refresh error:', err);
        throw err;
    }
};

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
