/**
 * @file DistrictListPanel.jsx
 * @description Danh sách quận huyện trong tỉnh đang xem, cho phép click để focus vào từng quận.
 */

'use client';

import React, { useState } from 'react';

export default function DistrictListPanel({ zones, selectedDistrictId, onClickZone }) {
    const [open, setOpen] = useState(true);
    if (!zones || zones.length === 0) return null;

    return (
        <div
            style={{
                position: 'absolute',
                left: 12,
                top: 46,
                zIndex: 1001,
                width: 220,
                maxHeight: 'calc(100% - 120px)',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'system-ui,sans-serif',
                pointerEvents: 'auto',
            }}
        >
            <div
                onClick={() => setOpen(!open)}
                style={{
                    background: 'rgba(15,23,42,0.88)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: open ? '8px 8px 0 0' : 8,
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    userSelect: 'none',
                    flexShrink: 0,
                }}
            >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {zones.length} quận/huyện
                </span>
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2.5"
                    style={{ transition: 'transform .15s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            {open && (
                <div
                    style={{
                        background: 'rgba(15,23,42,0.82)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '0 0 8px 8px',
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
                            gridTemplateColumns: '1fr 32px 32px 32px',
                            padding: '4px 8px 3px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(15,23,42,0.98)',
                        }}
                    >
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase' }}>Vùng</span>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right' }}>TB</span>
                        <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textAlign: 'right' }}>Onl</span>
                        <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, textAlign: 'right' }}>Off</span>
                    </div>

                    {zones.map((z) => {
                        const pct = z.total > 0 ? (z.online / z.total) * 100 : 0;
                        const isActive = z.id === selectedDistrictId;
                        return (
                            <div
                                key={z.id}
                                onClick={() => onClickZone && onClickZone(z)}
                                style={{
                                    padding: '5px 8px 4px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                                    background: isActive ? 'rgba(37,99,235,0.18)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background .1s',
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px', alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, color: isActive ? '#93c5fd' : '#cbd5e1', fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 4 }} title={z.name}>
                                        {z.name}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, textAlign: 'right' }}>{z.total}</span>
                                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, textAlign: 'right' }}>{z.online}</span>
                                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textAlign: 'right' }}>{z.offline}</span>
                                </div>
                                <div style={{ height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#166534,#4ade80)', borderRadius: 2 }} />
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, right: 0, background: 'rgba(239,68,68,0.38)', borderRadius: '0 2px 2px 0' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
