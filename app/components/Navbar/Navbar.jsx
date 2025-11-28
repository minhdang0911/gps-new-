'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import './Navbar.css';
import { useRouter, usePathname } from 'next/navigation';

import giamsat from '../../assets/giamsat.webp';
import hanhtrinh from '../../assets/hanhtrinh.webp';
import baocao from '../../assets/baocao.webp';
import quanly from '../../assets/quanly.webp';
import hotro from '../../assets/hotro.png';
import logo from '../../assets/logo-iky.webp';

import { logoutApi } from '../../lib/api/auth';

const navItems = [
    { key: 'monitor', label: 'Giám Sát', img: giamsat, path: '/' },
    { key: 'route', label: 'Hành Trình', img: hanhtrinh, path: '/cruise' },
    { key: 'report', label: 'Báo cáo', img: baocao, path: '/report' },
    { key: 'manage', label: 'Quản Lý', img: quanly, path: '/manage' },
    { key: 'support', label: 'Hỗ Trợ', img: hotro, path: '/support' },
];

const Navbar = () => {
    const router = useRouter();
    const pathname = usePathname() || '/';

    const [openDropdown, setOpenDropdown] = useState(false);
    const [displayName, setDisplayName] = useState('Tài khoản');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        const username = localStorage.getItem('username');
        const email = localStorage.getItem('email');
        setDisplayName(username || email || 'Tài khoản');
    }, []);

    const computedActiveKey = useMemo(() => {
        return (
            navItems.find((item) => {
                if (item.path === '/') return pathname === '/';
                return pathname.startsWith(item.path);
            })?.key || 'monitor'
        );
    }, [pathname]);

    if (pathname === '/login') return null;

    const handleClickItem = (item) => {
        if (pathname !== item.path) router.push(item.path);
    };

    const handleLogout = async () => {
        if (isLoggingOut) return; // Tránh click nhiều lần

        try {
            setIsLoggingOut(true);
            setOpenDropdown(false);

            const response = await logoutApi();

            // Check response từ API
            if (response && response.message === 'Thành công') {
                console.log('Đăng xuất thành công');
            } else {
                console.warn('Response không như mong đợi:', response);
            }
        } catch (err) {
            console.error('Lỗi khi đăng xuất:', err);
            // Vẫn cho logout ở client side ngay cả khi API lỗi
        } finally {
            // Xoá sạch localStorage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('username');
            localStorage.removeItem('email');
            localStorage.removeItem('currentUser');

            setIsLoggingOut(false);
            router.push('/login');
        }
    };

    return (
        <header className="iky-nav">
            <div className="iky-nav__logo">
                <img src={logo.src} alt="IKY GPS" className="iky-nav__logo-img" />
            </div>

            <nav className="iky-nav__menu">
                {navItems.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={'iky-nav__item' + (item.key === computedActiveKey ? ' iky-nav__item--active' : '')}
                        onClick={() => handleClickItem(item)}
                    >
                        <div className="iky-nav__item-icon">
                            <Image src={item.img} alt={item.label} width={26} height={26} />
                        </div>
                        <span className="iky-nav__item-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="iky-nav__user" onClick={() => setOpenDropdown((prev) => !prev)}>
                <span className="iky-nav__user-name">{displayName}</span>
                <span className="iky-nav__user-sub">({displayName})</span>
                <span className="iky-nav__user-caret">▾</span>

                {openDropdown && (
                    <div className="iky-nav__dropdown">
                        <button className="iky-nav__dropdown-item">Cá nhân</button>
                        <button className="iky-nav__dropdown-item" onClick={handleLogout} disabled={isLoggingOut}>
                            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Navbar;
