'use client';

import { Layout, Typography } from 'antd';
import './AppFooter.css';
import { usePathname } from 'next/navigation';

const { Footer } = Layout;
const { Text } = Typography;

export default function IKYGPSFooter() {
    const pathname = usePathname() || '/';
    const year = new Date().getFullYear();
    if (pathname === '/login' || pathname === '/login/en') return null;
    return (
        <Footer className="ikygps-footer">
            <div className="ikygps-footer__inner">
                <Text className="ikygps-footer__left">© {year} IKY . All rights reserved.</Text>

                <Text className="ikygps-footer__right">Powered by IKY </Text>
            </div>
        </Footer>
    );
}
