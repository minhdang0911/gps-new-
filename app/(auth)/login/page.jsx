'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';

import { login } from '../../lib/api/auth';
import './Login.css';

const { Title, Text } = Typography;

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const [isEn, setIsEn] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const router = useRouter();
    const pathname = usePathname() || '/login';

    // tách /en khỏi pathname để lấy normalizedPath + flag en từ URL
    const { isEnFromPath, normalizedPath } = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const hasEn = last === 'en';

        if (hasEn) {
            const baseSegments = segments.slice(0, -1);
            const basePath = baseSegments.length ? '/' + baseSegments.join('/') : '/login';
            return { isEnFromPath: true, normalizedPath: basePath };
        }

        return { isEnFromPath: false, normalizedPath: pathname || '/login' };
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
    }, [isEnFromPath]);

    const handleSwitchLang = (lang) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('iky_lang', lang);
        }

        if (lang === 'vi') {
            if (!isEn && !isEnFromPath) return;
            setIsEn(false);
            router.push('/login');
            return;
        }

        // lang === 'en'
        if (isEn || isEnFromPath) return;
        setIsEn(true);
        const newPath = normalizedPath === '/login' ? '/login/en' : `${normalizedPath}/en`;
        router.push(newPath);
    };

    const getRandomDeviceId = () => {
        return 'dev_' + Math.random().toString(36).substring(2, 12);
    };

    const onFinish = async (values) => {
        try {
            setLoading(true);

            const device = getRandomDeviceId();
            localStorage.setItem('device', device);

            const res = await login(values.username, values.password, device);

            // token + role
            localStorage.setItem('accessToken', res.accessToken);
            localStorage.setItem('refreshToken', res.refreshToken);
            localStorage.setItem('role', res?.user?.position || '');

            localStorage.setItem('username', res?.user?.username || '');
            localStorage.setItem('email', res?.user?.email || '');

            router.push('/');
        } catch (err) {
            console.error('Login error FE:', err);

            const fallbackMsg = isEn
                ? 'Login failed, please check your username/password'
                : 'Đăng nhập thất bại, kiểm tra lại tài khoản / mật khẩu';

            const msg = err?.response?.data?.error || err?.response?.data?.message || fallbackMsg;

            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const currentLangLabel = isEn ? 'EN' : 'VI';
    const currentLangText = isEn ? 'English' : 'Tiếng Việt';

    return (
        <div className="iky-login">
            <div className="iky-login__card">
                {/* LANG DROPDOWN */}
                <div className="iky-login__lang-dropdown">
                    <button
                        type="button"
                        className="iky-login__lang-trigger"
                        onClick={() => setLangOpen((prev) => !prev)}
                    >
                        <span className="iky-login__lang-trigger-code">{currentLangLabel}</span>
                        <span className="iky-login__lang-trigger-text">{currentLangText}</span>
                        <span className="iky-login__lang-trigger-caret">▾</span>
                    </button>

                    {langOpen && (
                        <div className="iky-login__lang-menu">
                            <button
                                type="button"
                                className={'iky-login__lang-item' + (!isEn ? ' iky-login__lang-item--active' : '')}
                                onClick={() => {
                                    setLangOpen(false);
                                    handleSwitchLang('vi');
                                }}
                            >
                                <span className="iky-login__lang-item-code">VI</span>
                                <span className="iky-login__lang-item-text">Tiếng Việt</span>
                            </button>
                            <button
                                type="button"
                                className={'iky-login__lang-item' + (isEn ? ' iky-login__lang-item--active' : '')}
                                onClick={() => {
                                    setLangOpen(false);
                                    handleSwitchLang('en');
                                }}
                            >
                                <span className="iky-login__lang-item-code">EN</span>
                                <span className="iky-login__lang-item-text">English</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="iky-login__header">
                    <Title level={3} className="iky-login__title">
                        {isEn ? 'Welcome back' : 'Chào mừng trở lại'}
                    </Title>
                    <Text type="secondary" className="iky-login__subtitle">
                        {isEn ? 'Sign in to manage the GPS system' : 'Đăng nhập để quản lý hệ thống GPS'}
                    </Text>
                </div>

                <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                    <Form.Item
                        label={isEn ? 'Username' : 'Tên đăng nhập'}
                        name="username"
                        rules={[
                            {
                                required: true,
                                message: isEn ? 'Please enter username' : 'Nhập tên đăng nhập',
                            },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<UserOutlined />}
                            placeholder={isEn ? 'Enter username' : 'Nhập username'}
                        />
                    </Form.Item>

                    <Form.Item
                        label={isEn ? 'Password' : 'Mật khẩu'}
                        name="password"
                        rules={[
                            {
                                required: true,
                                message: isEn ? 'Please enter password' : 'Nhập mật khẩu',
                            },
                        ]}
                    >
                        <Input.Password
                            size="large"
                            prefix={<LockOutlined />}
                            placeholder={isEn ? 'Enter password' : 'Nhập mật khẩu'}
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        className="iky-login__btn"
                    >
                        {isEn ? 'Login' : 'Đăng nhập'}
                    </Button>
                </Form>

                <div className="iky-login__footer">
                    <Text>© {new Date().getFullYear()} IKY Tracking System</Text>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
