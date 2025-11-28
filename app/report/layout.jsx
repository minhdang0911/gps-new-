'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Typography, Grid } from 'antd';
import { BarChartOutlined, ThunderboltOutlined, AimOutlined } from '@ant-design/icons';
import './reportLayout.css';

const { Sider, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const reportMenus = [
    {
        key: '/report/usage-session',
        href: '/report/usage-session',
        label: 'Báo cáo sử dụng',
        short: 'Sử dụng',
        icon: <BarChartOutlined />,
    },
    {
        key: '/report/charging-session',
        href: '/report/charging-session',
        label: 'Báo cáo sạc',
        short: 'Sạc',
        icon: <ThunderboltOutlined />,
    },
    {
        key: '/report/trip-session',
        href: '/report/trip-session',
        label: 'Báo cáo hành trình',
        short: 'Hành trình',
        icon: <AimOutlined />,
    },
];

const ReportLayout = ({ children }) => {
    const pathname = usePathname();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    if (isMobile) {
        // ===== MOBILE: tab custom ngang =====
        return (
            <div className="report-layout-mobile">
                <div className="report-topnav">
                    <Title level={5} className="report-topnav__title">
                        Báo cáo hệ thống
                    </Title>

                    <div className="report-topnav-tabs">
                        {reportMenus.map((item) => {
                            const active = pathname === item.href;
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

    // ===== DESKTOP: sidebar trái =====
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
                        Báo cáo hệ thống
                    </Title>
                </div>

                <Menu theme="light" mode="inline" selectedKeys={[pathname]} items={menuItems} />
            </Sider>

            <Layout className="report-main">
                <Content className="report-content">{children}</Content>
            </Layout>
        </Layout>
    );
};

export default ReportLayout;
