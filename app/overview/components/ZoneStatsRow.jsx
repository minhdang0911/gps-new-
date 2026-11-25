/**
 * @file ZoneStatsRow.jsx
 * @description Hàng hiển thị chi tiết số liệu của từng vùng trên ZoneStatsPanel.
 */

'use client';

import React from 'react';

export default function ZoneStatsRow({ zone, isSelected, onClickZone }) {
    const onlinePct = zone.total > 0 ? (zone.online / zone.total) * 100 : 0;

    return (
        <div
            onClick={() => onClickZone && onClickZone(zone)}
            style={{
                padding: '6px 10px 5px',
                cursor: onClickZone ? 'pointer' : 'default',
                background: isSelected ? 'rgba(37,99,235,0.22)' : 'transparent',
                borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                transition: 'background .12s',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 40px 36px', alignItems: 'center', marginBottom: 4 }}>
                <span
                    style={{
                        fontSize: 11,
                        color: isSelected ? '#93c5fd' : '#cbd5e1',
                        fontWeight: isSelected ? 700 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                    title={zone.name}
                >
                    {zone.name}
                </span>
                <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, textAlign: 'right' }}>{zone.total}</span>
                <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, textAlign: 'right' }}>{zone.online}</span>
                <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textAlign: 'right' }}>{zone.offline}</span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${onlinePct}%`, background: 'linear-gradient(90deg,#166534,#4ade80)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${onlinePct}%`, right: 0, background: 'rgba(239,68,68,0.38)' }} />
            </div>
        </div>
    );
}
