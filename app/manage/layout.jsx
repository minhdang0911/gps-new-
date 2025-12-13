'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    const router = useRouter();

    // Tính allowed ngay lúc khởi tạo (client only)
    const [allowed] = useState(() => {
        if (typeof window === 'undefined') return false;
        const role = window.localStorage.getItem('role');
        return role !== 'reporter';
    });

    useEffect(() => {
        if (!allowed) router.replace('/');
    }, [allowed, router]);

    if (!allowed) return null;

    return (
        <Layout hasSider style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb', overflowX: 'hidden' }}>
            <Sidebar />
            <Layout style={{ background: 'transparent', minWidth: 0 }}>
                <Content style={{ padding: 20, minWidth: 0 }}>{children}</Content>
            </Layout>
        </Layout>
    );
}
