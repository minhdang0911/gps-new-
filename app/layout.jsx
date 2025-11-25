'use client';

import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from './components/Navbar/Navbar';
import StatusBar from './components/StatusBar/StatusBar';
import { useEffect } from 'react';
import { refreshTokenApi } from './lib/api/auth';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

// export const metadata = {
//     title: 'IKY GPS',
//     description: 'Hệ thống theo dõi GPS',
// };

export default function RootLayout({ children }) {
    useEffect(() => {
        document.title = 'Quản lý xe';
    }, []);
    // 🔄 AUTO REFRESH TOKEN mỗi 10 phút
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
                // optional: window.location.href = "/login";
            }
        }, 10 * 60 * 1000); // 10 phút

        return () => clearInterval(interval);
    }, []);

    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                {/* NAV ẩn khi vào /login */}

                <>
                    <Navbar activeKey="monitor" username="haidv" />
                    <StatusBar />
                </>

                {/* PAGE */}
                <main style={{ paddingTop: 0 }}>{children}</main>
            </body>
        </html>
    );
}
