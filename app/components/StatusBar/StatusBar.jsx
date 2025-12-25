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

const StatusBar = () => {
    const pathname = usePathname() || '/';
    const [time, setTime] = useState('');
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

    // ----- TITLE ĂN THEO ROUTE -----
    let currentTitle = t.monitor;

    if (pathname === '/') currentTitle = t.monitor;
    else if (pathname.includes('/cruise')) currentTitle = t.cruise;
    else if (pathname.includes('/report')) currentTitle = t.report;
    else if (pathname.includes('/manage')) currentTitle = t.manage;
    else if (pathname.includes('/support')) currentTitle = t.support;
    else if (pathname.includes('/maintenance')) currentTitle = t.maintain;

    // ----- CLOCK -----
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();

            // 12h + AM/PM viết hoa
            const formatted = now
                .toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                })
                .toUpperCase();

            const date = now.toLocaleDateString('vi-VN');
            setTime(`${formatted} ${date}`);
        };

        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    if (pathname === '/login' || pathname === '/login/en') return null;

    return (
        <div className="iky-status">
            {/* LEFT: BREADCRUMB */}
            <div className="iky-status__left">
                <Breadcrumb className="iky-status__breadcrumb" items={[{ title: t.home }, { title: currentTitle }]} />
            </div>

            {/* CENTER: STATUS */}
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

            {/* RIGHT: NOTI + TIME */}
            <div className="iky-status__right">
                <Badge count={0} overflowCount={99} size="small" className="iky-status__badge" showZero>
                    <span className="iky-status__notify-label">{t.notify}</span>
                </Badge>
                <Text className="iky-status__time">{time}</Text>
            </div>
        </div>
    );
};

export default StatusBar;
