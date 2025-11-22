'use client';
import React, { useState } from 'react';
import './Navbar.css';
import { useRouter, usePathname } from 'next/navigation';

import giamsat from '../../assets/giamsat.png';
import hanhtrinh from '../../assets/hanhtrinh.png';
import baocao from '../../assets/baocao.png';
import quanly from '../../assets/quanly.png';
import hotro from '../../assets/hotro.png';
import logo from '../../assets/logo-iky.webp';

const navItems = [
    { key: 'monitor', label: 'Giám Sát', img: giamsat, path: '/' },
    { key: 'route', label: 'Hành Trình', img: hanhtrinh, path: '/cruise' },
    { key: 'report', label: 'Báo cáo', img: baocao, path: '/report' },
    { key: 'manage', label: 'Quản Lý', img: quanly, path: '/manage' },
    { key: 'support', label: 'Hỗ Trợ', img: hotro, path: '/support' },
];

const Navbar = ({ username = 'haidv' }) => {
    const [openDropdown, setOpenDropdown] = useState(false);
    const router = useRouter();
    const pathname = usePathname() || '/';

    // Tự tính activeKey dựa vào URL
    const computedActiveKey =
        navItems.find((item) => {
            if (item.path === '/') {
                return pathname === '/';
            }
            return pathname.startsWith(item.path);
        })?.key || 'monitor';

    const handleClickItem = (item) => {
        if (pathname !== item.path) {
            router.push(item.path);
        }
    };

    return (
        <header className="iky-nav">
            {/* LOGO */}
            <div className="iky-nav__logo">
                <img src={logo.src} alt="IKY GPS" className="iky-nav__logo-img" />
            </div>

            {/* MENU */}
            <nav className="iky-nav__menu">
                {navItems.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={
                            'iky-nav__item' +
                            (item.key === computedActiveKey ? ' iky-nav__item--active' : '')
                        }
                        onClick={() => handleClickItem(item)}
                    >
                        <div className="iky-nav__item-icon">
                            <img src={item.img.src} alt={item.label} />
                        </div>
                        <span className="iky-nav__item-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* USER + DROPDOWN */}
            <div
                className="iky-nav__user"
                onClick={() => setOpenDropdown((prev) => !prev)}
            >
                <span className="iky-nav__user-name">{username}</span>
                <span className="iky-nav__user-sub">({username})</span>
                <span className="iky-nav__user-caret">▾</span>

                {openDropdown && (
                    <div className="iky-nav__dropdown">
                        <button className="iky-nav__dropdown-item">Cá nhân</button>
                        <button className="iky-nav__dropdown-item">Đăng xuất</button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Navbar;
