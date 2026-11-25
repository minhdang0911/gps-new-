'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import './cruise.css';
import loading from '../assets/loading.gif';
import cruiseCacheManager from '../lib/cache/CruiseCacheManager';
import { useIsEn } from '../hooks/useLang';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

import { useCruiseDevices } from './hooks/useCruiseDevices';
import { useCruiseRouteLoader } from './hooks/useCruiseRouteLoader';
import { useCruiseTimeline } from './hooks/useCruiseTimeline';
import { useCruiseAddress } from './hooks/useCruiseAddress';
import { useCruisePlayback } from './hooks/useCruisePlayback';
import { useCruiseLeafletMap } from './hooks/useCruiseLeafletMap';

import CruiseSidebar from './components/CruiseSidebar';
import CruiseInfoPanel from './components/CruiseInfoPanel';
import CruiseStatsModal from './components/CruiseStatsModal';
import CruiseBottomNav from './components/CruiseBottomNav';

const locales = { vi, en };

export default function CruisePage() {
    const isEn = useIsEn();
    const t = isEn ? locales.en.cruise : locales.vi.cruise;

    const [activeTab, setActiveTab] = useState('route');
    const [statsOpen, setStatsOpen] = useState(false);
    const [navOpen, setNavOpen] = useState(true);

    const mapRef = useRef(null);
    const movingMarkerRef = useRef(null);
    const highlightDotRef = useRef(null);
    const openInfoPopupRef = useRef(null);
    const addressRefHelper = { current: null };

    const devicesHook = useCruiseDevices(t);

    const routeLoaderHook = useCruiseRouteLoader({
        selectedDeviceId: devicesHook.selectedDeviceId,
        selectedImei: devicesHook.selectedImei,
        start: devicesHook.start,
        end: devicesHook.end,
        deviceList: devicesHook.deviceList,
        isEn,
        t,
        ensureAddress: (lat, lon) => addressRefHelper.current?.(lat, lon),
    });

    const timelineHook = useCruiseTimeline(
        routeLoaderHook.rawRouteData,
        routeLoaderHook.totalKm,
    );

    const playbackHook = useCruisePlayback({
        rawRouteData: routeLoaderHook.rawRouteData,
        mapRouteData: routeLoaderHook.mapRouteData,
        mapToRawIndexRef: routeLoaderHook.mapToRawIndexRef,
        snappedPolyline: routeLoaderHook.snappedPolyline,
        snapToRoad: routeLoaderHook.snapToRoad,
        mapRef,
        movingMarkerRef,
        highlightDotRef,
        openInfoPopup: (p, anchor) => openInfoPopupRef.current?.(p, anchor),
    });

    const leafletMapHook = useCruiseLeafletMap({
        externalMapRef: mapRef,
        externalMovingMarkerRef: movingMarkerRef,
        externalHighlightDotRef: highlightDotRef,
        mapRouteData: routeLoaderHook.mapRouteData,
        playbackRoute: playbackHook.playbackRoute,
        snapToRoad: routeLoaderHook.snapToRoad,
        activeIndexRef: playbackHook.activeIndexRef,
        setActiveIndex: playbackHook.setActiveIndex,
        setSliderValue: playbackHook.setSliderValue,
        segMRef: playbackHook.segMRef,
        cumMRef: playbackHook.cumMRef,
        totalMRef: playbackHook.totalMRef,
        pendingPlayIdxRef: playbackHook.pendingPlayIdxRef,
        traveledMRef: playbackHook.traveledMRef,
        lastBearingRef: playbackHook.lastBearingRef,
        applyMovingMarkerPose: playbackHook.applyMovingMarkerPose,
        getRouteBearing: playbackHook.getRouteBearing,
        getPlayIndexForRaw: playbackHook.getPlayIndexForRaw,
        stopPlaying: playbackHook.stopPlaying,
        onPointClick: playbackHook.handlePointClickRaw,
    });

    const addressHook = useCruiseAddress({
        activeIndex: playbackHook.activeIndex,
        rawRouteData: routeLoaderHook.rawRouteData,
        isEn,
        LMap: leafletMapHook.LMap,
        mapRef,
        isPlayingRef: playbackHook.isPlayingRef,
    });

    addressRefHelper.current = addressHook.ensureAddress;
    openInfoPopupRef.current = addressHook.openInfoPopup;

    useEffect(() => {
        cruiseCacheManager.cleanupOldCache().catch((e) => console.error('Cache cleanup error:', e));
    }, []);

    const currentPoint = routeLoaderHook.rawRouteData?.[playbackHook.activeIndex] || null;

    return (
        <div className="iky-cruise">
            <CruiseSidebar
                t={t}
                isEn={isEn}
                deviceList={devicesHook.deviceList}
                selectedDeviceId={devicesHook.selectedDeviceId}
                setSelectedDeviceId={devicesHook.setSelectedDeviceId}
                setSelectedImei={devicesHook.setSelectedImei}
                deviceOptions={devicesHook.deviceOptions}
                loadingDevices={devicesHook.loadingDevices}
                setDeviceSearchText={devicesHook.setDeviceSearchText}
                handlePresetRange={devicesHook.handlePresetRange}
                start={devicesHook.start}
                setStart={devicesHook.setStart}
                end={devicesHook.end}
                setEnd={devicesHook.setEnd}
                handleLoadRoute={routeLoaderHook.handleLoadRoute}
                loadingRoute={routeLoaderHook.loadingRoute}
                error={routeLoaderHook.error}
                rawRouteData={routeLoaderHook.rawRouteData}
                stats={timelineHook.stats}
                segments={timelineHook.segments}
                ensureAddress={addressHook.ensureAddress}
                activeIndex={playbackHook.activeIndex}
                totalKm={routeLoaderHook.totalKm}
                handleStart={playbackHook.handleStart}
                handlePause={playbackHook.handlePause}
                handleReset={playbackHook.handleReset}
                isPlaying={playbackHook.isPlaying}
                playbackRoute={playbackHook.playbackRoute}
                followMode={playbackHook.followMode}
                setFollowMode={playbackHook.setFollowMode}
                snapToRoad={routeLoaderHook.snapToRoad}
                setSnapToRoad={routeLoaderHook.setSnapToRoad}
                isSnappingRoad={routeLoaderHook.isSnappingRoad}
                playbackRate={playbackHook.playbackRate}
                setPlaybackRate={playbackHook.setPlaybackRate}
                sliderValue={playbackHook.sliderValue}
                handleSliderChange={playbackHook.handleSliderChange}
                commitSlider={playbackHook.commitSlider}
                vlistRef={playbackHook.vlistRef}
                handlePointClickRaw={playbackHook.handlePointClickRaw}
            />

            <div className="iky-cruise__map">
                <div id="iky-cruise-map" className="iky-cruise__map-inner" />

                <CruiseInfoPanel
                    currentPoint={currentPoint}
                    currentAddr={addressHook.currentAddr}
                    currentAddrKeyRef={addressHook.currentAddrKeyRef}
                    isEn={isEn}
                />

                <CruiseBottomNav
                    navOpen={navOpen}
                    setNavOpen={setNavOpen}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    setStatsOpen={setStatsOpen}
                    isEn={isEn}
                    routeTimeline={timelineHook.routeTimeline}
                    segments={timelineHook.segments}
                    rawRouteData={routeLoaderHook.rawRouteData}
                    goToRawIndex={playbackHook.handlePointClickRaw}
                    ensureAddress={addressHook.ensureAddress}
                />

                <CruiseStatsModal
                    statsOpen={statsOpen}
                    setStatsOpen={setStatsOpen}
                    stats={timelineHook.stats}
                    isEn={isEn}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    goToRawIndex={playbackHook.handlePointClickRaw}
                />

                {routeLoaderHook.loadingRoute && (
                    <div className="iky-cruise__map-overlay">
                        <Image
                            width={600}
                            height={600}
                            src={typeof loading === 'string' ? loading : loading.src}
                            alt="Loading route"
                            className="iky-cruise__loading-gif"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
