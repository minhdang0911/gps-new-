'use client';

import React, { useMemo, useState } from 'react';
import { Row, Col, Menu } from 'antd';
import { CustomerServiceOutlined, FileTextOutlined } from '@ant-design/icons';
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

import InstallAcceptanceProcess from './components/InstallAcceptanceProcess';

export default function SupportPage() {
    const pathname = usePathname() || '/';
    const isEn = useLangFromPath(pathname);

    const t = useMemo(() => getSupportLocale(isEn), [isEn]);
    const { kpiTexts, faqItems, supportChannels } = useMemo(() => buildSupportContent(isEn), [isEn]);

    const [mapLocation, setMapLocation] = useState('hcm');
    const [activeKey, setActiveKey] = useState('support'); // 'support' | 'acceptance'

    const menuItems = [
        {
            key: 'support',
            icon: <CustomerServiceOutlined />,
            label: isEn ? 'Customer support' : 'Hỗ trợ khách hàng',
        },
        {
            key: 'acceptance',
            icon: <FileTextOutlined />,
            label: isEn ? 'Installation acceptance' : 'Quy trình nghiệm thu lắp đặt',
        },
    ];

    return (
        <div className={styles.supportPage}>
            <div className={styles.supportPageGradient} />

            <div className={styles.supportLayout}>
                {/* Sidebar */}
                <aside className={styles.supportSidebar}>
                    <div className={styles.sidebarTitle}>{isEn ? 'Support' : 'Hỗ trợ'}</div>

                    <Menu
                        mode="inline"
                        selectedKeys={[activeKey]}
                        items={menuItems}
                        onClick={(e) => setActiveKey(e.key)}
                        className={styles.sidebarMenu}
                    />
                </aside>

                {/* Content */}
                <main className={styles.supportMain}>
                    {activeKey === 'support' ? (
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
                    ) : (
                        <div className={styles.supportPageInner}>
                            <InstallAcceptanceProcess />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
