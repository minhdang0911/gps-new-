'use client';

import React, { useState } from 'react';
import { Card, Typography, Descriptions, Button, Modal, Form, Input, Row, Col, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const mockUserInfo = {
    fullName: 'haidv',
    phone: '0962081099',
    email: '',
    city: '',
    district: '',
    ward: '',
    address: '',
};

const mockAccountInfo = {
    username: 'haidv',
    password: 'xxxxxx',
    startDate: '18/05/2024',
    endDate: '18/05/2025',
    deviceCount: 4,
};

export default function ProfilePage() {
    const [showEditUserModal, setShowEditUserModal] = useState(false);

    const [userForm, setUserForm] = useState({
        fullName: mockUserInfo.fullName,
        phone: mockUserInfo.phone,
        email: mockUserInfo.email,
        city: mockUserInfo.city,
        district: mockUserInfo.district,
        ward: mockUserInfo.ward,
        address: mockUserInfo.address,
    });

    const handleSave = () => {
        console.log('SAVE PROFILE', userForm);
        setShowEditUserModal(false);
    };

    return (
        <div style={{ width: '100%' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Title level={4}>Thông tin người dùng</Title>

                <Card bordered>
                    <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="Họ tên">{mockUserInfo.fullName}</Descriptions.Item>
                        <Descriptions.Item label="Số điện thoại">{mockUserInfo.phone}</Descriptions.Item>
                        <Descriptions.Item label="Email">{mockUserInfo.email || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ">{mockUserInfo.address || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Phường">{mockUserInfo.ward || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Quận/Huyện">{mockUserInfo.district || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Tỉnh/Thành phố">{mockUserInfo.city || '-'}</Descriptions.Item>
                    </Descriptions>

                    <div style={{ textAlign: 'right', marginTop: 12 }}>
                        <Button type="primary" icon={<EditOutlined />} onClick={() => setShowEditUserModal(true)}>
                            Chỉnh sửa
                        </Button>
                    </div>
                </Card>

                <Title level={4}>Thông tin tài khoản</Title>

                <Card bordered>
                    <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="Tên đăng nhập">{mockAccountInfo.username}</Descriptions.Item>
                        <Descriptions.Item label="Mật khẩu">{mockAccountInfo.password}</Descriptions.Item>
                        <Descriptions.Item label="Ngày tạo">{mockAccountInfo.startDate}</Descriptions.Item>
                        <Descriptions.Item label="Ngày hết hạn">{mockAccountInfo.endDate}</Descriptions.Item>
                        <Descriptions.Item label="Số thiết bị">{mockAccountInfo.deviceCount}</Descriptions.Item>
                    </Descriptions>
                </Card>
            </Space>

            {/* MODAL EDIT PROFILE */}
            <Modal
                title="Chỉnh sửa thông tin cá nhân"
                open={showEditUserModal}
                onCancel={() => setShowEditUserModal(false)}
                onOk={handleSave}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form layout="vertical">
                    <Form.Item label="Họ tên">
                        <Input
                            value={userForm.fullName}
                            onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item label="Số điện thoại">
                        <Input
                            value={userForm.phone}
                            onChange={(e) => setUserForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item label="Email">
                        <Input
                            value={userForm.email}
                            onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Tỉnh/Thành phố">
                                <Input
                                    value={userForm.city}
                                    onChange={(e) => setUserForm((f) => ({ ...f, city: e.target.value }))}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item label="Quận/Huyện">
                                <Input
                                    value={userForm.district}
                                    onChange={(e) => setUserForm((f) => ({ ...f, district: e.target.value }))}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Phường">
                        <Input
                            value={userForm.ward}
                            onChange={(e) => setUserForm((f) => ({ ...f, ward: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item label="Địa chỉ">
                        <Input
                            value={userForm.address}
                            onChange={(e) => setUserForm((f) => ({ ...f, address: e.target.value }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
