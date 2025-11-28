'use client';

import React, { useState } from 'react';
import { Row, Col, Card, Typography, Space, Form, Input, Button, Divider, message, Segmented } from 'antd';
import { PhoneOutlined, MailOutlined, EnvironmentOutlined, SendOutlined } from '@ant-design/icons';
import './SupportPage.css';

const { Title, Text, Paragraph } = Typography;

// Map embed cho từng chi nhánh
const MAPS = {
    hcm: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.74330682685!2d106.61444527586868!3d10.75425585960055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752d003bee83db%3A0x743ea5c5852f19d3!2zQ8OUTkcgVFkgQ-G7lCBQSOG6pk4gQ8OUTkcgTkdI4buGIFRJ4buGTiDDjUNIIFRIw5RORyBNSU5IIChpS1kp!5e0!3m2!1svi!2s!4v1764131894708!5m2!1svi!2s',
    hanoi: 'https://www.google.com/maps?q=S%E1%BB%91+2%2C+ng%E1%BB%97+18+Nguy%E1%BB%85n+C%C6%A1+Th%E1%BA%A1ch%2C+T%E1%BB%AB+Li%C3%AAm%2C+H%C3%A0+N%E1%BB%99i&output=embed',
};

const SupportPage = () => {
    const [form] = Form.useForm();
    const [mapLocation, setMapLocation] = useState('hcm');

    const handleSubmit = (values) => {
        console.log('Support form values:', values);
        message.success('Gửi yêu cầu hỗ trợ thành công. Chúng tôi sẽ liên hệ sớm nhất!');
        form.resetFields();
    };

    return (
        <div className="support-page">
            <div className="support-page__inner">
                {/* HERO HEADER */}
                <div className="support-page__header">
                    <div className="support-hero-badge">
                        <span className="support-hero-dot" />
                        <span>Trung tâm hỗ trợ IKY</span>
                    </div>

                    <div className="support-page__header-main">
                        <div className="support-page__header-text">
                            <Title level={3} className="support-page__title">
                                Hỗ trợ khách hàng
                            </Title>
                            <Text type="secondary">
                                Có bất kỳ thắc mắc nào về sản phẩm IKY, mời bạn liên hệ theo thông tin dưới đây hoặc gửi
                                form hỗ trợ. Đội ngũ kỹ thuật sẽ phản hồi trong thời gian sớm nhất.
                            </Text>
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
                                Giới thiệu
                            </Title>
                            <Paragraph className="support-paragraph">
                                Công ty Cổ phần Công nghệ Tiện Ích Thông Minh chuyên nghiên cứu, sản xuất các sản phẩm
                                tiêu dùng công nghệ cao:
                            </Paragraph>
                            <ul className="support-list">
                                <li>
                                    Thiết bị khóa chống trộm xe máy: IKY Bike, IKY Plus, IKY Bike GPS, IKY Bike Found…
                                </li>
                                <li>Hệ thống cảnh báo an ninh: IKY SmartHome</li>
                                <li>Bài giảng vệ tinh thông minh</li>
                                <li>Hệ thống cảnh báo và nút gọi khẩn cấp</li>
                                <li>Sản xuất các sản phẩm điện tử theo đơn đặt hàng</li>
                            </ul>
                        </Card>
                    </Col>

                    {/* LIÊN HỆ + HOTLINE */}
                    <Col xs={24} lg={8}>
                        <Card variant={false} className="support-card">
                            <Title level={4} className="support-card__title">
                                Liên hệ
                            </Title>

                            <Space orientation="vertical" size={6} className="support-info-block">
                                <Text strong>CÔNG TY CỔ PHẦN CÔNG NGHỆ TIỆN ÍCH THÔNG MINH</Text>
                                <Space align="start">
                                    <EnvironmentOutlined className="support-icon" />
                                    <div>
                                        <Text strong>Trụ sở HCM:</Text>{' '}
                                        <Text>Số 38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh</Text>
                                        <br />
                                        <Text strong>CN Hà Nội:</Text>{' '}
                                        <Text>
                                            Số 2, ngõ 18 đường Nguyễn Cơ Thạch, Phường Từ Liêm, Thành phố Hà Nội
                                        </Text>
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
                                    <Text type="secondary">Giờ làm việc: 8h00 – 18h00 (Thứ 2 – Thứ 7)</Text>
                                </Space>
                            </Space>

                            <Divider />

                            <Title level={5} style={{ marginBottom: 6 }}>
                                Hotline theo khu vực
                            </Title>
                            <ul className="support-list support-list--compact">
                                <li>TP. Hồ Chí Minh: 08 628 01 999</li>
                                <li>Hà Nội: 0982 032 887</li>
                                {/* <li>Đà Nẵng: (sẽ cập nhật)</li> */}
                            </ul>
                        </Card>
                    </Col>

                    {/* FORM GỬI PHẢN HỒI */}
                    <Col xs={24} lg={8}>
                        <Card
                            variant={false}
                            className="support-card"
                            title="Gửi phản hồi cho chúng tôi"
                            extra={
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Thông tin của bạn sẽ được bảo mật
                                </Text>
                            }
                        >
                            <Form layout="vertical" form={form} onFinish={handleSubmit} requiredMark={false}>
                                <Form.Item
                                    label="Họ tên"
                                    name="fullName"
                                    rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                                >
                                    <Input placeholder="Nhập họ tên của bạn" />
                                </Form.Item>

                                <Form.Item
                                    label="Email"
                                    name="email"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập email' },
                                        { type: 'email', message: 'Email không hợp lệ' },
                                    ]}
                                >
                                    <Input placeholder="Nhập email liên hệ" />
                                </Form.Item>

                                <Form.Item
                                    label="Tiêu đề"
                                    name="subject"
                                    rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                                >
                                    <Input placeholder="Ví dụ: Hỗ trợ kích hoạt IKY GPS" />
                                </Form.Item>

                                <Form.Item
                                    label="Mô tả"
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
                                            Gửi yêu cầu
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
                                    <span>Bản đồ trụ sở IKY</span>
                                </Space>
                            }
                        >
                            <div className="support-map-switch">
                                <Segmented
                                    size="small"
                                    value={mapLocation}
                                    onChange={(val) => setMapLocation(val)}
                                    options={[
                                        { label: 'Hồ Chí Minh', value: 'hcm' },
                                        { label: 'Hà Nội', value: 'hanoi' },
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
                                Vui lòng phóng to bản đồ để xem chỉ đường chi tiết.
                            </Text>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default SupportPage;
