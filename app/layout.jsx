import './globals.css';
import 'antd/dist/reset.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Geist, Geist_Mono } from 'next/font/google';
import LayoutWrapper from './components/LayoutWrapper';
import SWRProvider from './providers/SWRProvider';
import 'leaflet/dist/leaflet.css';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';

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
                {/* Google Tag Manager */}
                <Script id="gtm" strategy="afterInteractive">
                    {`
                      (function(w,d,s,l,i){w[l]=w[l]||[];
                      w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
                      var f=d.getElementsByTagName(s)[0],
                      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                      j.async=true;j.src=
                      'https://www.googletagmanager.com/gtm.js?id='+i+dl;
                      f.parentNode.insertBefore(j,f);
                      })(window,document,'script','dataLayer','GTM-KC8CQGR6');
                    `}
                </Script>

                {/* Google Tag Manager (noscript) */}
                <noscript>
                    <iframe
                        src="https://www.googletagmanager.com/ns.html?id=GTM-KC8CQGR6"
                        height="0"
                        width="0"
                        style={{ display: 'none', visibility: 'hidden' }}
                    />
                </noscript>

                {/* Vercel Analytics */}
                <Analytics />

                <AntdRegistry>
                    <SWRProvider>
                        <LayoutWrapper>{children}</LayoutWrapper>
                    </SWRProvider>
                </AntdRegistry>
            </body>
        </html>
    );
}
