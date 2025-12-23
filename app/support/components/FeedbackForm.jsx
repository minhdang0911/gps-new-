'use client';

import React from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';

import styles from '../SupportPage.module.css';

export default function FeedbackForm({ t, isEn }) {
    const [form] = Form.useForm();

    const handleSubmit = (values) => {
        console.log('Support form values:', values);

        message.success(
            isEn
                ? 'Support request sent successfully. We will contact you soon!'
                : 'Gửi yêu cầu hỗ trợ thành công. Chúng tôi sẽ liên hệ sớm nhất!',
        );

        form.resetFields();
    };

    return (
        <Card variant={false} className={`${styles.supportCard} ${styles.supportCardElevated}`} title={t.feedbackTitle}>
            <Form layout="vertical" form={form} onFinish={handleSubmit} requiredMark={false}>
                <Form.Item
                    label={t.formFullName}
                    name="fullName"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please enter your full name' : 'Vui lòng nhập họ tên',
                        },
                    ]}
                >
                    <Input placeholder={isEn ? 'Enter your full name' : 'Nhập họ tên của bạn'} />
                </Form.Item>

                <Form.Item
                    label={t.formEmail}
                    name="email"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please enter your email' : 'Vui lòng nhập email',
                        },
                        { type: 'email', message: isEn ? 'Invalid email' : 'Email không hợp lệ' },
                    ]}
                >
                    <Input placeholder={isEn ? 'Enter your contact email' : 'Nhập email liên hệ'} />
                </Form.Item>

                <Form.Item
                    label={t.formSubject}
                    name="subject"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please enter a subject' : 'Vui lòng nhập tiêu đề',
                        },
                    ]}
                >
                    <Input
                        placeholder={isEn ? 'E.g. Support for activating IKY GPS' : 'Ví dụ: Hỗ trợ kích hoạt IKY GPS'}
                    />
                </Form.Item>

                <Form.Item
                    label={t.formContent}
                    name="content"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please describe your issue' : 'Vui lòng mô tả vấn đề',
                        },
                    ]}
                >
                    <Input.TextArea
                        placeholder={
                            isEn
                                ? 'Describe the issue, device IMEI, time, screenshots…'
                                : 'Mô tả chi tiết lỗi, mã thiết bị (IMEI), thời gian xảy ra, hình ảnh…'
                        }
                        rows={4}
                    />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                    <div className={styles.formActions}>
                        <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                            {t.formSend}
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Card>
    );
}
