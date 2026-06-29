'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Skeleton } from 'antd';
import {
    SearchOutlined,
    CloseOutlined,
    EnvironmentOutlined,
    StopOutlined,
} from '@ant-design/icons';
import {
    MapPin, X, ChevronDown, FileSpreadsheet,
    Loader2, RotateCcw, FileDown, Check,
} from 'lucide-react';
import Fuse from 'fuse.js';

import VietnamMapDrillDown from './VietnamMapDrillDown';
import { exportOverviewExcel, exportByRegion } from './useOverviewExcel';
import './map.css';

import { getDevices } from '../lib/api/devices';
import api from '../lib/api/axios';

const PROVINCE_API = 'https://esgoo.net/api-tinhthanh/1/0.htm';
const DISTRICT_API = (provinceId) => `https://esgoo.net/api-tinhthanh/2/${provinceId}.htm`;

const isOnline = (cruiseItem) => {
    if (!cruiseItem) return false;
    const updated = cruiseItem.updatedAt || cruiseItem.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const isExpiringSoon = (device) => {
    if (!device?.date_exp) return false;
    const exp = new Date(device.date_exp).getTime();
    const now = Date.now();
    return exp > now && exp - now < 7 * 24 * 60 * 60 * 1000;
};

// ── Inline SVG icons — no external deps needed ─────────────────
const IcGrid = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
);
const IcWifiOn = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
);
const IcWifiOff = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
);
const IcClock = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
);
const IcTotal = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
);
const IcMap = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/>
        <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="6" x2="15" y2="18"/>
    </svg>
);
const IcRefresh = ({ spinning }) => (
    <RotateCcw size={14} style={{ animation: spinning ? 'ov-spin .65s linear infinite' : 'none' }} />
);
const IcExcel = () => <FileSpreadsheet size={15} />;
const IcChevron = () => <ChevronDown size={12} strokeWidth={2.5} />;

