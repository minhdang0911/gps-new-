'use client';

import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { MobileOutlined, AppstoreOutlined, CarOutlined, ToolOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import vi from '../locales/vi.json';
import en from '../locales/en.json';

const { Sider } = Layout;
const { Text } = Typography;

// JS thuần, không type
const locales = { vi, en };

export default function Sidebar() {
    const pathname = usePathname() || '';

    // /manage/devices/en -> ['', 'manage', 'devices', 'en'] -> active = 'devices'
    const parts = pathname.split('/');
    const active = parts[2] || 'devices';

    // detect lang theo segment cuối: .../en thì tiếng Anh
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    const lang = last === 'en' ? 'en' : 'vi';
    const t = (locales[lang] && locales[lang].sidebar) || locales.vi.sidebar;

    const suffix = lang === 'en' ? '/en' : '';

    return (
        <Sider
            width={240}
            breakpoint="lg"
            collapsedWidth={0}
            style={{
                background: '#fff',
                borderRight: '1px solid #f0f0f0',
            }}
        >
            <div
                style={{
                    padding: '16px 16px 8px',
                    borderBottom: '1px solid #f0f0f0',
                }}
            >
                <Text strong>{t.title}</Text>
            </div>

            <Menu
                mode="inline"
                selectedKeys={[active]}
                items={[
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
                        key: 'vehicle-customer',
                        icon: <ToolOutlined />,
                        label: <Link href={`/manage/device-customer${suffix}`}>{t.deviceCustomer}</Link>,
                    },
                    {
                        key: 'user',
                        icon: <UsergroupAddOutlined />,
                        label: <Link href={`/manage/user${suffix}`}>{t.user}</Link>,
                    },
                ]}
            />
        </Sider>
    );
}
