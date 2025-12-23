'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar/Navbar';
import StatusBar from './StatusBar/StatusBar';
import TokenRefresher from './TokenRefresher';
import AppFooter from './Footer/AppFooter';
import MqttConnector from './MqttConnector';

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();

    const isLoginPage = pathname === '/login' || pathname === '/login/en' || pathname?.startsWith('/login');

    // 👉 CHỐT: bypass toàn bộ layout cho login
    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <>
            <TokenRefresher />
            <MqttConnector />
            <Navbar activeKey="monitor" />
            <StatusBar />

            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <main style={{ flex: 1 }}>{children}</main>
                <AppFooter />
            </div>
        </>
    );
}
