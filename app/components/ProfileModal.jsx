'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { updateUser, getUserInfo } from '../lib/api/user';
import { useAuthStore } from '../stores/authStore';

const ProfileModal = ({ open, onClose, isEn }) => {
    const [form] = Form.useForm();
    const user = useAuthStore((s) => s.user);
    const setUser = useAuthStore((s) => s.setUser);

    useEffect(() => {
        if (!open || !user?._id) return;

        const fetchInfo = async () => {
            try {
                const res = await getUserInfo(user._id);

                const u = res.user;

                form.setFieldsValue({
                    name: u?.name || '',
                    phone: u?.phone || '',
                    address: u?.address || '',
                    password: '',
                });
            } catch (err) {
                message.error(isEn ? 'Cannot load profile' : 'Không tải được thông tin');
            }
        };

        fetchInfo();
    }, [open]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            const payload = {
                name: values.name,
                phone: values.phone,
                address: values.address,
            };

            if (values.password) {
                payload.password = values.password;
            }

            const res = await updateUser(user._id, payload);

            setUser(res.obj);

            message.success(isEn ? 'Updated successfully' : 'Cập nhật thành công');
            onClose();
        } catch (err) {
            message.error(err?.response?.data?.message || (isEn ? 'Update failed' : 'Cập nhật thất bại'));
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            okText={isEn ? 'Save' : 'Lưu'}
            cancelText={isEn ? 'Cancel' : 'Hủy'}
            title={isEn ? 'Profile' : 'Thông tin cá nhân'}
            destroyOnHidden
        >
            <Form layout="vertical" form={form}>
                <Form.Item label={isEn ? 'Name' : 'Tên'} name="name">
                    <Input />
                </Form.Item>

                <Form.Item label={isEn ? 'Phone' : 'Số điện thoại'} name="phone">
                    <Input />
                </Form.Item>

                <Form.Item label={isEn ? 'Address' : 'Địa chỉ'} name="address">
                    <Input />
                </Form.Item>

                <Form.Item label={isEn ? 'New Password' : 'Mật khẩu mới'} name="password">
                    <Input.Password placeholder={isEn ? 'Leave blank if not changing' : 'Để trống nếu không đổi'} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ProfileModal;
