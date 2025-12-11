'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    const router = useRouter();
    const [allowed, setAllowed] = useState(false); // check xong mới render

    useEffect(() => {
        const role = localStorage.getItem('role');

        // role reporter thì chặn
        if (role === 'reporter') {
            router.replace('/');
            return;
        }

        setAllowed(true);
    }, []);

    if (!allowed) return null; // tránh nháy UI

    return (
        <Layout style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb' }}>
            <Sidebar />
            <Layout style={{ background: 'transparent' }}>
                <Content style={{ padding: 20 }}>{children}</Content>
            </Layout>
        </Layout>
    );
}
