'use client';

import { Layout, Typography } from 'antd';
import './AppFooter.css';

const { Footer } = Layout;
const { Text } = Typography;

export default function IKYGPSFooter() {
    const year = new Date().getFullYear();

    return (
        <Footer className="ikygps-footer">
            <div className="ikygps-footer__inner">
                <Text className="ikygps-footer__left">© {year} IKY . All rights reserved.</Text>

                <Text className="ikygps-footer__right">Powered by IKY </Text>
            </div>
        </Footer>
    );
}
