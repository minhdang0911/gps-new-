'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar/Navbar';
import StatusBar from './StatusBar/StatusBar';
import TokenRefresher from './TokenRefresher';
import AppFooter from './Footer/AppFooter';
import RouteProgressBar from './RouteProgressBar';
import { useAuthLogout } from '../hooks/useAuthLogout';
import { useGlobalKeyboard } from '../hooks/useGlobalKeyboard';

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();

    // Bridge: axios interceptor → router.push (không reload trang)
    useAuthLogout();

    // Global keyboard shortcuts: Ctrl+1..6 navigate, không fire trong input
    useGlobalKeyboard();

    const isLoginPage = pathname === '/login' || pathname === '/login/en' || pathname?.startsWith('/login');

    // 👉 CHỐT: bypass toàn bộ layout cho login
    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <>
            {/* Route progress bar — hiện khi chuyển trang */}
            <RouteProgressBar />
            <TokenRefresher />
            {/* MqttConnector được mount trong MonitorPage với IMEI cụ thể */}
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
