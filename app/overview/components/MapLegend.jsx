/**
 * @file MapLegend.jsx
 * @description Chú thích màu sắc trạng thái Online/Offline trên bản đồ.
 */

'use client';

import React from 'react';

export default function MapLegend({ level, isMobile }) {
    return (
        <div
            style={{
                position: 'absolute',
                bottom: isMobile ? 8 : 70,
                right: isMobile ? 8 : 'auto',
                left: isMobile ? 'auto' : 12,
                zIndex: 1000,
                background: 'rgba(15,23,42,0.78)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 8,
                padding: isMobile ? '5px 9px' : '8px 13px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
                fontSize: 11,
                fontFamily: 'system-ui,sans-serif',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {!isMobile && (
                <div
                    style={{
                        marginBottom: 5,
                        fontWeight: 600,
                        color: '#94a3b8',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}
                >
                    {level === 'province' && 'Cụm tỉnh'}
                    {level === 'district' && 'Cụm quận/huyện'}
                    {level === 'device' && 'Thiết bị'}
                </div>
            )}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: isMobile ? 0 : 4,
                }}
            >
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#4ade80',
                        boxShadow: '0 0 4px #4ade80',
                    }}
                />
                {!isMobile ? (
                    <span style={{ color: '#d1fae5', fontWeight: 500 }}>Online</span>
                ) : (
                    <span style={{ color: '#d1fae5', fontWeight: 500, fontSize: 10 }}>On</span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: isMobile ? 2 : 0 }}>
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#f87171',
                        boxShadow: '0 0 4px #f87171',
                    }}
                />
                {!isMobile ? (
                    <span style={{ color: '#fee2e2', fontWeight: 500 }}>Offline</span>
                ) : (
                    <span style={{ color: '#fee2e2', fontWeight: 500, fontSize: 10 }}>Off</span>
                )}
            </div>
        </div>
    );
}
