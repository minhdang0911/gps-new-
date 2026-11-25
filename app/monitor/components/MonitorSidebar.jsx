'use client';

import React from 'react';
import DeviceListItem from './DeviceListItem';
import { getDriverName } from '../util/monitorHelpers';

export default function MonitorSidebar({
    t,
    isEn,
    leftTab,
    setLeftTab,
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    filteredDevices,
    loadingDevices,
    selectedDevice,
    socByImei,
    handleSelectDevice,
    listContainerRef,
    historyDeviceId,
    setHistoryDeviceId,
    historyStart,
    setHistoryStart,
    historyEnd,
    setHistoryEnd,
    handleSaveHistoryFilter,
    historyMessage,
    historyMessageType,
    deviceList,
}) {
    return (
        <aside className="iky-monitor__left">
            <div
                className={
                    'iky-monitor__left-card' + (leftTab === 'monitor' ? ' iky-monitor__left-card--full' : '')
                }
            >
                <div className="iky-monitor__left-tabs">
                    <button
                        className={
                            'iky-monitor__left-tab' +
                            (leftTab === 'monitor' ? ' iky-monitor__left-tab--active' : '')
                        }
                        onClick={() => setLeftTab('monitor')}
                    >
                        {t.tabs.monitor}
                    </button>
                    <button
                        className={
                            'iky-monitor__left-tab' +
                            (leftTab === 'history' ? ' iky-monitor__left-tab--active' : '')
                        }
                        onClick={() => setLeftTab('history')}
                    >
                        {t.tabs.history}
                    </button>
                </div>

                {leftTab === 'monitor' && (
                    <div className="iky-monitor__left-body">
                        <div className="iky-monitor__left-section">
                            <div className="iky-monitor__left-label">{t.filter.searchLabel}</div>
                            <input
                                className="iky-monitor__input"
                                placeholder={t.filter.searchPlaceholder}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>

                        <div className="iky-monitor__left-section">
                            <div className="iky-monitor__left-label">{t.filter.statusLabel}</div>
                            <select
                                className="iky-monitor__select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">{t.filter.statusAll}</option>
                                <option value="online">{t.filter.statusOnline}</option>
                                <option value="offline">{t.filter.statusOffline}</option>
                            </select>
                        </div>

                        <div className="iky-monitor__left-section iky-monitor__left-section--list">
                            <div className="iky-monitor__left-label">
                                {t.list.label}{' '}
                                <span className="iky-monitor__count">({filteredDevices.length})</span>
                            </div>

                            <div className="iky-monitor__device-list" ref={listContainerRef}>
                                {loadingDevices && <div className="iky-loading">{t.list.loading}</div>}

                                {!loadingDevices && filteredDevices.length === 0 && (
                                    <div className="iky-monitor__empty">{t.list.empty}</div>
                                )}

                                {!loadingDevices &&
                                    filteredDevices.map((d, idx) => (
                                        <DeviceListItem
                                            key={d._id}
                                            d={d}
                                            idx={idx}
                                            isActive={selectedDevice?._id === d._id}
                                            socForItem={socByImei[d.imei]}
                                            isEn={isEn}
                                            unknownPlateText={t.list.unknownPlate}
                                            phoneLabel={t.list.phoneLabel}
                                            onSelectDevice={handleSelectDevice}
                                            searchText={searchText}
                                        />
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {leftTab === 'history' && (
                    <div className="iky-monitor__left-body">
                        <div className="iky-monitor__left-section">
                            <div className="iky-monitor__left-label">{t.history.selectVehicleLabel}</div>
                            <select
                                className="iky-monitor__select"
                                value={historyDeviceId}
                                onChange={(e) => setHistoryDeviceId(e.target.value)}
                            >
                                <option value="">{t.history.selectVehiclePlaceholder}</option>
                                {deviceList.map((d, idx) => (
                                    <option key={d._id} value={d._id}>
                                        {idx + 1}. {(d.license_plate || d.imei || t.history.unknown).trim()}
                                        {getDriverName(d)
                                            ? ` - ${isEn ? 'Driver' : 'Tài xế'}: ${getDriverName(d)}`
                                            : ''}
                                        {d.phone_number ? ` - ${d.phone_number}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="iky-monitor__left-section">
                            <div className="iky-monitor__left-label">{t.history.fromLabel}</div>
                            <input
                                type="datetime-local"
                                className="iky-monitor__input"
                                value={historyStart}
                                onChange={(e) => setHistoryStart(e.target.value)}
                            />
                        </div>

                        <div className="iky-monitor__left-section">
                            <div className="iky-monitor__left-label">{t.history.toLabel}</div>
                            <input
                                type="datetime-local"
                                className="iky-monitor__input"
                                value={historyEnd}
                                onChange={(e) => setHistoryEnd(e.target.value)}
                            />
                        </div>

                        <button className="iky-monitor__primary-btn" onClick={handleSaveHistoryFilter}>
                            {t.history.saveButton}
                        </button>

                        {historyMessage && (
                            <div
                                className={
                                    'iky-monitor__alert ' +
                                    (historyMessageType === 'error'
                                        ? 'iky-monitor__alert--error'
                                        : 'iky-monitor__alert--success')
                                }
                            >
                                {historyMessage}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
