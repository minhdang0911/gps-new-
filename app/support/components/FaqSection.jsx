'use client';

import React, { useMemo } from 'react';
import { Row, Col, Card, Collapse, Typography } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';
import styles from '../SupportPage.module.css';

const { Title, Paragraph } = Typography;

export default function FaqSection({ isEn, faqItems }) {
    const items = useMemo(
        () =>
            faqItems.map((item, idx) => ({
                key: String(idx),
                label: (
                    <div className={styles.faqHeader}>
                        <span className={styles.faqIndex}>{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                        <span className={styles.faqQuestion}>{item.q}</span>
                    </div>
                ),
                children: <Paragraph className={styles.faqAnswer}>{item.a}</Paragraph>,
            })),
        [faqItems],
    );

    return (
        <Row gutter={[20, 20]} className={styles.faqRow}>
            <Col xs={24} lg={16}>
                <Card
                    variant={false}
                    className={styles.faqCard}
                    title={isEn ? 'Frequently asked questions' : 'Câu hỏi thường gặp'}
                >
                    <Collapse
                        accordion
                        bordered={false}
                        className={styles.faqCollapse}
                        expandIconPlacement="end"
                        items={items}
                    />
                </Card>
            </Col>

            <Col xs={24} lg={8}>
                <Card variant={false} className={styles.faqCtaCard}>
                    <Title level={4} className={styles.cardTitle}>
                        {isEn ? "Can't find the answer?" : 'Chưa tìm thấy câu trả lời?'}
                    </Title>
                    <Paragraph className={styles.paragraph}>
                        {isEn
                            ? 'Call our hotline or send us a ticket, our team will assist you directly and guide you step by step.'
                            : 'Gọi ngay hotline hoặc gửi yêu cầu hỗ trợ, đội ngũ kỹ thuật IKY sẽ hỗ trợ trực tiếp và hướng dẫn chi tiết.'}
                    </Paragraph>
                    <a href="tel:+842862801999" className={styles.faqHotline}>
                        <PhoneOutlined />
                        <span>08 628 01 999</span>
                    </a>
                </Card>
            </Col>
        </Row>
    );
}