// ── Geo helper (province-level device filtering) ────────────────
const _haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const _findNearest = (lat, lon, list) => {
    let best = null, bestDist = Infinity;
    for (const item of list) {
        const d = _haversine(lat, lon, parseFloat(item.latitude), parseFloat(item.longitude));
        if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
};

// ── Region Filter Panel (TopCV-style) ─────────────────────────────
const RegionFilterPanel = ({ provinces, devices, cruiseByImei, onApply, disabled }) => {
    const [open, setOpen]                   = useState(false);
    const [hoveredProv, setHoveredProv]     = useState(null);
    const [checkedProvs, setCheckedProvs]   = useState(new Set());
    const [districtCache, setDistrictCache] = useState({});
    const [checkedDists, setCheckedDists]   = useState({});
    const [loadingDist, setLoadingDist]     = useState(false);
    const [exporting, setExporting]         = useState(false);
    const [provSearch, setProvSearch]       = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [distSearch, setDistSearch]         = useState('');
    // Track what's currently APPLIED (shown as tags), separate from checkedProvs (in-panel draft)
    const [appliedProvIds, setAppliedProvIds] = useState(new Set());
    const ref = useRef(null);
    const exportMenuRef = useRef(null);
    const TAG_LIMIT = 3; // max tags shown before "+N"

    // ─ Count devices per province
    const deviceCountByProv = useMemo(() => {
        if (!provinces.length) return {};
        const counts = {};
        Object.values(cruiseByImei).forEach(cruise => {
            if (!cruise?.lat || !cruise?.lon) return;
            const nearest = _findNearest(cruise.lat, cruise.lon, provinces);
            if (nearest) counts[nearest.id] = (counts[nearest.id] || 0) + 1;
        });
        return counts;
    }, [provinces, cruiseByImei]);

    // ─ Count devices per district (haversine nearest-district approx — fast & sync)
    const districtDeviceCounts = useMemo(() => {
        if (!hoveredProv) return {};
        const dists = districtCache[hoveredProv.id];
        if (!dists?.length) return {};
        const counts = {};
        Object.values(cruiseByImei).forEach(cruise => {
            if (!cruise?.lat || !cruise?.lon) return;
            // Only consider devices belonging to this province
            const nearestProv = _findNearest(cruise.lat, cruise.lon, provinces);
            if (nearestProv?.id !== hoveredProv.id) return;
            const nearestDist = _findNearest(cruise.lat, cruise.lon, dists);
            if (nearestDist) counts[nearestDist.id] = (counts[nearestDist.id] || 0) + 1;
        });
        return counts;
    }, [hoveredProv, districtCache, cruiseByImei, provinces]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);


    // Click province → fetch + cache districts, reset district search
    const handleHoverProv = async (prov) => {
        setHoveredProv(prov);
        setDistSearch('');
        if (!districtCache[prov.id]) {
            setLoadingDist(true);
            try {
                const res  = await fetch(DISTRICT_API(prov.id));
                const data = await res.json();
                setDistrictCache(prev => ({ ...prev, [prov.id]: data.data || [] }));
            } catch (e) { console.error(e); }
            finally { setLoadingDist(false); }
        }
    };

    const toggleProv = (provId) => {
        setCheckedProvs(prev => {
            const next = new Set(prev);
            if (next.has(provId)) next.delete(provId); else next.add(provId);
            return next;
        });
    };

    const toggleDist = (provId, distId) => {
        // Selecting a district also auto-checks the province
        if (!checkedProvs.has(provId)) setCheckedProvs(prev => new Set([...prev, provId]));
        setCheckedDists(prev => {
            const set = new Set(prev[provId] || []);
            if (set.has(distId)) set.delete(distId); else set.add(distId);
            return { ...prev, [provId]: set };
        });
    };

    const handleApply = () => {
        const hasFilter = checkedProvs.size > 0;
        setAppliedProvIds(new Set(checkedProvs));
        onApply(hasFilter ? { checkedProvs: new Set(checkedProvs), checkedDists: { ...checkedDists }, districtCache } : null);
        setOpen(false);
    };

    const handleReset = () => {
        setCheckedProvs(new Set());
        setCheckedDists({});
        setAppliedProvIds(new Set());
        onApply(null);
        setOpen(false);
    };

    // Remove a single applied province tag → auto-apply immediately
    const handleRemoveTag = (e, provId) => {
        e.stopPropagation();
        const nextApplied = new Set(appliedProvIds);
        nextApplied.delete(provId);
        setAppliedProvIds(nextApplied);

        const nextChecked = new Set(checkedProvs);
        nextChecked.delete(provId);
        setCheckedProvs(nextChecked);

        // Also clear district selection for this province
        setCheckedDists(prev => { const n = { ...prev }; delete n[provId]; return n; });

        if (nextApplied.size === 0) {
            // All removed → reset to show everything
            onApply(null);
        } else {
            // Re-apply with remaining
            const nextDists = { ...checkedDists };
            delete nextDists[provId];
            onApply({ checkedProvs: nextChecked, checkedDists: nextDists, districtCache });
        }
    };

    const handleExport = async (mode = 'all') => {
        if (!checkedProvs.size) return;
        setExporting(true);
        setShowExportMenu(false);
        try {
            // Pre-filter devices by mode
            const devicesToExport = mode === 'online'
                ? devices.filter(d => isOnline(cruiseByImei[d.imei]))
                : mode === 'offline'
                ? devices.filter(d => !isOnline(cruiseByImei[d.imei]))
                : devices;
            for (const provId of checkedProvs) {
                const prov = provinces.find(p => p.id === provId);
                if (!prov) continue;
                const dists = checkedDists[provId];
                if (dists && dists.size > 0) {
                    for (const distId of dists) {
                        const distList = districtCache[provId] || [];
                        const dist = distList.find(d => d.id === distId);
                        if (dist) await exportByRegion({ devices: devicesToExport, cruiseByImei, province: prov, district: { properties: { ma_huyen: dist.id, ten_huyen: dist.name, loai: dist.full_name?.split(' ')[0] || '' } }, provinces });
                    }
                } else {
                    await exportByRegion({ devices: devicesToExport, cruiseByImei, province: prov, district: null, provinces });
                }
            }
        } finally { setExporting(false); }
    };

    const selectedCount = checkedProvs.size;
    // Sort provinces: most devices first
    const filteredProvs = provinces
        .filter(p => !provSearch || p.full_name.toLowerCase().includes(provSearch.toLowerCase()))
        .sort((a, b) => (deviceCountByProv[b.id] || 0) - (deviceCountByProv[a.id] || 0));
    // Filter + sort districts: search → most devices first
    const sortedDistricts = [...(districtCache[hoveredProv?.id] || [])]
        .filter(d => !distSearch || (d.full_name || d.name).toLowerCase().includes(distSearch.toLowerCase()))
        .sort((a, b) => (districtDeviceCounts[b.id] || 0) - (districtDeviceCounts[a.id] || 0));

    const colStyle = { overflowY: 'auto', flex: 1 };
    const rowStyle = (isHovered) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', cursor: 'pointer',
        background: isHovered ? '#f0fdfa' : 'transparent',
        borderLeft: isHovered ? '2px solid #0f766e' : '2px solid transparent',
        transition: 'background .1s',
        userSelect: 'none',
    });

    // Tags to display on the trigger button
    const appliedProvList = provinces.filter(p => appliedProvIds.has(p.id));
    const visibleTags = appliedProvList.slice(0, TAG_LIMIT);
    const hiddenCount = appliedProvList.length - visibleTags.length;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Trigger button — TopCV style: shows selected province tags */}
            <button
                className="ov-refresh-btn"
                onClick={() => { if (!disabled && !exporting) setOpen(o => !o); }}
                disabled={disabled || exporting}
                style={{
                    color: '#0f766e',
                    borderColor: appliedProvIds.size > 0 ? '#0f766e' : '#99f6e4',
                    background: appliedProvIds.size > 0 ? '#f0fdfa' : undefined,
                    gap: 5,
                    flexWrap: 'nowrap',
                    maxWidth: 420,
                    height: 'auto',
                    minHeight: 32,
                    padding: '4px 10px',
                }}
            >
                {/* Pin icon or spinner */}
                {exporting
                    ? <Loader2 size={13} style={{ animation: 'ov-spin .65s linear infinite', flexShrink: 0 }} />
                    : <MapPin size={13} style={{ flexShrink: 0 }} />
                }

                {appliedProvIds.size === 0 ? (
                    // No filter active → plain label
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {exporting ? 'Đang xuất…' : 'Theo khu vực'}
                    </span>
                ) : (
                    // Applied tags — max TAG_LIMIT, then +N
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
                        {visibleTags.map(prov => (
                            <span
                                key={prov.id}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    background: '#0f766e', color: '#fff',
                                    borderRadius: 99, padding: '2px 8px 2px 9px',
                                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                                    lineHeight: 1.4,
                                }}
                            >
                                {/* Short name: strip "Tỉnh/Thành phố" prefix */}
                                {prov.full_name.replace(/^(Tỉnh|Thành phố)\s+/i, '')}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => handleRemoveTag(e, prov.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRemoveTag(e, prov.id)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 13, height: 13, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.25)',
                                        cursor: 'pointer', flexShrink: 0,
                                        fontSize: 9, fontWeight: 900, lineHeight: 1,
                                        transition: 'background .12s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.45)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                                >✕</span>
                            </span>
                        ))}
                        {hiddenCount > 0 && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                background: '#ccfbf1', color: '#0f766e',
                                borderRadius: 99, padding: '2px 8px',
                                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                            }}>
                                +{hiddenCount}
                            </span>
                        )}
                    </span>
                )}

                <ChevronDown size={11} strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: 2, opacity: 0.7 }} />
            </button>

            {open && (
                <div className="ov-region-panel">
                    {/* Panel header */}
                    <div style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} color="#0f766e" /> Lọc &amp; xuất theo khu vực
                        </span>
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* 2-col body */}
                    <div className="ov-region-body">

                        {/* LEFT: Provinces */}
                        <div className="ov-region-left">
                            <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                <input
                                    value={provSearch}
                                    onChange={e => setProvSearch(e.target.value)}
                                    placeholder="Tìm tỉnh/thành…"
                                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={colStyle}>
                                {filteredProvs.map(prov => {
                                    const isHov = hoveredProv?.id === prov.id;
                                    const isChk = checkedProvs.has(prov.id);
                                    const distCount = checkedDists[prov.id]?.size || 0;
                                    const devCount = deviceCountByProv[prov.id] || 0;
                                    return (
                                        <div
                                            key={prov.id}
                                            style={{ ...rowStyle(isHov), cursor: 'pointer' }}
                                            onClick={() => {
                                                // Click anywhere on row: load districts
                                                handleHoverProv(prov);
                                                // Also toggle check
                                                toggleProv(prov.id);
                                            }}
                                        >
                                            {/* Checkbox purely visual — click handled by row */}
                                            <input
                                                type="checkbox"
                                                checked={isChk}
                                                onChange={() => {}}
                                                style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0, pointerEvents: 'none' }}
                                            />
                                            <span style={{ fontSize: 12, color: isHov ? '#0f766e' : isChk ? '#0f766e' : '#334155', fontWeight: isChk || isHov ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {prov.full_name}
                                            </span>
                                            {devCount > 0 && (
                                                <span style={{ fontSize: 10, color: isChk ? '#0f766e' : '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                                                    ({devCount})
                                                </span>
                                            )}
                                            {distCount > 0 && (
                                                <span style={{ fontSize: 9, background: '#0f766e', color: '#fff', borderRadius: 99, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>{distCount}</span>
                                            )}
                                            <ChevronDown size={8} strokeWidth={2.5} style={{ transform: 'rotate(-90deg)', color: isHov ? '#0f766e' : '#94a3b8', flexShrink: 0 }} />
                                        </div>
                                    );
                                })}

                            </div>
                        </div>

                        {/* RIGHT: Districts */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            {hoveredProv ? (
                                <>
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#0f766e', background: '#f0fdfa', flexShrink: 0 }}>
                                        {hoveredProv.full_name}
                                    </div>
                                    {/* District search input */}
                                    <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                        <input
                                            value={distSearch}
                                            onChange={e => setDistSearch(e.target.value)}
                                            placeholder="Tìm quận/huyện…"
                                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    {/* Chọn toàn tỉnh — ẩn khi đang search */}
                                    {!distSearch && (
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#fafafa', flexShrink: 0 }}
                                        onClick={() => { toggleProv(hoveredProv.id); setCheckedDists(prev => ({ ...prev, [hoveredProv.id]: new Set() })); }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checkedProvs.has(hoveredProv.id) && !(checkedDists[hoveredProv.id]?.size > 0)}
                                            onChange={() => {}}
                                            style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 700, fontStyle: 'italic' }}>Tất cả ({hoveredProv.full_name})</span>
                                    </div>
                                    )}
                                    <div style={colStyle}>
                                        {loadingDist ? (
                                            <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                <Loader2 size={12} style={{ animation: 'ov-spin .65s linear infinite' }} /> Đang tải…
                                            </div>
                                        ) : (
                                            sortedDistricts.map(dist => {
                                                const distDevCount = districtDeviceCounts[dist.id] || 0;
                                                return (
                                                    <div
                                                        key={dist.id}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                        onClick={() => toggleDist(hoveredProv.id, dist.id)}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checkedDists[hoveredProv.id]?.has(dist.id) || false}
                                                            onChange={() => {}}
                                                            style={{ accentColor: '#0f766e', cursor: 'pointer', flexShrink: 0 }}
                                                        />
                                                        <span style={{ fontSize: 12, color: '#334155', flex: 1 }}>{dist.full_name || dist.name}</span>
                                                        {distDevCount > 0 && (
                                                            <span style={{ fontSize: 10, color: checkedDists[hoveredProv.id]?.has(dist.id) ? '#0f766e' : '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                                                                ({distDevCount})
                                                            </span>
                                                        )}
                                                        {checkedDists[hoveredProv.id]?.has(dist.id) && (
                                                            <Check size={12} color="#0f766e" />
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12, gap: 8 }}>
                                    <MapPin size={28} color="#cbd5e1" strokeWidth={1.5} />
                                    Click vào tỉnh để chọn quận/huyện
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="ov-region-footer">
                        <span className="ov-region-footer-label" style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                            {checkedProvs.size > 0 ? `Đã chọn ${checkedProvs.size} tỉnh/thành` : 'Chưa chọn khu vực nào'}
                        </span>
                        <button className="ov-region-footer-btn" onClick={handleReset} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <RotateCcw size={12} /> Đặt lại
                        </button>

                        {/* Export dropdown */}
                        <div className="ov-region-footer-btn" ref={exportMenuRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => checkedProvs.size && !exporting && setShowExportMenu(m => !m)}
                                disabled={!checkedProvs.size || exporting}
                                style={{ width: '100%', padding: '6px 12px', borderRadius: 7, border: '1px solid #99f6e4', background: '#fff', cursor: checkedProvs.size ? 'pointer' : 'not-allowed', fontSize: 12, color: '#0f766e', fontWeight: 600, opacity: checkedProvs.size ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                                {exporting ? <Loader2 size={12} style={{ animation: 'ov-spin .65s linear infinite' }} /> : <FileDown size={12} />}
                                Xuất Excel
                                <ChevronDown size={10} strokeWidth={2.5} />
                            </button>
                            {showExportMenu && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 200, zIndex: 99999 }}>
                                    {[
                                        { mode: 'all',     label: 'Xuất tất cả (khu vực)',  dot: '#0f766e' },
                                        { mode: 'online',  label: 'Xuất Online',            dot: '#16a34a' },
                                        { mode: 'offline', label: 'Xuất Offline',           dot: '#dc2626' },
                                    ].map(opt => (
                                        <button key={opt.mode} onClick={() => handleExport(opt.mode)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#334155', fontWeight: 500, textAlign: 'left' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            className="ov-region-footer-btn"
                            onClick={handleApply}
                            disabled={!checkedProvs.size}
                            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: checkedProvs.size ? '#0f766e' : '#e2e8f0', cursor: checkedProvs.size ? 'pointer' : 'not-allowed', fontSize: 12, color: checkedProvs.size ? '#fff' : '#94a3b8', fontWeight: 700 }}
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Excel Dropdown ──────────────────────────────────────────────
const ExcelDropdown = ({ onExport, disabled, regionActive, regionCount }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const options = regionActive
        ? [
            { mode: 'all',     label: `Xuất khu vực (${regionCount} thiết bị)`, color: '#0f766e' },
            { mode: 'online',  label: 'Xuất Online trong khu vực',               color: '#16a34a' },
            { mode: 'offline', label: 'Xuất Offline trong khu vực',              color: '#dc2626' },
        ]
        : [
            { mode: 'all',     label: 'Xuất toàn bộ',         color: '#1677ff' },
            { mode: 'online',  label: 'Xuất thiết bị Online',  color: '#16a34a' },
            { mode: 'offline', label: 'Xuất thiết bị Offline', color: '#dc2626' },
        ];

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className="ov-refresh-btn"
                onClick={() => setOpen((p) => !p)}
                disabled={disabled}
                style={{ color: regionActive ? '#0f766e' : '#16a34a', borderColor: regionActive ? '#99f6e4' : '#bbf7d0', gap: 6 }}
            >
                <IcExcel />
                Xuất Excel
                {regionActive && (
                    <span style={{ background: '#0f766e', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                        {regionCount}
                    </span>
                )}
                <IcChevron />
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
                             Đang lọc theo khu vực
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
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
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
};

// ── Search Box ────────────────────────────────────────────────
const SearchBox = ({ devices, cruiseByImei, onSelect, isEn }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const wrapRef = useRef(null);

    const fuse = useMemo(() => new Fuse(devices, {
        keys: [
            { name: 'license_plate', weight: 2 },
            { name: 'imei',          weight: 1 },
            { name: 'driver',        weight: 1 },
        ],
        threshold: 0.35,
        includeScore: true,
        minMatchCharLength: 1,
    }), [devices]);

    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        return fuse.search(q).slice(0, 8).map(r => r.item);
    }, [fuse, query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = useCallback((device) => {
        setQuery(device.license_plate || device.imei || '');
        setOpen(false);
        onSelect(device);
    }, [onSelect]);

    const handleClear = () => {
        setQuery('');
        setOpen(false);
        onSelect(null);
    };

    const placeholder = isEn ? 'Search plate / IMEI / driver…' : 'Tìm biển số / IMEI / lái xe…';
    const hasResults = results.length > 0;

    return (
        <div ref={wrapRef} className="ov-search-box-wrap" style={{ position: 'relative' }}>
            {/* Input */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: focused ? '#fff' : '#f8fafc',
                border: `1.5px solid ${focused ? '#1677ff' : '#e2e8f0'}`,
                borderRadius: 9,
                padding: '6px 10px',
                transition: 'border-color .15s, background .15s, box-shadow .15s',
                boxShadow: focused ? '0 0 0 3px rgba(22,119,255,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}>
                {/* Search icon */}
                <SearchOutlined style={{
                    fontSize: 13,
                    color: focused ? '#1677ff' : '#94a3b8',
                    flexShrink: 0,
                    transition: 'color .15s',
                }} />
                <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => { setFocused(true); if (query.trim()) setOpen(true); }}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: 12.5, color: '#1e293b', width: '100%', fontFamily: 'inherit',
                    }}
                />
                {/* Clear button */}
                {query && (
                    <button onClick={handleClear} style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                        color: '#94a3b8', lineHeight: 1,
                    }}>
                        <CloseOutlined style={{ fontSize: 12 }} />
                    </button>
                )}
            </div>

            {/* Dropdown results */}
            {open && hasResults && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                    background: '#fff', borderRadius: 10, zIndex: 2000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    maxHeight: 320, overflowY: 'auto',
                }}>
                    {results.map((d, i) => {
                        const cruise = cruiseByImei[d.imei];
                        const online = isOnline(cruise);
                        const hasGps = !!(cruise?.lat && cruise?.lon);
                        return (
                            <div
                                key={d._id || d.imei}
                                onMouseDown={() => handleSelect(d)}
                                style={{
                                    padding: '9px 14px',
                                    borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    transition: 'background .1s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                                {/* Status dot */}
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: online ? '#22c55e' : '#ef4444',
                                    boxShadow: online ? '0 0 0 2px rgba(34,197,94,0.2)' : '0 0 0 2px rgba(239,68,68,0.2)',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                        {d.license_plate || d.imei}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                                        {d.driver ? `${d.driver} · ` : ''}{d.imei}
                                    </div>
                                </div>
                                {/* GPS badge */}
                                {hasGps ? (
                                    <div style={{
                                        fontSize: 10, fontWeight: 600, padding: '2px 7px',
                                        borderRadius: 20, background: '#eff6ff',
                                        color: '#3b82f6', border: '1px solid #bfdbfe',
                                        flexShrink: 0, whiteSpace: 'nowrap',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        <EnvironmentOutlined style={{ fontSize: 10 }} /> GPS
                                    </div>
                                ) : (
                                    <div style={{
                                        fontSize: 10, fontWeight: 600, padding: '2px 7px',
                                        borderRadius: 20, background: '#f8fafc',
                                        color: '#94a3b8', border: '1px solid #e2e8f0',
                                        flexShrink: 0, whiteSpace: 'nowrap',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        <StopOutlined style={{ fontSize: 10 }} /> No GPS
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* No result */}
            {open && query.trim() && !hasResults && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                    background: '#fff', borderRadius: 10, zIndex: 2000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    border: '1px solid #e2e8f0',
                    padding: '16px 14px',
                    textAlign: 'center', fontSize: 12.5, color: '#94a3b8',
                }}>
                    {isEn ? 'No devices found' : 'Không tìm thấy thiết bị'}
                </div>
            )}
        </div>
    );
};

// ── Stat Card ────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, accentColor, loading: cardLoading, onClick, active }) => (
    <div
        className="ov-stat-card"
        onClick={onClick}
        style={{
            cursor: onClick ? 'pointer' : 'default',
            outline: active ? `2px solid ${accentColor}` : '2px solid transparent',
            outlineOffset: -2,
        }}
    >
        <div className="ov-stat-accent" style={{ background: accentColor }} />
        {active && (
            <div style={{
                position: 'absolute', inset: 0,
                background: accentColor + '0D',
                borderRadius: 14,
                pointerEvents: 'none',
            }} />
        )}
        <div className="ov-stat-body">
            <div className="ov-stat-label">{label}</div>
            {cardLoading ? (
                <Skeleton active paragraph={false} title={{ width: 60 }} />
            ) : (
                <>
                    <div className="ov-stat-value" style={{ color: accentColor }}>{value}</div>
                    {sub && <div className="ov-stat-sub">{sub}</div>}
                </>
            )}
        </div>
        <div className="ov-stat-icon" style={{ color: accentColor, background: accentColor + '18' }}>
            {icon}
        </div>
        {onClick && !cardLoading && (
            <div style={{
                position: 'absolute', bottom: 8, right: 12,
                fontSize: 10, color: accentColor + 'bb', fontWeight: 500,
            }}>
                {active ? '✕ Bỏ lọc' : 'Xem trên bản đồ →'}
            </div>
        )}
    </div>
);

// ── Main page ─────────────────────────────────────────────────
const OverviewPage = () => {
    const [devices, setDevices]           = useState([]);
    const [cruiseByImei, setCruiseByImei] = useState({});
    const [loading, setLoading]           = useState(true);
    const [isEn, setIsEn]                 = useState(false);
    const [lastUpdated, setLastUpdated]   = useState(null);
    const [refreshing, setRefreshing]     = useState(false);
    const [mapFilter, setMapFilter]       = useState('all'); // 'all' | 'online' | 'offline'
    const [highlightDevice, setHighlightDevice] = useState(null);
    const [provinces, setProvinces]       = useState([]);   // esgoo province list
    const [regionFilter, setRegionFilter] = useState(null); // applied region filter
    const [mapHeight, setMapHeight]       = useState(640);  // responsive map height

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsEn(localStorage.getItem('iky_lang') === 'en');
        }
    }, []);

    // Responsive map height
    useEffect(() => {
        const updateHeight = () => {
            const w = window.innerWidth;
            setMapHeight(w < 560 ? 340 : w < 768 ? 460 : 640);
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const fetchAll = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const token =
                typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

            // ✅ Fetch song song thay vì tuần tự — giảm ~50% thời gian chờ
            const [devRes, cruiseRes] = await Promise.all([
                getDevices({ limit: 200000 }),
                api.get('last-cruise-list', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const devList   = devRes?.devices || [];
            const cruiseList = cruiseRes?.data?.data || [];


            const byImei = {};
            cruiseList.forEach((c) => {
                if (c.dev) byImei[c.dev] = c;
            });

            setDevices(devList);
            setCruiseByImei(byImei);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Overview fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAllRef = useRef(fetchAll);
    useEffect(() => { fetchAllRef.current = fetchAll; });

    // Fetch lần đầu khi mount
    useEffect(() => { fetchAll(); }, []);

    // Fetch provinces (cached once — dùng chung cho RegionFilterPanel + map filter)
    useEffect(() => {
        fetch(PROVINCE_API).then(r => r.json()).then(d => setProvinces(d.data || [])).catch(console.error);
    }, []);

    // Auto-refresh mỗi 5 phút (silent — không hiện loading toàn trang)
    const AUTO_REFRESH_MS = 5 * 60 * 1000;
    useEffect(() => {
        const id = setInterval(() => {
            fetchAllRef.current(true);
        }, AUTO_REFRESH_MS);
        return () => clearInterval(id);
    }, []);

    const totalDevices = devices.length;
    const onlineDevices = useMemo(
        () => devices.filter((d) => isOnline(cruiseByImei[d.imei])).length,
        [devices, cruiseByImei],
    );
    const offlineDevices = totalDevices - onlineDevices;
    const expiringSoon   = useMemo(() => devices.filter(isExpiringSoon).length, [devices]);

    // Devices shown on map based on online/offline filter
    const filteredDevices = useMemo(() => {
        if (mapFilter === 'online')  return devices.filter((d) => isOnline(cruiseByImei[d.imei]));
        if (mapFilter === 'offline') return devices.filter((d) => !isOnline(cruiseByImei[d.imei]));
        return devices;
    }, [devices, cruiseByImei, mapFilter]);

    // Devices filtered further by selected region (province + district level)
    const regionFilteredDevices = useMemo(() => {
        if (!regionFilter || !regionFilter.checkedProvs.size || !provinces.length) return filteredDevices;
        return filteredDevices.filter(d => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            // Step 1: province filter
            const nearest = _findNearest(cruise.lat, cruise.lon, provinces);
            if (!nearest || !regionFilter.checkedProvs.has(nearest.id)) return false;
            // Step 2: district filter (if specific districts selected for this province)
            const provId = nearest.id;
            const selectedDists = regionFilter.checkedDists?.[provId];
            if (!selectedDists || selectedDists.size === 0) return true; // no district filter → keep
            const distList = regionFilter.districtCache?.[provId];
            if (!distList?.length) return true; // no district data → keep
            const nearestDist = _findNearest(cruise.lat, cruise.lon, distList);
            return nearestDist && selectedDists.has(nearestDist.id);
        });
    }, [filteredDevices, regionFilter, provinces, cruiseByImei]);


    const toggleFilter = (mode) => setMapFilter((cur) => cur === mode ? 'all' : mode);

    // Khi region filter active → ExcelDropdown cũng xuất theo khu vực đã chọn
    const handleExport = (mode) => exportOverviewExcel({
        devices: regionFilter ? regionFilteredDevices : devices,
        cruiseByImei,
        mode,
    });

    const t = (vi, en) => (isEn ? en : vi);

    const formatLastUpdated = () => {
        if (!lastUpdated) return '';
        return lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="ov-page">
            <style>{`
                @keyframes ov-spin { to { transform: rotate(360deg); } }

                .ov-page {
                    padding: 22px 26px 32px;
                    background: #f4f6fb;
                    min-height: calc(100vh - 100px);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
                }
                @media (max-width: 768px) {
                    .ov-page { padding: 14px 14px 24px; }
                }

                /* ── Header ─────────────────── */
                .ov-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    gap: 12px;
                }
                @media (max-width: 768px) {
                    .ov-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                        margin-bottom: 14px;
                    }
                }
                .ov-title-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .ov-title-icon {
                    width: 36px; height: 36px;
                    border-radius: 10px;
                    background: linear-gradient(135deg,#1677ff,#4096ff);
                    display: flex; align-items: center; justify-content: center;
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(22,119,255,0.3);
                    flex-shrink: 0;
                }
                .ov-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #0f172a;
                    letter-spacing: -.2px;
                }
                .ov-subtitle {
                    font-size: 11.5px;
                    color: #94a3b8;
                    margin-top: 2px;
                    font-weight: 400;
                }

                /* ── Refresh button ─────────── */
                .ov-refresh-btn {
                    display: flex; align-items: center; gap: 7px;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 9px;
                    padding: 7px 16px;
                    font-size: 12.5px;
                    color: #334155;
                    cursor: pointer;
                    font-weight: 500;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                    transition: background .15s, box-shadow .15s, transform .1s;
                    white-space: nowrap;
                }
                .ov-refresh-btn:hover:not(:disabled) {
                    background: #f8fafc;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .ov-refresh-btn:active:not(:disabled) { transform: scale(0.97); }
                .ov-refresh-btn:disabled { opacity: .6; cursor: not-allowed; }

                /* ── Stats grid ─────────────── */
                .ov-stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 14px;
                    margin-bottom: 18px;
                }
                @media (max-width: 1024px) { .ov-stats-row { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
                @media (max-width: 560px)  { .ov-stats-row { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; } }
                @media (max-width: 380px)  { .ov-stats-row { grid-template-columns: 1fr; gap: 8px; } }

                /* ── Header actions ─────────── */
                .ov-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                @media (max-width: 768px) {
                    .ov-header-actions {
                        justify-content: flex-start;
                        gap: 6px;
                        width: 100%;
                    }
                    .ov-header-actions > * {
                        flex: 1 !important;
                        min-width: 0 !important;
                    }
                    .ov-header-actions .ov-refresh-btn {
                        width: 100% !important;
                        justify-content: center;
                        font-size: 12px;
                        padding: 7px 10px;
                    }
                }

                /* ── Search Box responsive ── */
                .ov-search-box-wrap {
                    width: 260px;
                    flex-shrink: 0;
                }
                @media (max-width: 560px) {
                    .ov-search-box-wrap {
                        width: 100% !important;
                        margin-top: 4px;
                    }
                }

                /* ── Region Panel bottom sheet ── */
                .ov-region-panel {
                    position: absolute;
                    top: calc(100% + 6px);
                    right: 0;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 36px rgba(0,0,0,0.16);
                    z-index: 9999;
                    width: 500px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .ov-region-body {
                    display: flex;
                    height: 320px;
                }
                .ov-region-left {
                    width: 220px;
                    border-right: 1px solid #f1f5f9;
                    display: flex;
                    flex-direction: column;
                }
                .ov-region-footer {
                    padding: 10px 15px;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #f8fafc;
                    flex-shrink: 0;
                }
                @media (max-width: 560px) {
                    .ov-region-panel {
                        position: fixed !important;
                        top: auto !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        height: 70vh !important;
                        max-height: 500px !important;
                        border-radius: 16px 16px 0 0 !important;
                        border: none !important;
                        box-shadow: 0 -4px 24px rgba(0,0,0,0.15) !important;
                        z-index: 99999 !important;
                    }
                    .ov-region-body {
                        flex: 1 !important;
                        height: auto !important;
                        min-height: 0 !important;
                    }
                    .ov-region-left {
                        width: 45% !important;
                        min-width: 140px !important;
                    }
                    .ov-region-footer {
                        padding: 12px 14px 20px !important;
                        flex-wrap: wrap !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                    }
                    .ov-region-footer-label {
                        width: 100% !important;
                        margin-bottom: 2px !important;
                        font-size: 11px !important;
                    }
                    .ov-region-footer-btn {
                        flex: 1 !important;
                        justify-content: center !important;
                        min-width: 0 !important;
                    }
                }

                .ov-stat-card {
                    background: #fff;
                    border-radius: 14px;
                    padding: 18px 20px 28px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
                    border: 1px solid rgba(0,0,0,0.045);
                    position: relative;
                    overflow: hidden;
                    transition: transform .18s, box-shadow .18s, outline .15s;
                }
                .ov-stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
                }
                @media (max-width: 560px) {
                    .ov-stat-card {
                        padding: 14px 14px 22px;
                        gap: 12px;
                        border-radius: 12px;
                    }
                    .ov-stat-value { font-size: 24px !important; }
                    .ov-stat-icon { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
                }
                .ov-stat-accent {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    border-radius: 14px 14px 0 0;
                }
                .ov-stat-body { flex: 1; min-width: 0; }
                .ov-stat-label {
                    font-size: 10.5px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: .7px;
                    font-weight: 600;
                    margin-bottom: 6px;
                    white-space: nowrap;
                }
                .ov-stat-value {
                    font-size: 30px;
                    font-weight: 800;
                    line-height: 1;
                    margin-bottom: 4px;
                    letter-spacing: -.5px;
                }
                .ov-stat-sub {
                    font-size: 11px;
                    color: #b0bec5;
                    white-space: nowrap;
                }
                .ov-stat-icon {
                    width: 46px; height: 46px;
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }

                /* ── Map card ───────────────── */
                .ov-map-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 18px 20px 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
                    border: 1px solid rgba(0,0,0,0.045);
                }
                @media (max-width: 768px) {
                    .ov-map-card { padding: 14px 12px 14px; border-radius: 12px; }
                }
                .ov-map-card-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 14px;
                    flex-wrap: wrap;
                    row-gap: 8px;
                }
                @media (max-width: 768px) {
                    .ov-map-card-header { margin-bottom: 10px; }
                    .ov-map-hint { display: none; }
                }
                .ov-map-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                    white-space: nowrap;
                }
                .ov-map-hint {
                    margin-left: auto;
                    font-size: 11px;
                    color: #94a3b8;
                    font-weight: 400;
                    background: #f1f5f9;
                    padding: 3px 11px;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                }
                .ov-map-icon-wrap {
                    width: 28px; height: 28px;
                    border-radius: 8px;
                    background: linear-gradient(135deg,#0f766e,#14b8a6);
                    display: flex; align-items: center; justify-content: center;
                    color: #fff;
                    box-shadow: 0 2px 8px rgba(20,184,166,0.3);
                    flex-shrink: 0;
                }
            `}</style>

            {/* Header */}
            <div className="ov-header">
                <div>
                    <div className="ov-title-row">
                        <div className="ov-title-icon">
                            <IcGrid />
                        </div>
                        <div>
                            <div className="ov-title">{t('Tổng quan hệ thống', 'System Overview')}</div>
                            {lastUpdated && (
                                <div className="ov-subtitle">
                                    {t('Cập nhật lúc', 'Updated at')} {formatLastUpdated()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="ov-header-actions">
                    <RegionFilterPanel
                        provinces={provinces}
                        devices={devices}
                        cruiseByImei={cruiseByImei}
                        onApply={setRegionFilter}
                        disabled={loading || devices.length === 0}
                    />
                    <ExcelDropdown
                        onExport={handleExport}
                        disabled={loading || devices.length === 0}
                        regionActive={!!regionFilter}
                        regionCount={regionFilteredDevices.length}
                    />
                    <button
                        className="ov-refresh-btn"
                        onClick={() => fetchAll(true)}
                        disabled={refreshing || loading}
                    >
                        <IcRefresh spinning={refreshing} />
                        {t('Làm mới', 'Refresh')}
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="ov-stats-row">
                <StatCard
                    icon={<IcTotal />}
                    label={t('Tổng thiết bị', 'Total Devices')}
                    value={loading ? '—' : totalDevices.toLocaleString()}
                    accentColor="#1677ff"
                    loading={loading}
                    onClick={() => setMapFilter('all')}
                    active={mapFilter === 'all'}
                />
                <StatCard
                    icon={<IcWifiOn />}
                    label={t('Thiết bị Online', 'Devices Online')}
                    value={loading ? '—' : onlineDevices.toLocaleString()}
                    sub={t('Cập nhật trong 24h', 'Updated < 24h')}
                    accentColor="#16a34a"
                    loading={loading}
                    onClick={() => setMapFilter((c) => c === 'online' ? 'all' : 'online')}
                    active={mapFilter === 'online'}
                />
                <StatCard
                    icon={<IcWifiOff />}
                    label={t('Thiết bị Offline', 'Devices Offline')}
                    value={loading ? '—' : offlineDevices.toLocaleString()}
                    sub={t('Không cập nhật 24h', 'No update > 24h')}
                    accentColor="#dc2626"
                    loading={loading}
                    onClick={() => setMapFilter((c) => c === 'offline' ? 'all' : 'offline')}
                    active={mapFilter === 'offline'}
                />
                <StatCard
                    icon={<IcClock />}
                    label={t('Sắp hết hạn', 'Expiring Soon')}
                    value={loading ? '—' : expiringSoon.toLocaleString()}
                    sub={t('Trong vòng 7 ngày', 'Within 7 days')}
                    accentColor={expiringSoon > 0 ? '#ea580c' : '#94a3b8'}
                    loading={loading}
                />
            </div>

            {/* Map card */}
            <div className="ov-map-card">
                <div className="ov-map-card-header">
                    <div className="ov-map-icon-wrap">
                        <IcMap />
                    </div>
                    <span className="ov-map-title">{t('Bản đồ thiết bị', 'Device Map')}</span>

                    {/* Search box */}
                    {!loading && devices.length > 0 && (
                        <div className="ov-map-search-wrap">
                            <SearchBox
                                devices={devices}
                                cruiseByImei={cruiseByImei}
                                onSelect={(device) => setHighlightDevice(device ? { ...device, _ts: Date.now() } : null)}
                                isEn={isEn}
                            />
                        </div>
                    )}

                    {/* Active filter badge */}
                    {mapFilter !== 'all' && !loading && (
                        <span style={{
                            marginLeft: 'auto',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: mapFilter === 'online' ? '#dcfce7' : '#fee2e2',
                            color: mapFilter === 'online' ? '#166534' : '#991b1b',
                            border: `1px solid ${mapFilter === 'online' ? '#86efac' : '#fca5a5'}`,
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: mapFilter === 'online' ? '#16a34a' : '#dc2626',
                            }} />
                            Đang lọc: {mapFilter === 'online'
                                ? `${onlineDevices} Online`
                                : `${offlineDevices} Offline`}
                            <button
                                onClick={() => setMapFilter('all')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 13, color: 'inherit', fontWeight: 700, lineHeight: 1 }}
                            >✕</button>
                        </span>
                    )}

                    {!loading && mapFilter === 'all' && (
                        <span className="ov-map-hint" style={{ marginLeft: 'auto' }}>
                            {t('Click cụm → quận/huyện → xe', 'Click cluster → district → device')}
                        </span>
                    )}
                </div>

                {loading ? (
                    <Skeleton active paragraph={{ rows: 14 }} />
                ) : devices.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 20px',
                        color: '#94a3b8',
                        fontSize: 14,
                    }}>
                        <div style={{ marginBottom: 12, opacity: .4 }}>
                            <IcMap />
                        </div>
                        {t('Chưa có dữ liệu thiết bị', 'No device data')}
                    </div>
                ) : (
                    <VietnamMapDrillDown
                        devices={regionFilteredDevices}
                        cruiseByImei={cruiseByImei}
                        loading={false}
                        height={mapHeight}
                        forceAllDevices={mapFilter !== 'all' || !!regionFilter}
                        highlightDevice={highlightDevice}
                    />
                )}
            </div>
        </div>
    );
};

export default OverviewPage;
