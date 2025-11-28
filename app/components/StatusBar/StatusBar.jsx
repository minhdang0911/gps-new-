'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Breadcrumb, Typography, Space, Badge } from 'antd';
import './StatusBar.css';

import xeDung from '../../assets/ico_biker_1.webp';
import xeChay from '../../assets/ico_biker_2.webp';
import xe50 from '../../assets/ico_biker_3.webp';
import xe80 from '../../assets/ico_biker_4.webp';

const { Text } = Typography;

const StatusBar = () => {
    const pathname = usePathname() || '/';
    const [time, setTime] = useState('');

    // ----- TITLE ĂN THEO ROUTE -----
    let currentTitle = 'Giám sát';

    if (pathname === '/') {
        currentTitle = 'Giám sát';
    } else if (pathname.startsWith('/cruise')) {
        currentTitle = 'Hành trình';
    } else if (pathname.startsWith('/report')) {
        currentTitle = 'Báo cáo';
    } else if (pathname.startsWith('/manage')) {
        currentTitle = 'Quản lý';
    } else if (pathname.startsWith('/support')) {
        currentTitle = 'Hỗ trợ';
    }

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const formatted = now.toLocaleTimeString('en-GB', { hour12: true });
            const date = now.toLocaleDateString('vi-VN');
            setTime(`${formatted} ${date}`);
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    if (pathname === '/login') return null;

    return (
        <div className="iky-status">
            {/* LEFT: BREADCRUMB */}
            <div className="iky-status__left">
                <Breadcrumb
                    className="iky-status__breadcrumb"
                    items={[{ title: 'Trang chủ' }, { title: currentTitle }]}
                />
            </div>

            {/* CENTER: TRẠNG THÁI XE */}
            <div className="iky-status__center">
                <Space size={20} wrap>
                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xeDung.src} alt="Xe dừng" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">Xe dừng</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xeChay.src} alt="Xe đang chạy" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">Xe đang chạy</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <img src={xe50.src} alt="Xe quá 50km/h" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">Xe quá 50km/h</Text>
                    </div>

                    <div className="iky-status__state">
                        <div className="iky-status__state-icon">
                            <Image src={xe80} alt="Xe quá 80km/h" width={22} height={22} />
                        </div>
                        <Text className="iky-status__state-text">Xe quá 80km/h</Text>
                    </div>
                </Space>
            </div>

            {/* RIGHT: NOTI + TIME */}
            <div className="iky-status__right">
                <Badge count={0} overflowCount={99} size="small" className="iky-status__badge" showZero>
                    <span className="iky-status__notify-label">Thông báo</span>
                </Badge>
                <Text className="iky-status__time">{time}</Text>
            </div>
        </div>
    );
};

export default StatusBar;
