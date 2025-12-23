'use client';

import React, { useMemo, useState } from 'react';
import { Row, Col } from 'antd';
import { usePathname } from 'next/navigation';

import styles from './SupportPage.module.css';

import { getSupportLocale } from './data/locales';
import { useLangFromPath } from './hooks/useLangFromPath';
import { buildSupportContent } from './data/supportContent';

import HeroHeader from './components/HeroHeader';
import KpiStrip from './components/KpiStrip';
import IntroCard from './components/IntroCard';
import ContactCard from './components/ContactCard';
import FeedbackForm from './components/FeedbackForm';
import SupportChannels from './components/SupportChannels';
import FaqSection from './components/FaqSection';
import MapSection from './components/MapSection';

export default function SupportPage() {
    const pathname = usePathname() || '/';
    const isEn = useLangFromPath(pathname);

    const t = useMemo(() => getSupportLocale(isEn), [isEn]);
    const { kpiTexts, faqItems, supportChannels } = useMemo(() => buildSupportContent(isEn), [isEn]);

    const [mapLocation, setMapLocation] = useState('hcm');

    return (
        <div className={styles.supportPage}>
            <div className={styles.supportPageGradient} />
            <div className={styles.supportPageInner}>
                <HeroHeader t={t} isEn={isEn} />

                <KpiStrip items={kpiTexts} />

                <Row gutter={[20, 20]} className={styles.supportTopRow}>
                    <Col xs={24} lg={8}>
                        <IntroCard t={t} isEn={isEn} />
                    </Col>

                    <Col xs={24} lg={8}>
                        <ContactCard t={t} isEn={isEn} />
                    </Col>

                    <Col xs={24} lg={8}>
                        <FeedbackForm t={t} isEn={isEn} />
                    </Col>
                </Row>

                <SupportChannels isEn={isEn} channels={supportChannels} />

                <FaqSection isEn={isEn} faqItems={faqItems} />

                <MapSection t={t} mapLocation={mapLocation} setMapLocation={setMapLocation} />
            </div>
        </div>
    );
}
