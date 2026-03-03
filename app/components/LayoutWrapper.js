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

    // bypass login
    if (isLoginPage) return <>{children}</>;

    return (
        <div className="app-shell">
            <TokenRefresher />
            <MqttConnector />
            <Navbar activeKey="monitor" />
            <StatusBar />

            <main className="app-main">{children}</main>

            <AppFooter />
        </div>
    );
}
