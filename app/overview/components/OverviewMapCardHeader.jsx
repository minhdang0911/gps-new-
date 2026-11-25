/**
 * @file OverviewMapCardHeader.jsx
 * @description Thanh tiêu đề thẻ bản đồ (Toggle Bản đồ/Danh sách, Tìm kiếm nhanh, Toàn màn hình).
 */

'use client';

import React from 'react';
import OverviewSearchBox from './OverviewSearchBox';
import {
    IconFleetCommandHub,
    IconMapTab,
    IconTableTab,
    IconFullscreenExpand,
    IconFullscreenCollapse,
} from '../OverviewIcons';

export default function OverviewMapCardHeader({
    viewMode,
    setViewMode,
    devices = [],
    cruiseByImei = {},
    filteredDevices = [],
    highlightDevice,
    setHighlightDevice,
    fullscreen,
    toggleFullscreen,
    drillDevices,
    displayTotal,
    loading,
    isEn,
}) {
    const t = (vi, en) => (isEn ? en : vi);

    return (
        <div className="ov-map-card-header">
            <div className="ov-map-icon-wrap" style={{ background: '#0284c7', borderRadius: 6 }}>
                <IconFleetCommandHub size={18} color="#ffffff" />
            </div>
            <span className="ov-map-title">
                {viewMode === 'table' ? t('Danh sách thiết bị', 'Device List') : t('Bản đồ thiết bị', 'Device Map')}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 6, border: '1px solid #e2e8f0', padding: 2, gap: 2, flexShrink: 0 }}>
                <button
                    onClick={() => setViewMode('map')}
                    title={t('Xem bản đồ', 'Map view')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, border: 'none',
                        background: viewMode === 'map' ? '#ffffff' : 'transparent',
                        boxShadow: viewMode === 'map' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                        color: viewMode === 'map' ? '#0284c7' : '#64748b',
                        cursor: 'pointer', fontSize: 12, fontWeight: viewMode === 'map' ? 700 : 500,
                        transition: 'all .15s',
                    }}
                >
                    <IconMapTab size={14} color={viewMode === 'map' ? '#0284c7' : '#64748b'} />
                    <span className="ov-toggle-label">{t('Bản đồ', 'Map')}</span>
                </button>
                <button
                    onClick={() => setViewMode('table')}
                    title={t('Xem danh sách', 'Table view')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, border: 'none',
                        background: viewMode === 'table' ? '#ffffff' : 'transparent',
                        boxShadow: viewMode === 'table' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                        color: viewMode === 'table' ? '#0284c7' : '#64748b',
                        cursor: 'pointer', fontSize: 12, fontWeight: viewMode === 'table' ? 700 : 500,
                        transition: 'all .15s',
                    }}
                >
                    <IconTableTab size={14} color={viewMode === 'table' ? '#0284c7' : '#64748b'} />
                    <span className="ov-toggle-label">{t('Danh sách', 'List')}</span>
                </button>
            </div>

            {!loading && devices.length > 0 && (
                <div className="ov-map-search-wrap">
                    <OverviewSearchBox
                        devices={devices}
                        cruiseByImei={cruiseByImei}
                        onSelect={(device) => setHighlightDevice(device ? { ...device, _ts: Date.now() } : null)}
                        isEn={isEn}
                    />
                </div>
            )}

            <button
                onClick={toggleFullscreen}
                className="ov-refresh-btn"
                style={{
                    marginLeft: 'auto', padding: '0 12px', height: 32, fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 6, borderColor: '#cbd5e1', borderRadius: 6, cursor: 'pointer',
                }}
                title={fullscreen ? t('Thoát toàn màn hình', 'Exit Fullscreen') : t('Toàn màn hình', 'Fullscreen')}
            >
                {fullscreen ? <IconFullscreenCollapse size={13} color="#475569" /> : <IconFullscreenExpand size={13} color="#475569" />}
                <span>{fullscreen ? t('Thu nhỏ', 'Minimize') : t('Toàn màn hình', 'Fullscreen')}</span>
            </button>

            {drillDevices !== null && !loading && (
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', borderRadius: 20,
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    color: '#1d4ed8', fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1d4ed8' }} />
                    {t(`Xem: ${displayTotal} thiết bị`, `Viewing: ${displayTotal} devices`)}
                </span>
            )}
        </div>
    );
}
