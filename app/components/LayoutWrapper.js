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
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <TokenRefresher />
            <MqttConnector />
            <Navbar activeKey="monitor" />
            <StatusBar />

            <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</main>

            <AppFooter />
        </div>
    );
}

// return (
//   <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//     <TokenRefresher />
//     <MqttConnector />
//     <Navbar activeKey="monitor" />
//     <StatusBar />

//     <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
//       {children}
//     </main>

//     <AppFooter />
//   </div>
// );
