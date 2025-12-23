'use client';

import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { PhoneOutlined, MailOutlined, EnvironmentOutlined } from '@ant-design/icons';

import styles from '../SupportPage.module.css';

const { Title, Text } = Typography;

export default function ContactCard({ t, isEn }) {
    return (
        <Card variant={false} className={styles.supportCard}>
            <Title level={4} className={styles.cardTitle}>
                {t.contactTitle}
            </Title>

            <Space orientation="vertical" size={8} className={styles.infoBlock}>
                {/* Company name */}
                <Text strong>{t.companyName}</Text>

                {/* Address */}
                <Space align="start">
                    <EnvironmentOutlined className={styles.icon} />
                    <div>
                        <Text strong>{t.hcmBranch}:</Text> <Text>{t.hcmAddress}</Text>
                        <br />
                        <Text strong>{t.hnBranch}:</Text> <Text>{t.hnAddress}</Text>
                    </div>
                </Space>

                {/* Email */}
                <Space>
                    <MailOutlined className={styles.icon} />
                    <a href="mailto:contact@iky.vn">contact@iky.vn</a>
                </Space>

                {/* Phones */}
                <Space orientation="vertical" size={4} className={styles.phoneBlock}>
                    <Space>
                        <PhoneOutlined className={styles.icon} />
                        <a href="tel:+842862801999">(+84) 8 628 01 999</a>
                    </Space>

                    <Text type="secondary">
                        {isEn ? (
                            <>
                                Technical support: <a href="tel:+84938859085">0938.859.085</a> • Sales:{' '}
                                <a href="tel:+84917787885">0917.787.885</a>
                            </>
                        ) : (
                            <>
                                Hỗ trợ kỹ thuật: <a href="tel:+84938859085">0938.859.085</a> • Kinh doanh:{' '}
                                <a href="tel:+84917787885">0917.787.885</a>
                            </>
                        )}
                    </Text>

                    <Text type="secondary">{t.workTime}</Text>
                </Space>
            </Space>

            <Divider />

            {/* Area hotline */}
            <Title level={5} className={styles.areaHotlineTitle}>
                {t.areaHotlineTitle}
            </Title>

            <ul className={`${styles.supportList} ${styles.supportListCompact}`}>
                <li>{t.hcmHotline}</li>
                <li>{t.hnHotline}</li>
            </ul>
        </Card>
    );
}
