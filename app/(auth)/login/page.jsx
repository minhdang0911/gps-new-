'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            debugger; // ← Dừng lại đây
            console.log('🔥 RELOAD DETECTED!');
            e.preventDefault();
            e.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

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

        if (isEn || isEnFromPath) return;
        setIsEn(true);

        const newPath = normalizedPath === '/login' ? '/login/en' : `${normalizedPath}/en`;
        router.push(newPath);
    };

    const getRandomDeviceId = () => 'dev_' + Math.random().toString(36).substring(2, 12);
    const setUser = useAuthStore((state) => state.setUser);

    const onFinish = async (values) => {
        console.log('🔵 [1] onFinish STARTED');

        try {
            setLoading(true);
            console.log('🔵 [2] setLoading = true');

            const device = getRandomDeviceId();
            localStorage.setItem('device', device);
            console.log('🔵 [3] device set:', device);

            console.log('🔵 [4] Calling login API...');
            const res = await login(values.username, values.password, device);
            console.log('✅ [5] Login SUCCESS:', res);

            setUser(res.user);
            localStorage.setItem('role', res?.user?.position || '');

            message.success({
                content: isEn ? 'Login successful!' : 'Đăng nhập thành công!',
                duration: 2,
            });

            setTimeout(() => {
                router.push('/');
            }, 800);
        } catch (err) {
            console.log('❌ [6] Login FAILED - catch block');
            console.error('❌ [7] Error details:', err);
            console.error('❌ [8] Error message:', err?.message);
            console.error('❌ [9] Error response:', err?.response);

            // ✅ Lấy message từ response.data của server
            const errorMessage =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                (isEn ? 'Login failed. Please check your credentials.' : 'Sai thông tin đăng nhập');

            console.log('❌ [10] Showing error message:', errorMessage);
            message.error({
                content: errorMessage,
                duration: 3,
            });

            console.log('❌ [11] Error message shown, catch block DONE');
        } finally {
            console.log('🔵 [12] Finally block - setLoading = false');
            setLoading(false);
            console.log('🔵 [13] onFinish COMPLETED');
        }
    };
    return (
        <div className="iky-login">
            <div className="iky-login__card">
                <div className="iky-login__lang-dropdown">
                    <button type="button" className="iky-login__lang-trigger" onClick={() => setLangOpen((p) => !p)}>
                        <span>{isEn ? 'EN' : 'VI'}</span>
                        <span>{isEn ? 'English' : 'Tiếng Việt'}</span>
                        <span>▾</span>
                    </button>

                    {langOpen && (
                        <div className="iky-login__lang-menu">
                            <button
                                onClick={() => {
                                    setLangOpen(false);
                                    handleSwitchLang('vi');
                                }}
                            >
                                VI - Tiếng Việt
                            </button>
                            <button
                                onClick={() => {
                                    setLangOpen(false);
                                    handleSwitchLang('en');
                                }}
                            >
                                EN - English
                            </button>
                        </div>
                    )}
                </div>

                <div className="iky-login__logo">
                    <Image src={logo} alt="IKY GPS Logo" width={150} height={150} priority />
                </div>

                <div className="iky-login__header">
                    <Title level={3}>{isEn ? 'Welcome back' : 'Chào mừng trở lại'}</Title>
                    <Text type="secondary">
                        {isEn ? 'Sign in to manage the GPS system' : 'Đăng nhập để quản lý hệ thống GPS'}
                    </Text>
                </div>
                <Form
                    layout="vertical"
                    onFinish={onFinish}
                    onFinishFailed={(errorInfo) => {
                        console.log('Form validation failed:', errorInfo);
                    }}
                    requiredMark={false}
                >
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
                        />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                        {isEn ? 'Login' : 'Đăng nhập'}
                    </Button>
                </Form>

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
