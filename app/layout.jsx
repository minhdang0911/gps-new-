import './globals.css';
import 'antd/dist/reset.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Geist, Geist_Mono } from 'next/font/google';
import LayoutWrapper from './components/LayoutWrapper';
import SWRProvider from './providers/SWRProvider';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});
const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata = {
    title: 'IKY GPS - Nền tảng giám sát hành trình GPS',
    description:
        'Nền tảng giám sát GPS – theo dõi hành trình, trạng thái thiết bị, pin, cảnh báo và quản lý toàn bộ hệ thống IKY GPS.',
    keywords: 'IKY GPS, Giám sát hành trình, Thiết bị GPS',
    authors: [{ name: 'IKY GPS' }],
    icons: {
        icon: '/logoo.webp',
        apple: '/logoo.webp',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="vi">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <AntdRegistry>
                    <SWRProvider>
                        <LayoutWrapper>{children}</LayoutWrapper>
                    </SWRProvider>
                </AntdRegistry>
            </body>
        </html>
    );
}
