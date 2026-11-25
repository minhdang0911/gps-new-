/**
 * @file ZoneStatsPanel.jsx
 * @description Bảng thống kê tổng / online / offline theo vùng (tỉnh/quận).
 */

'use client';

import React, { useState } from 'react';
import ZoneStatsRow from './ZoneStatsRow';

export default function ZoneStatsPanel({
    zones,
    level,
    onClickZone,
    selectedId,
    onGoRoot,
    provinceName,
    onGoProvince,
    isMobile,
}) {
    const [collapsed, setCollapsed] = useState(false);
    if (!zones || zones.length === 0) return null;

    const isCollapsed = isMobile ? true : collapsed;

    const levelLabel =
        level === 'province'
            ? 'Thống kê theo tỉnh'
            : level === 'district'
            ? 'Thống kê theo quận/huyện'
            : 'Thiết bị trong quận';

    return (
        <div
            style={{
                position: 'absolute',
                left: 12,
                top: 12,
                zIndex: 1001,
                width: isMobile ? 180 : 236,
                maxHeight: isMobile ? 'calc(100% - 60px)' : 'calc(100% - 80px)',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'system-ui,sans-serif',
            }}
        >
            {(level === 'district' || level === 'device') && (
                <div
                    style={{
                        background: 'rgba(15,23,42,0.88)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '10px 10px 0 0',
                        padding: '5px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderBottomColor: 'rgba(255,255,255,0.04)',
                        flexShrink: 0,
                    }}
                >
                    <button
                        onClick={onGoRoot}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#93c5fd', fontWeight: 600, padding: 0, fontSize: 11,
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        VN
                    </button>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {level === 'district' ? (
                        <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                            {provinceName}
                        </span>
                    ) : (
                        <>
                            <button
                                onClick={onGoProvince}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#93c5fd', fontWeight: 500, padding: 0, fontSize: 11,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80,
                                }}
                            >
                                {provinceName}
                            </button>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
                                {zones[0] && selectedId ? zones.find((z) => z.id === selectedId)?.name || 'Quận' : 'Quận'}
                            </span>
                        </>
                    )}
                </div>
            )}

            <div
                onClick={() => !isMobile && setCollapsed(!collapsed)}
                style={{
                    background: 'rgba(15,23,42,0.88)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius:
                        level === 'province'
                            ? isCollapsed ? 10 : '10px 10px 0 0'
                            : isCollapsed ? '0 0 10px 10px' : 0,
                    padding: '7px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isMobile ? 'default' : 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderTop: level === 'district' || level === 'device' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderBottom: isCollapsed ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    userSelect: 'none',
                    gap: 8,
                    flexShrink: 0,
                }}
            >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.3px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {levelLabel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#334155', background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                        {zones.length} vùng
                    </span>
                    {!isMobile && (
                        <svg
                            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"
                            style={{ transition: 'transform .2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div
                    style={{
                        background: 'rgba(15,23,42,0.82)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '0 0 10px 10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderTop: 'none',
                        overflowY: 'auto',
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 36px 40px 36px',
                            gap: 0,
                            padding: '5px 10px 4px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(15,23,42,0.95)',
                        }}
                    >
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase' }}>Vùng</span>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right' }}>Tổng</span>
                        <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textAlign: 'right' }}>● Onl</span>
                        <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, textAlign: 'right' }}>● Off</span>
                    </div>

                    {zones.map((z) => (
                        <ZoneStatsRow
                            key={z.id}
                            zone={z}
                            isSelected={z.id === selectedId}
                            onClickZone={onClickZone}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
