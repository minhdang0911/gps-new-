'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layout, Spin } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    const router = useRouter();

    // derive trực tiếp (client-only)
    const allowed = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const role = window.localStorage.getItem('role');
        return role !== 'reporter';
    }, []);

    // chỉ side-effect: redirect nếu không allowed
    useEffect(() => {
        if (allowed === false) router.replace('/');
    }, [allowed, router]);

    return (
        <Layout
            hasSider
            style={{
                minHeight: 'calc(100vh - 140px)',
                background: '#f5f7fb',
                overflowX: 'hidden',
            }}
        >
            <Sidebar />

            <Layout style={{ background: 'transparent', minWidth: 0 }}>
                <Content style={{ padding: 20, minWidth: 0 }}>
                    {allowed === null ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                            <Spin />
                        </div>
                    ) : allowed ? (
                        children
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                            <Spin />
                        </div>
                    )}
                </Content>
            </Layout>
        </Layout>
    );
}
