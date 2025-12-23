'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { login } from '../../lib/api/auth';
import './Login.css';
import { useAuthStore } from '../../stores/authStore';

import logo from '../../assets/ChatGPT Image 14_36_56 5 thg 12, 2025.png';

const { Title, Text } = Typography;

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const [isEn, setIsEn] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const router = useRouter();
    const pathname = usePathname() || '/login';
    const dropdownRef = useRef(null);

    const { isEnFromPath, normalizedPath } = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const hasEn = last === 'en';

        if (hasEn) {
            const base = segments.slice(0, -1);
            const basePath = base.length ? '/' + base.join('/') : '/login';
            return { isEnFromPath: true, normalizedPath: basePath };
        }

        return { isEnFromPath: false, normalizedPath: pathname || '/login' };
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    // Close language dropdown when clicking outside
    useEffect(() => {
        const onMouseDown = (e) => {
            if (!dropdownRef.current) return;
            if (!dropdownRef.current.contains(e.target)) {
                setLangOpen(false);
            }
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, []);

    const handleSwitchLang = (lang) => {
        localStorage.setItem('iky_lang', lang);

        if (lang === 'vi') {
            if (!isEn && !isEnFromPath) return;
            setIsEn(false);
            router.push('/login');
            return;
        }

        if (isEn || isEnFromPath) return;
        setIsEn(true);

        const newPath = normalizedPath === '/login' ? '/login/en' : `${normalizedPath}/en`;

        router.push(newPath);
    };

    const getRandomDeviceId = () => 'dev_' + Math.random().toString(36).substring(2, 12);

    const setUser = useAuthStore((state) => state.setUser);

    const onFinish = async (values) => {
        try {
            setLoading(true);

            const device = getRandomDeviceId();
            localStorage.setItem('device', device);

            const res = await login(values.username, values.password, device);

            setUser(res.user);
            localStorage.setItem('role', res?.user?.position || '');
            localStorage.setItem('userid', res?.user?._id || '');

            message.success({
                content: isEn ? 'Login successful!' : 'Đăng nhập thành công!',
                duration: 2,
            });

            setTimeout(() => router.push('/'), 600);
        } catch (err) {
            const errorMessage =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                (isEn ? 'Login failed. Please check your credentials.' : 'Sai thông tin đăng nhập');

            message.error({
                content: errorMessage,
                duration: 3,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="iky-login">
            <div className="iky-login__card">
                {/* Language */}
                <div className="iky-login__lang-dropdown" ref={dropdownRef}>
                    <button type="button" className="iky-login__lang-trigger" onClick={() => setLangOpen((p) => !p)}>
                        <span className="iky-login__lang-badge">{isEn ? 'EN' : 'VI'}</span>
                        <span className="iky-login__lang-name">{isEn ? 'English' : 'Tiếng Việt'}</span>
                        <span className="iky-login__caret">▾</span>
                    </button>

                    {langOpen && (
                        <div className="iky-login__lang-menu">
                            <button onClick={() => handleSwitchLang('vi')}>VI - Tiếng Việt</button>
                            <button onClick={() => handleSwitchLang('en')}>EN - English</button>
                        </div>
                    )}
                </div>

                {/* Logo */}
                <div className="iky-login__logo">
                    <Image src={logo} alt="IKY GPS Logo" width={120} height={120} priority />
                </div>

                {/* Header */}
                <div className="iky-login__header">
                    <Title level={3} className="iky-login__title">
                        {isEn ? 'Welcome back' : 'Chào mừng trở lại'}
                    </Title>
                    <Text type="secondary" className="iky-login__subtitle">
                        {isEn ? 'Sign in to manage the GPS system' : 'Đăng nhập để quản lý hệ thống GPS'}
                    </Text>
                </div>

                {/* Form */}
                <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="iky-login__form">
                    <Form.Item
                        label={isEn ? 'Username' : 'Tên đăng nhập'}
                        name="username"
                        rules={[
                            {
                                required: true,
                                message: isEn ? 'Please enter username' : 'Vui lòng nhập tên đăng nhập',
                            },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<UserOutlined />}
                            placeholder={isEn ? 'Enter username' : 'Nhập tên đăng nhập'}
                            autoComplete="username"
                        />
                    </Form.Item>

                    <Form.Item
                        label={isEn ? 'Password' : 'Mật khẩu'}
                        name="password"
                        rules={[
                            {
                                required: true,
                                message: isEn ? 'Please enter password' : 'Vui lòng nhập mật khẩu',
                            },
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined />}
                            placeholder={isEn ? 'Enter password' : 'Nhập mật khẩu'}
                            autoComplete="current-password"
                        />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                        {isEn ? 'Login' : 'Đăng nhập'}
                    </Button>
                </Form>

                {/* Footer */}
                <div className="iky-login__footer">
                    <Text>
                        © {new Date().getFullYear()} <b>IKY GPS</b>
                        {isEn ? ' - IKY Tracking System.' : ' - Hệ thống giám sát IKY.'}
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
