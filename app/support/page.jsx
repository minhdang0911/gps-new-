'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Card, Typography, Space, Form, Input, Button, Divider, message, Segmented } from 'antd';
import { PhoneOutlined, MailOutlined, EnvironmentOutlined, SendOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import './SupportPage.css';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const { Title, Text, Paragraph } = Typography;

const locales = { vi, en };

// Map embed cho từng chi nhánh
const MAPS = {
    hcm: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.74330682685!2d106.61444527586868!3d10.75425585960055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752d003bee83db%3A0x743ea5c5852f19d3!2zQ8OUTkcgVFkgQ-G7lCBQSOG6pk4gQ8OUTkcgTkdI4buGIFRJ4buGTiDDjUNIIFRIw5RORyBNSU5IIChpS1kp!5e0!3m2!1svi!2s!4v1764131894708!5m2!1svi!2s',
    hanoi: 'https://www.google.com/maps?q=S%E1%BB%91+2%2C+ng%E1%BB%97+18+Nguy%E1%BB%85n+C%C6%A1+Th%E1%BA%A1ch%2C+T%E1%BB%AB+Li%C3%AAm%2C+H%C3%A0+N%E1%BB%99i&output=embed',
};

const SupportPage = () => {
    const [form] = Form.useForm();
    const [mapLocation, setMapLocation] = useState('hcm');

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    // detect EN giống StatusBar: /xxx/en
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
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

    const t = isEn ? locales.en.support : locales.vi.support;

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
        <div className="support-page">
            <div className="support-page__inner">
                {/* HERO HEADER */}
                <div className="support-page__header">
                    <div className="support-hero-badge">
                        <span className="support-hero-dot" />
                        <span>{t.badge}</span>
                    </div>

                    <div className="support-page__header-main">
                        <div className="support-page__header-text">
                            <Title level={3} className="support-page__title">
                                {t.title}
                            </Title>
                            <Text type="secondary">{t.desc}</Text>
                        </div>

                        <div className="support-hero-actions">
                            <div className="support-hero-chip support-hero-chip--primary">
                                <PhoneOutlined />
                                <span>Hotline: 08 628 01 999</span>
                            </div>
                            <div className="support-hero-chip">
                                <MailOutlined />
                                <span>contact@iky.vn</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HÀNG TRÊN: 3 KHUNG NGANG */}
                <Row gutter={[20, 20]} className="support-page__top">
                    {/* GIỚI THIỆU */}
                    <Col xs={24} lg={8}>
                        <Card variant={false} className="support-card">
                            <Title level={4} className="support-card__title">
                                {t.introTitle}
                            </Title>
                            <Paragraph className="support-paragraph">
                                {t.descIntro ||
                                    'Công ty Cổ phần Công nghệ Tiện Ích Thông Minh chuyên nghiên cứu, sản xuất các sản phẩm tiêu dùng công nghệ cao:'}
                            </Paragraph>
                            <ul className="support-list">
                                {(t.introList || []).map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </Card>
                    </Col>

                    {/* LIÊN HỆ + HOTLINE */}
                    <Col xs={24} lg={8}>
                        <Card variant={false} className="support-card">
                            <Title level={4} className="support-card__title">
                                {t.contactTitle}
                            </Title>

                            <Space orientation="vertical" size={6} className="support-info-block">
                                <Text strong>{t.companyName}</Text>
                                <Space align="start">
                                    <EnvironmentOutlined className="support-icon" />
                                    <div>
                                        <Text strong>{t.hcmBranch}:</Text> <Text>{t.hcmAddress}</Text>
                                        <br />
                                        <Text strong>{t.hnBranch}:</Text> <Text>{t.hnAddress}</Text>
                                    </div>
                                </Space>

                                <Space>
                                    <MailOutlined className="support-icon" />
                                    <a href="mailto:contact@iky.vn">contact@iky.vn</a>
                                </Space>

                                <Space orientation="vertical" size={2}>
                                    <Space>
                                        <PhoneOutlined className="support-icon" />
                                        <Text>(+84) 8 628 01 999</Text>
                                    </Space>
                                    <Text type="secondary">
                                        Hỗ trợ kỹ thuật: 0938.859.085 &nbsp;•&nbsp; Kinh doanh: 0917.787.885
                                    </Text>
                                    <Text type="secondary">{t.workTime}</Text>
                                </Space>
                            </Space>

                            <Divider />

                            <Title level={5} style={{ marginBottom: 6 }}>
                                {t.areaHotlineTitle}
                            </Title>
                            <ul className="support-list support-list--compact">
                                <li>{t.hcmHotline}</li>
                                <li>{t.hnHotline}</li>
                            </ul>
                        </Card>
                    </Col>

                    {/* FORM GỬI PHẢN HỒI */}
                    <Col xs={24} lg={8}>
                        <Card
                            variant={false}
                            className="support-card"
                            title={t.feedbackTitle}
                            // extra={
                            //     <Text type="secondary" style={{ fontSize: 12 }}>
                            //         {t.feedbackNote}
                            //     </Text>
                            // }
                        >
                            <Form layout="vertical" form={form} onFinish={handleSubmit} requiredMark={false}>
                                <Form.Item
                                    label={t.formFullName}
                                    name="fullName"
                                    rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                                >
                                    <Input placeholder="Nhập họ tên của bạn" />
                                </Form.Item>

                                <Form.Item
                                    label={t.formEmail}
                                    name="email"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập email' },
                                        { type: 'email', message: 'Email không hợp lệ' },
                                    ]}
                                >
                                    <Input placeholder="Nhập email liên hệ" />
                                </Form.Item>

                                <Form.Item
                                    label={t.formSubject}
                                    name="subject"
                                    rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                                >
                                    <Input placeholder="Ví dụ: Hỗ trợ kích hoạt IKY GPS" />
                                </Form.Item>

                                <Form.Item
                                    label={t.formContent}
                                    name="content"
                                    rules={[{ required: true, message: 'Vui lòng mô tả vấn đề' }]}
                                >
                                    <Input.TextArea
                                        placeholder="Mô tả chi tiết lỗi, mã thiết bị, thời gian xảy ra..."
                                        rows={4}
                                    />
                                </Form.Item>

                                <Form.Item style={{ marginBottom: 0 }}>
                                    <div className="support-form-actions">
                                        <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                                            {t.formSend}
                                        </Button>
                                    </div>
                                </Form.Item>
                            </Form>
                        </Card>
                    </Col>
                </Row>

                {/* HÀNG DƯỚI: MAP FULL WIDTH + SWITCH HCM / HN */}
                <Row gutter={[20, 20]} className="support-page__bottom">
                    <Col xs={24}>
                        <Card
                            variant={false}
                            className="support-card support-map-card"
                            title={
                                <Space>
                                    <EnvironmentOutlined />
                                    <span>{t.mapTitle}</span>
                                </Space>
                            }
                        >
                            <div className="support-map-switch">
                                <Segmented
                                    size="small"
                                    value={mapLocation}
                                    onChange={(val) => setMapLocation(val)}
                                    options={[
                                        { label: t.mapHCM, value: 'hcm' },
                                        { label: t.mapHN, value: 'hanoi' },
                                    ]}
                                />
                            </div>

                            <div className="support-map-wrapper preload-maps">
                                {/* HCM MAP */}
                                <iframe
                                    title="IKY HCM Map"
                                    src={MAPS.hcm}
                                    className={mapLocation === 'hcm' ? 'map-frame active' : 'map-frame'}
                                    loading="lazy"
                                    allowFullScreen
                                />

                                {/* HANOI MAP */}
                                <iframe
                                    title="IKY Hanoi Map"
                                    src={MAPS.hanoi}
                                    className={mapLocation === 'hanoi' ? 'map-frame active' : 'map-frame'}
                                    loading="lazy"
                                    allowFullScreen
                                />
                            </div>

                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {t.mapGuide}
                            </Text>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default SupportPage;
