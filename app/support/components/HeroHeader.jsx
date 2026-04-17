'use client';

import React from 'react';
import { Typography, Tag } from 'antd';
import { PhoneOutlined, MailOutlined } from '@ant-design/icons';

import styles from '../SupportPage.module.css';

const { Title, Text } = Typography;

export default function HeroHeader({ t, isEn }) {
    return (
        <div className={styles.header}>
            <div className={styles.heroBadge}>
                <span className={styles.heroDot} />
                <span>{t.badge}</span>
            </div>

            <div className={styles.headerMain}>
                <div className={styles.headerText}>
                    <Title level={2} className={styles.pageTitle}>
                        {t.title}
                    </Title>

                    <Text type="secondary" className={styles.subtitle}>
                        {t.desc}
                    </Text>

                    <div className={styles.headerMeta}>
                        <Tag className={styles.metaTagBlue}>
                            {isEn
                                ? 'Working hours: 8:00 – 17:30 (Mon – Sat)'
                                : 'Giờ làm việc: 8:00 – 17:00 (Thứ 2 – Thứ 7)'}
                        </Tag>

                        <Tag className={styles.metaTagGreen}>
                            {isEn ? 'Nationwide remote support' : 'Hỗ trợ từ xa trên toàn quốc'}
                        </Tag>
                    </div>
                </div>

                <div className={styles.heroActions}>
                    <a href="tel:+842862801999" className={`${styles.heroChip} ${styles.heroChipPrimary}`}>
                        <PhoneOutlined />
                        <span>Hotline: 08 628 01 999</span>
                    </a>

                    <a href="mailto:contact@iky.vn" className={`${styles.heroChip} ${styles.heroChipSecondary}`}>
                        <MailOutlined />
                        <span>contact@iky.vn</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
