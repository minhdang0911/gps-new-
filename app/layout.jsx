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
