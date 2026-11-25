'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import './MonitorPage.css';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useIsEn } from './hooks/useLang';
import { useAuthStore } from './stores/authStore';
import { toLocalDateTimeInput } from './util/time';
import { isMqttAlive } from './monitor/util/monitorHelpers';

import { useMonitorDevices } from './monitor/hooks/useMonitorDevices';
import { useMonitorLeafletMap } from './monitor/hooks/useMonitorLeafletMap';
import { useMonitorTelemetry } from './monitor/hooks/useMonitorTelemetry';
import { useMonitorControl } from './monitor/hooks/useMonitorControl';

import MonitorSidebar from './monitor/components/MonitorSidebar';
import MonitorPopup from './monitor/components/MonitorPopup';

import vi from './locales/vi.json';
import en from './locales/en.json';

const locales = { vi, en };

const MqttConnector = dynamic(() => import('./components/MqttConnector'), {
    ssr: false,
    loading: () => null,
});

const MonitorPage = () => {
    const router = useRouter();
    const isEn = useIsEn();
    const t = isEn ? locales.en.monitor : locales.vi.monitor;

    const token = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('accessToken') || '';
    }, []);

    const user = useAuthStore((s) => s.user);
    const [localRole, setLocalRole] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setLocalRole(localStorage.getItem('role') || '');
    }, []);

    const role = user?.position || user?.role || localRole;
    const lastMqttAtRef = useRef(0);

    const [leftTab, setLeftTab] = useState('monitor');
    const [detailTab, setDetailTab] = useState('status');

    const [historyDeviceId, setHistoryDeviceId] = useState('');
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');
    const [historyMessage, setHistoryMessage] = useState('');
    const [historyMessageType, setHistoryMessageType] = useState('');

    const openPopupRef = useRef(null);
    const resetTelemetryRef = useRef(null);

    const devicesHook = useMonitorDevices({
        token,
        onOpenPopup: () => openPopupRef.current?.(),
        onDeviceSelectReset: (device) => {
            resetTelemetryRef.current?.(device);
        },
    });

    const mapHook = useMonitorLeafletMap({ lat: 10.7542506, lng: 106.6170202 });
    openPopupRef.current = () => mapHook.setShowPopup(true);

    useEffect(() => {
        if (devicesHook.selectedDevice) {
            mapHook.setShowPopup(true);
        }
    }, [devicesHook.selectedDevice, mapHook.setShowPopup]);

    const telemetryHook = useMonitorTelemetry({
        token,
        selectedDevice: devicesHook.selectedDevice,
        LMap: mapHook.LMap,
        mapRef: mapHook.mapRef,
        markerRef: mapHook.markerRef,
        updatePopupPosition: mapHook.updatePopupPosition,
        makeIconRef: mapHook.makeIconRef,
        isMobileNowRef: mapHook.isMobileNowRef,
        currentMarkerAssetRef: mapHook.currentMarkerAssetRef,
        currentHeadingRef: mapHook.currentHeadingRef,
        isEn,
        t,
        lastMqttAtRef,
    });

    resetTelemetryRef.current = (device) => {
        telemetryHook.resetTelemetry(device);
        mapHook.setShowPopup(true);
    };

    const controlHook = useMonitorControl({
        selectedDevice: devicesHook.selectedDevice,
        liveTelemetry: telemetryHook.liveTelemetry,
        lastCruise: telemetryHook.lastCruise,
        batteryStatus: telemetryHook.batteryStatus,
        lastMqttAtRef,
        t,
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!devicesHook.deviceList.length) return;

        if (!historyDeviceId && devicesHook.deviceList[0]) {
            setHistoryDeviceId(devicesHook.deviceList[0]._id);
        }

        if (!historyStart || !historyEnd) {
            const now = new Date();
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 0, 0);
            setHistoryStart(toLocalDateTimeInput(start));
            setHistoryEnd(toLocalDateTimeInput(end));
        }
    }, [devicesHook.deviceList, historyDeviceId, historyStart, historyEnd]);

    const handleSaveHistoryFilter = () => {
        setHistoryMessage('');
        setHistoryMessageType('');

        if (!historyDeviceId || !historyStart || !historyEnd) {
            setHistoryMessage(t.history.errorMissing);
            setHistoryMessageType('error');
            return;
        }

        const startDate = new Date(historyStart);
        const endDate = new Date(historyEnd);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            setHistoryMessage(t.history.errorInvalidDate);
            setHistoryMessageType('error');
            return;
        }

        if (endDate < startDate) {
            setHistoryMessage(t.history.errorEndBeforeStart);
            setHistoryMessageType('error');
            return;
        }

        const filter = {
            deviceId: historyDeviceId,
            imei: devicesHook.deviceList.find((d) => d._id === historyDeviceId)?.imei || '',
            start: historyStart,
            end: historyEnd,
        };

        try {
            localStorage.setItem('iky_cruise_filter', JSON.stringify(filter));
            router.push('/cruise');
            setHistoryMessage(t.history.saveSuccess);
            setHistoryMessageType('success');
        } catch {
            setHistoryMessage(t.history.saveFailed);
            setHistoryMessageType('error');
        }
    };

    const sosVal = isMqttAlive(lastMqttAtRef) ? telemetryHook.liveTelemetry?.sos : telemetryHook.lastCruise?.sos;
    const isLocked = sosVal === 1 || sosVal === '1';
    const deviceStatusText = isLocked ? t.control.statusActivated : t.control.statusNotActivated;
    const deviceStatusClass = isLocked ? 'iky-monitor__tag-red' : 'iky-monitor__tag-green';

    const loadingBattery = telemetryHook.batteryQuery.isFetching;
    const loadingDeviceInfo = telemetryHook.deviceInfoQuery.isFetching;
    const loadingCruise = telemetryHook.lastCruiseQuery.isFetching;
    const isRefreshing = loadingDeviceInfo || loadingCruise || loadingBattery || telemetryHook.loadingAddress;
    const isStatusLoading = !devicesHook.selectedDevice || loadingDeviceInfo || loadingCruise;
    const isBatteryLoading = !devicesHook.selectedDevice || loadingBattery;

    return (
        <>
            <MqttConnector
                imei={devicesHook.selectedDevice?.imei}
                onMessage={telemetryHook.handleMqttMessage}
                onClientReady={(client) => { controlHook.mqttClientRef.current = client; }}
            />

            <div className="iky-monitor">
                <MonitorSidebar
                    t={t} isEn={isEn} leftTab={leftTab} setLeftTab={setLeftTab}
                    searchText={devicesHook.searchText} setSearchText={devicesHook.setSearchText}
                    statusFilter={devicesHook.statusFilter} setStatusFilter={devicesHook.setStatusFilter}
                    filteredDevices={devicesHook.filteredDevices} loadingDevices={devicesHook.loadingDevices}
                    selectedDevice={devicesHook.selectedDevice} socByImei={telemetryHook.socByImei}
                    handleSelectDevice={(d) => { devicesHook.handleSelectDevice(d); mapHook.setShowPopup(true); }}
                    listContainerRef={devicesHook.listContainerRef}
                    historyDeviceId={historyDeviceId} setHistoryDeviceId={setHistoryDeviceId}
                    historyStart={historyStart} setHistoryStart={setHistoryStart}
                    historyEnd={historyEnd} setHistoryEnd={setHistoryEnd}
                    handleSaveHistoryFilter={handleSaveHistoryFilter}
                    historyMessage={historyMessage} historyMessageType={historyMessageType}
                    deviceList={devicesHook.deviceList}
                />

                <section className="iky-monitor__center">
                    <div className="iky-monitor__map">
                        <div id="iky-map" className="iky-monitor__map-inner" />

                        {mapHook.showPopup && (
                            <MonitorPopup
                                popupWrapperRef={mapHook.popupWrapperRef}
                                detailTab={detailTab} setDetailTab={setDetailTab}
                                role={role} t={t} isRefreshing={isRefreshing}
                                isStatusLoading={isStatusLoading} selectedDevice={devicesHook.selectedDevice}
                                deviceInfo={telemetryHook.deviceInfo} liveTelemetry={telemetryHook.liveTelemetry}
                                lastCruise={telemetryHook.lastCruise} batteryStatus={telemetryHook.batteryStatus}
                                lastMqttAtRef={lastMqttAtRef} isEn={isEn} address={telemetryHook.address}
                                deprecatedAddress={telemetryHook.deprecatedAddress}
                                loadingAddress={telemetryHook.loadingAddress}
                                addressError={telemetryHook.addressError} cruiseError={telemetryHook.cruiseError}
                                isConnected={controlHook.isConnected} deviceStatusClass={deviceStatusClass}
                                isLocked={isLocked} deviceStatusText={deviceStatusText}
                                handleConfirmLock={controlHook.handleConfirmLock}
                                handleConfirmUnlock={controlHook.handleConfirmUnlock}
                                lockLoading={controlHook.lockLoading} pendingAction={controlHook.pendingAction}
                                lockError={controlHook.lockError} isBatteryLoading={isBatteryLoading}
                            />
                        )}
                    </div>
                </section>
            </div>
        </>
    );
};

export default MonitorPage;
