'use client';

import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    return (
        <Layout style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb' }}>
            <Sidebar />

            <Layout>
                <Content style={{ padding: '20px 24px' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
                </Content>
            </Layout>
        </Layout>
    );
}
