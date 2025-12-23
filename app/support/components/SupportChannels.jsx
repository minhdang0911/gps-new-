'use client';

import React from 'react';
import { Row, Col, Card, Space, Typography, Tag } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';

import styles from '../SupportPage.module.css';

const { Text, Paragraph } = Typography;

export default function SupportChannels({ isEn, channels }) {
    return (
        <Row gutter={[20, 20]} className={styles.channelRow}>
            <Col xs={24}>
                <Card
                    variant={false}
                    className={`${styles.supportCard} ${styles.channelsCard}`}
                    title={
                        <Space>
                            <CustomerServiceOutlined />
                            <span>{isEn ? 'Support channels' : 'Các kênh hỗ trợ chính thức'}</span>
                        </Space>
                    }
                >
                    <Row gutter={[16, 16]}>
                        {channels.map((ch, idx) => (
                            <Col xs={24} md={8} key={idx}>
                                <div className={styles.channelCard}>
                                    <Text strong>{ch.label}</Text>

                                    <Paragraph type="secondary" className={styles.channelDesc}>
                                        {ch.desc}
                                    </Paragraph>

                                    <a href={ch.contactLink}>
                                        <Tag color="blue" className={styles.channelTag}>
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
    );
}
