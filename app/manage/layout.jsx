'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Spin, Button, Drawer } from 'antd';
import { MenuOutlined, CloseOutlined } from '@ant-design/icons';
import SidebarMenu from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname() || '';

    // ==== quyền (bạn thay theo logic thật) ====
    const allowed = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const role = localStorage.getItem('role'); // ví dụ
        if (!role) return null;
        return role !== 'reporter';
    }, []);

    useEffect(() => {
        if (allowed === false) router.replace('/');
    }, [allowed, router]);

    // ==== responsive detect + drawer state ====
    const [isMobile, setIsMobile] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia('(max-width: 991.98px)'); // < 992px
        const apply = () => {
            const mobile = mql.matches;
            setIsMobile(mobile);

            // lên desktop thì đóng drawer (tránh drawer còn mở)
            if (!mobile) setDrawerOpen(false);
        };

        apply();
        mql.addEventListener?.('change', apply);
        return () => mql.removeEventListener?.('change', apply);
    }, []);

    return (
        <Layout style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb' }}>
            {/* ===== SIDEBAR DESKTOP ===== */}
            {!isMobile && (
                <Layout.Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
                    <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 600 }}>Quản lý</div>
                    </div>

                    <SidebarMenu pathname={pathname} onNavigate={() => {}} />
                </Layout.Sider>
            )}

            {/* ===== MAIN ===== */}
            <Layout style={{ minWidth: 0, background: 'transparent' }}>
                {/* Topbar: mobile có nút ☰ */}
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        background: '#fff',
                        borderBottom: '1px solid #f0f0f0',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                    }}
                >
                    {isMobile && <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />}
                    <div style={{ fontWeight: 600 }}>Quản lý</div>
                </div>

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

            <Drawer
                open={isMobile && drawerOpen}
                onClose={() => setDrawerOpen(false)}
                placement="left"
                size="default"
                destroyOnHidden
                title="Quản lý"
                closable
                closeIcon={<CloseOutlined />}
                maskClosable
                styles={{
                    body: { padding: 0 },
                    content: { width: 260 },
                }}
            >
                <SidebarMenu pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </Drawer>
        </Layout>
    );
}
