'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Layout, Menu, Typography, Grid, Tooltip } from 'antd';
import {
    BarChartOutlined,
    ThunderboltOutlined,
    AimOutlined,
    CarOutlined,
    EnvironmentOutlined,
    DashboardOutlined,
    QuestionCircleOutlined,
    ToolOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';

import './reportLayout.css';
import 'antd/dist/reset.css';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const { Sider, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const ReportLayout = ({ children }) => {
    const pathname = usePathname();
    const screens = useBreakpoint();

    // ✅ SSR-safe: chỉ mobile khi lg chắc chắn false (undefined => desktop)
    const isMobile = screens.lg === false;

    const isEn = useMemo(() => {
        if (typeof window === 'undefined') return false;

        const parts = pathname.split('/').filter(Boolean);
        const isEnFromPath = parts[parts.length - 1] === 'en';

        if (isEnFromPath) {
            localStorage.setItem('iky_lang', 'en');
            return true;
        }

        const saved = localStorage.getItem('iky_lang');
        return saved === 'en';
    }, [pathname]);

    const t = isEn ? locales.en.report : locales.vi.report;

    const help = useMemo(
        () => ({
            usage: isEn
                ? 'Detailed usage sessions. Each record represents one vehicle operation (e.g., 10 uses in a day = 10 records). Filter by device, battery, usage code, and time range.'
                : 'Chi tiết phiên sử dụng. Mỗi record là 1 lần xe vận hành (ví dụ: 1 ngày xe chạy 10 lần = 10 records). Lọc theo thiết bị, pin, mã usage và thời gian.',

            charging: isEn
                ? 'Charging sessions. Each record is one charging event (e.g., 10 charges in a day = 10 records). Shows charging time, count, and battery metrics per session.'
                : 'Phiên sạc pin. Mỗi record là 1 lần sạc (ví dụ: 1 ngày sạc 10 lần = 10 records). Hiển thị thời gian sạc, số lần và các chỉ số pin theo phiên.',

            trip: isEn
                ? 'Trip sessions. Each record is one trip/journey (e.g., 10 trips in a day = 10 records). Shows start/end time, coordinates, distance, and speed per trip.'
                : 'Phiên hành trình. Mỗi record là 1 chuyến đi (ví dụ: 1 ngày đi 10 chuyến = 10 records). Hiển thị thời gian, tọa độ bắt đầu/kết thúc, quãng đường và vận tốc.',

            tripReport: isEn
                ? 'Trip summary report: aggregates multiple trips into daily/period totals (e.g., 8 trips in a day → 1 summary record). Group by time range or device for analytics.'
                : 'Báo cáo tổng hợp hành trình: gộp nhiều chuyến đi thành tổng theo ngày . Nhóm theo thời gian hoặc thiết bị để phân tích.',

            lastCruise: isEn
                ? 'Latest cruise list: recent activity / last known positions, useful for quick tracking and monitoring.'
                : 'Danh sách hành trình gần nhất: theo dõi nhanh hoạt động mới nhất và vị trí gần nhất phục vụ giám sát.',

            battery: isEn
                ? 'Battery daily summary: overview per device by day  (SOC/voltage/temperature/location).'
                : 'Tổng quan pin theo thiết bị: tổng hợp theo ngày và hiển thị trạng thái  (SOC/điện áp/nhiệt độ/vị trí).',
            maintenanceHistory: isEn
                ? 'Maintenance history report: confirmed maintenance records. Search by IMEI or license plate (plate is mapped to IMEI).'
                : 'Báo cáo lịch sử bảo trì: các record bảo trì đã xác nhận. Tìm theo IMEI hoặc biển số (biển số sẽ map ra IMEI).',

            maintenanceDue: isEn
                ? 'Maintenance due report: upcoming maintenance schedules. Search by IMEI or license plate (plate is mapped to IMEI).'
                : 'Báo cáo sắp đến hạn: danh sách bảo trì dự kiến/sắp tới. Tìm theo IMEI hoặc biển số (biển số sẽ map ra IMEI).',
        }),
        [isEn],
    );

    const baseMenus = [
        {
            key: '/report/usage-session',
            basePath: '/report/usage-session',
            label: t.usage,
            short: t.usageShort,
            icon: <BarChartOutlined />,
            helpKey: 'usage',
        },
        {
            key: '/report/charging-session',
            basePath: '/report/charging-session',
            label: t.charging,
            short: t.chargingShort,
            icon: <ThunderboltOutlined />,
            helpKey: 'charging',
        },
        {
            key: '/report/trip-session',
            basePath: '/report/trip-session',
            label: t.trip,
            short: t.tripShort,
            icon: <AimOutlined />,
            helpKey: 'trip',
            smallText: true, // ✅ giảm font menu này
        },
        {
            key: '/report/trip-report',
            basePath: '/report/trip-report',
            label: t.tripReport,
            short: t.tripReportShort,
            icon: <CarOutlined />,
            helpKey: 'tripReport',
        },
        {
            key: '/report/last-cruise-list',
            basePath: '/report/last-cruise-list',
            label: t.lastCruise,
            short: t.lastCruiseShort,
            icon: <EnvironmentOutlined />,
            helpKey: 'lastCruise',
            smallText: true, // ✅ giảm font menu này
        },
        {
            key: '/report/battery-summary',
            basePath: '/report/battery-summary',
            label: t.battery,
            short: t.batteryShort,
            icon: <DashboardOutlined />,
            helpKey: 'battery',
        },
        {
            key: '/report/maintenance-history',
            basePath: '/report/maintenance-history',
            label: isEn ? 'Maintenance history' : 'Lịch sử bảo dưỡng',
            short: isEn ? 'History' : 'Lịch sử',
            icon: <ToolOutlined />,
            helpKey: 'maintenanceHistory',
        },
        {
            key: '/report/maintenance-due',
            basePath: '/report/maintenance-due',
            label: isEn ? 'Maintenance due' : 'Sắp đến hạn bảo dưỡng',
            short: isEn ? 'Due' : 'Đến hạn',
            icon: <ClockCircleOutlined />,
            helpKey: 'maintenanceDue',
            smallText: true,
        },
    ];

    const reportMenus = baseMenus.map((menu) => ({
        ...menu,
        href: isEn ? `${menu.basePath}/en` : menu.basePath,
    }));

    const currentKey = useMemo(() => pathname.replace(/\/en$/, ''), [pathname]);

    const HelpIcon = ({ text, isMobile: isMobileLocal }) => {
        if (!text) return null;

        return (
            <Tooltip
                title={text}
                placement="right"
                trigger={isMobileLocal ? ['click'] : ['hover']}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
                classNames={{ root: 'report-help-tooltip' }}
                styles={{
                    root: { maxWidth: 320 },
                    container: { maxWidth: 320 },
                }}
            >
                <span
                    className="help-icon-wrapper"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    style={{ pointerEvents: 'auto' }}
                >
                    <QuestionCircleOutlined className="help-icon" />
                </span>
            </Tooltip>
        );
    };

    // =========================
    // MOBILE LAYOUT
    // =========================
    if (isMobile) {
        return (
            <div className="report-layout-mobile">
                <div className="report-topnav">
                    <Title level={5} className="report-topnav__title">
                        {t.title}
                    </Title>

                    <div className="report-topnav-tabs">
                        {reportMenus.map((item) => {
                            const active = currentKey === item.key;
                            const helpText = help[item.helpKey];

                            return (
                                <div key={item.key} className={`report-topnav-tab ${active ? 'is-active' : ''}`}>
                                    <Link href={item.href} className="report-topnav-tab__link">
                                        {item.icon}
                                        <span className={`report-topnav-tab__text ${item.smallText ? 'is-small' : ''}`}>
                                            {item.short}
                                        </span>
                                    </Link>
                                    <HelpIcon text={helpText} isMobile={true} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="report-content-mobile">{children}</div>
            </div>
        );
    }

    // =========================
    // DESKTOP LAYOUT
    // =========================
    const menuItems = reportMenus.map((item) => {
        const helpText = help[item.helpKey];

        return {
            key: item.key,
            icon: item.icon,
            label: (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        gap: 8,
                    }}
                >
                    <Tooltip title={item.label} placement="right" mouseEnterDelay={0.5}>
                        <Link
                            href={item.href}
                            className={`report-menu-link ${item.smallText ? 'is-small' : ''}`}
                            style={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            onClick={(e) => {
                                if (e.target.closest('.help-icon-wrapper')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }}
                        >
                            {item.label}
                        </Link>
                    </Tooltip>

                    <span
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            pointerEvents: 'auto',
                            flexShrink: 0,
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <HelpIcon text={helpText} isMobile={false} />
                    </span>
                </div>
            ),
        };
    });

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
