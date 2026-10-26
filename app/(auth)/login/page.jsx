'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Form, Typography, message } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import './Login.css';
import { useAuthStore } from '../../stores/authStore';
import { login } from '../../lib/api/auth';
import logo from '../../assets/ChatGPT Image 14_36_56 5 thg 12, 2025.png';
import LanguageDropdown from './components/LanguageDropdown';
import LoginForm from './components/LoginForm';

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
    const [form] = Form.useForm();

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
                <LanguageDropdown
                    isEn={isEn}
                    langOpen={langOpen}
                    setLangOpen={setLangOpen}
                    handleSwitchLang={handleSwitchLang}
                    dropdownRef={dropdownRef}
                />

                <div className="iky-login__logo">
                    <Image src={logo} alt="IKY GPS Logo" width={200} height={80} priority />
                </div>

                <div className="iky-login__header">
                    <Title level={3} className="iky-login__title">
                        {isEn ? 'Welcome back' : 'Chào mừng trở lại'}
                    </Title>
                    <Text type="secondary" className="iky-login__subtitle">
                        {isEn ? 'Sign in to manage the GPS system' : 'Đăng nhập để quản lý hệ thống GPS'}
                    </Text>
                </div>

                <LoginForm
                    form={form}
                    loading={loading}
                    isEn={isEn}
                    onFinish={onFinish}
                />

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
