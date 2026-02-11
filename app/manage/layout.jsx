'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Spin, Button, Drawer } from 'antd';
import { MenuOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import SidebarMenu from './Sidebar';

const { Content } = Layout;

export default function ManageLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname() || '';

    // ==== quyền (demo) ====
    const allowed = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const role = localStorage.getItem('role');
        if (!role) return null;
        return role !== 'reporter';
    }, []);

    useEffect(() => {
        if (allowed === false) router.replace('/');
    }, [allowed, router]);

    // ==== detect lang ====
    const lang = useMemo(() => {
        const seg = (pathname || '').split('/').filter(Boolean);
        const last = seg[seg.length - 1];
        return last === 'en' ? 'en' : 'vi';
    }, [pathname]);

    const titleFull = lang === 'en' ? 'Manage' : 'Quản lý';
    const titleShort = lang === 'en' ? 'Mng' : 'QLý';

    // ==== responsive ====
    const [isMobile, setIsMobile] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia('(max-width: 991.98px)');
        const apply = () => {
            const mobile = mql.matches;
            setIsMobile(mobile);

            if (!mobile) setDrawerOpen(false);
            if (mobile) setCollapsed(false);
        };

        apply();
        mql.addEventListener?.('change', apply);
        return () => mql.removeEventListener?.('change', apply);
    }, []);

    return (
        <Layout style={{ minHeight: 'calc(100vh - 140px)', background: '#f5f7fb' }}>
            {/* ================= DESKTOP SIDEBAR ================= */}
            {!isMobile && (
                <Layout.Sider
                    width={240}
                    collapsedWidth={72}
                    collapsed={collapsed}
                    trigger={null}
                    style={{
                        background: '#fff',
                        borderRight: '1px solid #f0f0f0',
                        position: 'relative',
                        overflow: 'visible',
                    }}
                >
                    {/* Header sidebar */}
                    <div
                        style={{
                            height: 52,
                            display: 'flex',
                            alignItems: 'center',
                            padding: collapsed ? '0 12px' : '0 16px',
                            borderBottom: '1px solid #f0f0f0',
                            fontWeight: 600,
                            fontSize: 15,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {collapsed ? titleShort : titleFull}
                    </div>

                    <div style={{ height: 8 }} />

                    {/* Toggle button */}
                    <button
                        type="button"
                        onClick={() => setCollapsed((v) => !v)}
                        style={{
                            position: 'absolute',
                            top: 62,
                            right: -14,
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            border: '1px solid #e6e8ef',
                            background: '#fff',
                            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            zIndex: 50,
                        }}
                    >
                        {collapsed ? (
                            <RightOutlined style={{ fontSize: 12, color: '#4b5563' }} />
                        ) : (
                            <LeftOutlined style={{ fontSize: 12, color: '#4b5563' }} />
                        )}
                    </button>

                    <SidebarMenu pathname={pathname} onNavigate={() => {}} collapsed={collapsed} />
                </Layout.Sider>
            )}

            {/* ================= MAIN ================= */}
            <Layout style={{ minWidth: 0, background: 'transparent' }}>
                {/* Topbar */}
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
                    <div style={{ fontWeight: 600 }}>{titleFull}</div>
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

            {/* ================= MOBILE DRAWER ================= */}
            <Drawer
                open={isMobile && drawerOpen}
                onClose={() => setDrawerOpen(false)}
                placement="left"
                destroyOnHidden
                title={titleFull}
                closeIcon={<CloseOutlined />}
                styles={{
                    body: { padding: 0 },
                    content: { width: 260 },
                }}
            >
                <SidebarMenu pathname={pathname} onNavigate={() => setDrawerOpen(false)} collapsed={false} />
            </Drawer>
        </Layout>
    );
}
