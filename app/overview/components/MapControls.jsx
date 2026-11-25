/**
 * @file MapControls.jsx
 * @description Các điều khiển trên bản đồ: Breadcrumb, ZoomControl, ResetViewBtn.
 */

'use client';

import React, { useState, useEffect } from 'react';

export const IconMap = () => (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3.5 2" />
        <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 6L12.5 12.5L10 11.2L7.5 12.5L10 6Z" fill="#38bdf8" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
);

export const IconChevron = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export const IconReset = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);

export function ZoomControl({ mapRef }) {
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
    }, [mapRef]);

    const btnBase = {
        width: 32, height: 32, border: 'none', background: 'rgba(15,23,42,0.82)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#e2e8f0',
        fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', transition: 'background .15s, color .15s', outline: 'none', lineHeight: 1,
    };

    return (
        <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 10,
            overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)',
        }}>
            <button
                title="Phóng to (zoom in)"
                disabled={zoom >= maxZoom}
                style={{ ...btnBase, borderRadius: '10px 10px 0 0', opacity: zoom >= maxZoom ? 0.4 : 1, color: zoom >= maxZoom ? '#64748b' : '#93c5fd' }}
                onClick={() => mapRef.current?.zoomIn()}
            >+</button>
            <div style={{
                width: 32, height: 26, background: 'rgba(15,23,42,0.72)', color: '#94a3b8',
                fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'system-ui,monospace', letterSpacing: '0.3px',
            }}>
                {zoom != null ? `z${zoom}` : '—'}
            </div>
            <button
                title="Thu nhỏ (zoom out)"
                disabled={zoom <= minZoom}
                style={{ ...btnBase, borderRadius: '0 0 10px 10px', opacity: zoom <= minZoom ? 0.4 : 1, color: zoom <= minZoom ? '#64748b' : '#93c5fd' }}
                onClick={() => mapRef.current?.zoomOut()}
            >−</button>
        </div>
    );
}

export function ResetViewBtn({ onClick }) {
    return (
        <button
            title="Về toàn quốc"
            onClick={onClick}
            style={{
                position: 'absolute', right: 14, top: 'calc(50% + 68px)', zIndex: 1000,
                width: 32, height: 32, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                color: '#a5f3fc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.28)', outline: 'none', transition: 'background .15s',
            }}
        >
            <IconReset />
        </button>
    );
}

export function MapBreadcrumb({ province, district, onClickRoot, onClickProvince }) {
    const districtName = district ? `${district.properties?.loai || ''} ${district.properties?.ten_huyen || ''}`.trim() : '';

    return (
        <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 8, padding: '5px 11px', boxShadow: '0 2px 12px rgba(0,0,0,0.22)', fontSize: 12,
            fontFamily: 'system-ui,sans-serif', border: '1px solid rgba(255,255,255,0.1)',
        }}>
            <button
                onClick={onClickRoot}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: province ? '#93c5fd' : '#e2e8f0',
                    fontWeight: province ? 500 : 700, padding: 0, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
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
                            background: 'none', border: 'none', cursor: 'pointer', color: district ? '#93c5fd' : '#e2e8f0',
                            fontWeight: district ? 500 : 700, padding: 0, fontSize: 12,
                        }}
                    >
                        {province.full_name}
                    </button>
                </>
            )}
            {district && (
                <>
                    <IconChevron />
                    <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{districtName}</span>
                </>
            )}
        </div>
    );
}
