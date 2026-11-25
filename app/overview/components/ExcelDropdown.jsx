/**
 * @file ExcelDropdown.jsx
 * @description Menu dropdown xuất báo cáo Excel theo toàn bộ hoặc theo khu vực đã lọc.
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { IconExcelCustom, IconChevronDownCustom } from '../OverviewIcons';

export default function ExcelDropdown({ onExport, disabled, regionActive, regionCount, isEn }) {
    const t = (vi, en) => (isEn ? en : vi);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useClickOutside(ref, useCallback(() => setOpen(false), []), open);

    const options = regionActive
        ? [
            { mode: 'all',     label: t(`Xuất khu vực (${regionCount} thiết bị)`, `Export region (${regionCount} devices)`), color: '#0f766e' },
            { mode: 'online',  label: t('Xuất Online trong khu vực', 'Export Online in region'),               color: '#16a34a' },
            { mode: 'offline', label: t('Xuất Offline trong khu vực', 'Export Offline in region'),              color: '#dc2626' },
        ]
        : [
            { mode: 'all',     label: t('Xuất toàn bộ', 'Export all'),         color: '#1677ff' },
            { mode: 'online',  label: t('Xuất thiết bị Online', 'Export Online devices'),  color: '#16a34a' },
            { mode: 'offline', label: t('Xuất thiết bị Offline', 'Export Offline devices'), color: '#dc2626' },
        ];

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className="ov-refresh-btn"
                onClick={() => setOpen((p) => !p)}
                disabled={disabled}
                style={{ color: regionActive ? '#0f766e' : '#16a34a', borderColor: regionActive ? '#99f6e4' : '#bbf7d0', gap: 6 }}
            >
                <IconExcelCustom />
                {t('Xuất Excel', 'Export Excel')}
                {regionActive && (
                    <span style={{ background: '#0f766e', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                        {regionCount}
                    </span>
                )}
                <IconChevronDownCustom />
            </button>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: 9999,
                    minWidth: 240,
                }}>
                    {regionActive && (
                        <div style={{ padding: '6px 16px', fontSize: 10.5, color: '#0f766e', fontWeight: 600, background: '#f0fdfa', borderBottom: '1px solid #ccfbf1' }}>
                            {t('Đang lọc theo khu vực', 'Filtering by region')}
                        </div>
                    )}
                    {options.map((opt) => (
                        <button
                            key={opt.mode}
                            onClick={() => { onExport(opt.mode); setOpen(false); }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 16px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: '#334155',
                                fontWeight: 500,
                                textAlign: 'left',
                                transition: 'background .12s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                            <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: opt.color, flexShrink: 0,
                                boxShadow: `0 0 0 2px ${opt.color}33`,
                            }} />
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
