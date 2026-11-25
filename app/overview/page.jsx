/**
 * @file page.jsx
 * @description Trang Tổng quan hệ thống giám sát hành trình (Overview Dashboard).
 * Tối ưu hóa hiệu năng, chia nhỏ theo cấu trúc micro-component (<= 250 lines).
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import { useOverviewData } from './hooks/useOverviewData';
import OverviewStatsRow from './components/OverviewStatsRow';
import OverviewMapCardHeader from './components/OverviewMapCardHeader';
import DistributorSelect from './components/DistributorSelect';
import ExcelDropdown from './components/ExcelDropdown';
import RegionFilterPanel from './components/RegionFilterPanel';
import DeviceTable from './components/DeviceTable';
import {
    FleetTotalIcon,
    IconRefreshCustom,
} from './OverviewIcons';
import './map.css';
import './overview.css';

const VietnamMapDrillDown = dynamic(() => import('./VietnamMapDrillDown'), {
    ssr: false,
    loading: () => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, background: '#f5f7fb', borderRadius: 12, gap: 10 }}>
            <Spin size="large" />
            <span style={{ color: '#888', fontSize: 13 }}>Đang tải bản đồ...</span>
        </div>
    ),
});

export default function OverviewPage() {
    const data = useOverviewData();
    const {
        devices, cruiseByImei, provinces, loading, refreshing, lastUpdated,
        mapFilter, setMapFilter, distributorFilter, setDistributorFilter,
        regionFilter, setRegionFilter, highlightDevice, setHighlightDevice,
        viewMode, setViewMode, isAdmin, isEn, onlineMap, distributorOptions,
        distributorStats, filteredDevices, regionFilteredDevices,
        displayTotal, displayOnline, displayOffline, displayExpiring,
        totalDevices, fetchAll, handleExport, setDrillDevices, drillDevices,
    } = data;

    const t = (vi, en) => (isEn ? en : vi);
    const mapCardRef = useRef(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [mapHeight, setMapHeight] = useState(580);

    useEffect(() => {
        const handleFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            mapCardRef.current?.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }, []);

    const updateHeight = useCallback(() => {
        if (typeof window === 'undefined') return;
        const w = window.innerWidth;
        if (w < 480) setMapHeight(380);
        else if (w < 768) setMapHeight(460);
        else if (w < 1280) setMapHeight(540);
        else setMapHeight(600);
    }, []);

    useEffect(() => {
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, [updateHeight]);

    const formatLastUpdated = () => {
        if (!lastUpdated) return '';
        return lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="ov-page">
            <div className="ov-header">
                <div className="ov-title-row">
                    <div className="ov-title-icon">
                        <FleetTotalIcon size={20} color="#ffffff" />
                    </div>
                    <div>
                        <div className="ov-title">{t('Tổng quan hệ thống', 'System Overview')}</div>
                        {lastUpdated && (
                            <div className="ov-subtitle">
                                {t('Cập nhật lúc', 'Updated at')} {formatLastUpdated()}
                            </div>
                        )}
                        {!loading && totalDevices > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                                <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden', maxWidth: 140 }}>
                                    <div style={{
                                        height: '100%', borderRadius: 2, background: '#16a34a',
                                        width: `${Math.round((displayOnline / Math.max(displayTotal, 1)) * 100)}%`,
                                        transition: 'width .4s ease',
                                    }} />
                                </div>
                                <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700 }}>
                                    {Math.round((displayOnline / Math.max(displayTotal, 1)) * 100)}% online
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="ov-header-actions">
                    {isAdmin && distributorOptions.length > 0 && (
                        <DistributorSelect
                            value={distributorFilter}
                            onChange={setDistributorFilter}
                            options={distributorOptions}
                            isEn={isEn}
                        />
                    )}
                    <RegionFilterPanel
                        provinces={provinces}
                        devices={devices}
                        cruiseByImei={cruiseByImei}
                        onApply={setRegionFilter}
                        disabled={loading || devices.length === 0}
                        isEn={isEn}
                    />
                    <ExcelDropdown
                        onExport={handleExport}
                        disabled={loading || devices.length === 0}
                        regionActive={Boolean(regionFilter)}
                        regionCount={regionFilteredDevices.length}
                        isEn={isEn}
                    />
                    <button className="ov-refresh-btn" onClick={() => fetchAll(true)} disabled={refreshing || loading}>
                        <IconRefreshCustom spinning={refreshing} size={14} />
                        {t('Làm mới', 'Refresh')}
                    </button>
                </div>
            </div>

            <OverviewStatsRow
                displayTotal={displayTotal}
                totalDevices={totalDevices}
                displayOnline={displayOnline}
                displayOffline={displayOffline}
                displayExpiring={displayExpiring}
                distributorStats={distributorStats}
                distributorFilter={distributorFilter}
                mapFilter={mapFilter}
                setMapFilter={setMapFilter}
                loading={loading}
                isAdmin={isAdmin}
                isEn={isEn}
            />

            <div className="ov-map-card" ref={mapCardRef}>
                <OverviewMapCardHeader
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    devices={devices}
                    cruiseByImei={cruiseByImei}
                    filteredDevices={filteredDevices}
                    highlightDevice={highlightDevice}
                    setHighlightDevice={setHighlightDevice}
                    fullscreen={fullscreen}
                    toggleFullscreen={toggleFullscreen}
                    drillDevices={drillDevices}
                    displayTotal={displayTotal}
                    loading={loading}
                    isEn={isEn}
                />

                <div className="ov-map-body" style={{ height: viewMode === 'table' ? 620 : mapHeight }}>
                    {viewMode === 'map' ? (
                        <VietnamMapDrillDown
                            devices={filteredDevices}
                            cruiseByImei={cruiseByImei}
                            height={mapHeight}
                            forceAllDevices={mapFilter === 'online' || mapFilter === 'offline'}
                            highlightDevice={highlightDevice}
                            onDrillChange={setDrillDevices}
                        />
                    ) : (
                        <DeviceTable devices={filteredDevices} cruiseByImei={cruiseByImei} isEn={isEn} onlineMap={onlineMap} />
                    )}
                </div>
            </div>
        </div>
    );
}
