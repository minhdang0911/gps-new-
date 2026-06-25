'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from 'antd';

import VietnamMapDrillDown from './VietnamMapDrillDown';
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

// ── Stat Card ────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, accentColor, loading: cardLoading }) => (
    <div className="ov-stat-card">
        <div className="ov-stat-accent" style={{ background: accentColor }} />
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
    </div>
);

// ── Main page ─────────────────────────────────────────────────
const OverviewPage = () => {
    const [devices, setDevices] = useState([]);
    const [cruiseByImei, setCruiseByImei] = useState({});
    const [loading, setLoading] = useState(true);
    const [isEn, setIsEn] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

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

            const devRes = await getDevices({ limit: 200000 });
            const devList = devRes?.devices || [];

            const cruiseRes = await api.get('last-cruise-list', {
                headers: { Authorization: `Bearer ${token}` },
            });
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

    useEffect(() => { fetchAll(); }, []);

    const totalDevices = devices.length;
    const onlineDevices = useMemo(
        () => devices.filter((d) => isOnline(cruiseByImei[d.imei])).length,
        [devices, cruiseByImei],
    );
    const offlineDevices = totalDevices - onlineDevices;
    const expiringSoon = useMemo(() => devices.filter(isExpiringSoon).length, [devices]);

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
                .ov-stat-card {
                    background: #fff;
                    border-radius: 14px;
                    padding: 18px 20px 16px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
                    border: 1px solid rgba(0,0,0,0.045);
                    position: relative;
                    overflow: hidden;
                    transition: transform .18s, box-shadow .18s;
                    cursor: default;
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
                <button
                    className="ov-refresh-btn"
                    onClick={() => fetchAll(true)}
                    disabled={refreshing || loading}
                >
                    <IcRefresh spinning={refreshing} />
                    {t('Làm mới', 'Refresh')}
                </button>
            </div>

            {/* Stat cards */}
            <div className="ov-stats-row">
                <StatCard
                    icon={<IcTotal />}
                    label={t('Tổng thiết bị', 'Total Devices')}
                    value={loading ? '—' : totalDevices.toLocaleString()}
                    accentColor="#1677ff"
                    loading={loading}
                />
                <StatCard
                    icon={<IcWifiOn />}
                    label={t('Thiết bị Online', 'Devices Online')}
                    value={loading ? '—' : onlineDevices.toLocaleString()}
                    sub={t('Cập nhật trong 24h', 'Updated < 24h')}
                    accentColor="#16a34a"
                    loading={loading}
                />
                <StatCard
                    icon={<IcWifiOff />}
                    label={t('Thiết bị Offline', 'Devices Offline')}
                    value={loading ? '—' : offlineDevices.toLocaleString()}
                    sub={t('Không cập nhật 24h', 'No update > 24h')}
                    accentColor="#dc2626"
                    loading={loading}
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
                    {!loading && (
                        <span className="ov-map-hint">
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
                        devices={devices}
                        cruiseByImei={cruiseByImei}
                        loading={false}
                        height={640}
                    />
                )}
            </div>
        </div>
    );
};

export default OverviewPage;
