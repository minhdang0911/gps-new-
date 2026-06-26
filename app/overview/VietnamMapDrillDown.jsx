'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as turf from '@turf/turf';

// ✅ Module-level GeoJSON cache — dữ liệu tĩnh, không bao giờ thay đổi → cache suốt session
let _geoJsonCache = null;
let _vnBoundsCache = null;

// ============================================================
// CONSTANTS — esgoo API for province/district centroids
// ============================================================
const PROVINCE_API = 'https://esgoo.net/api-tinhthanh/1/0.htm';
const DISTRICT_API = (provinceId) => `https://esgoo.net/api-tinhthanh/2/${provinceId}.htm`;

// Haversine distance (km)
const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findNearest = (lat, lon, list) => {
    let best = null,
        bestDist = Infinity;
    for (const item of list) {
        const d = haversine(lat, lon, parseFloat(item.latitude), parseFloat(item.longitude));
        if (d < bestDist) {
            bestDist = d;
            best = item;
        }
    }
    return best;
};

// ============================================================
// HELPERS
// ============================================================
const isOnline = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('vi-VN');
};

// Compact cluster SVG
const clusterSvg = (count, online, total, type) => {
    const cfg = type === 'province' ? { bg: '#1d4ed8', border: '#93c5fd' } : { bg: '#7c3aed', border: '#c4b5fd' };
    const size = Math.max(26, Math.min(38, 26 + Math.log10(count + 1) * 8));
    const r = size / 2;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${cfg.bg}" stroke="${cfg.border}" stroke-width="2" opacity="0.93"/>
    <text x="${r}" y="${r + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(9, size * 0.32)}px" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${count}</text>
  </svg>`;
};

const getDistrictName = (district) => {
    return `${district.properties.loai} ${district.properties.ten_huyen}`;
};

// ============================================================
// DEVICE POPUP
// ============================================================
const DevicePopup = ({ device, cruise, onClose }) => {
    const online = isOnline(cruise);
    const color = online ? '#22c55e' : '#ef4444';
    return (
        <div
            className="ov-device-popup"
            style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 295,
                zIndex: 1000,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                border: '1px solid #e5e7eb',
                fontFamily: 'system-ui,-apple-system,sans-serif',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    padding: '10px 14px',
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#fff',
                            flexShrink: 0,
                        }}
                    />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                        {device.license_plate || device.imei}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                        style={{
                            background: 'rgba(255,255,255,0.25)',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 9,
                        }}
                    >
                        {online ? 'Online' : 'Offline'}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            fontSize: 17,
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: '0 2px',
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>
            <div style={{ padding: '10px 14px' }}>
                {!cruise ? (
                    <div
                        style={{
                            color: '#9ca3af',
                            fontSize: 12,
                            textAlign: 'center',
                            padding: '12px 0',
                        }}
                    >
                        Chưa có dữ liệu hành trình
                    </div>
                ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        {[
                            ['IMEI', device.imei],
                            ['Lái xe', device.driver || '—'],
                            ['Loại xe', device.vehicle_category_id?.name || '—'],
                            [
                                'Tọa độ',
                                cruise.lat && cruise.lon ? `${cruise.lat.toFixed(5)}, ${cruise.lon.toFixed(5)}` : '—',
                            ],
                            ['Tốc độ', cruise.spd != null ? `${cruise.spd} km/h` : '—'],
                            ['ODO', cruise.mil != null ? `${cruise.mil.toLocaleString()} km` : '—'],
                            ['ACC', cruise.acc === 1 ? 'Tắt máy' : 'Mở máy'],
                            ['Cập nhật', formatDateTime(cruise.updatedAt || cruise.createdAt)],
                        ].map(([k, v]) => (
                            <tr key={k}>
                                <td style={{ color: '#6b7280', padding: '3px 0', width: 80 }}>{k}</td>
                                <td style={{ color: '#111827', fontWeight: 500 }}>{v}</td>
                            </tr>
                        ))}
                    </table>
                )}
            </div>
        </div>
    );
};

// ============================================================
// BREADCRUMB
// ============================================================
// SVG Icons — inline, không cần import
const IconMap = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="6" x2="15" y2="18"/>
    </svg>
);
const IconInfo = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
);
const IconChevron = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
    </svg>
);
const IconHome = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
);
const IconReset = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
    </svg>
);

// ── Custom Zoom Control ────────────────────────────────────────
const ZoomControl = ({ mapRef }) => {
    const [zoom, setZoom] = useState(null);
    const [minZoom, setMinZoom] = useState(4);
    const [maxZoom, setMaxZoom] = useState(18);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const update = () => setZoom(map.getZoom());
        map.on('zoomend', update);
        setZoom(map.getZoom());
        setMinZoom(map.getMinZoom());
        setMaxZoom(map.getMaxZoom());
        return () => { map.off('zoomend', update); };
    }, [mapRef.current]);

    const btnBase = {
        width: 32, height: 32,
        border: 'none',
        background: 'rgba(15,23,42,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: '#e2e8f0',
        fontSize: 18,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background .15s, color .15s',
        outline: 'none',
        lineHeight: 1,
    };

    return (
        <div style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.12)',
        }}>
            {/* Zoom In */}
            <button
                title="Phóng to (zoom in)"
                disabled={zoom >= maxZoom}
                style={{
                    ...btnBase,
                    borderRadius: '10px 10px 0 0',
                    opacity: zoom >= maxZoom ? 0.4 : 1,
                    color: zoom >= maxZoom ? '#64748b' : '#93c5fd',
                }}
                onMouseEnter={e => { if (zoom < maxZoom) e.currentTarget.style.background = 'rgba(37,99,235,0.85)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.82)'; }}
                onClick={() => mapRef.current?.zoomIn()}
            >
                +
            </button>

            {/* Zoom level badge */}
            <div style={{
                width: 32,
                height: 26,
                background: 'rgba(15,23,42,0.72)',
                color: '#94a3b8',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui,monospace',
                letterSpacing: '0.3px',
            }}>
                {zoom != null ? `z${zoom}` : '—'}
            </div>

            {/* Zoom Out */}
            <button
                title="Thu nhỏ (zoom out)"
                disabled={zoom <= minZoom}
                style={{
                    ...btnBase,
                    borderRadius: '0 0 10px 10px',
                    opacity: zoom <= minZoom ? 0.4 : 1,
                    color: zoom <= minZoom ? '#64748b' : '#93c5fd',
                }}
                onMouseEnter={e => { if (zoom > minZoom) e.currentTarget.style.background = 'rgba(37,99,235,0.85)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.82)'; }}
                onClick={() => mapRef.current?.zoomOut()}
            >
                −
            </button>
        </div>
    );
};

// ── Reset View Button ──────────────────────────────────────────
const ResetViewBtn = ({ onClick }) => (
    <button
        title="Về toàn quốc"
        onClick={onClick}
        style={{
            position: 'absolute',
            right: 14,
            top: 'calc(50% + 68px)',
            zIndex: 1000,
            width: 32,
            height: 32,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            background: 'rgba(15,23,42,0.82)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#a5f3fc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
            outline: 'none',
            transition: 'background .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.75)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.82)'; }}
    >
        <IconReset />
    </button>
);

const Breadcrumb = ({ province, district, onClickRoot, onClickProvince }) => (
    <div
        style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(15,23,42,0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '5px 11px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
            fontSize: 12,
            fontFamily: 'system-ui,sans-serif',
            border: '1px solid rgba(255,255,255,0.1)',
        }}
    >
        <button
            onClick={onClickRoot}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: province ? '#93c5fd' : '#e2e8f0',
                fontWeight: province ? 500 : 700,
                padding: 0,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
            }}
        >
            <span style={{ color: province ? '#93c5fd' : '#60a5fa' }}><IconMap /></span>
            Việt Nam
        </button>

        {province && (
            <>
                <IconChevron />
                <button
                    onClick={onClickProvince}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: district ? '#93c5fd' : '#e2e8f0',
                        fontWeight: district ? 500 : 700,
                        padding: 0,
                        fontSize: 12,
                    }}
                >
                    {province.full_name}
                </button>
            </>
        )}

        {district && (
            <>
                <IconChevron />
                <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{getDistrictName(district)}</span>
            </>
        )}
    </div>
);

// ============================================================
// LEGEND
// ============================================================
const Legend = ({ level, isMobile }) => (
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
            <div style={{ marginBottom: 5, fontWeight: 600, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {level === 'province' && 'Cụm tỉnh'}
                {level === 'district' && 'Cụm quận/huyện'}
                {level === 'device' && 'Thiết bị'}
            </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isMobile ? 0 : 4, flexDirection: isMobile ? 'row' : 'row' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
            {!isMobile && <span style={{ color: '#d1fae5', fontWeight: 500 }}>Online</span>}
            {isMobile && <span style={{ color: '#d1fae5', fontWeight: 500, fontSize: 10 }}>On</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: isMobile ? 2 : 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
            {!isMobile && <span style={{ color: '#fee2e2', fontWeight: 500 }}>Offline</span>}
            {isMobile && <span style={{ color: '#fee2e2', fontWeight: 500, fontSize: 10 }}>Off</span>}
        </div>
    </div>
);

// ============================================================
// ZONE STATS PANEL
// ============================================================
const ZoneStatsPanel = ({ zones, level, onClickZone, selectedId, onGoRoot, provinceName, onGoProvince, isMobile }) => {
    const [collapsed, setCollapsed] = React.useState(false);
    if (!zones || zones.length === 0) return null;

    // On mobile: auto-collapse
    const isCollapsed = isMobile ? true : collapsed;

    const levelLabel =
        level === 'province' ? 'Thống kê theo tỉnh' :
        level === 'district' ? 'Thống kê theo quận/huyện' :
        'Thiết bị trong quận';

    return (
        <div style={{
            position: 'absolute',
            left: 12,
            top: 12,
            zIndex: 1001,
            width: isMobile ? 180 : 236,
            maxHeight: isMobile ? 'calc(100% - 60px)' : 'calc(100% - 80px)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui,sans-serif',
        }}>
            {/* Navigation breadcrumb (district/device level) */}
            {(level === 'district' || level === 'device') && (
                <div style={{
                    background: 'rgba(15,23,42,0.88)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: '10px 10px 0 0',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderBottomColor: 'rgba(255,255,255,0.04)',
                    flexShrink: 0,
                }}>
                    <button onClick={onGoRoot} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#93c5fd', fontWeight: 600, padding: 0, fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        VN
                    </button>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    {level === 'district' ? (
                        <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                            {provinceName}
                        </span>
                    ) : (
                        <>
                            <button onClick={onGoProvince} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#93c5fd', fontWeight: 500, padding: 0, fontSize: 11,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80,
                            }}>{provinceName}</button>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
                                {zones[0] && selectedId
                                    ? (zones.find(z => z.id === selectedId)?.name || 'Quận')
                                    : 'Quận'}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Header */}
            <div
                onClick={() => !isMobile && setCollapsed(!collapsed)}
                style={{
                    background: 'rgba(15,23,42,0.88)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: level === 'province'
                        ? (isCollapsed ? 10 : '10px 10px 0 0')
                        : (isCollapsed ? '0 0 10px 10px' : 0),
                    padding: '7px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isMobile ? 'default' : 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderTop: (level === 'district' || level === 'device') ? 'none' : '1px solid rgba(255,255,255,0.1)',
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
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"
                            style={{ transition: 'transform .2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    )}
                </div>
            </div>

            {/* Body */}
            {!isCollapsed && (
                <div style={{
                    background: 'rgba(15,23,42,0.82)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: '0 0 10px 10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderTop: 'none',
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                }}>
                    {/* Column headers */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 36px 40px 36px',
                        gap: 0,
                        padding: '5px 10px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        position: 'sticky', top: 0,
                        background: 'rgba(15,23,42,0.95)',
                    }}>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vùng</span>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right' }}>Tổng</span>
                        <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textAlign: 'right' }}>● Onl</span>
                        <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, textAlign: 'right' }}>● Off</span>
                    </div>

                    {/* Zone rows */}
                    {zones.map((z) => {
                        const onlinePct = z.total > 0 ? (z.online / z.total) * 100 : 0;
                        const isSelected = z.id === selectedId;
                        return (
                            <div
                                key={z.id}
                                onClick={() => onClickZone && onClickZone(z)}
                                style={{
                                    padding: '6px 10px 5px',
                                    cursor: onClickZone ? 'pointer' : 'default',
                                    background: isSelected ? 'rgba(37,99,235,0.22)' : 'transparent',
                                    borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                                    transition: 'background .12s',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Name + numbers */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 36px 40px 36px',
                                    alignItems: 'center',
                                    gap: 0,
                                    marginBottom: 4,
                                }}>
                                    <span style={{
                                        fontSize: 11,
                                        color: isSelected ? '#93c5fd' : '#cbd5e1',
                                        fontWeight: isSelected ? 700 : 500,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        paddingRight: 4,
                                    }} title={z.name}>
                                        {z.name}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, textAlign: 'right' }}>{z.total}</span>
                                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, textAlign: 'right' }}>{z.online}</span>
                                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textAlign: 'right' }}>{z.offline}</span>
                                </div>

                                {/* Progress bar */}
                                <div style={{
                                    height: 3,
                                    borderRadius: 3,
                                    background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                        width: `${onlinePct}%`,
                                        background: 'linear-gradient(90deg,#166534,#4ade80)',
                                        borderRadius: 3,
                                    }} />
                                    <div style={{
                                        position: 'absolute', top: 0, bottom: 0,
                                        left: `${onlinePct}%`, right: 0,
                                        background: 'rgba(239,68,68,0.38)',
                                        borderRadius: '0 3px 3px 0',
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================================
// DISTRICT LIST PANEL
// ============================================================
const DistrictListPanel = ({ zones, selectedDistrictId, onClickZone, mapRef }) => {
    const [open, setOpen] = React.useState(true);
    if (!zones || zones.length === 0) return null;

    return (
        <div style={{
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
        }}>
            {/* Header toggle */}
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"
                    style={{ transition: 'transform .15s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>

            {/* List body */}
            {open && (
                <div style={{
                    background: 'rgba(15,23,42,0.82)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: '0 0 8px 8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderTop: 'none',
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                }}>
                    {/* Column labels */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 32px 32px 32px',
                        padding: '4px 8px 3px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        position: 'sticky', top: 0,
                        background: 'rgba(15,23,42,0.98)',
                    }}>
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
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px', alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{
                                        fontSize: 11,
                                        color: isActive ? '#93c5fd' : '#cbd5e1',
                                        fontWeight: isActive ? 700 : 500,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 4,
                                    }} title={z.name}>{z.name}</span>
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
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const VietnamMapDrillDown = ({ devices = [], cruiseByImei = {}, loading = false, height = 580, forceAllDevices = false }) => {
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);
    const markersLayerRef = useRef(null);
    const labelsLayerRef = useRef(null); // province name labels
    const geoLayerRef = useRef(null); // province outline (vn_geo.json)
    const districtLayerRef = useRef(null); // district outlines (diaphanhuyen.geojson, visual only)
    const tileLayerRef = useRef(null); // OSM tile layer — chỉ bật ở level district/device

    const [L, setL] = useState(null);
    const [provinces, setProvinces] = useState([]);
    const [level, setLevel] = useState('province');
    const [selectedProvince, setSelectedProvince] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [districts, setDistricts] = useState([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [districtGeoJson, setDistrictGeoJson] = useState(null);

    const [popupDevice, setPopupDevice] = useState(null);
    const [popupCruise, setPopupCruise] = useState(null);
    const [zoneStats, setZoneStats] = useState([]); // [{id,name,total,online,offline,lat,lon}]
    const [containerWidth, setContainerWidth] = useState(800);
    const isMobile = containerWidth < 480;

    // ── Init Leaflet ─────────────────────────────────────────
    useEffect(() => {
        const container = mapRef.current?.parentElement;
        if (!container) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(container);
        setContainerWidth(container.offsetWidth);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            if (leafletMapRef.current || !mapRef.current) return;
            const Lf = (await import('leaflet')).default;
            await import('leaflet/dist/leaflet.css');
            if (cancelled || !mapRef.current) return;

            // Reset nếu bị Strict Mode double-init
            if (mapRef.current._leaflet_id) {
                mapRef.current._leaflet_id = null;
            }

            const map = Lf.map(mapRef.current, {
                center: [16.5, 107.5],
                zoom: 6,
                minZoom: 4,
                maxZoom: 19,
                zoomControl: false,      // ✅ Dùng custom zoom control thay Leaflet default
                attributionControl: false,
                boxZoom: false,          // ✅ Tắt hộp đen khi kéo (box selection)
                wheelPxPerZoomLevel: 80, // ✅ Zoom mượt hơn với scroll wheel (default 60)
                zoomSnap: 0.5,           // ✅ Cho phép zoom nửa bước để mượt hơn
            });

            // ✅ Auto re-center:
            // 1. Khi zoom về zoom <= 5 (rất rộng) → luôn fitBounds về Việt Nam
            // 2. Khi kéo quá xa đến mức Việt Nam không còn trong viewport → pan về
            let _isRecentering = false; // guard chống infinite loop fitBounds→moveend→fitBounds
            map.on('moveend zoomend', () => {
                if (_isRecentering || !_vnBoundsCache) return;
                const [[s, w], [n, e]] = _vnBoundsCache;
                const vp = map.getBounds();
                const z = map.getZoom();
                // Việt Nam hoàn toàn nằm ngoài viewport — chỉ recenter khi out-of-view
                // KHÔNG recenter khi user đang zoom in (bỏ điều kiện z <= 5)
                const outOfView =
                    vp.getSouth() > n ||
                    vp.getNorth() < s ||
                    vp.getWest()  > e ||
                    vp.getEast()  < w;
                if (outOfView) {
                    _isRecentering = true;
                    map.fitBounds(_vnBoundsCache, { padding: [10, 10], animate: true });
                    setTimeout(() => { _isRecentering = false; }, 600);
                }
            });


            leafletMapRef.current = map;
            markersLayerRef.current = Lf.layerGroup().addTo(map);
            labelsLayerRef.current = Lf.layerGroup().addTo(map);

            // ✅ FIX DRAG: invalidateSize + dragging.enable() sau khi DOM đã render xong
            setTimeout(() => {
                if (!cancelled && map && !map._removed) {
                    map.invalidateSize({ animate: false });
                    map.dragging.enable();
                    map.scrollWheelZoom.enable();
                }
            }, 50);

            // ── OSM Tile layer (ẩn mặc định, hiện khi vào quận/thiết bị) ──
            // Dùng CartoDB Voyager — giao diện hiện đại, tiếng Việt đầy đủ, miễn phí
            const tile = Lf.tileLayer(
                'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                {
                    subdomains: 'abcd',
                    maxZoom: 19,
                    opacity: 0,      // ẩn lúc khởi tạo
                    zIndex: 1,
                }
            ).addTo(map);
            tileLayerRef.current = tile;

            setL(Lf);
        };
        init();
        return () => {
            cancelled = true;
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        // ✅ GeoJSON cache: chỉ fetch 1 lần/session — GeoJSON tỉnh/huyện VN không thay đổi
        if (_geoJsonCache) {
            setDistrictGeoJson(_geoJsonCache);
            return;
        }
        fetch('/geojson/VietNam63.geojson')
            .then((r) => r.json())
            .then((geo) => {
                geo.features.forEach((f) => {
                    f._center = turf.centroid(f);
                });

                // ✅ Tính bounds toàn quốc dùng reduce (an toàn với mảng lớn)
                // Không dùng Math.min(...array) vì sẽ stack-overflow với GeoJSON lớn
                let minLat = Infinity, maxLat = -Infinity;
                let minLon = Infinity, maxLon = -Infinity;
                geo.features.forEach((f) => {
                    const geom = f.geometry;
                    if (!geom) return;
                    const polys = geom.type === 'MultiPolygon'
                        ? geom.coordinates.map((p) => p[0])
                        : [geom.coordinates[0]];
                    polys.forEach((ring) => {
                        if (!ring) return;
                        ring.forEach(([lon, lat]) => {
                            if (lat < minLat) minLat = lat;
                            if (lat > maxLat) maxLat = lat;
                            if (lon < minLon) minLon = lon;
                            if (lon > maxLon) maxLon = lon;
                        });
                    });
                });
                if (isFinite(minLat)) {
                    _vnBoundsCache = [[minLat, minLon], [maxLat, maxLon]];
                }

                _geoJsonCache = geo;
                setDistrictGeoJson(geo);
            })
            .catch(console.error);
    }, []);

    const findDistrictByPoint = (lat, lon, geojson) => {
        if (!geojson?.features?.length) return null;

        const point = turf.point([lon, lat]);

        const normalize = (str = '') =>
            str
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/^tp\.?\s*/i, '')
                .replace(/^thanh pho\s*/i, '')
                .replace(/^tinh\s*/i, '')
                .trim();

        for (const feature of geojson.features) {
            if (!feature?.geometry) continue;

            try {
                const geom = feature.geometry;

                let inside = false;

                if (geom.type === 'Polygon') {
                    inside = turf.booleanPointInPolygon(point, turf.polygon(geom.coordinates));
                } else if (geom.type === 'MultiPolygon') {
                    inside = turf.booleanPointInPolygon(point, turf.multiPolygon(geom.coordinates));
                }

                if (inside) return feature;
            } catch (e) {
                console.warn('GEO ERROR:', e);
            }
        }

        return null;
    };
    // ── Fetch provinces from esgoo ────────────────────────────
    useEffect(() => {
        fetch(PROVINCE_API)
            .then((r) => r.json())
            .then((d) => setProvinces(d.data || []))
            .catch(console.error);
    }, []);

    // ── Draw province GeoJSON outline + province labels ───────
    useEffect(() => {
        if (!L || !leafletMapRef.current) return;
        if (geoLayerRef.current) {
            geoLayerRef.current.remove();
            geoLayerRef.current = null;
        }
        if (labelsLayerRef.current) labelsLayerRef.current.clearLayers();

        fetch('/vn_geo.json')
            .then((r) => r.json())
            .then((geo) => {
                if (!leafletMapRef.current) return;

                geoLayerRef.current = L.geoJSON(geo, {
                    style: { color: '#60a5fa', weight: 1, fillColor: '#dbeafe', fillOpacity: 0.5 },
                    onEachFeature: (feature, layer) => {
                        const name = feature.properties.oldName || feature.properties.name || '';

                        // Hover tooltip (always)
                        layer.bindTooltip(name, {
                            permanent: false,
                            direction: 'center',
                            className: 'vn-prov-hover',
                            sticky: false,
                        });

                        // Permanent label — dùng turf.pointOnFeature để đảm bảo label nằm trong đất liền
                        // (không bị lệch ra biển như getBounds().getCenter() với tỉnh ven biển)
                        let labelLat, labelLng;
                        try {
                            const pt = turf.pointOnFeature(feature);
                            [labelLng, labelLat] = pt.geometry.coordinates;
                        } catch (_) {
                            const c = layer.getBounds().getCenter();
                            labelLat = c.lat; labelLng = c.lng;
                        }
                        const label = L.marker([labelLat, labelLng], {
                            icon: L.divIcon({
                                className: 'vn-prov-label',
                                html: name,
                                iconSize: [130, 16],
                                iconAnchor: [65, 8],
                            }),
                            interactive: false,
                            keyboard: false,
                            zIndexOffset: -1000,
                        });
                        labelsLayerRef.current.addLayer(label);
                    },
                }).addTo(leafletMapRef.current);

                leafletMapRef.current.fitBounds(geoLayerRef.current.getBounds(), {
                    padding: [8, 8],
                    animate: false,
                });

                // Toggle permanent labels theo zoom — hien khi zoom > 6
                const toggleLabels = () => {
                    const z = leafletMapRef.current?.getZoom() ?? 6;
                    document.querySelectorAll('.vn-prov-label').forEach((el) => {
                        el.style.display = z > 6 ? '' : 'none';
                    });
                };
                leafletMapRef.current.on('zoomend', toggleLabels);
                toggleLabels();
            })
            .catch(console.error);
    }, [L]);

    // ── Draw district GeoJSON boundaries (visual only) ────────
    const drawDistrictBoundaries = useCallback(
        (provinceName) => {
            if (!L || !leafletMapRef.current) return;
            if (districtLayerRef.current) {
                districtLayerRef.current.remove();
                districtLayerRef.current = null;
            }
            fetch('/geojson/VietNam63.geojson')
                .then((r) => r.json())
                .then((geo) => {
                    if (!leafletMapRef.current) return;
                    const fc = {
                        type: 'FeatureCollection',
                        features: geo.features.filter((f) => f.properties.Ten_Tinh === provinceName),
                    };
                    if (!fc.features.length) return;
                    districtLayerRef.current = L.geoJSON(fc, {
                        style: {
                            color: '#6d28d9',
                            weight: 2,
                            dashArray: '5 4',
                            fillColor: 'transparent',
                            fillOpacity: 0,
                            opacity: 0.75,
                        },
                        onEachFeature: (feature, layer) => {
                            layer.bindTooltip(`<b>${feature.properties.Ten_Huyen}</b>`, {
                                sticky: true,
                                className: 'vn-district-tip',
                                direction: 'top',
                            });
                        },
                    }).addTo(leafletMapRef.current);
                })
                .catch(console.error);
        },
        [L],
    );

    const clearDistrictBoundaries = useCallback(() => {
        if (districtLayerRef.current) {
            districtLayerRef.current.remove();
            districtLayerRef.current = null;
        }
    }, []);

    // ── Tile layer toggle ─────────────────────────────────────────────
    const showTile = useCallback(() => {
        if (!tileLayerRef.current) return;
        tileLayerRef.current.setOpacity(1);
        // Ẩn GeoJSON province outline — tile đã có ranh giới rồi
        if (geoLayerRef.current) geoLayerRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
        // Ẩn province name labels
        if (labelsLayerRef.current) labelsLayerRef.current.eachLayer((l) => { if (l._icon) l._icon.style.display = 'none'; });
    }, []);

    const hideTile = useCallback(() => {
        if (!tileLayerRef.current) return;
        tileLayerRef.current.setOpacity(0);
        // Hiện lại GeoJSON province outline
        if (geoLayerRef.current) geoLayerRef.current.setStyle({ color: '#60a5fa', weight: 1, fillColor: '#dbeafe', fillOpacity: 0.5, opacity: 1 });
        if (labelsLayerRef.current) labelsLayerRef.current.eachLayer((l) => { if (l._icon) l._icon.style.display = ''; });
    }, []);

    // ── Grouping helpers (haversine) — dùng useMemo để cache kết quả ──────────────────────────
    // groupByProvince: tính 1 lần mỗi khi provinces/devices/cruiseByImei thay đổi
    const provinceGroups = useMemo(() => {
        if (!provinces.length || !devices.length) return {};
        const groups = {};
        for (const d of devices) {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) continue;
            const prov = findNearest(cruise.lat, cruise.lon, provinces);
            if (!prov) continue;
            const key = prov.id;
            if (!groups[key]) groups[key] = { province: prov, items: [] };
            groups[key].items.push({ device: d, cruise });
        }
        return groups;
    }, [provinces, devices, cruiseByImei]);

    // groupByDistrict: tính lại khi province/district/cruiseByImei thay đổi
    const districtGroups = useMemo(() => {
        if (!districts.length || !devices.length || !selectedProvince) return {};
        const provinceDevices = devices.filter((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            const prov = findNearest(cruise.lat, cruise.lon, provinces);
            return prov?.id === selectedProvince?.id;
        });
        const groups = {};
        for (const d of provinceDevices) {
            const cruise = cruiseByImei[d.imei];

            const districtFeature = findDistrictByPoint(
                cruise.lat,
                cruise.lon,
                districtGeoJson,
                selectedProvince.full_name,
            );

            if (!districtFeature) {
                console.log('NOT FOUND', selectedProvince.full_name, cruise.lat, cruise.lon);
                continue;
            }
            const key = districtFeature.properties.ma_huyen;

            if (!groups[key]) {
                groups[key] = {
                    district: districtFeature,
                    items: [],
                };
            }

            groups[key].items.push({
                device: d,
                cruise,
            });
        }
        return groups;
    }, [districts, devices, cruiseByImei, provinces, selectedProvince, districtGeoJson]);

    const getDistrictName = (district) => {
        return `${district.properties.loai} ${district.properties.ten_huyen}`;
    };

    const clearMarkers = useCallback(() => markersLayerRef.current?.clearLayers(), []);

    // ── Draw: province clusters ───────────────────────────────
    const drawProvinceLevel = useCallback(() => {
        if (!L || !leafletMapRef.current) return;
        clearMarkers();
        clearDistrictBoundaries();
        const groups = provinceGroups; // dùng memo value thay vì gọi hàm

        Object.values(groups).forEach(({ province, items }) => {
            const online = items.filter((i) => isOnline(i.cruise)).length;
            const total = items.length;
            const lat = parseFloat(province.latitude);
            const lon = parseFloat(province.longitude);

            const sz = Math.round(Math.max(26, Math.min(38, 26 + Math.log10(total + 1) * 8)));
            const icon = L.divIcon({
                className: '',
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
                html: clusterSvg(total, online, total, 'province'),
            });

            const marker = L.marker([lat, lon], { icon });
            marker.bindTooltip(`<b>${province.full_name}</b><br>${total} thiết bị · ${online} online`, {
                direction: 'top',
                offset: [0, -27],
            });
            marker.on('click', async () => {
                setSelectedProvince(province);
                setSelectedDistrict(null);
                setPopupDevice(null);
                leafletMapRef.current.setView([lat, lon], 9, { animate: true });

                // Bật tile layer — hiện đường phố chi tiết
                showTile();

                // Draw district boundaries (visual)
                drawDistrictBoundaries(province.full_name);

                // Fetch district centroids
                setLoadingDistricts(true);
                try {
                    const res = await fetch(DISTRICT_API(province.id));
                    const data = await res.json();
                    setDistricts(data.data || []);
                    console.log('DISTRICTS:', province.full_name, data);
                    setLevel('district');
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingDistricts(false);
                }
            });
            markersLayerRef.current.addLayer(marker);
        });
    }, [L, provinceGroups, clearMarkers, clearDistrictBoundaries, drawDistrictBoundaries]);

    // ── Draw: district clusters ───────────────────────────────
    const drawDistrictLevel = useCallback(() => {
        if (!L || !leafletMapRef.current || !districts.length) return;
        clearMarkers();
        const groups = districtGroups; // dùng memo value thay vì gọi hàm

        Object.values(groups).forEach(({ district, items }) => {
            const online = items.filter((i) => isOnline(i.cruise)).length;
            const total = items.length;
            const [lon, lat] = district._center.geometry.coordinates;

            const sz = Math.round(Math.max(26, Math.min(38, 26 + Math.log10(total + 1) * 8)));
            const icon = L.divIcon({
                className: '',
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
                html: clusterSvg(total, online, total, 'district'),
            });

            const marker = L.marker([lat, lon], { icon });
            marker.bindTooltip(`<b>${getDistrictName(district)}</b><br>${total} thiết bị · ${online} online`, {
                direction: 'top',
                offset: [0, -23],
            });
            marker.on('click', () => {
                setSelectedDistrict(district);
                setPopupDevice(null);
                leafletMapRef.current.setView([lat, lon], 13, { animate: true });
                setLevel('device');
            });
            markersLayerRef.current.addLayer(marker);
        });
    }, [L, districtGroups, clearMarkers]);

    // ── Draw: individual device pins ──────────────────────────
    const drawDeviceLevel = useCallback(() => {
        if (!L || !leafletMapRef.current || !selectedDistrict || !districts.length) return;
        clearMarkers();

        const districtDevices = devices.filter((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            const districtFeature = findDistrictByPoint(
                cruise.lat,
                cruise.lon,
                districtGeoJson,
                selectedProvince.full_name,
            );

            console.log({
                lat: cruise.lat,
                lon: cruise.lon,
                district: districtFeature?.properties?.Ten_Huyen,
            });

            return districtFeature?.properties.ma_huyen === selectedDistrict?.properties?.ma_huyen;
        });

        districtDevices.forEach((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return;
            const online = isOnline(cruise);
            const color = online ? '#22c55e' : '#ef4444';

            const svgHtml = `<svg width="32" height="42" viewBox="0 0 36 47" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 12.5 18 29 18 29S36 30.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="18" r="8" fill="white"/>
        <circle cx="18" cy="18" r="4.5" fill="${color}"/>
      </svg>`;

            const icon = L.divIcon({
                className: '',
                iconSize: [32, 42],
                iconAnchor: [16, 42],
                html: svgHtml,
            });

            const marker = L.marker([cruise.lat, cruise.lon], { icon });
            marker.bindTooltip(`<b>${d.license_plate || d.imei}</b><br>${online ? '🟢 Online' : '🔴 Offline'}`, {
                direction: 'top',
                offset: [0, -43],
            });
            marker.on('click', () => {
                setPopupDevice(d);
                setPopupCruise(cruise);
            });
            markersLayerRef.current.addLayer(marker);
        });
    }, [L, devices, cruiseByImei, selectedDistrict, districts, clearMarkers]);

    // ── Draw: all devices as individual pins (forceAllDevices mode) ─────────
    const drawAllDevicesLevel = useCallback(() => {
        if (!L || !leafletMapRef.current) return;
        clearMarkers();
        showTile();

        const bounds = [];

        // Jitter: nhóm các thiết bị có cùng tọa độ → xếp thành vòng xoắn
        // để tránh chồng pin khi nhiều xe đậu cùng chỗ
        const coordGroups = {};
        devices.forEach((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return;
            const key = `${cruise.lat.toFixed(5)},${cruise.lon.toFixed(5)}`;
            if (!coordGroups[key]) coordGroups[key] = [];
            coordGroups[key].push({ device: d, cruise });
        });

        Object.values(coordGroups).forEach((group) => {
            group.forEach(({ device: d, cruise }, idx) => {
                const online = isOnline(cruise);
                const color = online ? '#22c55e' : '#ef4444';

                // Spiral jitter: idx=0 ở giữa, các cái sau ra vòng xoắn
                let lat = cruise.lat;
                let lon = cruise.lon;
                if (idx > 0) {
                    // Vòng xoắn Archimedes: mỗi 6 pins lên 1 vòng
                    const ring   = Math.ceil(idx / 6);
                    const angle  = (idx % 6) * (Math.PI / 3) + ring * 0.5;
                    const radius = 0.000035 * ring; // ~3.5m mỗi vòng
                    lat = cruise.lat + radius * Math.cos(angle);
                    lon = cruise.lon + radius * Math.sin(angle) / Math.cos((cruise.lat * Math.PI) / 180);
                }

                const svgHtml = `<svg width="26" height="34" viewBox="0 0 36 47" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 12.5 18 29 18 29S36 30.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="18" r="8" fill="white"/>
        <circle cx="18" cy="18" r="4.5" fill="${color}"/>
      </svg>`;

                const icon = L.divIcon({
                    className: '',
                    iconSize: [26, 34],
                    iconAnchor: [13, 34],
                    html: svgHtml,
                });

                const marker = L.marker([lat, lon], { icon });
                marker.bindTooltip(
                    `<b>${d.license_plate || d.imei}</b><br>${online ? '🟢 Online' : '🔴 Offline'}`,
                    { direction: 'top', offset: [0, -35] },
                );
                marker.on('click', () => {
                    setPopupDevice(d);
                    setPopupCruise(cruise);
                });
                markersLayerRef.current.addLayer(marker);
                bounds.push([lat, lon]);
            });
        });

        // Auto-fit to all device pins
        if (bounds.length > 0 && leafletMapRef.current) {
            try {
                leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 19, animate: true });
            } catch (_) {}
        }
    }, [L, devices, cruiseByImei, clearMarkers, showTile]);

    // ── Trigger redraws ───────────────────────────────────────
    useEffect(() => {
        if (!L || !provinces.length) return;
        if (forceAllDevices) return; // skip — handled by forceAllDevices effect below
        if (level === 'province') drawProvinceLevel();
    }, [L, level, provinces, devices, cruiseByImei, drawProvinceLevel, forceAllDevices]);

    useEffect(() => {
        if (!L || level !== 'district' || !districts.length) return;
        if (forceAllDevices) return;
        drawDistrictLevel();
    }, [L, level, districts, devices, cruiseByImei, drawDistrictLevel, forceAllDevices]);

    useEffect(() => {
        if (!L || level !== 'device' || !selectedDistrict) return;
        if (forceAllDevices) return;
        drawDeviceLevel();
    }, [L, level, selectedDistrict, devices, cruiseByImei, drawDeviceLevel, forceAllDevices]);

    // forceAllDevices: show all devices as pins regardless of level
    useEffect(() => {
        if (!L) return;
        if (forceAllDevices) {
            drawAllDevicesLevel();
        } else {
            // Restore normal province view + reset map to full Vietnam view
            hideTile();
            setLevel('province');
            setSelectedProvince(null);
            setSelectedDistrict(null);
            if (provinces.length) drawProvinceLevel();
            // Fit back to Vietnam bounds
            if (_vnBoundsCache && leafletMapRef.current) {
                try {
                    leafletMapRef.current.fitBounds(_vnBoundsCache, { padding: [10, 10], animate: true });
                } catch (_) {}
            }
        }
    }, [L, forceAllDevices, devices, cruiseByImei, drawAllDevicesLevel, drawProvinceLevel, hideTile, provinces]);

    // ── Compute zone stats ─────────────────────────────────────
    useEffect(() => {
        if (!provinces.length || !devices.length) return;

        if (level === 'province') {
            const groups = provinceGroups; // dùng memo value
            const stats = Object.values(groups)
                .map(({ province, items }) => ({
                    id: province.id,
                    name: province.full_name,
                    total: items.length,
                    online: items.filter((i) => isOnline(i.cruise)).length,
                    offline: items.filter((i) => !isOnline(i.cruise)).length,
                    lat: parseFloat(province.latitude),
                    lon: parseFloat(province.longitude),
                    province,
                }))
                .sort((a, b) => b.total - a.total);
            setZoneStats(stats);
        } else if (level === 'district' && districts.length) {
            const groups = districtGroups; // dùng memo value
            const stats = Object.values(groups)
                .map(({ district, items }) => {
                    // Lấy centroid từ GeoJSON feature, fallback về avg lat/lon của thiết bị
                    let lat = 0, lon = 0;
                    try {
                        const pt = turf.centroid(district);
                        [lon, lat] = pt.geometry.coordinates;
                    } catch (_) {
                        const validItems = items.filter(i => i.cruise?.lat && i.cruise?.lon);
                        if (validItems.length) {
                            lat = validItems.reduce((s, i) => s + i.cruise.lat, 0) / validItems.length;
                            lon = validItems.reduce((s, i) => s + i.cruise.lon, 0) / validItems.length;
                        }
                    }
                    return {
                        id: district.properties.ma_huyen,
                        name: `${district.properties.loai} ${district.properties.ten_huyen}`,
                        total: items.length,
                        online: items.filter((i) => isOnline(i.cruise)).length,
                        offline: items.filter((i) => !isOnline(i.cruise)).length,
                        lat, lon,
                        district,
                    };
                })
                .sort((a, b) => b.total - a.total);
            setZoneStats(stats);
        } else if (level === 'device') {
            // Ở device level, giữ lại stats của district level
            // (không reset — user vẫn thấy list quận)
        }
    }, [level, provinces, devices, cruiseByImei, districts, provinceGroups, districtGroups]);

    // ── Navigation ────────────────────────────────────────────
    const goRoot = () => {
        setLevel('province');
        setSelectedProvince(null);
        setSelectedDistrict(null);
        setDistricts([]);
        setPopupDevice(null);
        clearDistrictBoundaries();
        // Tắt tile layer — về nền trắng toàn quốc
        hideTile();
        if (leafletMapRef.current && geoLayerRef.current) {
            leafletMapRef.current.fitBounds(geoLayerRef.current.getBounds(), {
                padding: [20, 20],
                animate: true,
            });
        }
    };

    const goProvince = () => {
        if (!selectedProvince) return;
        setLevel('district');
        setSelectedDistrict(null);
        setPopupDevice(null);
        const lat = parseFloat(selectedProvince.latitude);
        const lon = parseFloat(selectedProvince.longitude);
        leafletMapRef.current?.setView([lat, lon], 9, { animate: true });
        drawDistrictBoundaries(selectedProvince.full_name);
        // Đảm bảo tile vẫn hiện khi quay lại province level từ district
        showTile();
    };

    const totalOnline = devices.filter((d) => isOnline(cruiseByImei[d.imei])).length;
    const totalOffline = devices.length - totalOnline;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height, 
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
                border: '1px solid #e5e7eb',
                background: '#f0f6ff',
                // ✅ Fix ô vuông đen: ngăn browser tạo native selection rectangle khi drag
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
            }}
        >
            {/* Map container */}
            <div ref={mapRef} style={{ width: '100%', height: '100%', userSelect: 'none' }} />

            {/* Breadcrumb — top left */}
            <Breadcrumb
                province={selectedProvince}
                district={selectedDistrict}
                onClickRoot={goRoot}
                onClickProvince={goProvince}
            />




            {/* Custom Zoom Control — thay thế leaflet default */}
            {L && leafletMapRef.current && <ZoomControl mapRef={leafletMapRef} />}

            {/* Reset về toàn quốc */}
            <ResetViewBtn onClick={goRoot} />

            <Legend level={level} isMobile={isMobile} />

            {/* Bottom stats bar */}
            <div style={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                right: 14,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                pointerEvents: 'none',
            }}>
                {/* Global total pill — luôn hiện */}
                <div style={{
                    flexShrink: 0,
                    background: 'rgba(15,23,42,0.88)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: 10,
                    padding: isMobile ? '5px 10px' : '6px 13px',
                    display: 'flex',
                    gap: isMobile ? 7 : 10,
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontFamily: 'system-ui,sans-serif',
                }}>
                    <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#e2e8f0' }}>{devices.length} thiết bị</span>
                    <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#4ade80' }}>● {totalOnline}</span>
                    <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#f87171' }}>● {totalOffline}</span>
                </div>

                {/* Province level: pills theo từng tỉnh — ẩn trên mobile */}
                {level === 'province' && zoneStats.length > 0 && !isMobile && (
                    <div style={{
                        flex: 1,
                        overflowX: 'auto',
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        pointerEvents: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}>
                        {zoneStats.map((z) => {
                            const onlinePct = z.total > 0 ? (z.online / z.total) * 100 : 0;
                            return (
                                <div key={z.id} title={z.name} style={{
                                    flexShrink: 0,
                                    background: 'rgba(15,23,42,0.85)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    borderRadius: 8,
                                    padding: '5px 11px',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3,
                                    cursor: 'pointer',
                                    minWidth: 110,
                                    maxWidth: 160,
                                    fontFamily: 'system-ui,sans-serif',
                                    transition: 'border-color .15s, background .15s',
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)';
                                        e.currentTarget.style.background = 'rgba(30,41,59,0.95)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                                        e.currentTarget.style.background = 'rgba(15,23,42,0.85)';
                                    }}
                                >
                                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{z.total}</span>
                                        <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>● {z.online}</span>
                                        <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>● {z.offline}</span>
                                    </div>
                                    <div style={{ height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${onlinePct}%`, background: 'linear-gradient(90deg,#166534,#4ade80)', borderRadius: 2 }} />
                                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${onlinePct}%`, right: 0, background: 'rgba(239,68,68,0.42)', borderRadius: '0 2px 2px 0' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* District/device level: summary card — ẩn trên mobile */}
                {(level === 'district' || level === 'device') && selectedProvince && !isMobile && (() => {
                    // Ở device level + có quận được chọn → hiện stats quận đó
                    const activeZone = level === 'device' && selectedDistrict
                        ? zoneStats.find(z => z.id === selectedDistrict.properties?.ma_huyen)
                        : null;

                    // Ở district level hoặc chưa chọn quận → tổng tỉnh
                    const total    = activeZone ? activeZone.total   : zoneStats.reduce((s, z) => s + z.total, 0);
                    const online   = activeZone ? activeZone.online  : zoneStats.reduce((s, z) => s + z.online, 0);
                    const offline  = activeZone ? activeZone.offline : zoneStats.reduce((s, z) => s + z.offline, 0);
                    const onlinePct = total > 0 ? (online / total) * 100 : 0;

                    return (
                        <div style={{
                            flexShrink: 0,
                            background: 'rgba(15,23,42,0.88)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            borderRadius: 10,
                            padding: '7px 14px',
                            border: '1px solid rgba(96,165,250,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontFamily: 'system-ui,sans-serif',
                            pointerEvents: 'auto',
                        }}>
                            {/* Path: Tỉnh > Quận (nếu có quận được chọn) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {activeZone ? (
                                    /* Device level — hiện tỉnh > quận */
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>
                                            {selectedProvince.full_name}
                                        </span>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                        <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                            {activeZone.name}
                                        </span>
                                    </div>
                                ) : (
                                    /* District level — hiện tổng tỉnh */
                                    <>
                                        <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            {selectedProvince.full_name}
                                        </span>
                                        <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>
                                            {zoneStats.length} quận/huyện có thiết bị
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Divider */}
                            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

                            {/* Stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{total}</span>
                                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>● {online} online</span>
                                <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>● {offline} offline</span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ width: 80, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${onlinePct}%`, background: 'linear-gradient(90deg,#166534,#4ade80)', borderRadius: 3 }} />
                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${onlinePct}%`, right: 0, background: 'rgba(239,68,68,0.42)', borderRadius: '0 3px 3px 0' }} />
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Hint pills — ẩn trên mobile */}
            {level === 'province' && !loading && devices.length > 0 && !isMobile && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 58,
                        right: 14,
                        zIndex: 1000,
                        background: 'rgba(22,119,255,0.88)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '5px 11px',
                        fontSize: 11,
                        fontFamily: 'system-ui,sans-serif',
                        fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                    }}
                >
                    <IconInfo /> Click vào cụm để xem quận/huyện
                </div>
            )}
            {level === 'district' && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 58,
                        right: 14,
                        zIndex: 1000,
                        background: 'rgba(124,58,237,0.88)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '5px 11px',
                        fontSize: 11,
                        fontFamily: 'system-ui,sans-serif',
                        fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                    }}
                >
                    <IconInfo /> Click vào cụm để xem từng thiết bị
                </div>
            )}

            {/* Loading overlay */}
            {(loading || loadingDistricts) && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255,255,255,0.65)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        borderRadius: 11,
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: '16px 28px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                            fontSize: 13,
                            fontFamily: 'system-ui,sans-serif',
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <style>{`
                            @keyframes vn-spin { to { transform: rotate(360deg); } }
                            .vn-spinner { width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#1677ff;border-radius:50%;animation:vn-spin .7s linear infinite; }
                        `}</style>
                        <div className="vn-spinner" />
                        Đang tải dữ liệu...
                    </div>
                </div>
            )}

            {popupDevice && (
                <DevicePopup device={popupDevice} cruise={popupCruise} onClose={() => setPopupDevice(null)} />
            )}
        </div>
    );
};

export default VietnamMapDrillDown;
