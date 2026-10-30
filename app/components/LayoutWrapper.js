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
 
    useAuthLogout();

   
    useGlobalKeyboard();

    const isLoginPage = pathname === '/login' || pathname === '/login/en' || pathname?.startsWith('/login');
 
    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <>
      
            <RouteProgressBar />
            <TokenRefresher />
 
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
