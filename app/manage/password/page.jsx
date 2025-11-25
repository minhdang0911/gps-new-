'use client';

import React from 'react';
import { Card, Typography, Form, Input, Button } from 'antd';

const { Title } = Typography;

const mockAccountInfo = {
    username: 'haidv',
};

export default function PasswordPage() {
    return (
        <Card style={{ maxWidth: 500, margin: '0 auto' }}>
            <Title level={4}>Đổi mật khẩu</Title>

            <Form layout="vertical">
                <Form.Item label="Tài khoản">
                    <Input value={mockAccountInfo.username} disabled />
                </Form.Item>

                <Form.Item label="Mật khẩu hiện tại">
                    <Input.Password />
                </Form.Item>

                <Form.Item label="Mật khẩu mới">
                    <Input.Password />
                </Form.Item>

                <Form.Item label="Xác nhận mật khẩu mới">
                    <Input.Password />
                </Form.Item>

                <Form.Item style={{ textAlign: 'right' }}>
                    <Button type="primary">Lưu thay đổi</Button>
                </Form.Item>
            </Form>
        </Card>
    );
}
