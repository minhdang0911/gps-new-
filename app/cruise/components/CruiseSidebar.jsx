'use client';

import React, { memo } from 'react';
import { Select, Tooltip, Switch } from 'antd';
import { CaretRightOutlined, PauseOutlined, BorderOutlined, LoadingOutlined } from '@ant-design/icons';
import { FixedSizeList as VirtualList } from 'react-window';
import CruiseExportButton from '../../components/CruiseExportButton';
import { formatDateFromDevice } from '../../util/FormatDate';
import { distanceMeters, formatDuration } from '../../util/cruiseUtils';
import { matchVehicleSearch } from '../../lib/search/canonicalVehicleSearch';

const VLIST_HEIGHT = 460;
const ROW_HEIGHT = 40;

const Row = memo(function Row({ index, style, data }) {
    const { items, activeIndex, onClick } = data;
    const p = items[index];
    const isActive = index === activeIndex;

    return (
        <div
            style={style}
            className={'iky-cruise__table-row' + (isActive ? ' iky-cruise__table-row--active' : '')}
            onClick={() => onClick(index)}
        >
            <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                {formatDateFromDevice(p.dateTime)}
            </div>
            <div className="iky-cruise__table-cell">{typeof p.lat === 'number' ? p.lat.toFixed(6) : ''}</div>
            <div className="iky-cruise__table-cell">{typeof p.lon === 'number' ? p.lon.toFixed(6) : ''}</div>
            <div className="iky-cruise__table-cell">{p?.velocity}</div>
        </div>
    );
});

