/**
 * @file OverviewSearchBox.jsx
 * @description Ô tìm kiếm thiết bị nhanh (biển số, IMEI, lái xe) sử dụng Fuse.js fuzzy search.
 */

'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
    IconSearchOptic,
    IconCloseMini,
    IconGpsPin,
    IconGpsSlash,
} from '../OverviewIcons';

const isOnline = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

export default function OverviewSearchBox({ devices = [], cruiseByImei = {}, onSelect, isEn }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const wrapRef = useRef(null);

    const fuse = useMemo(() => new Fuse(devices, {
        keys: [
            { name: 'license_plate', weight: 2 },
            { name: 'imei', weight: 1 },
            { name: 'driver', weight: 1 },
        ],
        threshold: 0.35,
        includeScore: true,
        minMatchCharLength: 1,
    }), [devices]);

    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        return fuse.search(q).slice(0, 8).map((r) => r.item);
    }, [fuse, query]);

    useClickOutside(wrapRef, useCallback(() => setOpen(false), []), open);

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
            <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: focused ? '#ffffff' : '#f8fafc',
                border: `1px solid ${focused ? '#1d4ed8' : '#cbd5e1'}`,
                borderRadius: 6, padding: '5px 10px', height: 32, boxSizing: 'border-box',
                transition: 'border-color .15s, background .15s, box-shadow .15s',
                boxShadow: focused ? '0 0 0 1px #1d4ed8, 0 1px 2px rgba(15,23,42,0.06)' : '0 1px 2px rgba(15,23,42,0.04)',
            }}>
                <IconSearchOptic size={14} color={focused ? '#1d4ed8' : '#64748b'} style={{ flexShrink: 0, transition: 'color .15s' }} />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => { setFocused(true); if (query.trim()) setOpen(true); }}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#0f172a', width: '100%', fontFamily: 'inherit' }}
                />
                {query && (
                    <button onClick={handleClear} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, color: '#94a3b8', lineHeight: 1 }}>
                        <IconCloseMini size={12} color="#94a3b8" />
                    </button>
                )}
            </div>

            {open && hasResults && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#ffffff', borderRadius: 6, zIndex: 2000,
                    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', border: '1px solid #cbd5e1',
                    overflow: 'hidden', maxHeight: 320, overflowY: 'auto',
                }}>
                    {results.map((d, i) => {
                        const cruise = cruiseByImei[d.imei];
                        const online = isOnline(cruise);
                        const hasGps = Boolean(cruise?.lat && cruise?.lon);
                        return (
                            <div
                                key={d._id || d.imei}
                                onMouseDown={() => handleSelect(d)}
                                style={{
                                    padding: '8px 12px', borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: online ? '#16a34a' : '#dc2626',
                                    boxShadow: online ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 0 0 2px rgba(220,38,38,0.2)',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{d.license_plate || d.imei}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{d.driver ? `${d.driver} · ` : ''}{d.imei}</div>
                                </div>
                                {hasGps ? (
                                    <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <IconGpsPin size={10} color="#1d4ed8" /> GPS
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <IconGpsSlash size={10} color="#94a3b8" /> No GPS
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {open && query.trim() && !hasResults && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                    background: '#fff', borderRadius: 10, zIndex: 2000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid #e2e8f0',
                    padding: '16px 14px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8',
                }}>
                    {isEn ? 'No devices found' : 'Không tìm thấy thiết bị'}
                </div>
            )}
        </div>
    );
}
