'use client';

import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    return (
        <Layout style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb' }}>
            <Sidebar />

            <Layout style={{ background: 'transparent' }}>
                <Content
                    style={{
                        padding: '20px',
                        paddingLeft: '20px',
                        width: '100%',
                    }}
                >
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
}
