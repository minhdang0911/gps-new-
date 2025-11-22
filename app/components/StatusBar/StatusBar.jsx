'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import './StatusBar.css';

import xeDung from '../../assets/ico_biker_1.png';
import xeChay from '../../assets/ico_biker_2.png';
import xe50 from '../../assets/ico_biker_3.png';
import xe80 from '../../assets/ico_biker_4.png';

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

    // ----- CLOCK -----
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

    return (
        <div className="iky-status">
            {/* BREADCRUMB */}
            <div className="iky-status__breadcrumb">
                <span className="iky-status__icon">&raquo;&raquo;</span>
                <span className="iky-status__link">Trang chủ</span>
                <span className="iky-status__slash"> / </span>
                <span className="iky-status__current">{currentTitle}</span>
            </div>

            {/* ICON XE */}
            <div className="iky-status__states">
                <div className="iky-status__state">
                    <img src={xeDung.src} alt="Xe dừng" />
                    <span>Xe dừng</span>
                </div>
                <div className="iky-status__state">
                    <img src={xeChay.src} alt="Xe đang chạy" />
                    <span>Xe đang chạy</span>
                </div>
                <div className="iky-status__state">
                    <img src={xe50.src} alt="Xe quá 50km/h" />
                    <span>Xe quá 50km/h</span>
                </div>
                <div className="iky-status__state">
                    <img src={xe80.src} alt="Xe quá 80km/h" />
                    <span>Xe quá 80km/h</span>
                </div>
            </div>

            {/* NOTI + TIME */}
            <div className="iky-status__right">
                <span className="iky-status__notify">
                    Thông Báo <span className="iky-status__notify-count">(0)</span>
                </span>
                <span className="iky-status__time">{time}</span>
            </div>
        </div>
    );
};

export default StatusBar;
