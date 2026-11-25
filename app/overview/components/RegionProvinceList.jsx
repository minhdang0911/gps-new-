/**
 * @file RegionProvinceList.jsx
 * @description Danh sách 63 tỉnh thành bên trái của popup bộ lọc khu vực.
 */

'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function RegionProvinceList({
    provinces = [],
    hoveredProv,
    checkedProvs = new Set(),
    checkedDists = {},
    deviceCountByProv = {},
    searchValue = '',
    onSearchChange,
    onSelectProv,
    onToggleProv,
    isEn = false,
}) {
    const t = (vi, en) => (isEn ? en : vi);

    const filteredProvs = provinces
        .filter((p) => !searchValue || p.full_name.toLowerCase().includes(searchValue.toLowerCase()))
        .sort((a, b) => (deviceCountByProv[b.id] || 0) - (deviceCountByProv[a.id] || 0));

    return (
        <div className="ov-region-left">
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <input
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('Tìm tỉnh/thành…', 'Search province…')}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredProvs.map((prov) => {
                    const isHov = hoveredProv?.id === prov.id;
                    const isChk = checkedProvs.has(prov.id);
                    const distCount = checkedDists[prov.id]?.size || 0;
                    const devCount = deviceCountByProv[prov.id] || 0;
                    return (
                        <div
                            key={prov.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 12px', cursor: 'pointer',
                                background: isHov ? '#f0fdfa' : 'transparent',
                                borderLeft: isHov ? '2px solid #0f766e' : '2px solid transparent',
                                transition: 'background .1s', userSelect: 'none',
                            }}
                            onClick={() => {
                                onSelectProv(prov);
                                onToggleProv(prov.id);
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={isChk}
                                onChange={() => {}}
                                style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }}
                            />
                            <span style={{ fontSize: 12, color: isHov || isChk ? '#0f766e' : '#334155', fontWeight: isChk || isHov ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {prov.full_name}
                            </span>
                            {devCount > 0 && (
                                <span style={{ fontSize: 10, color: isChk ? '#0f766e' : '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                                    ({devCount})
                                </span>
                            )}
                            {distCount > 0 && (
                                <span style={{ fontSize: 9, background: '#0f766e', color: '#fff', borderRadius: 99, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>
                                    {distCount}
                                </span>
                            )}
                            <ChevronDown size={8} strokeWidth={2.5} style={{ transform: 'rotate(-90deg)', color: isHov ? '#0f766e' : '#94a3b8', flexShrink: 0 }} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
