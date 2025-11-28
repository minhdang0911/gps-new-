'use client';

import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
    UserOutlined,
    MobileOutlined,
    AppstoreOutlined,
    CarOutlined,
    ToolOutlined,
    TeamOutlined,
    UsergroupAddOutlined,
    LockOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const { Sider } = Layout;
const { Text } = Typography;

export default function Sidebar() {
    const pathname = usePathname();

    const active = pathname.split('/')[2]; // /manage/users => users

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
                <Text strong>Quản lý tài khoản</Text>
            </div>

            <Menu
                mode="inline"
                selectedKeys={[active]}
                items={[
                    // {
                    //     key: 'profile',
                    //     icon: <UserOutlined />,
                    //     label: <Link href="/manage/profile">Thông tin tài khoản</Link>,
                    // },
                    {
                        key: 'devices',
                        icon: <MobileOutlined />,
                        label: <Link href="/manage/devices">Quản lý thiết bị</Link>,
                    },

                    {
                        key: 'device-category',
                        icon: <AppstoreOutlined />,
                        label: <Link href="/manage/device-category">Quản lý danh mục thiết bị</Link>,
                    },

                    {
                        key: 'vehicle-category',
                        icon: <CarOutlined />,
                        label: <Link href="/manage/vehicle-category">Quản lý loại xe</Link>,
                    },

                    {
                        key: 'vehicle-customer',
                        icon: <ToolOutlined />,
                        label: <Link href="/manage/device-customer">Quản lý thiết bị khách hàng</Link>,
                    },

                    // {
                    //     key: 'groups',
                    //     icon: <TeamOutlined />,
                    //     label: <Link href="/manage/groups">Quản lý nhóm</Link>,
                    // },
                    {
                        key: 'user',
                        icon: <UsergroupAddOutlined />,
                        label: <Link href="/manage/user">Quản lý người dùng</Link>,
                    },
                    // {
                    //     key: 'password',
                    //     icon: <LockOutlined />,
                    //     label: <Link href="/manage/password">Đổi mật khẩu</Link>,
                    // },
                ]}
            />
        </Sider>
    );
}
