'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Breadcrumb, Typography, Space, Badge } from 'antd';
import './StatusBar.css';
import xeDung from '../../assets/ico_biker_1.webp';
import xeChay from '../../assets/ico_biker_2.webp';
import xe50 from '../../assets/ico_biker_3.webp';
import xe80 from '../../assets/ico_biker_4.webp';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const { Text } = Typography;

const locales = { vi, en };
 

const Clock = React.memo(function Clock({ isEn }) {
    const [time, setTime] = useState('');

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const formatted = now
                .toLocaleTimeString(isEn ? 'en-US' : 'vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: isEn,
                });
            const date = now.toLocaleDateString('vi-VN');
            setTime(`${formatted} ${date}`);
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, [isEn]);

    return <Text className="iky-status__time">{time}</Text>;
});

const StatusBar = () => {
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    // Detect EN từ pathname (/xxx/en)
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    // quyết định lang
    useEffect(() => {
        if (typeof window === 'undefined') return;

        queueMicrotask(() => {
            if (isEnFromPath) {
                setIsEn(true);
                localStorage.setItem('iky_lang', 'en');
            } else {
                const saved = localStorage.getItem('iky_lang');
                setIsEn(saved === 'en');
            }
        });
    }, [isEnFromPath]);

    const t = isEn ? locales.en.statusbar : locales.vi.statusbar;

     
    const routeTitleMap = [
        { prefix: '/cruise',      key: 'cruise'   },
        { prefix: '/report',      key: 'report'   },
        { prefix: '/manage',      key: 'manage'   },
        { prefix: '/support',     key: 'support'  },
        { prefix: '/maintenance', key: 'maintain' },
        { prefix: '/overview',    key: 'overview' },
    ];
    const routeMatch = routeTitleMap.find(({ prefix }) => pathname.startsWith(prefix));
    const currentTitle = routeMatch ? t[routeMatch.key] : t.monitor;


    if (pathname === '/login' || pathname === '/login/en') return null;

    return (
        <div className="iky-status">
           
            <div className="iky-status__left">
                <Breadcrumb className="iky-status__breadcrumb" items={[{ title: t.home }, { title: currentTitle }]} />
            </div>

       
            <div className="iky-status__center">
                <Space size={20} wrap>
                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xeDung.src} alt="" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">{t.stopped}</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xeChay.src} alt="" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">{t.running}</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xe50.src} alt="" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">{t.over50}</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <Image src={xe80} alt="" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">{t.over80}</Text>
                    </div>
                </Space>
            </div>

         
            <div className="iky-status__right">
                <Badge count={0} overflowCount={99} size="small" className="iky-status__badge">
                    <span className="iky-status__notify-label">{t.notify}</span>
                </Badge>
                <Clock isEn={isEn} />
            </div>
        </div>
    );
};

export default StatusBar;
