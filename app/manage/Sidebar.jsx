'use client';

import React, { useMemo } from 'react';
import { Menu } from 'antd';
import { useRouter } from 'next/navigation';
import { MobileOutlined, AppstoreOutlined, CarOutlined, ToolOutlined, UsergroupAddOutlined } from '@ant-design/icons';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const locales = { vi, en };

export default function SidebarMenu({ pathname, onNavigate, collapsed = false }) {
    const router = useRouter();

    const active = useMemo(() => {
        const parts = (pathname || '').split('/');
        return parts[2] || 'devices';
    }, [pathname]);

    const lang = useMemo(() => {
        const seg = (pathname || '').split('/').filter(Boolean);
        const last = seg[seg.length - 1];
        return last === 'en' ? 'en' : 'vi';
    }, [pathname]);

    const t = (locales[lang] && locales[lang].sidebar) || locales.vi.sidebar;
    const suffix = lang === 'en' ? '/en' : '';

    const go = (path) => {
        router.push(path);
        onNavigate?.();
    };

    // ✅ để label là string => AntD tự tooltip khi inlineCollapsed
    const items = [
        {
            key: 'devices',
            icon: <MobileOutlined />,
            label: t.devices,
            onClick: () => go(`/manage/devices${suffix}`),
        },
        {
            key: 'device-category',
            icon: <AppstoreOutlined />,
            label: t.deviceCategory,
            onClick: () => go(`/manage/device-category${suffix}`),
        },
        {
            key: 'vehicle-category',
            icon: <CarOutlined />,
            label: t.vehicleCategory,
            onClick: () => go(`/manage/vehicle-category${suffix}`),
        },
        {
            key: 'device-customer',
            icon: <ToolOutlined />,
            label: t.deviceCustomer,
            onClick: () => go(`/manage/device-customer${suffix}`),
        },
        {
            key: 'user',
            icon: <UsergroupAddOutlined />,
            label: t.user,
            onClick: () => go(`/manage/user${suffix}`),
        },
    ];

    return (
        <>
            <style jsx global>{`
                .manage-sider-menu.ant-menu-inline {
                    padding: 8px 8px;
                }

                .manage-sider-menu .ant-menu-item {
                    height: 44px;
                    line-height: 44px;
                    margin: 4px 0;
                    border-radius: 10px;
                }

                .manage-sider-menu .ant-menu-item-icon {
                    font-size: 18px;
                }

                /* collapsed: center icon, hide text */
                .manage-sider-menu.ant-menu-inline-collapsed {
                    width: 72px;
                    padding: 8px 6px;
                }

                .manage-sider-menu.ant-menu-inline-collapsed .ant-menu-item {
                    padding: 0 !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .manage-sider-menu.ant-menu-inline-collapsed .ant-menu-item .ant-menu-title-content {
                    display: none;
                }

                .manage-sider-menu .ant-menu-item-selected {
                    background: #eaf2ff !important;
                }
            `}</style>

            <Menu
                className="manage-sider-menu"
                mode="inline"
                selectedKeys={[active]}
                items={items}
                inlineCollapsed={collapsed}
                style={{ borderRight: 0 }}
            />
        </>
    );
}
