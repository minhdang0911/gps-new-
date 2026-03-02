'use client';

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Tabs, message } from 'antd';
import { updateUser, getUserInfo } from '../lib/api/user';
import { useAuthStore } from '../stores/authStore';
import AddressAutoComplete from '../components/AddressAutoComplete';

const ProfileModal = ({ open, onClose, isEn }) => {
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [activeTab, setActiveTab] = useState('profile');

    const user = useAuthStore((s) => s.user);
    const setUser = useAuthStore((s) => s.setUser);

    useEffect(() => {
        if (!open || !user?._id) return;

        const fetchInfo = async () => {
            try {
                const res = await getUserInfo(user._id);
                const u = res?.user;

                profileForm.setFieldsValue({
                    username: u?.username || '',
                    name: u?.name || '',
                    email: u?.email || '',
                    phone: u?.phone || '',
                    address: u?.address || '',
                });

                passwordForm.resetFields();
                setActiveTab('profile');
            } catch (err) {
                message.error(isEn ? 'Cannot load profile' : 'Không tải được thông tin');
            }
        };

        fetchInfo();
    }, [open, user?._id]); // giữ như bạn đang dùng

    const handleSubmit = async () => {
        try {
            if (activeTab === 'profile') {
                const values = await profileForm.validateFields();

                const payload = {
                    name: values.name,
                    email: values.email, // ✅ email edit được
                    phone: values.phone,
                    address: values.address,
                };

                const res = await updateUser(user._id, payload);

                if (res?.obj) setUser(res.obj);

                message.success(isEn ? 'Updated successfully' : 'Cập nhật thành công');
                onClose();
                return;
            }

            // activeTab === 'password'
            const values = await passwordForm.validateFields();

            const payload = {
                password: values.newPassword, // ✅ backend tính sau
            };

            const res = await updateUser(user._id, payload);
            if (res?.obj) setUser(res.obj);

            message.success(isEn ? 'Password updated successfully' : 'Đổi mật khẩu thành công');
            passwordForm.resetFields();
            onClose();
        } catch (err) {
            message.error(err?.response?.data?.message || (isEn ? 'Update failed' : 'Cập nhật thất bại'));
        }
    };

    const handleClose = () => {
        onClose?.();
        profileForm.resetFields();
        passwordForm.resetFields();
        setActiveTab('profile');
    };

    const okText = activeTab === 'password' ? (isEn ? 'Change Password' : 'Đổi mật khẩu') : isEn ? 'Save' : 'Lưu';

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            onOk={handleSubmit}
            okText={okText}
            cancelText={isEn ? 'Cancel' : 'Hủy'}
            title={isEn ? 'Profile' : 'Thông tin cá nhân'}
            destroyOnHidden
        >
            <Tabs
                activeKey={activeTab}
                onChange={(key) => {
                    setActiveTab(key);
                    if (key === 'password') passwordForm.resetFields();
                }}
                items={[
                    {
                        key: 'profile',
                        label: isEn ? 'Personal Info' : 'Thông tin cá nhân',
                        children: (
                            <Form layout="vertical" form={profileForm}>
                                <Form.Item label={isEn ? 'Username' : 'Tên đăng nhập'} name="username">
                                    <Input disabled />
                                </Form.Item>

                                <Form.Item
                                    label={isEn ? 'Email' : 'Email'}
                                    name="email"
                                    rules={[{ type: 'email', message: isEn ? 'Invalid email' : 'Email không hợp lệ' }]}
                                >
                                    <Input />
                                </Form.Item>

                                <Form.Item label={isEn ? 'Name' : 'Tên'} name="name">
                                    <Input />
                                </Form.Item>

                                <Form.Item label={isEn ? 'Phone' : 'Số điện thoại'} name="phone">
                                    <Input />
                                </Form.Item>

                                {/* ✅ Address AutoComplete */}
                                <Form.Item label={isEn ? 'Address' : 'Địa chỉ'} name="address">
                                    <AddressAutoComplete
                                        value={profileForm.getFieldValue('address')}
                                        onChange={(val) => {
                                            profileForm.setFieldValue('address', val);
                                        }}
                                        placeholder={isEn ? 'Enter address...' : 'Nhập địa chỉ...'}
                                    />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: 'password',
                        label: isEn ? 'Change Password' : 'Đổi mật khẩu',
                        children: (
                            <Form layout="vertical" form={passwordForm}>
                                <Form.Item
                                    label={isEn ? 'New Password' : 'Mật khẩu mới'}
                                    name="newPassword"
                                    rules={[
                                        {
                                            required: true,
                                            message: isEn ? 'Please enter new password' : 'Vui lòng nhập mật khẩu mới',
                                        },
                                    ]}
                                >
                                    <Input.Password />
                                </Form.Item>

                                <Form.Item
                                    label={isEn ? 'Confirm New Password' : 'Xác nhận mật khẩu mới'}
                                    name="confirmNewPassword"
                                    dependencies={['newPassword']}
                                    rules={[
                                        {
                                            required: true,
                                            message: isEn ? 'Please confirm password' : 'Vui lòng xác nhận mật khẩu',
                                        },
                                        ({ getFieldValue }) => ({
                                            validator(_, value) {
                                                const pwd = getFieldValue('newPassword');
                                                if (!value || value === pwd) return Promise.resolve();
                                                return Promise.reject(
                                                    new Error(isEn ? 'Passwords do not match' : 'Mật khẩu không khớp'),
                                                );
                                            },
                                        }),
                                    ]}
                                >
                                    <Input.Password />
                                </Form.Item>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
};

export default ProfileModal;
