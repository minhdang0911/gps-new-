'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import './Navbar.css';
import { useRouter, usePathname } from 'next/navigation';
import { UpOutlined, DownOutlined } from '@ant-design/icons';

import giamsat from '../../assets/giamsat.webp';
import hanhtrinh from '../../assets/hanhtrinh.webp';
import baocao from '../../assets/baocao.webp';
import quanly from '../../assets/quanly.webp';
import hotro from '../../assets/hotro.png';
import logo from '../../assets/logo-iky.webp';

import flagVi from '../../assets/flag-vi.png';
import flagEn from '../../assets/flag-en.png';

import { logoutApi } from '../../lib/api/auth';

// label theo từng ngôn ngữ
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

    const [openDropdown, setOpenDropdown] = useState(false);
    const [displayName, setDisplayName] = useState('Tài khoản');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isEn, setIsEn] = useState(false);

    // username
    useEffect(() => {
        const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
        const email = typeof window !== 'undefined' ? localStorage.getItem('email') : null;
        setDisplayName(username || email || 'Tài khoản');
    }, []);

    // tách /en khỏi pathname để lấy normalizedPath + flag en từ URL
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

    // quyết định ngôn ngữ:
    // 1) nếu URL có /en -> EN + lưu vào localStorage
    // 2) nếu không, lấy theo localStorage (nếu trước đó user chọn EN)
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

    const computedActiveKey = useMemo(() => {
        return (
            navItems.find((item) => {
                if (item.path === '/') return normalizedPath === '/';
                return normalizedPath.startsWith(item.path);
            })?.key || 'monitor'
        );
    }, [normalizedPath]);

    if (pathname === '/login' || pathname === '/login/en') return null;

    const handleClickItem = (item) => {
        let targetPath = item.path;

        // nếu đang EN thì URL đẹp /xxx/en (middleware sẽ rewrite nội bộ)
        if (isEn) {
            if (item.path === '/') {
                targetPath = '/en';
            } else {
                targetPath = `${item.path}/en`;
            }
        }

        router.push(targetPath);
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        try {
            setIsLoggingOut(true);
            setOpenDropdown(false);

            const response = await logoutApi();

            if (response && response.message === 'Thành công') {
                console.log('Đăng xuất thành công');
            } else {
                console.warn('Response không như mong đợi:', response);
            }
        } catch (err) {
            console.error('Lỗi khi đăng xuất:', err);
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('role');
                localStorage.removeItem('username');
                localStorage.removeItem('email');
                localStorage.removeItem('currentUser');
            }

            setIsLoggingOut(false);
            router.push('/login');
        }
    };

    // 🔁 switch VI / EN
    const handleSwitchLang = (lang) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('iky_lang', lang);
        }

        if (lang === 'vi') {
            if (!isEn && !isEnFromPath) return;
            // quay về path gốc (không /en)
            router.push(normalizedPath || '/');
            return;
        }

        if (lang === 'en') {
            if (isEn || isEnFromPath) return;
            const newPath = normalizedPath === '/' ? '/en' : `${normalizedPath}/en`;
            router.push(newPath);
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
                            <Image src={item.img} alt={isEn ? item.labelEn : item.labelVi} width={26} height={26} />
                        </div>
                        <span className="iky-nav__item-label">{isEn ? item.labelEn : item.labelVi}</span>
                    </button>
                ))}
            </nav>

            {/* CỤM BÊN PHẢI: LANG + USER */}
            <div className="iky-nav__right">
                <div className="iky-nav__lang">
                    <button
                        type="button"
                        className={'iky-nav__lang-btn' + (!isEn ? ' iky-nav__lang-btn--active' : '')}
                        onClick={() => handleSwitchLang('vi')}
                    >
                        <Image src={flagVi} alt="Tiếng Việt" width={16} height={16} />
                        <span className="iky-nav__lang-text">VI</span>
                    </button>

                    <button
                        type="button"
                        className={'iky-nav__lang-btn' + (isEn ? ' iky-nav__lang-btn--active' : '')}
                        onClick={() => handleSwitchLang('en')}
                    >
                        <Image src={flagEn} alt="English" width={16} height={16} />
                        <span className="iky-nav__lang-text">EN</span>
                    </button>
                </div>

                <div className="iky-nav__user" onClick={() => setOpenDropdown((prev) => !prev)}>
                    <span className="iky-nav__user-name">{displayName}</span>
                    <span className="iky-nav__user-sub">({displayName})</span>
                    {openDropdown ? (
                        <UpOutlined className="iky-nav__user-caret" />
                    ) : (
                        <DownOutlined className="iky-nav__user-caret" />
                    )}

                    {openDropdown && (
                        <div className="iky-nav__dropdown">
                            <button className="iky-nav__dropdown-item">{isEn ? 'Profile' : 'Cá nhân'}</button>
                            <button className="iky-nav__dropdown-item" onClick={handleLogout} disabled={isLoggingOut}>
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
    );
};

export default Navbar;
