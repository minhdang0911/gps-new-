'use client';

import React from 'react';
import { Row, Col, Card, Space, Typography } from 'antd';
import styles from '../SupportPage.module.css';

const { Text } = Typography;

export default function KpiStrip({ items }) {
    return (
        <Row gutter={[16, 16]} className={styles.kpiRow}>
            {items.map((item, idx) => (
                <Col xs={24} sm={8} key={idx}>
                    <Card variant={false} className={styles.kpiCard}>
                        <Space align="center" size={12}>
                            <div className={styles.kpiIcon}>{item.icon}</div>
                            <div>
                                <Text type="secondary" className={styles.kpiLabel}>
                                    {item.label}
                                </Text>
                                <div className={styles.kpiValue}>{item.value}</div>
                            </div>
                        </Space>
                    </Card>
                </Col>
            ))}
        </Row>
    );
}
