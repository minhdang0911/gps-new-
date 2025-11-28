'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/api/auth';

import './Login.css';

const { Title, Text } = Typography;

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onFinish = async (values) => {
        try {
            setLoading(true);
            const res = await login(values.username, values.password);

            // token + role
            localStorage.setItem('accessToken', res.accessToken);
            localStorage.setItem('refreshToken', res.refreshToken);
            localStorage.setItem('role', res?.user?.position || '');

            // ✨ lưu info user cho Navbar dùng
            localStorage.setItem('username', res?.user?.username || '');
            localStorage.setItem('email', res?.user?.email || '');

            router.push('/');
        } catch (err) {
            console.error('Login error FE:', err);

            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                'Đăng nhập thất bại, kiểm tra lại tài khoản / mật khẩu';

            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="iky-login">
            <div className="iky-login__card">
                <div className="iky-login__header">
                    <Title level={3} className="iky-login__title">
                        Chào mừng trở lại
                    </Title>
                    <Text type="secondary" className="iky-login__subtitle">
                        Đăng nhập để quản lý hệ thống GPS
                    </Text>
                </div>

                <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                    <Form.Item
                        label="Tên đăng nhập"
                        name="username"
                        rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}
                    >
                        <Input size="large" prefix={<UserOutlined />} placeholder="Nhập username" />
                    </Form.Item>

                    <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                        <Input.Password size="large" prefix={<LockOutlined />} placeholder="Nhập mật khẩu" />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        className="iky-login__btn"
                    >
                        Đăng nhập
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
