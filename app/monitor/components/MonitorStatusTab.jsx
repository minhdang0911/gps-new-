'use client';

import React from 'react';
import { formatFixedDateTime, parseTimToDate } from '../../util/time';
import { toNumberOrNull } from '../../util/number';
import { isDatBikeDevice, getDatBikeStateInfo } from '../../util/cruiseUtils';
import { pickField, pickAcc, pickSpeed, pickBikeState, getDriverName } from '../util/monitorHelpers';

export default function MonitorStatusTab({
    selectedDevice,
    deviceInfo,
    liveTelemetry,
    lastCruise,
    batteryStatus,
    lastMqttAtRef,
    isEn,
    t,
    address,
    deprecatedAddress,
    loadingAddress,
    addressError,
    cruiseError,
}) {
    const NA_TEXT = isEn ? 'N/A' : 'Chưa rõ';
    if (!selectedDevice) return <>{t.statusInfo.pleaseSelect}</>;

    const info = deviceInfo || selectedDevice;
    const ctx = { liveTelemetry, lastCruise, batteryStatus };

    const odo = pickField('mil', ctx, lastMqttAtRef);
    const distance = pickField('dst', ctx, lastMqttAtRef);

    const timVal = pickField('tim', ctx, lastMqttAtRef);
    const timeStr = timVal ? formatFixedDateTime(parseTimToDate(timVal)) : NA_TEXT;

    const fwr = pickField('fwr', ctx, lastMqttAtRef);

    const latVal = pickField('lat', ctx, lastMqttAtRef);
    const lonVal = pickField('lon', ctx, lastMqttAtRef);

    const accValNum = toNumberOrNull(pickAcc({ liveTelemetry, lastCruise }, lastMqttAtRef));
    const usedSpeed = toNumberOrNull(pickSpeed({ liveTelemetry, lastCruise }, lastMqttAtRef));

    const gpsValNum = toNumberOrNull(pickField('gps', ctx, lastMqttAtRef));

    const isDatBike = isDatBikeDevice(info);
    const bikeStateVal = pickBikeState({ liveTelemetry, lastCruise }, lastMqttAtRef);
    const datBikeState = (isDatBike || bikeStateVal != null) ? getDatBikeStateInfo(bikeStateVal, isEn) : null;

    let machineStatus;
    let vehicleStatus;

    if (datBikeState) {
        machineStatus = datBikeState.isEngineOn ? t.statusInfo.engineOn : t.statusInfo.engineOff;
        vehicleStatus = datBikeState.label;
    } else {
        const isEngineOff = accValNum === 1;
        machineStatus = isEngineOff ? t.statusInfo.engineOff : t.statusInfo.engineOn;

        vehicleStatus = t.statusInfo.vehicleStopped;
        if (isEngineOff) {
            vehicleStatus = t.statusInfo.vehicleParking;
        } else {
            if (usedSpeed != null && usedSpeed > 0) {
                vehicleStatus = t.statusInfo.vehicleRunning.replace('{speed}', String(usedSpeed));
            } else {
                vehicleStatus = t.statusInfo.vehicleStopped;
            }
        }
    }

    const unknownPlateText = (t.list && t.list.unknownPlate) || (isEn ? 'No plate number' : 'Chưa có biển số');
    const driverName = getDriverName(info);

    return (
        <>
            <div>
                {t.statusInfo.plate} {info.license_plate || unknownPlateText}
            </div>
            <div>
                {isEn ? 'Driver' : 'Lái xe'}: {driverName || NA_TEXT}
            </div>
            <div>
                {t.statusInfo.version} {fwr || NA_TEXT}
            </div>
            <div>
                {t.statusInfo.vehicleType} {info.vehicle_category_id?.name || NA_TEXT}
            </div>
            <div>
                {t.statusInfo.deviceType} {info.device_category_id?.name || NA_TEXT}
            </div>
            <div>
                {t.statusInfo.atTime} {timeStr}
            </div>
            <div>
                {t.statusInfo.engineStatus} {machineStatus}
            </div>
            <div>
                {t.statusInfo.vehicleStatus} {vehicleStatus}
            </div>

            {(isDatBike || (usedSpeed != null && usedSpeed > 0)) && (
                <div>
                    {t.statusInfo.speed} {usedSpeed != null ? usedSpeed : 0} km/h
                </div>
            )}

            {distance != null && (
                <div>
                    {t.statusInfo.distance} {distance} km
                </div>
            )}

            <div>ODO: {odo ?? 0} km</div>

            <div className="iky-monitor__location-row">
                <span className="iky-monitor__location-label">{t.statusInfo.location}</span>
                <span className="iky-monitor__location-text">
                    {address
                        ? address
                        : loadingAddress
                          ? isEn
                              ? 'Resolving address...'
                              : 'Đang xác định vị trí...'
                          : addressError
                            ? addressError
                            : (isEn ? 'No location data' : 'Chưa có dữ liệu vị trí')}
                </span>
            </div>

            {deprecatedAddress && (
                <div className="iky-monitor__location-row">
                    <span className="iky-monitor__location-label">
                        {isEn ? 'Former address:' : 'Vị trí trước sáp nhập:'}
                    </span>
                    <span className="iky-monitor__location-text">{deprecatedAddress}</span>
                </div>
            )}

            <div>
                {t.statusInfo.coordinate}{' '}
                {latVal != null && lonVal != null ? (
                    <span>
                        {`${latVal}, ${lonVal}`}{' '}
                        {gpsValNum === 1 && <span style={{ color: 'red', fontWeight: 600 }}>(*)</span>}
                    </span>
                ) : (
                    NA_TEXT
                )}
            </div>

            {cruiseError && (
                <div className="iky-monitor__alert iky-monitor__alert--info" style={{ marginTop: 8 }}>
                    {cruiseError}
                </div>
            )}
        </>
    );
}
