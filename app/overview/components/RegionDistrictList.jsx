/**
 * @file RegionDistrictList.jsx
 * @description Danh sách quận huyện bên phải của popup bộ lọc khu vực.
 */

'use client';

import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export default function RegionDistrictList({
    hoveredProv,
    districts = [],
    checkedProvs = new Set(),
    checkedDists = {},
    districtDeviceCounts = {},
    loadingDist = false,
    searchValue = '',
    onSearchChange,
    onToggleAllProv,
    onToggleDist,
    isEn = false,
}) {
    const t = (vi, en) => (isEn ? en : vi);

    if (!hoveredProv) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12.5, gap: 8, padding: 24, textAlign: 'center' }}>
                <MapPin size={28} color="#cbd5e1" strokeWidth={1.5} />
                {t('Click vào tỉnh để chọn quận/huyện', 'Click province to select district')}
            </div>
        );
    }

    const sortedDistricts = [...districts]
        .filter((d) => !searchValue || (d.full_name || d.name).toLowerCase().includes(searchValue.toLowerCase()))
        .sort((a, b) => (districtDeviceCounts[b.id] || 0) - (districtDeviceCounts[a.id] || 0));

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#0f766e', background: '#f0fdfa', flexShrink: 0 }}>
                {hoveredProv.full_name}
            </div>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <input
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('Tìm quận/huyện…', 'Search district…')}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                />
            </div>
            {!searchValue && (
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#fafafa', flexShrink: 0 }}
                    onClick={onToggleAllProv}
                >
                    <input
                        type="checkbox"
                        checked={checkedProvs.has(hoveredProv.id) && !(checkedDists[hoveredProv.id]?.size > 0)}
                        onChange={() => {}}
                        style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 700, fontStyle: 'italic' }}>
                        {t('Tất cả', 'All')} ({hoveredProv.full_name})
                    </span>
                </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {loadingDist ? (
                    <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Loader2 size={12} style={{ animation: 'ov-spin .65s linear infinite' }} /> {t('Đang tải…', 'Loading…')}
                    </div>
                ) : (
                    sortedDistricts.map((dist) => {
                        const isChk = checkedDists[hoveredProv.id]?.has(dist.id);
                        const distDevCount = districtDeviceCounts[dist.id] || 0;
                        return (
                            <div
                                key={dist.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                                    cursor: 'pointer', background: isChk ? '#f0fdfa' : 'transparent',
                                    borderLeft: isChk ? '2px solid #0f766e' : '2px solid transparent',
                                    transition: 'background .1s', userSelect: 'none',
                                }}
                                onClick={() => onToggleDist(hoveredProv.id, dist.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(isChk)}
                                    onChange={() => {}}
                                    style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }}
                                />
                                <span style={{ fontSize: 12, color: isChk ? '#0f766e' : '#334155', fontWeight: isChk ? 600 : 400, flex: 1 }}>
                                    {dist.full_name || dist.name}
                                </span>
                                {distDevCount > 0 && (
                                    <span style={{ fontSize: 10, color: isChk ? '#0f766e' : '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                                        ({distDevCount})
                                    </span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