export default function CruiseSidebar({
    t, isEn, deviceList, selectedDeviceId, setSelectedDeviceId, setSelectedImei,
    deviceOptions, loadingDevices, setDeviceSearchText, handlePresetRange,
    start, setStart, end, setEnd, handleLoadRoute, loadingRoute, error,
    rawRouteData, stats, segments, ensureAddress, activeIndex, totalKm,
    handleStart, handlePause, handleReset, isPlaying, playbackRoute,
    followMode, setFollowMode, snapToRoad, setSnapToRoad, isSnappingRoad,
    playbackRate, setPlaybackRate, sliderValue, handleSliderChange,
    commitSlider, vlistRef, handlePointClickRaw,
}) {
    return (
        <aside className="iky-cruise__left">
            <div className="iky-cruise__left-card">
                <div className="iky-cruise__left-header">{t.title}</div>

                <div className="iky-cruise__form">
                    <div className="iky-cruise__form-row">
                        <label>{t.form.selectVehicle}</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder={t.form.searchVehiclePlaceholder || 'Nhập biển số / IMEI / SĐT'}
                            loading={loadingDevices}
                            value={selectedDeviceId || undefined}
                            onSearch={(value) => setDeviceSearchText(value)}
                            onChange={(value) => {
                                setSelectedDeviceId(value);
                                const device = deviceList.find((d) => d._id === value);
                                setSelectedImei(device?.imei || '');
                            }}
                            filterOption={(input, option) => {
                                if (!input || !input.trim()) return true;
                                if (!option?.device) {
                                    const lowerInput = input.trim().toLowerCase();
                                    return Boolean(option?.searchable?.includes(lowerInput));
                                }
                                if (matchVehicleSearch(option.device, input, { allowFuzzy: false })) return true;
                                return matchVehicleSearch(option.device, input, { allowFuzzy: true });
                            }}
                            options={deviceOptions}
                        />
                    </div>

                    <div className="iky-cruise__form-row iky-cruise__quick-row">
                        <div className="iky-cruise__quick-group">
                            <button type="button" className="iky-cruise__quick-btn" onClick={() => handlePresetRange(1)}>
                                {t.quick.oneHour}
                            </button>
                            <button type="button" className="iky-cruise__quick-btn" onClick={() => handlePresetRange(8)}>
                                {t.quick.eightHours}
                            </button>
                            <button type="button" className="iky-cruise__quick-btn" onClick={() => handlePresetRange(24)}>
                                {t.quick.twentyFourHours}
                            </button>
                        </div>
                    </div>

                    <div className="iky-cruise__form-row">
                        <label>{t.form.from}</label>
                        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                    </div>

                    <div className="iky-cruise__form-row">
                        <label>{t.form.to}</label>
                        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                    </div>

                    <button className="iky-cruise__load-btn" onClick={handleLoadRoute} disabled={loadingRoute}>
                        {loadingRoute ? t.form.loadingRoute : t.form.loadRoute}
                    </button>

                    <CruiseExportButton
                        isEn={isEn}
                        disabled={loadingRoute || rawRouteData.length === 0}
                        rawRouteData={rawRouteData}
                        stats={stats}
                        segments={segments}
                        device={deviceList.find((d) => d._id === selectedDeviceId)}
                        startText={start}
                        endText={end}
                        distanceMetersFn={(a, b) => distanceMeters(a, b)}
                        formatDateFn={(dt) => formatDateFromDevice(dt)}
                        formatDurationFn={(sec) => formatDuration(sec)}
                        ensureAddressFn={ensureAddress}
                    />

                    {error && <div className="iky-cruise__error">{error}</div>}
                </div>

                {rawRouteData.length > 0 && (
                    <>
                        <div className="iky-cruise__result">
                            <span>{t.result.label}</span>
                            <span>{activeIndex + 1}/{rawRouteData.length}</span>
                        </div>

                        <div className="iky-cruise__distance">
                            <span>{t.result.totalDistance}</span>
                            <span>{totalKm.toFixed(3)} {t.result.unitKm || 'km'}</span>
                        </div>

                        <div className="iky-cruise__controls">
                            <button onClick={handleStart} disabled={isPlaying || playbackRoute.points.length < 2} aria-label="Play">
                                <CaretRightOutlined />
                            </button>
                            <button onClick={handlePause} disabled={!isPlaying} aria-label="Pause">
                                <PauseOutlined />
                            </button>
                            <button onClick={handleReset} disabled={!playbackRoute.points.length} aria-label="Stop">
                                <BorderOutlined />
                            </button>

                            <div className="iky-cruise__follow">
                                <Tooltip title={isEn ? 'Follow marker (auto pan while playing)' : 'Bám theo xe (tự pan khi chạy)'}>
                                    <span className="iky-cruise__follow-label">{isEn ? 'Follow' : 'Bám'}</span>
                                </Tooltip>
                                <Switch size="small" checked={followMode} onChange={(v) => setFollowMode(v)} />
                            </div>

                            <div className="iky-cruise__follow">
                                <Tooltip title={isEn ? 'Snap route to roads (OSRM/Mapbox matching)' : 'Bám sát mặt đường (khắc phục đường chim bay)'}>
                                    <span className="iky-cruise__follow-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        {isEn ? 'Road' : 'Đường'}
                                        {isSnappingRoad && <LoadingOutlined spin className="iky-cruise__spin" />}
                                    </span>
                                </Tooltip>
                                <Switch size="small" checked={snapToRoad} onChange={(v) => setSnapToRoad(v)} />
                            </div>

                            <select value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))} className="iky-cruise__rate">
                                <option value={0.5}>0.5x</option>
                                <option value={1}>1x</option>
                                <option value={1.5}>1.5x</option>
                                <option value={2}>2x</option>
                                <option value={3}>3x</option>
                                <option value={5}>5x</option>
                                <option value={10}>10x</option>
                            </select>

                            <input
                                type="range"
                                min={0}
                                max={Math.max(0, playbackRoute.points.length - 1)}
                                value={sliderValue}
                                onChange={handleSliderChange}
                                onMouseUp={commitSlider}
                                onTouchEnd={commitSlider}
                            />
                        </div>

                        <div className="iky-cruise__list">
                            <div className="iky-cruise__table">
                                <div className="iky-cruise__table-header">
                                    <div className="iky-cruise__table-cell iky-cruise__table-cell--time">{t.table?.time || 'Time'}</div>
                                    <div className="iky-cruise__table-cell">{t.table?.lat || 'Latitude'}</div>
                                    <div className="iky-cruise__table-cell">{t.table?.lon || 'Longitude'}</div>
                                    <div className="iky-cruise__table-cell">{t.table?.speed || 'Speed'}</div>
                                </div>

                                <VirtualList
                                    ref={vlistRef}
                                    className="iky-cruise__table-body"
                                    height={VLIST_HEIGHT}
                                    itemCount={rawRouteData.length}
                                    itemSize={ROW_HEIGHT}
                                    width="100%"
                                    overscanCount={12}
                                    itemData={{
                                        items: rawRouteData,
                                        activeIndex,
                                        onClick: handlePointClickRaw,
                                    }}
                                >
                                    {Row}
                                </VirtualList>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}
