'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Row,
    Col,
    Card,
    Typography,
    Space,
    Form,
    Input,
    Button,
    Divider,
    message,
    Segmented,
    Tag,
    Collapse,
} from 'antd';
import {
    PhoneOutlined,
    MailOutlined,
    EnvironmentOutlined,
    SendOutlined,
    CustomerServiceOutlined,
    ClockCircleOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import './SupportPage.css';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const { Title, Text, Paragraph } = Typography;
// removed: const { Panel } = Collapse;

const locales = { vi, en };

/* ===================== MAP4D CONFIG ===================== */
const MAP4D_KEY = process.env.NEXT_PUBLIC_MAP4D_API_KEY;

const MAP4D_LOCATIONS = {
    hcm: {
        center: { lat: 10.75425585960055, lng: 106.6169 },
        zoom: 18,
        title: ' Văn phòng Hồ Chí Minh',
        type: 'office',
    },
    hanoi: {
        center: { lat: 21.0366176, lng: 105.7696554 },
        zoom: 18,
        title: ' Văn phòng Hà Nội',
        type: 'office',
    },
};

/* ===================== MAP4D COMPONENT ===================== */

function Map4DView({ location }) {
    const mapContainerRef = useRef(null);
    const [sdkReady, setSdkReady] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (window.map4d) {
            setSdkReady(true);
            return;
        }

        window.__iky_map4d_ready = () => {
            setSdkReady(true);
        };

        const existing = document.querySelector('script[data-map4d-sdk="true"]');
        if (existing) return;

        const script = document.createElement('script');
        script.src = `https://api.map4d.vn/sdk/map/js?version=2.0&key=${MAP4D_KEY}&callback=__iky_map4d_ready`;
        script.async = true;
        script.defer = true;
        script.dataset.map4dSdk = 'true';
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!sdkReady) return;
        if (!mapContainerRef.current) return;

        const cfg = MAP4D_LOCATIONS[location] || MAP4D_LOCATIONS.hcm;

        const map = new window.map4d.Map(mapContainerRef.current, {
            center: cfg.center,
            zoom: cfg.zoom,
            controls: true,
        });

        const poi = new window.map4d.POI({
            position: cfg.center,
            title: cfg.title,
            type: cfg.type,
        });
        poi.setMap(map);

        return () => {
            poi.setMap(null);
            if (map.destroy) map.destroy();
        };
    }, [sdkReady, location]);

    return (
        <div className="support-map4d-shell">
            {!sdkReady && (
                <div className="support-map4d-loading">
                    <span>Đang tải bản đồ…</span>
                </div>
            )}
            <div ref={mapContainerRef} className="support-map4d-frame" />
        </div>
    );
}

/* ===================== MAIN PAGE ===================== */

