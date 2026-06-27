'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Skeleton } from 'antd';
import {
    SearchOutlined,
    CloseOutlined,
    EnvironmentOutlined,
    StopOutlined,
} from '@ant-design/icons';
import Fuse from 'fuse.js';

import VietnamMapDrillDown from './VietnamMapDrillDown';
import { exportOverviewExcel } from './useOverviewExcel';
import './map.css';

import { getDevices } from '../lib/api/devices';
import api from '../lib/api/axios';

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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: spinning ? 'ov-spin .65s linear infinite' : 'none' }}>
        <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
);
const IcExcel = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
);
const IcChevron = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="6 9 12 15 18 9"/>
    </svg>
);

// ── Excel Dropdown ──────────────────────────────────────────────
const ExcelDropdown = ({ onExport, disabled }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const options = [
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
                style={{ color: '#16a34a', borderColor: '#bbf7d0', gap: 6 }}
            >
                <IcExcel />
                Xuất Excel
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
                    minWidth: 210,
                }}>
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
        <div ref={wrapRef} style={{ position: 'relative', width: 260, flexShrink: 0 }}>
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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsEn(localStorage.getItem('iky_lang') === 'en');
        }
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

    // Devices shown on map based on active filter
    const filteredDevices = useMemo(() => {
        if (mapFilter === 'online')  return devices.filter((d) => isOnline(cruiseByImei[d.imei]));
        if (mapFilter === 'offline') return devices.filter((d) => !isOnline(cruiseByImei[d.imei]));
        return devices;
    }, [devices, cruiseByImei, mapFilter]);

    const toggleFilter = (mode) => setMapFilter((cur) => cur === mode ? 'all' : mode);

    const handleExport = (mode) => exportOverviewExcel({ devices, cruiseByImei, mode });

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

                /* ── Header ─────────────────── */
                .ov-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 20px;
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
                @media (max-width: 1024px) { .ov-stats-row { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 560px)  { .ov-stats-row { grid-template-columns: 1fr; } }

                /* ── Stat Card ──────────────── */
                /* ── Header actions ─────────── */
                .ov-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
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
                .ov-map-card-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 14px;
                }
                .ov-map-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
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
                    <ExcelDropdown
                        onExport={handleExport}
                        disabled={loading || devices.length === 0}
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
                        <SearchBox
                            devices={devices}
                            cruiseByImei={cruiseByImei}
                            onSelect={(device) => setHighlightDevice(device ? { ...device, _ts: Date.now() } : null)}
                            isEn={isEn}
                        />
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
                        devices={filteredDevices}
                        cruiseByImei={cruiseByImei}
                        loading={false}
                        height={640}
                        forceAllDevices={mapFilter !== 'all'}
                        highlightDevice={highlightDevice}
                    />
                )}
            </div>
        </div>
    );
};

export default OverviewPage;
