'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Typography, Grid } from 'antd';
import { BarChartOutlined, ThunderboltOutlined, AimOutlined } from '@ant-design/icons';
import './reportLayout.css';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const { Sider, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const ReportLayout = ({ children }) => {
    const pathname = usePathname();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isEn, setIsEn] = useState(false);

    // detect lang từ pathname /xxx/en hoặc localStorage
    const isEnFromPath = useMemo(() => {
        const parts = pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] === 'en';
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

    const t = isEn ? locales.en.report : locales.vi.report;

    // Base menu config
    const baseMenus = [
        {
            key: '/report/usage-session',
            basePath: '/report/usage-session',
            label: t.usage,
            short: t.usageShort,
            icon: <BarChartOutlined />,
        },
        {
            key: '/report/charging-session',
            basePath: '/report/charging-session',
            label: t.charging,
            short: t.chargingShort,
            icon: <ThunderboltOutlined />,
        },
        {
            key: '/report/trip-session',
            basePath: '/report/trip-session',
            label: t.trip,
            short: t.tripShort,
            icon: <AimOutlined />,
        },
    ];

    // Add /en to href when using English
    const reportMenus = useMemo(() => {
        return baseMenus.map((menu) => ({
            ...menu,
            href: isEn ? `${menu.basePath}/en` : menu.basePath,
        }));
    }, [isEn]);

    // Get current selected key (remove /en for comparison)
    const currentKey = useMemo(() => {
        return pathname.replace(/\/en$/, '');
    }, [pathname]);

    if (isMobile) {
        // ===== MOBILE =====
        return (
            <div className="report-layout-mobile">
                <div className="report-topnav">
                    <Title level={5} className="report-topnav__title">
                        {t.title}
                    </Title>

                    <div className="report-topnav-tabs">
                        {reportMenus.map((item) => {
                            const active = currentKey === item.key;
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`report-topnav-tab ${active ? 'is-active' : ''}`}
                                >
                                    {item.icon}
                                    <span className="report-topnav-tab__text">{item.short}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="report-content-mobile">{children}</div>
            </div>
        );
    }

    // ===== DESKTOP =====
    const menuItems = reportMenus.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: (
            <Link href={item.href} className="report-menu-link">
                {item.label}
            </Link>
        ),
    }));

    return (
        <Layout className="report-layout-desktop">
            <Sider className="report-sider" width={240} theme="light">
                <div className="report-logo">
                    <Title level={5} className="report-logo__title">
                        {t.title}
                    </Title>
                </div>

                <Menu theme="light" mode="inline" selectedKeys={[currentKey]} items={menuItems} />
            </Sider>

            <Layout className="report-main">
                <Content className="report-content">{children}</Content>
            </Layout>
        </Layout>
    );
};

export default ReportLayout;
