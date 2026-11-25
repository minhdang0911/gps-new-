'use client';

import React from 'react';
import { Skeleton } from 'antd';
import MonitorStatusTab from './MonitorStatusTab';
import MonitorControlTab from './MonitorControlTab';
import MonitorBatteryTab from './MonitorBatteryTab';

export default function MonitorPopup({
    popupWrapperRef,
    detailTab,
    setDetailTab,
    role,
    t,
    isRefreshing,
    isStatusLoading,
    selectedDevice,
    deviceInfo,
    liveTelemetry,
    lastCruise,
    batteryStatus,
    lastMqttAtRef,
    isEn,
    address,
    deprecatedAddress,
    loadingAddress,
    addressError,
    cruiseError,
    isConnected,
    deviceStatusClass,
    isLocked,
    deviceStatusText,
    handleConfirmLock,
    handleConfirmUnlock,
    lockLoading,
    pendingAction,
    lockError,
    isBatteryLoading,
}) {
    return (
        <div ref={popupWrapperRef} className="iky-monitor__popup-wrapper">
            <div className="iky-monitor__popup">
                <div className="iky-monitor__popup-tabs">
                    <button
                        className={'iky-monitor__popup-tab' + (detailTab === 'status' ? ' iky-monitor__popup-tab--active' : '')}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDetailTab('status');
                        }}
                    >
                        {t.tabsDetail.status}
                    </button>

                    {role !== 'reporter' && (
                        <button
                            className={'iky-monitor__popup-tab' + (detailTab === 'control' ? ' iky-monitor__popup-tab--active' : '')}
                            onClick={(e) => {
                                e.stopPropagation();
                                setDetailTab('control');
                            }}
                        >
                            {t.tabsDetail.control}
                        </button>
                    )}

                    <button
                        className={'iky-monitor__popup-tab' + (detailTab === 'battery' ? ' iky-monitor__popup-tab--active' : '')}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDetailTab('battery');
                        }}
                    >
                        {t.tabsDetail.battery}
                    </button>
                </div>

                {isRefreshing && <div className="iky-monitor__refreshing-bar" />}

                <div className="iky-monitor__popup-body">
                    {detailTab === 'status' && (
                        <div className="iky-monitor__popup-col">
                            {isStatusLoading ? (
                                <Skeleton active paragraph={{ rows: 8 }} />
                            ) : (
                                <MonitorStatusTab
                                    selectedDevice={selectedDevice}
                                    deviceInfo={deviceInfo}
                                    liveTelemetry={liveTelemetry}
                                    lastCruise={lastCruise}
                                    batteryStatus={batteryStatus}
                                    lastMqttAtRef={lastMqttAtRef}
                                    isEn={isEn}
                                    t={t}
                                    address={address}
                                    deprecatedAddress={deprecatedAddress}
                                    loadingAddress={loadingAddress}
                                    addressError={addressError}
                                    cruiseError={cruiseError}
                                />
                            )}
                        </div>
                    )}

                    {detailTab === 'control' && (
                        <MonitorControlTab
                            t={t}
                            isConnected={isConnected}
                            deviceStatusClass={deviceStatusClass}
                            isLocked={isLocked}
                            deviceStatusText={deviceStatusText}
                            handleConfirmLock={handleConfirmLock}
                            handleConfirmUnlock={handleConfirmUnlock}
                            lockLoading={lockLoading}
                            pendingAction={pendingAction}
                            lockError={lockError}
                        />
                    )}

                    {detailTab === 'battery' && (
                        <div className="iky-monitor__popup-col">
                            {isBatteryLoading ? (
                                <Skeleton active paragraph={{ rows: 7 }} />
                            ) : (
                                <MonitorBatteryTab
                                    liveTelemetry={liveTelemetry}
                                    batteryStatus={batteryStatus}
                                    lastCruise={lastCruise}
                                    selectedDevice={selectedDevice}
                                    isEn={isEn}
                                    t={t}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