function SupportPage() {
    const [form] = Form.useForm();
    const [mapLocation, setMapLocation] = useState('hcm');

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

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

    const kpiTexts = isEn
        ? [
              { icon: <ClockCircleOutlined />, label: 'Avg. first response', value: '< 15 minutes' },
              { icon: <CustomerServiceOutlined />, label: 'Support channels', value: 'Phone • Email • Zalo' },
              { icon: <SafetyCertificateOutlined />, label: 'Service uptime', value: '99%+ monitoring' },
          ]
        : [
              { icon: <ClockCircleOutlined />, label: 'Thời gian phản hồi', value: '< 15 phút (trung bình)' },
              { icon: <CustomerServiceOutlined />, label: 'Kênh hỗ trợ', value: 'Điện thoại • Email • Zalo' },
              { icon: <SafetyCertificateOutlined />, label: 'Giám sát hệ thống', value: 'Hoạt động ổn định 99%+' },
          ];

    const faqItems = isEn
        ? [
              {
                  q: 'How long does it take for support to respond?',
                  a: 'During working hours, most requests are responded to within 15–30 minutes via phone or email.',
              },
              {
                  q: 'Which information should I provide when reporting an issue?',
                  a: 'Please include device IMEI, license plate, time of incident, screenshots (if any) and a brief description of the problem.',
              },
              {
                  q: 'Do you support outside of working hours?',
                  a: 'For urgent issues, please call the hotline directly. We maintain on-call support for critical situations.',
              },
          ]
        : [
              {
                  q: 'Thời gian phản hồi hỗ trợ là bao lâu?',
                  a: 'Trong giờ làm việc, đa số yêu cầu được phản hồi trong vòng 15–30 phút qua điện thoại hoặc email.',
              },
              {
                  q: 'Tôi cần cung cấp thông tin gì khi báo lỗi?',
                  a: 'Vui lòng cung cấp IMEI thiết bị, biển số xe, thời gian xảy ra, hình ảnh/chụp màn hình (nếu có) và mô tả ngắn gọn vấn đề.',
              },
              {
                  q: 'Có hỗ trợ ngoài giờ hành chính không?',
                  a: 'Với các trường hợp khẩn cấp, vui lòng liên hệ trực tiếp hotline. Chúng tôi có cơ chế trực hỗ trợ cho các tình huống quan trọng.',
              },
          ];

    const supportChannels = isEn
        ? [
              {
                  label: 'Technical support',
                  desc: 'Activation issues, device operation, GPS signal, reports not updating…',
                  contact: '0938.859.085',
                  contactLink: 'tel:+84938859085',
              },
              {
                  label: 'Sales & partnership',
                  desc: 'Bulk orders, corporate packages, distributors, partnership proposals…',
                  contact: '0917.787.885',
                  contactLink: 'tel:+84917787885',
              },
              {
                  label: 'Email support',
                  desc: 'Non-urgent requests and documents can be sent via email for tracking.',
                  contact: 'contact@iky.vn',
                  contactLink: 'mailto:contact@iky.vn',
              },
          ]
        : [
              {
                  label: 'Hỗ trợ kỹ thuật',
                  desc: 'Các vấn đề kích hoạt, vận hành thiết bị, tín hiệu GPS, báo cáo không cập nhật…',
                  contact: '0938.859.085',
                  contactLink: 'tel:+84938859085',
              },
              {
                  label: 'Kinh doanh & hợp tác',
                  desc: 'Đơn hàng số lượng lớn, gói doanh nghiệp, đại lý, đề xuất hợp tác…',
                  contact: '0917.787.885',
                  contactLink: 'tel:+84917787885',
              },
              {
                  label: 'Hỗ trợ qua email',
                  desc: 'Các yêu cầu không khẩn gấp, cần gửi tài liệu hoặc mô tả chi tiết, vui lòng gửi qua email.',
                  contact: 'contact@iky.vn',
                  contactLink: 'mailto:contact@iky.vn',
              },
          ];

    // Build items for Collapse (new API)
    const faqCollapseItems = faqItems.map((item, idx) => ({
        key: String(idx),
        label: (
            <div className="support-faq-header">
                <span className="support-faq-index">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                <span className="support-faq-question">{item.q}</span>
            </div>
        ),
        children: <Paragraph className="support-faq-answer">{item.a}</Paragraph>,
    }));

    return (
        <div className="support-page">
            <div className="support-page-gradient" />
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
                            <Text type="secondary" className="support-page__subtitle">
                                {t.desc}
                            </Text>

                            <div className="support-header-meta">
                                <Tag color="blue">
                                    {isEn
                                        ? 'Working hours: 8:00 – 17:30 (Mon – Sat)'
                                        : 'Giờ làm việc: 8:00 – 17:30 (Thứ 2 – Thứ 7)'}
                                </Tag>
                                <Tag color="green">
                                    {isEn ? 'Nationwide remote support' : 'Hỗ trợ từ xa trên toàn quốc'}
                                </Tag>
                            </div>
                        </div>

                        <div className="support-hero-actions">
                            <a href="tel:+842862801999" className="support-hero-chip support-hero-chip--primary">
                                <PhoneOutlined />
                                <span>Hotline: 08 628 01 999</span>
                            </a>
                            <a href="mailto:contact@iky.vn" className="support-hero-chip">
                                <MailOutlined />
                                <span>contact@iky.vn</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* KPI STRIP */}
                <Row gutter={[16, 16]} className="support-kpi-row">
                    {kpiTexts.map((item, idx) => (
                        <Col xs={24} sm={8} key={idx}>
                            <Card variant={false} className="support-kpi-card">
                                <Space align="center" size={12}>
                                    <div className="support-kpi-icon">{item.icon}</div>
                                    <div>
                                        <Text type="secondary" className="support-kpi-label">
                                            {item.label}
                                        </Text>
                                        <div className="support-kpi-value">{item.value}</div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                    ))}
                </Row>

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
                                    (isEn
                                        ? 'IKY is a technology company focusing on smart, high–value IoT solutions for vehicles and fleet management.'
                                        : 'Công ty Cổ phần Công nghệ Tiện Ích Thông Minh (IKY) tập trung nghiên cứu và phát triển các giải pháp IoT thông minh, giá trị cao cho phương tiện và đội xe.')}
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

                            <Space orientation="vertical" size={8} className="support-info-block">
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

                                <Space orientation="vertical" size={4} className="support-phone-block">
                                    <Space>
                                        <PhoneOutlined className="support-icon" />
                                        <a href="tel:+842862801999">(+84) 8 628 01 999</a>
                                    </Space>
                                    <Text type="secondary">
                                        {isEn ? (
                                            <>
                                                Technical support:{' '}
                                                <a href="tel:+84938859085" style={{ color: 'inherit' }}>
                                                    0938.859.085
                                                </a>{' '}
                                                • Sales:{' '}
                                                <a href="tel:+84917787885" style={{ color: 'inherit' }}>
                                                    0917.787.885
                                                </a>
                                            </>
                                        ) : (
                                            <>
                                                Hỗ trợ kỹ thuật:{' '}
                                                <a href="tel:+84938859085" style={{ color: 'inherit' }}>
                                                    0938.859.085
                                                </a>{' '}
                                                • Kinh doanh:{' '}
                                                <a href="tel:+84917787885" style={{ color: 'inherit' }}>
                                                    0917.787.885
                                                </a>
                                            </>
                                        )}
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
                        <Card variant={false} className="support-card support-card--elevated" title={t.feedbackTitle}>
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
                                        placeholder={
                                            isEn
                                                ? 'E.g. Support for activating IKY GPS'
                                                : 'Ví dụ: Hỗ trợ kích hoạt IKY GPS'
                                        }
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

                {/* KÊNH HỖ TRỢ */}
                <Row gutter={[20, 20]} className="support-channel-row">
                    <Col xs={24}>
                        <Card
                            variant={false}
                            className="support-card support-card--channels"
                            title={
                                <Space>
                                    <CustomerServiceOutlined />
                                    <span>{isEn ? 'Support channels' : 'Các kênh hỗ trợ chính thức'}</span>
                                </Space>
                            }
                        >
                            <Row gutter={[16, 16]}>
                                {supportChannels.map((ch, idx) => (
                                    <Col xs={24} md={8} key={idx}>
                                        <div className="support-channel-card">
                                            <Text strong>{ch.label}</Text>
                                            <Paragraph type="secondary" className="support-channel-desc">
                                                {ch.desc}
                                            </Paragraph>
                                            <a href={ch.contactLink}>
                                                <Tag color="blue" className="support-channel-tag">
                                                    {ch.contact}
                                                </Tag>
                                            </a>
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        </Card>
                    </Col>
                </Row>

                {/* FAQ + CTA */}
                <Row gutter={[20, 20]} className="support-faq-row">
                    <Col xs={24} lg={16}>
                        <Card
                            variant={false}
                            className="support-card support-card--faq"
                            title={isEn ? 'Frequently asked questions' : 'Câu hỏi thường gặp'}
                        >
                            <Collapse
                                accordion
                                bordered={false}
                                className="support-faq-collapse"
                                expandIconPlacement="end"
                                items={faqCollapseItems}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                        <Card className="support-card support-faq-cta-card" variant={false}>
                            <Title level={4} className="support-card__title">
                                {isEn ? "Can't find the answer?" : 'Chưa tìm thấy câu trả lời?'}
                            </Title>
                            <Paragraph className="support-paragraph">
                                {isEn
                                    ? 'Call our hotline or send us a ticket, our team will assist you directly and guide you step by step.'
                                    : 'Gọi ngay hotline hoặc gửi yêu cầu hỗ trợ, đội ngũ kỹ thuật IKY sẽ hỗ trợ trực tiếp và hướng dẫn chi tiết.'}
                            </Paragraph>
                            <a href="tel:+842862801999" className="support-faq-cta-hotline">
                                <PhoneOutlined />
                                <span>08 628 01 999</span>
                            </a>
                        </Card>
                    </Col>
                </Row>

                {/* MAP4D FULL WIDTH */}
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

                            <Map4DView key={mapLocation} location={mapLocation} />

                            <Text type="secondary" style={{ fontSize: 12, marginTop: 12, display: 'block' }}>
                                {t.mapGuide}
                            </Text>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
}

export default SupportPage;
