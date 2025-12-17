'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from './Navbar/Navbar';
import StatusBar from './StatusBar/StatusBar';
import TokenRefresher from './TokenRefresher';
import AppFooter from './Footer/AppFooter';
import MqttConnector from './MqttConnector';

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();

    const isLoginPage = pathname === '/login' || pathname === '/login/en' || pathname?.startsWith('/login');

    return (
        <>
            {!isLoginPage && (
                <>
                    <TokenRefresher />
                    <MqttConnector />
                    <Navbar activeKey="monitor" />
                    <StatusBar />
                </>
            )}

            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <main style={{ flex: 1 }}>{children}</main>

                {!isLoginPage && <AppFooter style={{ marginTop: 'auto' }} />}
            </div>
        </>
    );
}
