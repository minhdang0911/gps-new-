'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import './Navbar.css';
import { useRouter, usePathname } from 'next/navigation';
import { UpOutlined, DownOutlined } from '@ant-design/icons';
import ProfileModal from '../ProfileModal';
import Link from 'next/link';

import giamsat from '../../assets/giamsat.webp';
import hanhtrinh from '../../assets/hanhtrinh.webp';
import baocao from '../../assets/baocao.webp';
import quanly from '../../assets/quanly.webp';
import hotro from '../../assets/hotro.png';
import logo from '../../assets/logo-iky.webp';

import flagVi from '../../assets/flag-vi.webp';
import flagEn from '../../assets/flag-en.webp';

import { useAuthStore } from '../../stores/authStore';
import { logoutApi } from '../../lib/api/auth';

const navItems = [
    { key: 'monitor', labelVi: 'Giám Sát', labelEn: 'Monitor', img: giamsat, path: '/' },
    { key: 'route', labelVi: 'Hành Trình', labelEn: 'Cruise', img: hanhtrinh, path: '/cruise' },
    { key: 'report', labelVi: 'Báo cáo', labelEn: 'Report', img: baocao, path: '/report' },
    { key: 'manage', labelVi: 'Quản Lý', labelEn: 'Manage', img: quanly, path: '/manage' },
    { key: 'support', labelVi: 'Hỗ Trợ', labelEn: 'Support', img: hotro, path: '/support' },
];

const Navbar = () => {
    const router = useRouter();
    const pathname = usePathname() || '/';
    const dropdownRef = useRef(null);

    const [openDropdown, setOpenDropdown] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isEn, setIsEn] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);

    const user = useAuthStore((s) => s.user);
    const hydrated = useAuthStore((s) => s.hydrated);
    const clearUser = useAuthStore((s) => s.clearUser);

    const { isEnFromPath, normalizedPath } = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const hasEn = last === 'en';

        if (hasEn) {
            const baseSegments = segments.slice(0, -1);
            const basePath = baseSegments.length ? '/' + baseSegments.join('/') : '/';
            return { isEnFromPath: true, normalizedPath: basePath };
        }

        return { isEnFromPath: false, normalizedPath: pathname };
    }, [pathname]);

    const computedActiveKey = useMemo(() => {
        return (
            navItems.find((item) => {
                if (item.path === '/') return normalizedPath === '/';
                return normalizedPath.startsWith(item.path);
            })?.key || 'monitor'
        );
    }, [normalizedPath]);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath, pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(false);
            }
        };

        if (openDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown]);

    if (!mounted) return null;
    if (pathname === '/login' || pathname === '/login/en') return null;

    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : '';

    const handleClickItem = (item) => {
        let targetPath = item.path;
        if (isEn) targetPath = item.path === '/' ? '/en' : `${item.path}/en`;
        router.push(targetPath);
    };

    const handleOpenGuide = () => {
        setOpenDropdown(false);
        window.open('/TÀI%20LIỆU%20HƯỚNG%20DẪN%20SỬ%20DỤNG%20WEBSITE%20GPS.pdf', '_blank');
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        try {
            setIsLoggingOut(true);
            setOpenDropdown(false);
            await logoutApi();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            clearUser();
            if (typeof window !== 'undefined') {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('role');
                localStorage.removeItem('iky_user');
            }
            setIsLoggingOut(false);
            router.push('/login');
        }
    };

    const handleSwitchLang = (lang) => {
        if (typeof window !== 'undefined') localStorage.setItem('iky_lang', lang);
        if (lang === 'vi') router.push(normalizedPath || '/');
        if (lang === 'en') {
            const newPath = normalizedPath === '/' ? '/en' : `${normalizedPath}/en`;
            router.push(newPath);
        }
    };

    const filteredNavItems = navItems.filter((item) => {
        if (role === 'reporter' && item.key === 'manage') return false;
        return true;
    });

    return (
        <>
            <ProfileModal open={openProfile} onClose={() => setOpenProfile(false)} isEn={isEn} />

            <header className="iky-nav">
                <Link className="iky-nav__logo" href="/">
                    <img src={logo.src} alt="IKY GPS" className="iky-nav__logo-img" />
                </Link>

                <nav className="iky-nav__menu">
                    {filteredNavItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={
                                'iky-nav__item' + (item.key === computedActiveKey ? ' iky-nav__item--active' : '')
                            }
                            onClick={() => handleClickItem(item)}
                        >
                            <div className="iky-nav__item-icon">
                                <Image src={item.img} alt={isEn ? item.labelEn : item.labelVi} width={26} height={26} />
                            </div>
                            <span className="iky-nav__item-label">{isEn ? item.labelEn : item.labelVi}</span>
                        </button>
                    ))}
                </nav>

                <div className="iky-nav__right">
                    <div className="iky-nav__lang">
                        <button
                            type="button"
                            className={'iky-nav__lang-btn' + (!isEn ? ' iky-nav__lang-btn--active' : '')}
                            onClick={() => handleSwitchLang('vi')}
                        >
                            <Image src={flagVi} alt="Tiếng Việt" width={16} height={16} />
                            <span>VI</span>
                        </button>

                        <button
                            type="button"
                            className={'iky-nav__lang-btn' + (isEn ? ' iky-nav__lang-btn--active' : '')}
                            onClick={() => handleSwitchLang('en')}
                        >
                            <Image src={flagEn} alt="English" width={16} height={16} />
                            <span>EN</span>
                        </button>
                    </div>

                    <div className="iky-nav__user" ref={dropdownRef} onClick={() => setOpenDropdown((prev) => !prev)}>
                        <span className="iky-nav__user-name">
                            {!hydrated ? '...' : user?.username || user?.email || 'Tài khoản'}
                        </span>
                        {openDropdown ? <UpOutlined /> : <DownOutlined />}

                        {openDropdown && (
                            <div className="iky-nav__dropdown" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="iky-nav__dropdown-item"
                                    onClick={() => {
                                        setOpenDropdown(false);
                                        setOpenProfile(true);
                                    }}
                                >
                                    {isEn ? 'Profile' : 'Thông tin cá nhân'}
                                </button>

                                <button className="iky-nav__dropdown-item" onClick={handleOpenGuide}>
                                    {isEn ? 'User Guide' : 'Hướng dẫn sử dụng'}
                                </button>

                                <button
                                    className="iky-nav__dropdown-item"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                >
                                    {isLoggingOut
                                        ? isEn
                                            ? 'Logging out...'
                                            : 'Đang đăng xuất...'
                                        : isEn
                                          ? 'Logout'
                                          : 'Đăng xuất'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
};

export default Navbar;
