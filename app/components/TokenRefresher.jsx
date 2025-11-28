'use client';

import { useEffect } from 'react';
import { refreshTokenApi } from '../lib/api/auth';

export default function TokenRefresher() {
    useEffect(() => {
        document.title = 'Quản lý xe';
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            const refreshToken = localStorage.getItem('refreshToken');
            const token = localStorage.getItem('accessToken');
            if (!refreshToken) return;

            try {
                const res = await refreshTokenApi(refreshToken, token);
                localStorage.setItem('accessToken', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
                console.log('🔄 Token refreshed!');
            } catch (err) {
                console.error('Refresh failed:', err);
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return null;
}
