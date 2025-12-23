'use client';

import React from 'react';
import { Card, Typography } from 'antd';
import styles from '../SupportPage.module.css';

const { Title, Paragraph } = Typography;

export default function IntroCard({ t, isEn }) {
    return (
        <Card variant={false} className={styles.supportCard}>
            <Title level={4} className={styles.cardTitle}>
                {t.introTitle}
            </Title>

            <Paragraph className={styles.paragraph}>
                {t.descIntro ||
                    (isEn
                        ? 'IKY is a technology company focusing on smart, high–value IoT solutions for vehicles and fleet management.'
                        : 'Công ty Cổ phần Công nghệ Tiện Ích Thông Minh (IKY) tập trung nghiên cứu và phát triển các giải pháp IoT thông minh, giá trị cao cho phương tiện và đội xe.')}
            </Paragraph>

            <ul className={styles.supportList}>
                {(t.introList || []).map((item, idx) => (
                    <li key={idx}>{item}</li>
                ))}
            </ul>
        </Card>
    );
}
