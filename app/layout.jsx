import './globals.css';
import 'antd/dist/reset.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from './components/Navbar/Navbar';
import StatusBar from './components/StatusBar/StatusBar';
import TokenRefresher from './components/TokenRefresher';
import AppFooter from './components/Footer/AppFooter';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export default function RootLayout({ children }) {
    return (
        <html lang="vi">
            <head>
                <title>IKY GPS - Nền tảng giám sát hành trình GPS</title>
                <meta
                    name="description"
                    content="Nền tảng giám sát GPS – theo dõi hành trình, trạng thái thiết bị, pin, cảnh báo và quản lý toàn bộ hệ thống IKY GPS."
                />
                <meta name="keywords" content="IKY GPS, Giám sát hành trình, Thiết bị GPS" />
                <meta name="author" content="IKY GPS" />
            </head>

            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <AntdRegistry>
                    <TokenRefresher />
                    <Navbar activeKey="monitor" />
                    <StatusBar />
                    <main>{children}</main>
                    <AppFooter />
                </AntdRegistry>
            </body>
        </html>
    );
}
