'use client';

import React, { useMemo } from 'react';
import { Menu } from 'antd';
import { MobileOutlined, AppstoreOutlined, CarOutlined, ToolOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import Link from 'next/link';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const locales = { vi, en };

export default function SidebarMenu({ pathname, onNavigate }) {
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

    const items = [
        {
            key: 'devices',
            icon: <MobileOutlined />,
            label: <Link href={`/manage/devices${suffix}`}>{t.devices}</Link>,
        },
        {
            key: 'device-category',
            icon: <AppstoreOutlined />,
            label: <Link href={`/manage/device-category${suffix}`}>{t.deviceCategory}</Link>,
        },
        {
            key: 'vehicle-category',
            icon: <CarOutlined />,
            label: <Link href={`/manage/vehicle-category${suffix}`}>{t.vehicleCategory}</Link>,
        },
        {
            key: 'device-customer',
            icon: <ToolOutlined />,
            label: <Link href={`/manage/device-customer${suffix}`}>{t.deviceCustomer}</Link>,
        },
        {
            key: 'user',
            icon: <UsergroupAddOutlined />,
            label: <Link href={`/manage/user${suffix}`}>{t.user}</Link>,
        },
    ];

    return (
        <Menu
            mode="inline"
            selectedKeys={[active]}
            items={items}
            onClick={() => onNavigate?.()}
            style={{ borderRight: 0 }}
        />
    );
}
