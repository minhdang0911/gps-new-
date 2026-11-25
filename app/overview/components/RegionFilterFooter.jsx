/**
 * @file RegionFilterFooter.jsx
 * @description Phần footer của popup bộ lọc khu vực (số lượng đã chọn, đặt lại, xuất excel, áp dụng).
 */

'use client';

import React from 'react';
import { RotateCcw, FileDown, Loader2, ChevronDown } from 'lucide-react';

export default function RegionFilterFooter({
    checkedCount = 0,
    exporting = false,
    showExportMenu = false,
    exportMenuRef,
    onReset,
    onToggleExportMenu,
    onExport,
    onApply,
    isEn = false,
}) {
    const t = (vi, en) => (isEn ? en : vi);

    return (
        <div className="ov-region-footer">
            <span className="ov-region-footer-label" style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                {checkedCount > 0 ? t(`Đã chọn ${checkedCount} tỉnh/thành`, `Selected ${checkedCount} region(s)`) : t('Chưa chọn khu vực nào', 'No region selected')}
            </span>
            <button className="ov-region-footer-btn" onClick={onReset} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                <RotateCcw size={12} /> {t('Đặt lại', 'Reset')}
            </button>

            <div className="ov-region-footer-btn" ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => checkedCount && !exporting && onToggleExportMenu()}
                    disabled={!checkedCount || exporting}
                    style={{ width: '100%', padding: '6px 12px', borderRadius: 7, border: '1px solid #99f6e4', background: '#fff', cursor: checkedCount ? 'pointer' : 'not-allowed', fontSize: 12, color: '#0f766e', fontWeight: 600, opacity: checkedCount ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                    {exporting ? <Loader2 size={12} style={{ animation: 'ov-spin .65s linear infinite' }} /> : <FileDown size={12} />}
                    {t('Xuất Excel', 'Export Excel')}
                    <ChevronDown size={10} strokeWidth={2.5} />
                </button>
                {showExportMenu && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 200, zIndex: 99999 }}>
                        {[
                            { mode: 'all', label: t('Xuất tất cả (khu vực)', 'Export all (region)'), dot: '#0f766e' },
                            { mode: 'online', label: t('Xuất Online', 'Export Online'), dot: '#16a34a' },
                            { mode: 'offline', label: t('Xuất Offline', 'Export Offline'), dot: '#dc2626' },
                        ].map((opt) => (
                            <button key={opt.mode} onClick={() => onExport(opt.mode)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#334155', fontWeight: 500, textAlign: 'left' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                className="ov-region-footer-btn"
                onClick={onApply}
                disabled={!checkedCount}
                style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: checkedCount ? '#0f766e' : '#e2e8f0', cursor: checkedCount ? 'pointer' : 'not-allowed', fontSize: 12, color: checkedCount ? '#fff' : '#94a3b8', fontWeight: 700 }}
            >
                {t('Áp dụng', 'Apply')}
            </button>
        </div>
    );
}
